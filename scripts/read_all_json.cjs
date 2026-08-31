const fs = require('fs');

const files = [
  'ledger/data_ledger.json',
  'consolidated_database/data_ledger_production.json',
  'consolidated_database/data_ledger_coinbase.json',
  'consolidated_database/data_ledger_github_repo.json',
  'consolidated_database/ledger_db_production.json',
  'consolidated_database/ledger_db_github_repo.json',
  'ledger_db.json'
];

files.forEach((f) => {
  if (fs.existsSync(f)) {
    try {
      const content = fs.readFileSync(f, 'utf8');
      const data = JSON.parse(content);
      console.log(`\n=== File: ${f} ===`);
      if (data.clearedUSD !== undefined) {
        console.log(`clearedUSD: ${data.clearedUSD}`);
        console.log(`status: ${data.status}`);
        console.log(`lastUpdated: ${data.lastUpdated}`);
      }
      if (data.entries) {
        console.log(`Entries count: ${data.entries.length}`);
      }
      if (data.mutationHistory) {
        console.log(`Mutation history count: ${data.mutationHistory.length}`);
      }
    } catch (e) {
      // ignore
    }
  }
});
