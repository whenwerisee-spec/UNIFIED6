const fs = require('fs');

const files = [
  'consolidated_database/ledger_db_production.json',
  'consolidated_database/ledger_db_github_repo.json'
];

files.forEach((f) => {
  try {
    const content = fs.readFileSync(f, 'utf8');
    const data = JSON.parse(content);
    console.log(`\n=== File: ${f} ===`);
    console.log(JSON.stringify(data.entries, null, 2));
  } catch (err) {
    console.error(`Error reading ${f}:`, err.message);
  }
});
