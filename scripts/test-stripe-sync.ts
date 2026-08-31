import assert from 'assert';
import { db } from '../src/db/ledger.js';
import { syncAllStripeBalances, runAsymmetricForensicAudit, GLOBAL_STRIPE_BALANCE } from '../src/lib/stripe-sync.js';
import crypto from 'crypto';

// Setup environment mock
process.env.NODE_ENV = 'test';
process.env.STRIPE_SECRET_KEY = 'sk_test_mock_reconcile';

console.log('🧪 Starting Advanced Stripe & Reconciliation Validation Suite...');

// Mock transactions in ledger
const testTxId1 = `ch_${crypto.randomBytes(12).toString('hex')}`;
const testTxId2 = `ch_${crypto.randomBytes(12).toString('hex')}`;
const testTxId3 = `ch_${crypto.randomBytes(12).toString('hex')}`;

db.execute(`INSERT INTO transactions (id, user_id, type, asset_symbol, amount, fiat_amount, timestamp, details, hash, status, ledger_debit, ledger_credit) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, [
  testTxId1, 'user_mlaframboisemm', 'RECEIVE', 'USD', 150.00, 150.00, Date.now(), `Stripe Card Deposit (Session: ${testTxId1})`, testTxId1, 'completed', 'stripe_gateway', 'user_wallet'
]);

db.execute(`INSERT INTO transactions (id, user_id, type, asset_symbol, amount, fiat_amount, timestamp, details, hash, status, ledger_debit, ledger_credit) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, [
  testTxId2, 'user_mlaframboisemm', 'RECEIVE', 'USD', 300.00, 300.00, Date.now(), `Stripe Card Deposit (Session: ${testTxId2})`, testTxId2, 'completed', 'stripe_gateway', 'user_wallet'
]);

// 1. Mock global fetch
const originalFetch = global.fetch;

let fetchCallCount = 0;
const fetchedUrls: string[] = [];

(global as any).fetch = async (url: string, options: any = {}) => {
  fetchCallCount++;
  fetchedUrls.push(url);

  // Stripe balance
  if (url.includes('/v1/balance') && !url.includes('/v1/balance_transactions')) {
    const isConnected = !!options.headers?.['Stripe-Account'];
    if (isConnected) {
      return {
        ok: true,
        json: async () => ({
          available: [{ amount: 5000, currency: 'usd' }], // $50
          pending: [{ amount: 1000, currency: 'usd' }]     // $10
        })
      } as any;
    } else {
      return {
        ok: true,
        json: async () => ({
          available: [{ amount: 10000, currency: 'usd' }], // $100
          pending: [{ amount: 2000, currency: 'usd' }]     // $20
        })
      } as any;
    }
  }

  // Stripe accounts list
  if (url.includes('/v1/accounts')) {
    return {
      ok: true,
      json: async () => ({
        data: [
          { id: 'acct_mock1' },
          { id: 'acct_mock2' }
        ]
      })
    } as any;
  }

  // Stripe balance transactions
  if (url.includes('/v1/balance_transactions')) {
    return {
      ok: true,
      json: async () => ({
        data: [
          // Matches testTxId1 perfectly
          { id: 'txn_1', amount: 15000, currency: 'usd', source: testTxId1 },
          // Mismatch amount (300 in ledger, 200 in Stripe) -> should trigger discrepancy!
          { id: 'txn_2', amount: 20000, currency: 'usd', source: testTxId2 },
          // Missing ledger entry -> should trigger discrepancy!
          { id: 'txn_3', amount: 5000, currency: 'usd', source: testTxId3 }
        ]
      })
    } as any;
  }

  return { ok: false, text: async () => 'Not Found' } as any;
};

async function runTests() {
  try {
    // -------------------------------------------------------------
    // Test 1: Balance Aggregation Sync
    // -------------------------------------------------------------
    console.log('\n--- Test 1: syncAllStripeBalances ---');
    await syncAllStripeBalances();

    // Check fetched API endpoints:
    // Should fetch 1 platform balance + 1 accounts list + 2 connected balances = 4 fetches total
    console.log(`Fetch call count: ${fetchCallCount}`);
    assert.strictEqual(fetchCallCount, 4);

    // Verify calculated totals:
    // Platform available = 100, Connected accounts available = 50 * 2 = 100. Total available = 200.
    // Platform pending = 20, Connected accounts pending = 10 * 2 = 20. Total pending = 40.
    console.log(`Aggregated available: $${GLOBAL_STRIPE_BALANCE.available} USD`);
    console.log(`Aggregated pending: $${GLOBAL_STRIPE_BALANCE.pending} USD`);
    assert.strictEqual(GLOBAL_STRIPE_BALANCE.available, 200);
    assert.strictEqual(GLOBAL_STRIPE_BALANCE.pending, 40);
    console.log('✅ Test 1 Passed.');

    // -------------------------------------------------------------
    // Test 2: Asymmetric Forensic Audit Reconciliation
    // -------------------------------------------------------------
    console.log('\n--- Test 2: runAsymmetricForensicAudit ---');
    // Clear previous reconciliation logs
    const initialLogsCount = (db.execute('SELECT * FROM audit_logs') as any[]).length;

    await runAsymmetricForensicAudit();

    // Verify audit logs are generated
    const newLogs = db.execute('SELECT * FROM audit_logs') as any[];
    assert.strictEqual(newLogs.length, initialLogsCount + 1);

    const latestLog = newLogs[newLogs.length - 1];
    console.log(`Audit log action: ${latestLog.action}`);
    console.log(`Audit log status: ${latestLog.status}`);
    console.log(`Audit log details summary:\n${latestLog.details}`);
    
    assert.strictEqual(latestLog.action, 'RECONCILIATION_AUDIT_FAILURE');
    assert.strictEqual(latestLog.status, 'failure');
    assert.ok(latestLog.details.includes('Amount Mismatch'));
    assert.ok(latestLog.details.includes('Missing Ledger Entry'));
    console.log('✅ Test 2 Passed.');

    // -------------------------------------------------------------
    // Cleanup
    // -------------------------------------------------------------
    global.fetch = originalFetch;
    console.log('\n🎉 All stripe aggregation and forensic audit reconciliation tests passed successfully!');
    process.exit(0);
  } catch (error) {
    global.fetch = originalFetch;
    console.error('❌ Validation Test Failed:', error);
    process.exit(1);
  }
}

runTests();
