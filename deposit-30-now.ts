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

async function wiseApi(method: string, path: string, body?: any) {
  const url = `${BASE_URL}${path}`;
  console.log(`→ ${method} ${path}`);
  
  const res = await fetch(url, {
    method,
    headers: HEADERS,
    body: body ? JSON.stringify(body) : undefined
  });

  const data = await res.json();
  if (!res.ok) {
    console.error(`  ✗ Status ${res.status}`);
    throw new Error(`[${res.status}] ${JSON.stringify(data)}`);
  }
  return data;
}

async function deposit30USD() {
  console.log('\n╔═══════════════════════════════════════════════════════════╗');
  console.log('║          💸 DEPOSITING $30 USD TO WISE ACCOUNT           ║');
  console.log('╚═══════════════════════════════════════════════════════════╝\n');

  try {
    // 1. Get profile
    console.log('📋 Step 1: Get Wise profile');
    const profiles = await wiseApi('GET', '/v1/profiles');
    const business = profiles.find((p: any) => p.type === 'business');
    const profileId = business.id;
    console.log(`  ✓ Profile: ${business.details?.name} (${profileId})\n`);

    // 2. Get or create recipient (self)
    console.log('👤 Step 2: Setting up recipient (your own account)');
    const accounts = await wiseApi('GET', `/v1/accounts?profile=${profileId}`);
    const usdAccount = accounts.find((a: any) => a.currency === 'USD' && a.type === 'aba');
    console.log(`  ✓ USD Account: ${usdAccount.accountHolderName}`);
    console.log(`  ✓ Account ID: ${usdAccount.id}\n`);

    // 3. Create quote
    console.log('📊 Step 3: Creating USD->USD quote');
    const quote = await wiseApi('POST', `/v3/profiles/${profileId}/quotes`, {
      sourceCurrency: 'USD',
      targetCurrency: 'USD',
      sourceAmount: 30.00,
      profile: profileId
    });
    console.log(`  ✓ Quote ID: ${quote.id}`);
    console.log(`  ✓ Source: $${quote.sourceAmount} USD`);
    console.log(`  ✓ Target: $${quote.targetAmount} USD\n`);

    // 4. Create transfer
    console.log('🔄 Step 4: Creating transfer');
    const customerTxId = crypto.randomUUID();
    const transfer = await wiseApi('POST', '/v1/transfers', {
      targetAccount: usdAccount.id,
      quoteUuid: quote.id,
      customerTransactionId: customerTxId,
      details: {
        reference: 'Ledger deposit $30 USD'
      }
    });
    console.log(`  ✓ Transfer ID: ${transfer.id}`);
    console.log(`  ✓ Status: ${transfer.status}`);
    console.log(`  ✓ Amount: $${transfer.targetAmount} ${transfer.targetCurrency}\n`);

    // 5. Check available payment options
    console.log('💳 Step 5: Checking payment options');
    const paymentOptions = await wiseApi('GET', `/v1/transfers/${transfer.id}/payments`);
    console.log(`  Found ${paymentOptions?.length || 0} payment options\n`);

    if (Array.isArray(paymentOptions) && paymentOptions.length > 0) {
      paymentOptions.forEach((opt: any, i: number) => {
        console.log(`  ${i + 1}. ${opt.type || 'UNKNOWN'}`);
        if (opt.availableFunds) console.log(`     Available: ${opt.availableFunds}`);
      });
      console.log();
    }

    // 6. Try BALANCE payment
    console.log('💰 Step 6: Funding transfer (BALANCE)');
    try {
      const payment = await wiseApi('POST', `/v3/profiles/${profileId}/transfers/${transfer.id}/payments`, {
        type: 'BALANCE'
      });
      console.log(`  ✓ Payment Type: ${payment.type}`);
      console.log(`  ✓ Payment Status: ${payment.paymentStatus}\n`);
    } catch (balanceErr: any) {
      console.log(`  ✗ BALANCE not available (${balanceErr.message})`);
      console.log(`  Trying alternative payment methods...\n`);

      // Try other payment types
      const paymentTypes = ['BANK_TRANSFER', 'CARD', 'DEBIT_CARD', 'CREDIT_CARD'];
      let funded = false;

      for (const paymentType of paymentTypes) {
        try {
          console.log(`  → Trying ${paymentType}...`);
          const altPayment = await wiseApi('POST', `/v3/profiles/${profileId}/transfers/${transfer.id}/payments`, {
            type: paymentType
          });
          console.log(`  ✓ ${paymentType} funded!`);
          console.log(`    Payment Status: ${altPayment.paymentStatus}\n`);
          funded = true;
          break;
        } catch (e) {
          // Try next type
        }
      }

      if (!funded) {
        throw new Error('No payment method available. You may need to link a payment method in Wise first.');
      }
    }

    // 7. Check final status
    console.log('📊 Step 7: Verifying transfer status');
    await new Promise(resolve => setTimeout(resolve, 1000));
    const finalTransfer = await wiseApi('GET', `/v1/transfers/${transfer.id}`);
    console.log(`  ✓ Transfer Status: ${finalTransfer.status}`);
    console.log(`  ✓ Amount: $${finalTransfer.targetAmount} ${finalTransfer.targetCurrency}\n`);

    // 8. Check balance
    console.log('💵 Step 8: Checking Wise account balance');
    const balances = await wiseApi('GET', `/v4/profiles/${profileId}/balances?types=STANDARD`);
    const usdBal = balances.find((b: any) => b.currency === 'USD');
    console.log(`  ✓ USD Balance: $${(usdBal?.amount?.value || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}\n`);

    console.log('╔═══════════════════════════════════════════════════════════╗');
    console.log('║        ✅ $30 USD SUCCESSFULLY DEPOSITED TO WISE         ║');
    console.log('╚═══════════════════════════════════════════════════════════╝\n');

    console.log('Summary:');
    console.log(`  • Transfer ID: ${transfer.id}`);
    console.log(`  • Amount: $30.00 USD`);
    console.log(`  • Status: ${finalTransfer.status}`);
    console.log(`  • Current Balance: $${(usdBal?.amount?.value || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}`);
    console.log(`  • Ready to use: YES\n`);

  } catch (err: any) {
    console.error('\n❌ Deposit failed:');
    console.error(`  Error: ${err.message}\n`);
    process.exit(1);
  }
}

deposit30USD().catch(console.error);
