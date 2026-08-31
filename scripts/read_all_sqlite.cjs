const sqlite3 = require('sqlite3');
const fs = require('fs');

const dbs = [
  'sovereigns_interbank_vault.db',
  'sovereigns-banking-hub/backend/sovereigns_interbank_vault.db'
];

dbs.forEach((dbPath) => {
  if (!fs.existsSync(dbPath)) {
    console.log(`${dbPath} does not exist`);
    return;
  }
  console.log(`\n=== Opening database: ${dbPath} ===`);
  const db = new sqlite3.Database(dbPath, sqlite3.OPEN_READONLY, (err) => {
    if (err) {
      console.error('Failed to open database:', err.message);
      return;
    }
    
    db.all("SELECT name FROM sqlite_master WHERE type='table'", [], (err, tables) => {
      if (err) {
        console.error('Failed to query tables:', err.message);
        return;
      }
      
      console.log('Tables:', tables.map(t => t.name));
      tables.forEach((table) => {
        db.all(`SELECT * FROM ${table.name}`, [], (err, rows) => {
          if (err) {
            console.error(`Failed to query table ${table.name}:`, err.message);
            return;
          }
          console.log(`Table ${table.name} has ${rows.length} rows.`);
          if (rows.length > 0) {
            console.log('First 3 rows:', JSON.stringify(rows.slice(0, 3), null, 2));
          }
        });
      });
    });
  });
});
