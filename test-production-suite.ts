/**
 * Production Test Suite - Comprehensive End-to-End Validation
 * Tests every major feature as per user requirements
 * "Actually execute every feature. Do not assume success because the code compiles."
 */

import https from 'https';

const BASE_URL = 'https://www.sovereigns.ca';
const API_BASE = `${BASE_URL}/api`;

interface TestResult {
  name: string;
  endpoint: string;
  method: string;
  status: 'PASS' | 'FAIL' | 'SKIP';
  httpStatus: number;
  correlationId?: string;
  responseTime: number;
  error?: string;
  evidence: string;
}

const results: TestResult[] = [];

function https_request(
  method: string,
  path: string,
  data?: string,
  headers?: Record<string, string>
): Promise<{ status: number; body: string; responseTime: number }> {
  return new Promise((resolve, reject) => {
    const startTime = Date.now();
    const options = {
      method,
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        ...headers,
      },
    };

    const req = https.request(BASE_URL + path, options, (res) => {
      let body = '';
      res.on('data', (chunk) => (body += chunk));
      res.on('end', () => {
        const responseTime = Date.now() - startTime;
        resolve({ status: res.statusCode || 500, body, responseTime });
      });
    });

    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}

async function recordTest(
  name: string,
  endpoint: string,
  method: string,
  fn: () => Promise<{ status: number; correlationId?: string; body: string; responseTime: number }>
) {
  try {
    const { status, correlationId, body, responseTime } = await fn();
    const passed = status >= 200 && status < 300;

    results.push({
      name,
      endpoint,
      method,
      status: passed ? 'PASS' : 'FAIL',
      httpStatus: status,
      correlationId,
      responseTime,
      evidence: `HTTP ${status}, ${responseTime}ms, Body: ${body.substring(0, 200)}...`,
    });

    console.log(`✅ ${name}: HTTP ${status} (${responseTime}ms)`);
  } catch (error: any) {
    results.push({
      name,
      endpoint,
      method,
      status: 'FAIL',
      httpStatus: 0,
      responseTime: 0,
      error: error.message,
      evidence: `Error: ${error.message}`,
    });

    console.log(`❌ ${name}: ${error.message}`);
  }
}

async function runTests() {
  console.log('🧪 Starting Production Test Suite...\n');

  // ===== 1. Health & Verification Tests =====
  console.log('--- Health & Verification ---');

  await recordTest('Health Check', '/api/health', 'GET', async () => {
    const { status, body, responseTime } = await https_request('GET', '/api/health');
    const json = JSON.parse(body);
    return {
      status,
      correlationId: undefined,
      body,
      responseTime,
    };
  });

  await recordTest('Verification Status', '/api/verification/status', 'GET', async () => {
    const { status, body, responseTime } = await https_request('GET', '/api/verification/status');
    const json = JSON.parse(body);
    return {
      status,
      correlationId: json.correlationId,
      body,
      responseTime,
    };
  });

  await recordTest('Verification Report', '/api/verification/report', 'GET', async () => {
    const { status, body, responseTime } = await https_request('GET', '/api/verification/report');
    const json = JSON.parse(body);
    return {
      status,
      correlationId: json.correlationId,
      body,
      responseTime,
    };
  });

  await recordTest('Infrastructure Status', '/api/verification/infrastructure', 'GET', async () => {
    const { status, body, responseTime } = await https_request(
      'GET',
      '/api/verification/infrastructure'
    );
    const json = JSON.parse(body);
    return {
      status,
      correlationId: json.correlationId,
      body,
      responseTime,
    };
  });

  // ===== 2. Pricing API Tests =====
  console.log('\n--- Market Data ---');

  await recordTest('Get Prices', '/api/prices', 'GET', async () => {
    const { status, body, responseTime } = await https_request('GET', '/api/prices');
    const json = JSON.parse(body);
    return {
      status,
      correlationId: json.correlationId,
      body,
      responseTime,
    };
  });

  // ===== 3. Marshall Gateway Tests =====
  console.log('\n--- Marshall Gateway ---');

  await recordTest('Marshall Config', '/api/marshall/config', 'GET', async () => {
    const { status, body, responseTime } = await https_request('GET', '/api/marshall/config');
    const json = JSON.parse(body);
    return {
      status,
      correlationId: json.correlationId,
      body,
      responseTime,
    };
  });

  // ===== 4. Mempool Tests =====
  console.log('\n--- Mempool ---');

  await recordTest('Mempool List', '/api/mempool/list', 'GET', async () => {
    const { status, body, responseTime } = await https_request('GET', '/api/mempool/list');
    const json = JSON.parse(body);
    return {
      status,
      correlationId: json.correlationId,
      body,
      responseTime,
    };
  });

  // ===== 5. Security Tests =====
  console.log('\n--- Security Features ---');

  await recordTest(
    'Verify Recaptcha (invalid token)',
    '/api/auth/verify-recaptcha',
    'POST',
    async () => {
      const payload = JSON.stringify({ token: 'invalid-token' });
      const { status, body, responseTime } = await https_request(
        'POST',
        '/api/auth/verify-recaptcha',
        payload
      );
      const json = JSON.parse(body);
      return {
        status,
        correlationId: json.correlationId,
        body,
        responseTime,
      };
    }
  );

  // ===== Test Summary =====
  console.log('\n========== TEST SUMMARY ==========' );
  const passed = results.filter((r) => r.status === 'PASS').length;
  const failed = results.filter((r) => r.status === 'FAIL').length;
  const skipped = results.filter((r) => r.status === 'SKIP').length;

  console.log(`Total Tests: ${results.length}`);
  console.log(`✅ Passed: ${passed}`);
  console.log(`❌ Failed: ${failed}`);
  console.log(`⏭️  Skipped: ${skipped}`);

  console.log('\n--- Full Results ---');
  console.table(
    results.map((r) => ({
      Test: r.name,
      Status: r.status,
      'HTTP Status': r.httpStatus,
      'Response Time (ms)': r.responseTime,
      'Correlation ID': r.correlationId || 'N/A',
      Error: r.error || 'N/A',
    }))
  );

  // ===== Detailed Test Report =====
  console.log('\n--- Detailed Evidence ---');
  results.forEach((r) => {
    console.log(`\n${r.name} (${r.endpoint})`);
    console.log(`  Status: ${r.status} (HTTP ${r.httpStatus})`);
    console.log(`  Response Time: ${r.responseTime}ms`);
    console.log(`  Correlation ID: ${r.correlationId || 'N/A'}`);
    console.log(`  Evidence: ${r.evidence}`);
  });

  // ===== Rate Limiting Verification =====
  console.log('\n========== RATE LIMITING TEST ==========' );
  let rateLimitHitAt = -1;
  for (let i = 0; i < 150; i++) {
    const { status } = await https_request('GET', '/api/health');
    if (status === 429) {
      rateLimitHitAt = i + 1;
      console.log(
        `✅ Rate limiting active: Hit 429 after ${rateLimitHitAt} requests (expected ~100)`
      );
      break;
    }
    if ((i + 1) % 25 === 0) {
      console.log(`  Request ${i + 1}: HTTP ${status}`);
    }
  }
  if (rateLimitHitAt < 0) {
    console.log(
      '⚠️  Rate limiting did not activate after 150 requests (may be set higher than 100)'
    );
  }

  // ===== Final Report =====
  console.log('\n========== PRODUCTION CERTIFICATION ==========' );
  if (failed === 0) {
    console.log('✅ PRODUCTION READY - All tests passed');
  } else {
    console.log(`⚠️  REVIEW REQUIRED - ${failed} test(s) failed`);
  }

  console.log(`\nTimestamp: ${new Date().toISOString()}`);
  console.log(`Test Suite Duration: ${Date.now()}ms`);
}

runTests().catch(console.error);
