import path from 'path';
import sqlite3Mock from '../src/lib/sqlite3-mock';

function loadSqlite(): any {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const nativeSqlite = require('sqlite3');
    if (nativeSqlite?.Database) {
      return nativeSqlite;
    }
  } catch (_e) {
    // Native sqlite3 unavailable
  }
  return sqlite3Mock;
}

const sqlite3 = loadSqlite();

const dbPath = path.resolve('sovereigns_interbank_vault.db');
console.log('Opening database:', dbPath);

const db = new sqlite3.Database(dbPath, sqlite3.OPEN_READONLY, (err) => {
  if (err) {
    console.error('Failed to open database:', err.message);
    return;
  }
  
  db.all("SELECT name FROM sqlite_master WHERE type='table'", [], (err, tables: any[]) => {
    if (err) {
      console.error('Failed to query tables:', err.message);
      return;
    }
    
    console.log('Tables in database:', tables.map(t => t.name));
    
    tables.forEach((table) => {
      db.all(`SELECT * FROM ${table.name}`, [], (err, rows) => {
        if (err) {
          console.error(`Failed to query table ${table.name}:`, err.message);
          return;
        }
        console.log(`\n--- Rows in ${table.name} (${rows.length} total) ---`);
        console.log(JSON.stringify(rows.slice(0, 100), null, 2));
      });
    });
  });
});
