import sqlite3Mock from './sqlite3-mock';

function getSqliteDbClass(): any {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const sqlite3 = require('sqlite3');
    if (sqlite3?.Database) {
      return sqlite3.Database;
    }
  } catch (_e) {
    // Native sqlite3 unavailable or GLIBC version mismatch
  }
  return sqlite3Mock.Database;
}

export async function pruneWebhookDeduplicationCache(dbPath: string): Promise<number> {
  return new Promise((resolve, reject) => {
    const DbClass = getSqliteDbClass();
    if (!DbClass) {
      console.warn('[DEDUP-PRUNER] sqlite3 Database class unavailable.');
      return resolve(0);
    }
    // Open the persistent database safely on your Render /data volume
    const db = new DbClass(dbPath);

    db.serialize(() => {
      // Ensure table exists so pruning executes smoothly
      db.run(`CREATE TABLE IF NOT EXISTS wise_processed_events (
        event_id TEXT PRIMARY KEY,
        event_type TEXT,
        received_at TEXT NOT NULL DEFAULT (datetime('now'))
      );`);

      // Begin an isolated transaction block
      db.run('BEGIN TRANSACTION;');

      // Delete only the tracking tokens older than 30 days
      db.run(
        `DELETE FROM wise_processed_events 
         WHERE received_at < datetime('now', '-30 days');`,
        function (this: any, err: Error | null) {
          if (err) {
            db.run('ROLLBACK;');
            db.close();
            return reject(err);
          }

          const rowsDeleted = this.changes || 0;
          db.run('COMMIT;', (commitErr: Error | null) => {
            db.close();
            if (commitErr) return reject(commitErr);
            resolve(rowsDeleted);
          });
        }
      );
    });
  });
}
