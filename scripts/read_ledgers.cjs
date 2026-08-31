const fs = require('fs');

const files = [
  'ledger_db.json',
  'ledger/data_ledger.json',
  'consolidated_database/data_ledger_production.json',
  'consolidated_database/data_ledger_coinbase.json',
  'consolidated_database/data_ledger_github_repo.json'
];

files.forEach((f) => {
  if (fs.existsSync(f)) {
    try {
      const content = fs.readFileSync(f, 'utf8');
      const parsed = JSON.parse(content);
      console.log(`\n--- Summary of ${f} ---`);
      if (Array.isArray(parsed)) {
        console.log(`It is an array with ${parsed.length} entries.`);
        console.log('First 3 entries:', JSON.stringify(parsed.slice(0, 3), null, 2));
      } else {
        console.log('Keys:', Object.keys(parsed));
        if (parsed.entries) {
          console.log(`Entries count: ${parsed.entries.length}`);
          console.log('First 3 entries:', JSON.stringify(parsed.entries.slice(0, 3), null, 2));
        } else {
          console.log('Content (first 500 chars):', JSON.stringify(parsed).slice(0, 500));
        }
      }
    } catch (e) {
      console.error(`Failed to read/parse ${f}:`, e.message);
    }
  } else {
    console.log(`${f} does not exist`);
  }
});
