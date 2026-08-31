import fs from 'fs';
import path from 'path';

export interface LogRotationConfig {
  backupDir?: string;
  maxAgeDays?: number;      // Default: 30 days
  maxFileCount?: number;    // Default: 50 files
}

export class BackupLogRotationManager {
  private backupDir: string;
  private maxAgeDays: number;
  private maxFileCount: number;

  constructor(config: LogRotationConfig = {}) {
    this.backupDir = config.backupDir || path.join(process.cwd(), 'backups');
    this.maxAgeDays = config.maxAgeDays || 30;
    this.maxFileCount = config.maxFileCount || 50;
  }

  /**
   * Scans the backup directory, purges files older than maxAgeDays,
   * and caps total files to maxFileCount.
   */
  public runRotation(): { purgedCount: number; remainingCount: number; freedBytes: number } {
    if (!fs.existsSync(this.backupDir)) {
      return { purgedCount: 0, remainingCount: 0, freedBytes: 0 };
    }

    const now = Date.now();
    const maxAgeMs = this.maxAgeDays * 24 * 60 * 60 * 1000;
    let purgedCount = 0;
    let freedBytes = 0;

    const files = fs.readdirSync(this.backupDir)
      .filter((file) => file.startsWith('ledger_db_backup_') || file.endsWith('.json') || file.endsWith('.sqlite'))
      .map((file) => {
        const filePath = path.join(this.backupDir, file);
        const stats = fs.statSync(filePath);
        return { file, filePath, mtimeMs: stats.mtimeMs, size: stats.size };
      })
      .sort((a, b) => b.mtimeMs - a.mtimeMs); // Newest first

    // 1. Purge files exceeding maxAgeDays
    const remainingAfterAge: typeof files = [];
    for (const item of files) {
      if (now - item.mtimeMs > maxAgeMs) {
        try {
          fs.unlinkSync(item.filePath);
          purgedCount++;
          freedBytes += item.size;
          console.log(`[🧹 BackupRotation] Purged expired backup (${this.maxAgeDays}+ days old): ${item.file}`);
        } catch (err) {
          console.warn(`[⚠️ BackupRotation] Failed to unlink ${item.file}:`, err);
        }
      } else {
        remainingAfterAge.push(item);
      }
    }

    // 2. Enforce max count limit (prune oldest if exceeding limit)
    while (remainingAfterAge.length > this.maxFileCount) {
      const oldest = remainingAfterAge.pop();
      if (oldest) {
        try {
          fs.unlinkSync(oldest.filePath);
          purgedCount++;
          freedBytes += oldest.size;
          console.log(`[🧹 BackupRotation] Purged oldest backup to enforce count cap (${this.maxFileCount}): ${oldest.file}`);
        } catch (err) {
          console.warn(`[⚠️ BackupRotation] Failed to unlink ${oldest.file}:`, err);
        }
      }
    }

    return {
      purgedCount,
      remainingCount: remainingAfterAge.length,
      freedBytes
    };
  }

  /**
   * Starts automatic background rotation schedule (e.g. daily)
   */
  public startScheduledRotation(intervalMs = 24 * 60 * 60 * 1000): NodeJS.Timeout {
    console.log(`[🧹 BackupRotation] Scheduled backup log rotation active (every ${intervalMs / 3600000}h).`);
    return setInterval(() => {
      this.runRotation();
    }, intervalMs);
  }
}

export const backupLogRotator = new BackupLogRotationManager();
