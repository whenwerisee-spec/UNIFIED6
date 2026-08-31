import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import https from 'https';

// Load environment variables from standard locations
const envPath = path.join(process.cwd(), '.env');
if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath, override: true });
}

const credentialsPath = path.join(process.cwd(), 'config', '.env.credentials');
if (fs.existsSync(credentialsPath)) {
  dotenv.config({ path: credentialsPath, override: true });
}

const token = String(process.env.WISE_API_TOKEN || '').trim();
const baseUrl = String(process.env.WISE_BASE_URL || 'https://api.wise.com').trim().replace(/\/$/, '');

// Load mTLS client certificates
const certPath = process.env.WISE_MTLS_CERT_PATH || path.join(process.cwd(), 'config', 'wise-mtls-cert.pem');
const keyPath = process.env.WISE_MTLS_KEY_PATH || path.join(process.cwd(), 'config', 'wise-mtls-key.pem');

let cert: Buffer | string | undefined;
let key: Buffer | string | undefined;
let mtlsSource = 'none';

if (process.env.WISE_MTLS_CERT && process.env.WISE_MTLS_KEY) {
  cert = process.env.WISE_MTLS_CERT;
  key = process.env.WISE_MTLS_KEY;
  mtlsSource = 'environment_variables';
} else {
  try {
    if (fs.existsSync(certPath) && fs.existsSync(keyPath)) {
      cert = fs.readFileSync(certPath);
      key = fs.readFileSync(keyPath);
      mtlsSource = `files (${certPath}, ${keyPath})`;
    }
  } catch (err: any) {
    console.warn('[mTLS DIAGNOSTIC] Warning loading cert files:', err.message);
  }
}

const mtlsEnabled = Boolean(cert && key);

let httpsAgent: https.Agent | undefined;
if (mtlsEnabled) {
  httpsAgent = new https.Agent({
    cert,
    key,
    keepAlive: true,
    rejectUnauthorized: true
  });
}

function makeMtlsRequest(urlStr: string, method = 'GET', body?: any): Promise<{
  statusCode: number;
  headers: Record<string, string | string[] | undefined>;
  raw: string;
  json: any;
}> {
  return new Promise((resolve, reject) => {
    const url = new URL(urlStr);
    const options: https.RequestOptions = {
      hostname: url.hostname,
      port: url.port || 443,
      path: url.pathname + url.search,
      method,
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'User-Agent': 'SovereignWiseDiagnosticEngine/1.0'
      },
      agent: httpsAgent
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        let json: any = null;
        try {
          json = JSON.parse(data);
        } catch {
          json = data;
        }
        resolve({
          statusCode: res.statusCode || 0,
          headers: res.headers,
          raw: data,
          json
        });
      });
    });

    req.on('error', (err) => {
      reject(err);
    });

    if (body) {
      req.write(typeof body === 'string' ? body : JSON.stringify(body));
    }
    req.end();
  });
}

