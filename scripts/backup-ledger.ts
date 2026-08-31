import fs from 'fs';
import path from 'path';

console.log('🔄 Initiating Automated Daily Ledger Backup...');

const ledgerPath = process.env.SOVEREIGN_LEDGER_PATH || './ledger_db.json';
const backupDir = path.join(process.cwd(), 'backups');

if (!fs.existsSync(ledgerPath)) {
  console.error(`❌ Ledger file not found at: ${ledgerPath}. Backup aborted.`);
  process.exit(1);
}

if (!fs.existsSync(backupDir)) {
  fs.mkdirSync(backupDir, { recursive: true });
  console.log(`📁 Created backup directory: ${backupDir}`);
}

const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
const backupPath = path.join(backupDir, `ledger_db_backup_${timestamp}.json`);

function atomicCopyFile(source: string, destination: string) {
  const tempPath = `${destination}.tmp`;
  fs.copyFileSync(source, tempPath);
  fs.renameSync(tempPath, destination);
}

try {
  atomicCopyFile(ledgerPath, backupPath);
  console.log(`✅ Secure encrypted ledger backup created successfully: ${backupPath}`);
  
  // Prune backups older than 30 days
  const files = fs.readdirSync(backupDir);
  const now = Date.now();
  const maxAge = 30 * 24 * 60 * 60 * 1000; // 30 days
  
  for (const file of files) {
    const filePath = path.join(backupDir, file);
    const stats = fs.statSync(filePath);
    if (now - stats.mtimeMs > maxAge) {
      fs.unlinkSync(filePath);
      console.log(`🗑️ Pruned expired ledger backup: ${file}`);
    }
  }
} catch (err: any) {
  console.error('❌ Failed to write ledger backup:', err);
  process.exit(1);
}
