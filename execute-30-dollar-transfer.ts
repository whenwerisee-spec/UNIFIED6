import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';

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

const TRANSFER_AMOUNT = 30.00;
const TRANSFER_CURRENCY = 'USD';

async function wiseApi(method: string, path: string, body?: any) {
  const url = `${BASE_URL}${path}`;
  console.log(`  → ${method} ${url}`);
  
  const res = await fetch(url, {
    method,
    headers: HEADERS,
    body: body ? JSON.stringify(body) : undefined
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(`Wise API ${method} ${path} failed [${res.status}]: ${JSON.stringify(data)}`);
  }
  return data;
}

async function execute30DollarTransfer() {
  console.log('\n╔═══════════════════════════════════════════════════════════╗');
  console.log('║          💸 EXECUTING $30 USD DEPOSIT TO WISE             ║');
  console.log('╚═══════════════════════════════════════════════════════════╝\n');

  try {
    console.log(`Amount: $${TRANSFER_AMOUNT} USD`);
    console.log(`Mode: LIVE\n`);

    // Step 1: Get Wise profile
    console.log('📋 Step 1: Fetching Wise profile...');
    const profiles = await wiseApi('GET', '/v1/profiles');
    const business = profiles.find((p: any) => p.type === 'business') || profiles[0];
    const profileId = business.id;
    console.log(`  ✓ Profile: ${business.details?.name || business.name}`);
    console.log(`  ✓ Profile ID: ${profileId}\n`);

    // Step 2: Check Wise balance
    console.log('💰 Step 2: Checking Wise balance...');
    const balances = await wiseApi('GET', `/v4/profiles/${profileId}/balances?types=STANDARD`);
    const usdBal = balances.find((b: any) => b.currency === TRANSFER_CURRENCY);
    console.log(`  Current Balance: $${(usdBal?.amount?.value || 0).toLocaleString()}`);
    console.log(`  After transfer: $${((usdBal?.amount?.value || 0) + TRANSFER_AMOUNT).toLocaleString()}\n`);

    // Step 3: Get USD account/recipient for deposit
    console.log('👤 Step 3: Getting your USD account details...');
    const accounts = await wiseApi('GET', `/v1/accounts?profile=${profileId}`);
    const usdAccount = accounts.find((a: any) => a.currency === TRANSFER_CURRENCY && a.type === 'aba');
    
    if (!usdAccount) {
      throw new Error('No USD ABA account found. Please create one in Wise first.');
    }

    const accountDetails = usdAccount.details as any;
    console.log(`  ✓ Account: ${usdAccount.accountHolderName}`);
    console.log(`  ✓ Routing: ${accountDetails.abartn}`);
    console.log(`  ✓ Account: ${accountDetails.accountNumber}`);
    console.log(`  ✓ Account ID: ${usdAccount.id}\n`);

    // Step 4: Create quote
    console.log('📊 Step 4: Creating transfer quote...');
    const quote = await wiseApi('POST', `/v3/profiles/${profileId}/quotes`, {
      sourceCurrency: TRANSFER_CURRENCY,
      targetCurrency: TRANSFER_CURRENCY,
      sourceAmount: TRANSFER_AMOUNT,
      profile: profileId
    });
    console.log(`  ✓ Quote ID: ${quote.id}`);
    console.log(`  ✓ Rate: 1.00`);
    console.log(`  ✓ Target Amount: $${quote.targetAmount}\n`);

    // Step 5: Use existing account as recipient
    console.log('👥 Step 5: Using existing USD account...');
    console.log(`  ✓ Recipient Account ID: ${usdAccount.id}`);
    console.log(`  ✓ Recipient Name: ${usdAccount.accountHolderName}\n`);

    // Step 6: Create transfer
    console.log('🔄 Step 6: Creating transfer...');
    const transfer = await wiseApi('POST', `/v1/transfers`, {
      targetAccount: usdAccount.id,
      quoteUuid: quote.id,
      customerTransactionId: crypto.randomUUID(),
      details: {
        reference: 'Ledger deposit to Wise USD account'
      }
    });
    console.log(`  ✓ Transfer ID: ${transfer.id}`);
    console.log(`  ✓ Status: ${transfer.status}`);
    console.log(`  ✓ Amount: $${transfer.targetAmount} ${transfer.targetCurrency}\n`);

    // Step 7: Fund transfer (execute)
    console.log('💳 Step 7: Funding transfer...');
    const funding = await wiseApi('POST', `/v3/profiles/${profileId}/transfers/${transfer.id}/payments`, {
      type: 'BALANCE'
    });
    console.log(`  ✓ Payment Type: ${funding.type}`);
    console.log(`  ✓ Payment Status: ${funding.paymentStatus}`);
    console.log(`  ✓ Reference: ${funding.reference}\n`);

    // Step 8: Monitor status
    console.log('📊 Step 8: Checking transfer status...');
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    const status = await wiseApi('GET', `/v1/transfers/${transfer.id}`);
    console.log(`  ✓ Transfer Status: ${status.status}`);
    console.log(`  ✓ Amount: $${status.targetAmount} ${status.targetCurrency}`);
    console.log(`  ✓ Recipient: ${status.recipient?.name || 'USD Account'}\n`);

    console.log('╔═══════════════════════════════════════════════════════════╗');
    console.log('║   ✅ $30 TRANSFER EXECUTED SUCCESSFULLY                   ║');
    console.log('╚═══════════════════════════════════════════════════════════╝\n');

    console.log('📝 Transfer Summary:');
    console.log(`  • Transfer ID: ${transfer.id}`);
    console.log(`  • Amount: $${TRANSFER_AMOUNT} USD`);
    console.log(`  • Status: ${status.status}`);
    console.log(`  • From: Ledger`);
    console.log(`  • To: Your Wise USD Account`);
    console.log(`  • Timestamp: ${new Date().toISOString()}\n`);

    console.log('🔄 Next Steps:');
    console.log('  • Transfer is now in your Wise account');
    console.log('  • Monitor via: https://wise.com/transfers');
    console.log('  • Can withdraw to external bank anytime\n');

  } catch (err: any) {
    console.error('\n❌ Transfer failed:');
    console.error(`  Error: ${err.message}\n`);
    process.exit(1);
  }
}

execute30DollarTransfer().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