async function runDiagnostics() {
  console.log('===================================================================');
  console.log('🔍 WISE API REAL-TIME mTLS BALANCE DIAGNOSTICS SUITE');
  console.log('===================================================================');
  console.log(`Timestamp: ${new Date().toISOString()}`);
  console.log(`Base URL: ${baseUrl}`);
  console.log(`API Token Configured: ${token ? 'YES (' + token.substring(0, 8) + '...)' : 'NO'}`);
  console.log(`mTLS Status: ${mtlsEnabled ? 'ACTIVE / ENABLED' : 'INACTIVE (Fallback to Bearer token)'}`);
  console.log(`mTLS Source: ${mtlsSource}`);
  console.log('-------------------------------------------------------------------\n');

  if (!token) {
    console.error('❌ ERROR: WISE_API_TOKEN is missing from environment. Diagnostics aborted.');
    process.exit(1);
  }

  // Step 1: Query User Profiles
  console.log('📋 STEP 1: Fetching User Profiles...');
  try {
    const profilesRes = await makeMtlsRequest(`${baseUrl}/v2/profiles`);
    console.log(`Response Code: ${profilesRes.statusCode}`);
    if (profilesRes.statusCode !== 200) {
      console.log('Response Headers:', JSON.stringify(profilesRes.headers, null, 2));
      console.log('Response Body:', profilesRes.raw);
    } else {
      const profiles = Array.isArray(profilesRes.json) ? profilesRes.json : [];
      console.log(`Found ${profiles.length} profile(s):`);
      for (const p of profiles) {
        console.log(`  - Profile ID: ${p.id} | Type: ${p.type} | Name: ${p.fullName || p.name || 'N/A'} | Status: ${p.details?.status || 'ACTIVE'}`);
      }

      // Step 2: Query Balances for Each Profile
      for (const p of profiles) {
        console.log(`\n💰 STEP 2: Fetching Balances for Profile ${p.id} (${p.type})...`);
        
        // Test /v4/profiles/{id}/balances?types=STANDARD
        const balV4StandardRes = await makeMtlsRequest(`${baseUrl}/v4/profiles/${p.id}/balances?types=STANDARD`);
        console.log(`  [/v4/profiles/${p.id}/balances?types=STANDARD] Status: ${balV4StandardRes.statusCode}`);
        if (balV4StandardRes.headers['x-2fa-approval'] || balV4StandardRes.headers['x-2fa-approval-result']) {
          console.log(`    ⚠️ SCA/2FA Header detected: result=${balV4StandardRes.headers['x-2fa-approval-result']}, token=${balV4StandardRes.headers['x-2fa-approval']}`);
        }
        if (balV4StandardRes.statusCode === 200 && Array.isArray(balV4StandardRes.json)) {
          console.log(`    Found ${balV4StandardRes.json.length} STANDARD balance object(s):`);
          for (const b of balV4StandardRes.json) {
            console.log(`      * Balance ID: ${b.id} | Currency: ${b.amount?.currency || b.currency} | Amount: ${b.amount?.value ?? b.amount} | Type: ${b.type || 'STANDARD'}`);
          }
        } else {
          console.log(`    Raw Response: ${balV4StandardRes.raw.substring(0, 300)}`);
        }

        // Test /v4/profiles/{id}/balances?types=SAVINGS
        const balV4SavingsRes = await makeMtlsRequest(`${baseUrl}/v4/profiles/${p.id}/balances?types=SAVINGS`);
        console.log(`  [/v4/profiles/${p.id}/balances?types=SAVINGS] Status: ${balV4SavingsRes.statusCode}`);
        if (balV4SavingsRes.statusCode === 200 && Array.isArray(balV4SavingsRes.json)) {
          console.log(`    Found ${balV4SavingsRes.json.length} SAVINGS balance object(s):`);
          for (const b of balV4SavingsRes.json) {
            console.log(`      * Balance ID: ${b.id} | Currency: ${b.amount?.currency || b.currency} | Amount: ${b.amount?.value ?? b.amount} | Type: ${b.type || 'SAVINGS'}`);
          }
        }

        // Test /v4/profiles/{id}/balances?types=INVESTMENT
        const balV4InvestRes = await makeMtlsRequest(`${baseUrl}/v4/profiles/${p.id}/balances?types=INVESTMENT`);
        console.log(`  [/v4/profiles/${p.id}/balances?types=INVESTMENT] Status: ${balV4InvestRes.statusCode}`);
        if (balV4InvestRes.statusCode === 200 && Array.isArray(balV4InvestRes.json)) {
          console.log(`    Found ${balV4InvestRes.json.length} INVESTMENT balance object(s):`);
          for (const b of balV4InvestRes.json) {
            console.log(`      * Balance ID: ${b.id} | Currency: ${b.amount?.currency || b.currency} | Amount: ${b.amount?.value ?? b.amount} | Type: ${b.type || 'INVESTMENT'}`);
          }
        }
      }
    }
  } catch (err: any) {
    console.error('❌ Request Error during diagnostic run:', err.message);
  }

  console.log('\n===================================================================');
  console.log('💡 DIAGNOSTIC SUMMARY & ZERO-BALANCE ANALYSIS');
  console.log('===================================================================');
  console.log('Common causes for 0 balance on Wise API:');
  console.log('1. Balance Type Filter: Standard query `/v4/.../balances` defaults to STANDARD. Vault or jar balances may be under SAVINGS or INVESTMENT.');
  console.log('2. Profile Context: Personal profile ID vs. Business profile ID. Virtual cards and balances are often tied strictly to the Business profile.');
  console.log('3. mTLS Gateway Binding: Without client certificate TLS binding, certain production enterprise endpoints return masked/zeroed security placeholders.');
  console.log('4. SCA/2FA Step-up Requirement: If `x-2fa-approval-result: REJECTED` header is present, a 2FA step-up token is required.');
  console.log('===================================================================\n');
}

runDiagnostics();
