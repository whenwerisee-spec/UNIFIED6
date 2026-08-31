#!/usr/bin/env node
import fs from 'fs';

const baseUrl = String(process.env.AUTH_BASE_URL || 'https://www.pay.sovereigns.ca').replace(/\/$/, '');
const email = String(process.env.AUTH_EMAIL || '').trim();
const password = String(process.env.AUTH_PASSWORD || '').trim();
const mfaCode = String(process.env.AUTH_MFA_CODE || '').trim();
const outFile = String(process.env.AUTH_COOKIE_FILE || '.tmp_cb_session_cookie.txt').trim();

if (!email || !password) {
  console.error('Missing required env vars: AUTH_EMAIL and AUTH_PASSWORD');
  process.exit(1);
}

async function main() {
  const loginPayload = {
    email,
    password,
    ...(mfaCode ? { mfaCode } : {})
  };

  const loginRes = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(loginPayload)
  });

  const loginText = await loginRes.text();
  let loginJson = null;
  try {
    loginJson = JSON.parse(loginText);
  } catch {
    loginJson = { raw: loginText };
  }

  if (!loginRes.ok) {
    console.error(`Login failed: HTTP ${loginRes.status}`);
    console.error(JSON.stringify(loginJson, null, 2));
    process.exit(1);
  }

  const setCookie = loginRes.headers.get('set-cookie') || '';
  const match = setCookie.match(/cb_session=([^;]+)/);
  if (!match || !match[1]) {
    console.error('Login succeeded but cb_session cookie was not returned.');
    process.exit(1);
  }

  const cookieHeader = `cb_session=${match[1]}`;
  fs.writeFileSync(outFile, cookieHeader, 'utf8');
  console.log(`Cookie written to ${outFile}`);

  const coinbaseTestRes = await fetch(`${baseUrl}/api/coinbase/test`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      cookie: cookieHeader
    },
    body: '{}'
  });
  const coinbaseTestText = await coinbaseTestRes.text();
  console.log(`coinbase/test -> HTTP ${coinbaseTestRes.status}`);
  console.log(coinbaseTestText);

  const queueRes = await fetch(`${baseUrl}/api/admin/payouts/process-queue`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      cookie: cookieHeader
    },
    body: '{}'
  });
  const queueText = await queueRes.text();
  console.log(`admin/payouts/process-queue -> HTTP ${queueRes.status}`);
  console.log(queueText);
}

main().catch((err) => {
  console.error(err?.message || err);
  process.exit(1);
});
