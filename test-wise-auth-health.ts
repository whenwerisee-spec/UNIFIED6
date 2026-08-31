import fetch from 'node-fetch';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';

const credentialsPath = path.join(process.cwd(), 'config', '.env.credentials');
if (fs.existsSync(credentialsPath)) {
  dotenv.config({ path: credentialsPath, override: false });
}

const baseUrl = String(process.env.BASE_URL || 'http://localhost:3000').trim();

async function main() {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('  WISE AUTH HEALTH CHECK');
  console.log('═══════════════════════════════════════════════════════════');
  console.log(`Base URL: ${baseUrl}`);

  const response = await fetch(`${baseUrl}/api/withdrawal/wise-auth/health`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      // Non-production suite runs use explicit test bypass with X-User-ID.
      'X-User-ID': 'wise-ops-health-check'
    }
  });

  const text = await response.text();
  let data: any = {};
  try {
    data = JSON.parse(text);
  } catch {
    data = { raw: text };
  }

  if (!response.ok) {
    const errorCode = String(data?.error || '').toUpperCase();
    if (response.status === 401 || errorCode === 'UNAUTHORIZED') {
      throw new Error('WISE_AUTH_HEALTH_UNAUTHORIZED: Auth required for /wise-auth/health in current runtime mode');
    }
    if (response.status === 503 || errorCode === 'SERVICE_UNAVAILABLE') {
      throw new Error('WISE_AUTH_HEALTH_UNAVAILABLE: Wise integration not configured');
    }
    throw new Error(`WISE_AUTH_HEALTH_FAILED: status=${response.status} body=${JSON.stringify(data)}`);
  }

  const auth = data?.auth || {};
  console.log('Auth Snapshot:');
  console.log(`  mode: ${String(auth.mode || 'unknown')}`);
  console.log(`  tokenShape: ${String(auth.tokenShape || 'unknown')}`);
  console.log(`  hasToken: ${Boolean(auth.hasToken)}`);
  console.log(`  hasCachedToken: ${Boolean(auth.hasCachedToken)}`);
  console.log(`  expiresAt: ${auth.expiresAt || 'n/a'}`);
  console.log(`  expiresInSeconds: ${auth.expiresInSeconds ?? 'n/a'}`);
  console.log(`  refreshInFlight: ${Boolean(auth.refreshInFlight)}`);
  console.log('');
  console.log('Auth health status: PASS');
}

main().catch((err: any) => {
  console.error('Auth health status: FAIL');
  console.error(err?.message || String(err));
  process.exit(1);
});
