import fetch from 'node-fetch';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { db } from './src/db/ledger.js';
import { generateSessionId, signSessionToken } from './src/lib/auth-security.js';

const credentialsPath = path.join(process.cwd(), 'config', '.env.credentials');
if (fs.existsSync(credentialsPath)) {
  dotenv.config({ path: credentialsPath, override: false });
}

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';

interface OutboundResponse {
  success?: boolean;
  message?: string;
  transactionId?: string;
  wiseTransferId?: string;
  status?: string;
  error?: string;
  [key: string]: any;
}

async function testWiseOutboundE2E() {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('  🚀 WISE OUTBOUND END-TO-END TEST');
  console.log('═══════════════════════════════════════════════════════════\n');

  try {
    console.log('📝 Step 1: Creating test user...');
    const uniqueSuffix = crypto.randomBytes(6).toString('hex');
    const testUserId = `test-wise-outbound-user-${Date.now()}-${uniqueSuffix}`;
    const testEmail = `wise-outbound-test-${Date.now()}-${uniqueSuffix}@test.local`;
    const testPassword = 'TestPassword123!@#';

    db.execute(
      `
      INSERT INTO users (id, name, email, passwordHash, salt, twoFactorSecret, twoFactorEnabled, kycLevel, citizenship)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
      [
        testUserId,
        `Outbound Test User ${uniqueSuffix}`,
        testEmail,
        testPassword,
        '',
        '',
        0,
        1,
        'US'
      ]
    );

    console.log(`  ✓ User created: ${testUserId}`);
    console.log(`  ✓ Email: ${testEmail}\n`);

    console.log('📝 Step 2: Creating pending ledger transaction...');
    const txId = `tx-wise-outbound-${Date.now()}`;
    const amount = 10.0;

    db.execute(
      `
      INSERT INTO transactions (id, user_id, type, asset_symbol, amount, fiat_amount, timestamp, details, hash, status, ledger_debit, ledger_credit)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
      [
        txId,
        testUserId,
        'WISE_WITHDRAWAL',
        'USD',
        amount,
        amount,
        Date.now(),
        JSON.stringify({ description: 'Test Wise Outbound Withdrawal' }),
        '',
        'pending',
        amount,
        0.0
      ]
    );

    console.log(`  ✓ Transaction created: ${txId}`);
    console.log(`  ✓ Amount: $${amount.toFixed(2)} USD`);
    console.log('  ✓ Status: pending\n');

    console.log('🔐 Step 3: Generating authentication session...');
    generateSessionId();
    const authSecret =
      process.env.JWT_SECRET || process.env.SESSION_SECRET || 'local-dev-secret-please-change';
    const sessionToken = signSessionToken({ sub: testUserId } as any, authSecret);
    console.log('  ✓ Session created');
    console.log('  ✓ Token type: Bearer\n');

    console.log('💸 Step 4: Initiating outbound Wise transfer...');
    const outboundPayload = {
      amount,
      sourceCurrency: 'USD',
      targetCurrency: 'USD',
      recipientName: 'Production Rail Test',
      bankDetails: {
        routingNumber: '021000021',
        accountNumber: '9900000000',
        accountType: 'CHECKING',
        address: {
          country: 'US',
          city: 'New York',
          postCode: '10001',
          firstLine: '123 Test Street',
          state: 'NY'
        }
      }
    };

    const outboundRes = await fetch(`${BASE_URL}/api/withdrawal/wise-send-anywhere/${txId}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${sessionToken}`,
        'X-User-ID': testUserId,
        'X-Idempotency-Key': `wise-outbound-${txId}`
      },
      body: JSON.stringify(outboundPayload)
    });

    const outboundData = (await outboundRes.json()) as OutboundResponse;
    console.log(`  Response Status: ${outboundRes.status}`);
    console.log('  Response:', JSON.stringify(outboundData, null, 2));

    if (outboundRes.status !== 202 || !outboundData.wiseTransferId) {
      throw new Error(`Unexpected outbound response status: ${outboundRes.status}`);
    }

    console.log('  ✅ Outbound transfer initiated successfully!');
    console.log(`  ✓ Wise Transfer ID: ${outboundData.wiseTransferId}\n`);

    console.log('📊 Step 5: Checking transfer status...');
    const statusRes = await fetch(`${BASE_URL}/api/withdrawal/wise-status/${outboundData.wiseTransferId}`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${sessionToken}`,
        'X-User-ID': testUserId
      }
    });

    const statusData = await statusRes.json();
    console.log(`  Response Status: ${statusRes.status}`);
    console.log('  Transfer Status:', JSON.stringify(statusData, null, 2));

    console.log('\n✅ Step 6: Verifying ledger transaction state...');
    const updatedTx = db.getTransaction(txId) as any;
    if (!updatedTx) {
      throw new Error('Ledger transaction not found after outbound transfer request');
    }

    console.log(`  ✓ Transaction status: ${updatedTx.status}`);
    console.log(`  ✓ Wise Transfer ID: ${updatedTx.wiseTransferId || 'N/A'}`);
    console.log(`  ✓ Recipient Name: ${updatedTx.recipientName || 'N/A'}`);

    console.log('\n═══════════════════════════════════════════════════════════');
    console.log('✅ OUTBOUND E2E TEST COMPLETED');
    console.log('═══════════════════════════════════════════════════════════');
  } catch (err: any) {
    console.error('❌ Outbound E2E test failed:', err.message || String(err));
    console.error(err?.stack || err);
    process.exitCode = 1;
  }
}

testWiseOutboundE2E().catch((err) => {
  console.error(err);
  process.exit(1);
});
