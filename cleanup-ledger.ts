import { db } from './src/db/ledger.js';

console.log('\n🧹 Cleaning up corrupt transactions...\n');

try {
  // Get all transactions
  const allTxs = db.getAllTransactions();
  console.log(`Total transactions: ${allTxs.length}`);

  // Find corrupt ones (ledger-deposit-* transactions)
  const corruptIds = allTxs
    .filter((tx: any) => tx.id && typeof tx.id === 'string' && tx.id.startsWith('ledger-deposit-'))
    .map((tx: any) => tx.id);

  console.log(`Corrupt transactions found: ${corruptIds.length}`);
  corruptIds.forEach(id => console.log(`  - ${id}`));

  // Delete them
  if (corruptIds.length > 0) {
    corruptIds.forEach(id => {
      db.execute(`DELETE FROM transactions WHERE id = ?`, [id]);
    });
    console.log(`\n✓ Deleted ${corruptIds.length} corrupt transactions\n`);
  }

  // Verify integrity
  console.log('Checking integrity after cleanup...');
  const integrity = db.checkLedgerIntegrity();
  console.log(`  Errors: ${integrity.errors.length}`);
  console.log(`  Warnings: ${integrity.warnings.length}`);
  
  if (integrity.errors.length === 0 && integrity.warnings.length === 0) {
    console.log('\n✅ Ledger is now clean and ready!\n');
  } else {
    console.log('\n⚠️  Some issues remain:\n');
    integrity.errors.slice(0, 5).forEach((e: any) => {
      console.log(`  ERROR: ${e.code} - ${e.message}`);
    });
  }

} catch (err: any) {
  console.error('Error:', err.message);
}
