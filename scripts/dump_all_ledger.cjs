const fs = require('fs');
const content = fs.readFileSync('ledger/data_ledger.json', 'utf8');
const parsed = JSON.parse(content);
console.log(JSON.stringify(parsed.entries, null, 2));
