import fetch from 'node-fetch';
import { config } from 'dotenv';
import { join } from 'path';
import { existsSync, readFileSync } from 'fs';

// Load credentials from .env.credentials like the server does
const credentialsPath = join(process.cwd(), 'config', '.env.credentials');
if (existsSync(credentialsPath)) {
  config({ path: credentialsPath, override: false });
}

const BASE_URL = 'http://localhost:3000';
const ledgerDbPath = join(process.cwd(), 'src', 'db', 'database.json');

function getLedgerTransactionId(): string | null {
  if (!existsSync(ledgerDbPath)) {
    return null;
  }

  try {
    const data = JSON.parse(readFileSync(ledgerDbPath, 'utf8'));
    const transactions = Array.isArray(data.transactions) ? data.transactions : [];
    return transactions.length > 0 ? String(transactions[0].id) : null;
  } catch {
    return null;
  }
}

async function testWiseIntegration() {
  console.log('🔍 Testing Wise API Integration (LIVE)...\n');

  try {
    // Test 1: Health check
    console.log('✓ Test 1: Withdrawal health endpoint');
    const healthRes = await fetch(`${BASE_URL}/api/withdrawal/health`);
    const healthData = await healthRes.json();
    console.log(`  Status: ${healthRes.status}`);
    console.log(`  Response:`, JSON.stringify(healthData, null, 2));
    console.log();

    // Test 2: Wise API engine initialization check
    console.log('✓ Test 2: Check if Wise engine is initialized');
    if (process.env.WISE_API_TOKEN) {
      console.log(`  ✅ WISE_API_TOKEN is configured`);
      console.log(`  Sandbox mode: ${process.env.WISE_SANDBOX_MODE === 'true' ? 'YES' : 'NO'}`);
    } else {
      console.log(`  ❌ WISE_API_TOKEN is NOT set`);
    }
    console.log();

    // Test 3: Test direct debit endpoint (will fail without valid txId, but should show endpoint exists)
    console.log('✓ Test 3: Test direct debit endpoint existence');
    try {
      const directDebitRes = await fetch(`${BASE_URL}/api/withdrawal/wise-direct-debit/test-tx`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer test-token'
        },
        body: JSON.stringify({
          amount: 100,
          bankRouting: '123456',
          bankAccount: '987654321',
          recipientName: 'Test User',
          currency: 'USD'
        })
      });
      console.log(`  Response Status: ${directDebitRes.status}`);
      const data = await directDebitRes.json();
      console.log(`  Response:`, JSON.stringify(data, null, 2).substring(0, 200) + '...');
    } catch (e: any) {
      console.log(`  Endpoint test (expected to fail without valid auth): ${e.message}`);
    }
    console.log();

    // Test 4: Test status endpoint
    console.log('✓ Test 4: Test Wise status endpoint existence');
    try {
      const statusRes = await fetch(`${BASE_URL}/api/withdrawal/wise-status/test-transfer-id`, {
        method: 'GET',
        headers: {
          'Authorization': 'Bearer test-token'
        }
      });
      console.log(`  Response Status: ${statusRes.status}`);
      const data = await statusRes.json();
      console.log(`  Response:`, JSON.stringify(data, null, 2).substring(0, 200) + '...');
    } catch (e: any) {
      console.log(`  Endpoint test (expected to fail without valid auth): ${e.message}`);
    }

    console.log('✓ Test 5: Ledger balance endpoint');
    try {
      const ledgerBalanceRes = await fetch(`${BASE_URL}/api/withdrawal/ledger/balance`);
      console.log(`  Response Status: ${ledgerBalanceRes.status}`);
      const ledgerBalanceData = await ledgerBalanceRes.json();
      console.log(`  Response:`, JSON.stringify(ledgerBalanceData, null, 2).substring(0, 200) + '...');
    } catch (e: any) {
      console.log(`  Ledger balance endpoint failed: ${e.message}`);
    }
    console.log();

    const txId = getLedgerTransactionId();
    if (txId) {
      console.log(`✓ Test 6: Ledger transaction endpoint for txId=${txId}`);
      try {
        const txRes = await fetch(`${BASE_URL}/api/withdrawal/ledger/transaction/${txId}`);
        console.log(`  Response Status: ${txRes.status}`);
        const txData = await txRes.json();
        console.log(`  Response:`, JSON.stringify(txData, null, 2).substring(0, 200) + '...');
      } catch (e: any) {
        console.log(`  Ledger transaction endpoint failed: ${e.message}`);
      }
      console.log();
    } else {
      console.log('✓ Test 6: Ledger transaction endpoint skipped because no transaction ID was found in ledger database.');
      console.log();
    }

    console.log('\n✅ All endpoint tests completed!');
    console.log('\nNext steps:');
    console.log('1. Create test transaction in ledger');
    console.log('2. Authenticate with valid user token');
    console.log('3. Test direct debit withdrawal flow');
    console.log('4. Monitor polling for transfer completion');
  } catch (err: any) {
    console.error('❌ Test failed:', err.message);
  }
}

testWiseIntegration().catch(console.error);
