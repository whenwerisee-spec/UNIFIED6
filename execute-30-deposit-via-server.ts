import { db } from './src/db/ledger.js';
import fetch from 'node-fetch';
import crypto from 'crypto';

async function execute30DepositViaServer() {
  console.log('\n╔═══════════════════════════════════════════════════════════╗');
  console.log('║          💸 EXECUTING $30 DEPOSIT VIA SERVER              ║');
  console.log('╚═══════════════════════════════════════════════════════════╝\n');

  const BASE_URL = 'http://localhost:3000';
  const EXISTING_USER_ID = 'user_mlaframboisemm'; // Use existing bootstrap user

  try {
    // Step 1: Create transaction in ledger
    console.log('📝 Step 1: Creating $30 ledger transaction...');
    const txId = 'ledger-deposit-' + Date.now();
    const now = Date.now();

    db.execute(`
      INSERT INTO transactions (id, user_id, type, asset_symbol, amount, fiat_amount, timestamp, details, hash, status, ledger_debit, ledger_credit, metadata, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      txId,
      EXISTING_USER_ID,
      'WISE_WITHDRAWAL',
      'USD',
      30.00,
      30.00,
      now,
      'Deposit $30 from ledger to Wise',
      crypto.randomUUID(),
      'pending',
      'ledger-main',
      'wise-account',
      JSON.stringify({ source: 'ledger', destination: 'wise' }),
      new Date().toISOString(),
      new Date().toISOString()
    ]);

    console.log(`  ✓ Transaction ID: ${txId}`);
    console.log(`  ✓ Amount: $30.00 USD`);
    console.log(`  ✓ User ID: ${EXISTING_USER_ID}`);
    console.log(`  ✓ Status: pending\n`);

    // Step 2: Wait for server to be ready
    console.log('⏳ Waiting for server to be ready...');
    await new Promise(resolve => setTimeout(resolve, 3000));
    console.log('  ✓ Server should be ready\n');

    // Step 3: Call withdrawal endpoint
    console.log('💸 Step 2: Calling withdrawal endpoint...');
    const payload = {
      bankRouting: '021000021',
      bankAccount: '9900000000',
      recipientName: 'Production Rail Test',
      currency: 'USD',
      address: {
        country: 'US',
        city: 'New York',
        postCode: '10001',
        firstLine: '350 Fifth Avenue'
      }
    };

    console.log(`  Endpoint: POST ${BASE_URL}/api/withdrawal/wise-direct-debit/${txId}`);
    console.log(`  Payload: ${JSON.stringify(payload)}\n`);

    const response = await fetch(
      `${BASE_URL}/api/withdrawal/wise-direct-debit/${txId}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer production-token',
          'X-User-ID': EXISTING_USER_ID,
          'X-Idempotency-Key': crypto.randomUUID()
        },
        body: JSON.stringify(payload)
      }
    );

    console.log(`📊 Response Status: ${response.status}\n`);
    const responseData = (await response.json()) as any;
    console.log('Response:', JSON.stringify(responseData, null, 2));
    console.log();

    if (response.status >= 200 && response.status < 300) {
      console.log('╔═══════════════════════════════════════════════════════════╗');
      console.log('║   ✅ $30 DEPOSIT INITIATED SUCCESSFULLY                   ║');
      console.log('╚═══════════════════════════════════════════════════════════╝\n');

      console.log('📝 Transaction Summary:');
      console.log(`  • Transaction ID: ${txId}`);
      console.log(`  • Amount: $30.00 USD`);
      console.log(`  • Status: ${responseData.status || 'processing'}`);
      console.log(`  • Wise Transfer ID: ${responseData.wiseTransferId || 'pending'}`);
      console.log(`  • Recipient: Production Rail Test`);
      console.log(`  • Timestamp: ${new Date().toISOString()}\n`);

      console.log('🔄 Next Steps:');
      console.log('  • Transfer is processing via Wise API');
      console.log('  • Monitor status at: https://wise.com/transfers');
      console.log('  • Check back in a few minutes for confirmation\n');
    } else {
      console.log('❌ DEPOSIT FAILED\n');
      console.log('Error:', responseData);
    }

  } catch (err: any) {
    console.error('❌ Deposit failed:', err.message);
    console.error(err.stack);
    process.exit(1);
  }
}

execute30DepositViaServer().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
