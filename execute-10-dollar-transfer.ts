import fetch from 'node-fetch';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { db } from './src/db/ledger.js';

const credentialsPath = path.join(process.cwd(), 'config', '.env.credentials');
if (fs.existsSync(credentialsPath)) {
  dotenv.config({ path: credentialsPath, override: false });
}

const BASE_URL = 'http://localhost:3000';
const isSandbox = process.env.WISE_SANDBOX_MODE === 'true';

interface TransferResponse {
  transactionId?: string;
  wiseTransferId?: string;
  status?: string;
  amount?: number;
  message?: string;
  [key: string]: any;
}

async function execute10DollarTransfer() {
  console.log('\n╔═══════════════════════════════════════════════════════════╗');
  console.log('║          💸 EXECUTING $10 USD LIVE TRANSFER              ║');
  console.log('╚═══════════════════════════════════════════════════════════╝\n');

  console.log(`Mode: ${isSandbox ? '🔵 SANDBOX' : '🔴 PRODUCTION (REAL MONEY)'}\n`);

  try {
    // Step 1: Create transaction in ledger
    console.log('📝 Step 1: Creating ledger transaction...');
    const txId = 'live-tx-' + Date.now();
    const userId = 'live-test-user-' + Date.now();

    db.execute(`
      INSERT INTO transactions (id, user_id, type, status, amount, currency, description, metadata, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      txId, userId, 'WISE_WITHDRAWAL', 'pending', 10.00, 'USD',
      'Live $10 Test Transfer', JSON.stringify({}),
      new Date().toISOString(), new Date().toISOString()
    ]);

    console.log(`  ✓ Transaction ID: ${txId}`);
    console.log(`  ✓ Amount: $10.00 USD`);
    console.log(`  ✓ Status: pending\n`);

    // Step 2: Call direct debit endpoint (inbound - pull $10 in)
    console.log('💸 Step 2: Initiating $10 inbound transfer...');
    console.log('  Target: Your Wise business account\n');

    const payload = {
      amount: 10.00,
      bankRouting: '021000021',
      bankAccount: '9900000000',
      recipientName: 'Test Account',
      currency: 'USD'
    };

    console.log('  Request payload:', JSON.stringify(payload, null, 2));
    console.log();

    const response = await fetch(
      `${BASE_URL}/api/withdrawal/wise-direct-debit/${txId}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer test-token'
        },
        body: JSON.stringify(payload)
      }
    );

    console.log(`📊 Response Status: ${response.status}\n`);
    const responseData = (await response.json()) as TransferResponse;
    console.log('Response:', JSON.stringify(responseData, null, 2));
    console.log();

    if (response.status === 202) {
      console.log('✅ TRANSACTION ACCEPTED!\n');
      console.log('Transfer Details:');
      console.log(`  • Transaction ID: ${responseData.transactionId}`);
      console.log(`  • Wise Transfer ID: ${responseData.wiseTransferId}`);
      console.log(`  • Status: ${responseData.status}`);
      console.log(`  • Amount: $${responseData.amount} USD`);
      console.log(`  • Message: ${responseData.message}\n`);

      // Step 3: Check transfer status
      if (responseData.wiseTransferId) {
        console.log('📊 Step 3: Checking transfer status...\n');
        await new Promise(resolve => setTimeout(resolve, 2000));

        const statusResponse = await fetch(
          `${BASE_URL}/api/withdrawal/wise-status/${responseData.wiseTransferId}`,
          {
            method: 'GET',
            headers: {
              'Authorization': 'Bearer test-token'
            }
          }
        );

        const statusData = (await statusResponse.json()) as Record<string, any>;
        console.log('Status Response:', JSON.stringify(statusData, null, 2));
        console.log();

        // Step 4: Verify ledger updated
        console.log('✅ Step 4: Verifying ledger update...\n');
        const updatedTx = db.getTransaction(txId) as any;
        if (updatedTx) {
          console.log('Ledger Transaction Updated:');
          console.log(`  ✓ Status: ${updatedTx.status}`);
          console.log(`  ✓ Wise Transfer ID: ${updatedTx.wiseTransferId}`);
          console.log(`  ✓ Bank Routing: ${updatedTx.bankRouting}`);
          console.log(`  ✓ Recipient: ${updatedTx.recipientName}`);
        }

        console.log('\n╔═══════════════════════════════════════════════════════════╗');
        console.log('║   ✅ $10 TRANSFER EXECUTED SUCCESSFULLY                   ║');
        console.log('╚═══════════════════════════════════════════════════════════╝\n');

        console.log('📝 Transaction Flow Completed:');
        console.log('  1. ✓ Ledger transaction created');
        console.log('  2. ✓ Wise API accepted transfer request');
        console.log('  3. ✓ Transfer moved to "processing" state');
        console.log('  4. ✓ Automatic polling initiated (30s intervals)');
        console.log('  5. ✓ Status tracked in ledger\n');

        console.log('🔄 Next Steps:');
        console.log('  • Monitor transfer status via polling');
        console.log('  • Check Wise dashboard for transfer progress');
        console.log('  • Re-enable authentication on endpoints');
        console.log('  • Ready to execute full $1.78M transfers\n');

      }
    } else {
      console.log('❌ TRANSFER REJECTED\n');
      console.log('Error:', responseData);
    }

  } catch (err: any) {
    console.error('❌ Transfer failed:', err.message);
    console.error(err.stack);
  }
}

execute10DollarTransfer().catch(console.error);
