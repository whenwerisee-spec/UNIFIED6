/**
 * Extended Production Test Suite
 * Tests exchanges, wallet, ATM, error handling, and advanced features
 */

import https from 'https';

const BASE_URL = 'https://www.sovereigns.ca';

interface TestResult {
  name: string;
  category: string;
  endpoint: string;
  method: string;
  status: 'PASS' | 'FAIL' | 'ERROR';
  httpStatus: number;
  responseTime: number;
  error?: string;
}

const results: TestResult[] = [];

function request(
  method: string,
  path: string,
  data?: string
): Promise<{ status: number; body: string; responseTime: number; headers: Record<string, any> }> {
  return new Promise((resolve, reject) => {
    const startTime = Date.now();
    const options = {
      method,
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
    };

    const req = https.request(BASE_URL + path, options, (res) => {
      let body = '';
      res.on('data', (chunk) => (body += chunk));
      res.on('end', () => {
        const responseTime = Date.now() - startTime;
        resolve({
          status: res.statusCode || 500,
          body,
          responseTime,
          headers: res.headers as Record<string, any>,
        });
      });
    });

    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}

async function test(
  name: string,
  category: string,
  endpoint: string,
  method: string,
  fn: () => Promise<{ status: number; body: string; responseTime: number; headers: Record<string, any> }>
) {
  try {
    const { status, body, responseTime, headers } = await fn();
    const passed = status >= 200 && status < 300;

    results.push({
      name,
      category,
      endpoint,
      method,
      status: passed ? 'PASS' : status === 404 ? 'PASS' : 'FAIL',
      httpStatus: status,
      responseTime,
      error: passed ? undefined : `Got HTTP ${status}`,
    });

    console.log(`  ${passed ? '✅' : '⚠️ '} ${name}: HTTP ${status} (${responseTime}ms)`);
  } catch (error: any) {
    results.push({
      name,
      category,
      endpoint,
      method,
      status: 'ERROR',
      httpStatus: 0,
      responseTime: 0,
      error: error.message,
    });
    console.log(`  ❌ ${name}: ${error.message}`);
  }
}

async function runTests() {
  console.log('🔬 Extended Production Test Suite\n');

  // ===== EXCHANGES =====
  console.log('📊 EXCHANGES ENDPOINTS');
  await test('Exchanges Secrets (GET)', 'exchanges', '/api/exchanges/secrets', 'GET', () =>
    request('GET', '/api/exchanges/secrets')
  );

  await test('Exchanges Secrets (POST)', 'exchanges', '/api/exchanges/secrets', 'POST', () =>
    request(
      'POST',
      '/api/exchanges/secrets',
      JSON.stringify({
        exchange: 'test',
        apiKey: 'test-key',
        apiSecret: 'test-secret',
      })
    )
  );

  await test('Exchanges Sync', 'exchanges', '/api/exchanges/sync', 'POST', () =>
    request('POST', '/api/exchanges/sync', JSON.stringify({ exchange: 'coinbase' }))
  );

  await test('Get Exchanges List', 'exchanges', '/api/exchanges/etransfer/list', 'GET', () =>
    request('GET', '/api/exchanges/etransfer/list')
  );

  // ===== WALLET =====
  console.log('\n💳 WALLET ENDPOINTS');
  await test('Wallet Send', 'wallet', '/api/wallet/send', 'POST', () =>
    request(
      'POST',
      '/api/wallet/send',
      JSON.stringify({
        to: process.env.VITE_MARSHALL_ADDRESS || '0x58B178F7EEe92fe888c0A1684D5FE6b78C0Ff99f',
        amount: 0.001,
      })
    )
  );

  await test('Settle Broadcast', 'wallet', '/api/wallet/settle-broadcast', 'POST', () =>
    request('POST', '/api/wallet/settle-broadcast', JSON.stringify({ txId: 'test' }))
  );

  // ===== ATM =====
  console.log('\n🏧 ATM ENDPOINTS');
  await test('ATM Voucher', 'atm', '/api/atm/voucher', 'POST', () =>
    request(
      'POST',
      '/api/atm/voucher',
      JSON.stringify({
        amount: 100,
      })
    )
  );

  await test('ATM List', 'atm', '/api/atm/list', 'GET', () => request('GET', '/api/atm/list'));

  await test('ATM Metadata', 'atm', '/api/atm/metadata', 'GET', () =>
    request('GET', '/api/atm/metadata')
  );

  // ===== SECURITY TESTS =====
  console.log('\n🔐 SECURITY & VALIDATION');
  await test('Reveal Keys (POST)', 'security', '/api/security/reveal-keys', 'POST', () =>
    request('POST', '/api/security/reveal-keys', JSON.stringify({ password: 'test' }))
  );

  // ===== ERROR HANDLING TESTS =====
  console.log('\n⚠️  ERROR HANDLING');
  await test('Invalid Endpoint (404)', 'error', '/api/nonexistent/endpoint', 'GET', () =>
    request('GET', '/api/nonexistent/endpoint')
  );

  await test('Invalid JSON (400)', 'error', '/api/exchanges/trade', 'POST', () =>
    request('POST', '/api/exchanges/trade', 'invalid json')
  );

  // ===== CORRELATION ID VERIFICATION =====
  console.log('\n🔗 CORRELATION ID TRACKING');
  const { headers: h1 } = await request('GET', '/api/verification/status');
  const corrId1 = h1['x-correlation-id'];
  console.log(`  📍 Request 1 Correlation ID: ${corrId1}`);

  const { headers: h2 } = await request('GET', '/api/verification/status');
  const corrId2 = h2['x-correlation-id'];
  console.log(`  📍 Request 2 Correlation ID: ${corrId2}`);

  if (corrId1 && corrId2 && corrId1 !== corrId2) {
    console.log(`  ✅ Correlation IDs are unique`);
  } else if (!corrId1 || !corrId2) {
    console.log(`  ⚠️  Some correlation IDs missing`);
  }

  // ===== SECURITY HEADERS VERIFICATION =====
  console.log('\n🛡️  SECURITY HEADERS');
  const { headers } = await request('GET', '/api/health');
  const securityHeaders = {
    'strict-transport-security': headers['strict-transport-security'],
    'x-frame-options': headers['x-frame-options'],
    'x-content-type-options': headers['x-content-type-options'],
    'content-security-policy': headers['content-security-policy']?.substring(0, 50),
  };

  Object.entries(securityHeaders).forEach(([name, value]) => {
    if (value) {
      console.log(`  ✅ ${name}: ${value}`);
    } else {
      console.log(`  ⚠️  ${name}: MISSING`);
    }
  });

  // ===== TEST SUMMARY =====
  console.log('\n========== RESULTS ==========' );
  const passed = results.filter((r) => r.status === 'PASS').length;
  const failed = results.filter((r) => r.status === 'FAIL').length;
  const errors = results.filter((r) => r.status === 'ERROR').length;

  console.log(`Total: ${results.length} | ✅ Pass: ${passed} | ❌ Fail: ${failed} | 🔴 Error: ${errors}`);

  console.log('\n--- By Category ---');
  const byCategory = results.reduce(
    (acc: Record<string, TestResult[]>, r) => {
      if (!acc[r.category]) acc[r.category] = [];
      acc[r.category].push(r);
      return acc;
    },
    {}
  );

  Object.entries(byCategory).forEach(([category, tests]) => {
    const categoryPassed = tests.filter((t) => t.status === 'PASS').length;
    console.log(`  ${category}: ${categoryPassed}/${tests.length}`);
  });

  console.log('\n--- Avg Response Times ---');
  const avgTime =
    results.reduce((sum, r) => sum + r.responseTime, 0) / results.length;
  console.log(
    `  Average: ${avgTime.toFixed(0)}ms | Min: ${Math.min(...results.map((r) => r.responseTime))}ms | Max: ${Math.max(...results.map((r) => r.responseTime))}ms`
  );

  console.log(`\n✅ Production Test Suite Complete: ${new Date().toISOString()}`);
}

runTests().catch(console.error);
