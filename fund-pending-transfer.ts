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

async function fundPendingTransfer() {
  console.log('\n╔═══════════════════════════════════════════════════════════╗');
  console.log('║     💳 FUNDING $30 VIA PENDING TRANSFER (BALANCE)       ║');
  console.log('╚═══════════════════════════════════════════════════════════╝\n');

  try {
    // Get profile
    const profiles = await wiseApi('GET', '/v1/profiles');
    const business = profiles.find((p: any) => p.type === 'business');
    const profileId = business.id;

    console.log(`Profile: ${business.details?.name}\n`);

    // Get transfers
    console.log('📊 Fetching pending transfers...');
    const transfers = await wiseApi('GET', `/v1/transfers?profile=${profileId}&limit=1`);
    
    if (!transfers || transfers.length === 0) {
      console.log('No transfers found');
      return;
    }

    const transfer = transfers[0];
    console.log(`  Transfer ID: ${transfer.id}`);
    console.log(`  Status: ${transfer.status}`);
    console.log(`  Created: ${transfer.created}\n`);

    // Try to fund with BALANCE
    console.log('💰 Attempting to fund from Wise balance...');
    const payment = await wiseApi('POST', `/v3/profiles/${profileId}/transfers/${transfer.id}/payments`, {
      type: 'BALANCE'
    });

    console.log(`  ✓ Payment Status: ${payment.paymentStatus}`);
    console.log(`  ✓ Payment Type: ${payment.type}\n`);

    // Check transfer status
    console.log('📊 Checking transfer status...');
    await new Promise(resolve => setTimeout(resolve, 1000));

    const updatedTransfer = await wiseApi('GET', `/v1/transfers/${transfer.id}`);
    console.log(`  Status: ${updatedTransfer.status}`);
    console.log(`  Amount: $${updatedTransfer.targetAmount} ${updatedTransfer.targetCurrency}\n`);

    console.log('✅ Transfer funded successfully!');

  } catch (err: any) {
    console.error('❌ Error:', err.message);
  }
}

fundPendingTransfer().catch(console.error);
