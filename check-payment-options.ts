import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';

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

async function checkPaymentOptions() {
  console.log('\n╔═══════════════════════════════════════════════════════════╗');
  console.log('║     📋 CHECKING AVAILABLE PAYMENT OPTIONS                ║');
  console.log('╚═══════════════════════════════════════════════════════════╝\n');

  try {
    // Get profile
    const profiles = await wiseApi('GET', '/v1/profiles');
    const business = profiles.find((p: any) => p.type === 'business');
    const profileId = business.id;

    // Get transfers
    const transfers = await wiseApi('GET', `/v1/transfers?profile=${profileId}&limit=1`);
    const transfer = transfers[0];

    console.log(`Transfer ID: ${transfer.id}`);
    console.log(`Status: ${transfer.status}\n`);

    // Get payment options
    console.log('📋 Available Payment Options:\n');
    const paymentOptions = await wiseApi('GET', `/v1/transfers/${transfer.id}/payments`);
    
    if (Array.isArray(paymentOptions)) {
      if (paymentOptions.length === 0) {
        console.log('No payment options available (transfer may be waiting for direct debit)');
      } else {
        paymentOptions.forEach((opt: any, i: number) => {
          console.log(`${i + 1}. Type: ${opt.type || 'UNKNOWN'}`);
          if (opt.availableFunds) console.log(`   Available: ${opt.availableFunds}`);
          if (opt.formattedFunds) console.log(`   Formatted: ${opt.formattedFunds}`);
          console.log();
        });
      }
    } else {
      console.log(JSON.stringify(paymentOptions, null, 2));
    }

    // Check direct debit instruction
    console.log('💳 Direct Debit Information:\n');
    const accounts = await wiseApi('GET', `/v1/accounts?profile=${profileId}`);
    const usdAccount = accounts.find((a: any) => a.currency === 'USD' && a.type === 'aba');
    
    if (usdAccount) {
      console.log('USD Account Details:');
      console.log(`  Routing: ${usdAccount.details.abartn}`);
      console.log(`  Account: ${usdAccount.details.accountNumber}`);
      console.log(`  Account ID: ${usdAccount.id}\n`);

      // Get direct debit instructions
      console.log('Direct Debit ACH Instructions for inbound transfer:\n');
      const instructions = await wiseApi('GET', `/v2/accounts/${usdAccount.id}/instructions`);
      console.log(JSON.stringify(instructions, null, 2));
    }

  } catch (err: any) {
    console.error('❌ Error:', err.message);
  }
}

checkPaymentOptions().catch(console.error);
