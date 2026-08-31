const fs = require('fs');
const content = fs.readFileSync('C:/Users/WINNNEER/.gemini/antigravity/brain/616f4b00-fb98-4aa7-a888-97390dde4740/scratch/data_ledger.json', 'utf8');
const data = JSON.parse(content);

console.log('Total mutations:', data.mutationHistory.length);
const activeMutations = data.mutationHistory.filter(m => m.amount !== 0 || m.type !== 'reconciliation');
console.log('Non-zero/non-reconciliation mutations count:', activeMutations.length);
console.log(JSON.stringify(activeMutations, null, 2));
