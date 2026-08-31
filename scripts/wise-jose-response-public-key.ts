import crypto from 'crypto';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { getWiseClientId, getWiseClientSecret } from '../src/lib/wise-env.js';

const credentialsPath = path.join(process.cwd(), 'config', '.env.credentials');
if (fs.existsSync(credentialsPath)) {
  dotenv.config({ path: credentialsPath, override: true });
}

const wiseBaseUrl = String(process.env.WISE_BASE_URL || 'https://api.wise.com').trim().replace(/\/$/, '');
const oauthTokenUrl = String(process.env.WISE_OAUTH_TOKEN_URL || `${wiseBaseUrl}/oauth/token`).trim();
const clientId = getWiseClientId();
const clientSecret = getWiseClientSecret();
const outputPath = path.resolve(process.cwd(), String(process.env.WISE_WEBHOOK_PUBLIC_KEY_OUTPUT_PATH || 'config/wise-webhook-public.pem'));

async function getClientCredentialsToken(): Promise<string> {
  if (!clientId || !clientSecret) {
    throw new Error('WISE_CLIENT_ID and WISE_CLIENT_SECRET are required');
  }

  const basic = Buffer.from(`${clientId}:${clientSecret}`, 'utf8').toString('base64');
  const response = await fetch(oauthTokenUrl, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${basic}`,
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: 'grant_type=client_credentials'
  });

  const text = await response.text();
  let json: any = {};
  try {
    json = JSON.parse(text);
  } catch {
    json = { raw: text };
  }

  if (!response.ok || !json?.access_token) {
    throw new Error(`Unable to obtain client credentials token: ${JSON.stringify(json)}`);
  }

  return String(json.access_token).trim();
}

function extractPem(payload: any): string {
  const candidates = [
    payload?.publicKey,
    payload?.pem,
    payload?.key,
    payload?.value,
    payload?.keys?.[0]?.publicKey,
    payload?.keys?.[0]?.pem,
    payload?.keys?.[0]?.key,
    payload?.keys?.[0]?.value
  ];

  for (const candidate of candidates) {
    const value = String(candidate || '').trim();
    if (value.includes('BEGIN PUBLIC KEY')) {
      return value.replace(/\\n/g, '\n');
    }
  }

  throw new Error(`Unable to extract PEM public key from response: ${JSON.stringify(payload)}`);
}

async function main() {
  const token = await getClientCredentialsToken();
  const response = await fetch(`${wiseBaseUrl}/v1/auth/jose/response/public-keys`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/json',
      'X-External-Correlation-Id': crypto.randomUUID()
    }
  });

  const text = await response.text();
  let json: any = text;
  try {
    json = JSON.parse(text);
  } catch {
    json = { raw: text };
  }

  if (!response.ok) {
    throw new Error(`Failed to fetch Wise JOSE public key (${response.status}): ${JSON.stringify(json)}`);
  }

  const pem = extractPem(json);
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, pem.endsWith('\n') ? pem : `${pem}\n`, 'utf8');
  console.log(`Saved Wise public key to ${outputPath}`);
}

main().catch((err: any) => {
  console.error(err?.stack || String(err));
  process.exit(1);
});