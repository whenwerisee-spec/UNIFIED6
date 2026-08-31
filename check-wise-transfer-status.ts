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

async function checkTransfer() {
  console.log('\n╔═══════════════════════════════════════════════════════════╗');
  console.log('║        📊 CHECKING TRANSFER STATUS & PAYMENT OPTIONS      ║');
  console.log('╚═══════════════════════════════════════════════════════════╝\n');

  try {
    // Get profile
    const profiles = await wiseApi('GET', '/v1/profiles');
    const business = profiles.find((p: any) => p.type === 'business');
    const profileId = business.id;

    const TRANSFER_ID = '2258243663';

    // Check transfer status
    console.log(`Checking transfer ${TRANSFER_ID}...\n`);
    const transfer = await wiseApi('GET', `/v1/transfers/${TRANSFER_ID}`);

    console.log('Transfer Status:');
    console.log(`  ID: ${transfer.id}`);
    console.log(`  Status: ${transfer.status}`);
    console.log(`  Amount: $${transfer.targetAmount} ${transfer.targetCurrency}`);
    console.log(`  Reference: ${transfer.details?.reference || 'N/A'}\n`);

    // Get payment options for this transfer
    console.log('Available Payment Options:');
    const paymentOptions = await wiseApi('GET', `/v1/transfers/${TRANSFER_ID}/payments`);
    console.log(JSON.stringify(paymentOptions, null, 2));
    console.log();

    // If there are payment options, try to fund with the first available
    if (paymentOptions && Array.isArray(paymentOptions) && paymentOptions.length > 0) {
      console.log('Payment options found:');
      paymentOptions.forEach((opt: any, i: number) => {
        console.log(`  ${i + 1}. Type: ${opt.type}`);
        if (opt.availableFunds) console.log(`     Available Funds: $${opt.availableFunds}`);
        if (opt.formattedFunds) console.log(`     Formatted Funds: ${opt.formattedFunds}`);
      });
    }

  } catch (err: any) {
    console.error('\n❌ Error:');
    console.error(`  ${err.message}\n`);
  }
}

checkTransfer().catch(console.error);
