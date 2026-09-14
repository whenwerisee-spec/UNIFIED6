import { globalLedger } from '../ledger/accounting';

console.log('--- COINBASE DOUBLE-ENTRY LEDGER AUDIT VERIFICATION ---');
const integrity = globalLedger.verifyIntegrity();
console.log('Audit Timestamp:', new Date().toISOString());
console.log('Total Assets (USD):', `$${integrity.totalAssets.toLocaleString()}`);
console.log('Total Liabilities (USD):', `$${integrity.totalLiabilities.toLocaleString()}`);
console.log('Total Equity (USD):', `$${integrity.totalEquity.toLocaleString()}`);
console.log('Reserve Backing Ratio:', `${integrity.reserveRatioPercent}%`);
console.log('Unbalanced Journal Entries:', integrity.unbalancedEntries);
console.log('Status:', integrity.isBalanced ? 'PASS - LEDGER MATHEMATICALLY SOUND' : 'FAIL - RECONCILIATION ERROR');
