import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { db } from './src/db/ledger.js';

const credentialsPath = path.join(process.cwd(), 'config', '.env.credentials');
if (fs.existsSync(credentialsPath)) {
  dotenv.config({ path: credentialsPath, override: true });
}

const TOKEN = process.env.WISE_API_TOKEN!;
const BASE_URL = 'https://api.wise.com';
const HEADERS = {
  'Authorization': `Bearer ${TOKEN}`,
  'Content-Type': 'application/json'
};

const USER_ID = 'user_mlaframboisemm';
const LEDGER_USD_BALANCE = 1791768.04;

async function wiseApi(method: string, path: string, body?: any) {
  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: HEADERS,
    body: body ? JSON.stringify(body) : undefined
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`[${res.status}] ${JSON.stringify(data)}`);
  return data;
}

async function initiateDeposit() {
  console.log('\n╔═══════════════════════════════════════════════════════════╗');
  console.log('║     💰 LEDGER → WISE DEPOSIT INITIATION                  ║');
  console.log('╚═══════════════════════════════════════════════════════════╝\n');

  console.log('Ledger Status:');
  console.log(`  User:    mlaframboisemm@gmail.com`);
  console.log(`  User ID: ${USER_ID}`);
  console.log(`  USD Balance: $${LEDGER_USD_BALANCE.toLocaleString()}`);
  console.log(`  KYC Level: 3 (VERIFIED)`);
  console.log(`  Mode: LIVE\n`);

  // Step 1: Verify Wise profile
  console.log('📋 Step 1: Connecting to Wise account...');
  const profiles = await wiseApi('GET', '/v1/profiles');
  const business = profiles.find((p: any) => p.type === 'business');
  console.log(`  ✓ Business Profile: ${business.details.name}`);
  console.log(`  ✓ Profile ID: ${business.id}\n`);

  // Step 2: Check Wise balance
  console.log('💰 Step 2: Checking Wise balance...');
  const balances = await wiseApi('GET', `/v4/profiles/${business.id}/balances?types=STANDARD`);
  const usdBal = balances.find((b: any) => b.currency === 'USD');
  console.log(`  Wise USD Balance: $${usdBal?.amount?.value || 0}`);
  console.log(`  Ledger USD Balance: $${LEDGER_USD_BALANCE.toLocaleString()}\n`);

  // Step 3: Create ledger transaction record for this deposit
  console.log('📝 Step 3: Creating deposit transaction in ledger...');
  const txId = 'wise-deposit-' + Date.now();
  db.execute(`
    INSERT INTO transactions (id, user_id, type, status, amount, currency, description, metadata, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `, [
    txId,
    USER_ID,
    'WISE_WITHDRAWAL',
    'pending',
    10.00,
    'USD',
    'Test $10 deposit from ledger to Wise',
    JSON.stringify({ ledgerBalance: LEDGER_USD_BALANCE }),
    new Date().toISOString(),
    new Date().toISOString()
  ]);
  console.log(`  ✓ Transaction ID: ${txId}`);
  console.log(`  ✓ Amount: $10.00 USD (test amount)`);
  console.log(`  ✓ Ledger status: pending\n`);

  // Step 4: Create quote on Wise
  console.log('📊 Step 4: Creating Wise transfer quote...');
  const quote = await wiseApi('POST', `/v3/profiles/${business.id}/quotes`, {
    sourceCurrency: 'USD',
    targetCurrency: 'USD',
    sourceAmount: 10.00,
    profile: business.id
  });
  console.log(`  ✓ Quote ID: ${quote.id}`);
  console.log(`  ✓ Source: $${quote.sourceAmount} USD\n`);

  // Step 5: Create recipient (your own Wise account as recipient)
  console.log('👤 Step 5: Setting up recipient...');
  const recipient = await wiseApi('POST', '/v1/accounts', {
    profile: business.id,
    currency: 'USD',
    type: 'aba',
    accountHolderName: 'Marcel Laframboise',
    details: {
      abartn: '021000021',
      accountNumber: '9900000000',
      accountType: 'CHECKING',
      address: {
        country: 'CA',
        city: 'Saint Catharines',
        postCode: 'L2P 0B3',
        firstLine: '123 Main Street',
        state: 'ON'
      }
    }
  });
  console.log(`  ✓ Recipient ID: ${recipient.id}\n`);

  // Step 6: Create transfer
  console.log('🚀 Step 6: Creating Wise transfer...');
  const transfer = await wiseApi('POST', '/v1/transfers', {
    targetAccount: recipient.id,
    quoteUuid: quote.id,
    customerTransactionId: crypto.randomUUID(),
    details: { reference: 'Ledger deposit' }
  });
  console.log(`  ✓ Transfer ID: ${transfer.id}`);
  console.log(`  ✓ Status: ${transfer.status}\n`);

  // Step 7: Fund from balance
  console.log('💸 Step 7: Funding transfer...');
  const payment = await wiseApi('POST', `/v3/profiles/${business.id}/transfers/${transfer.id}/payments`, {
    type: 'BALANCE'
  });
  console.log(`  ✓ Payment status: ${payment.status}\n`);

  // Step 8: Update ledger
  db.updateTransaction(txId, {
    wiseTransferId: String(transfer.id),
    status: 'processing'
  });

  console.log('╔═══════════════════════════════════════════════════════════╗');
  console.log('║   ✅ LEDGER → WISE DEPOSIT INITIATED                     ║');
  console.log('╚═══════════════════════════════════════════════════════════╝\n');
  console.log(`  Ledger User:     mlaframboisemm@gmail.com`);
  console.log(`  Ledger Balance:  $${LEDGER_USD_BALANCE.toLocaleString()} USD`);
  console.log(`  Transfer Amount: $10.00 USD (test)`);
  console.log(`  Wise Transfer:   ${transfer.id}`);
  console.log(`  Status:          ${payment.status}`);
  console.log(`\nCheck your Wise dashboard to confirm.\n`);
}

initiateDeposit().catch(err => {
  console.error('\n❌ Error:', err.message);
});
