import assert from 'node:assert/strict';
import fetch from 'node-fetch';
import { db } from '../src/db/ledger.js';

function parseCookie(setCookieHeader: string | null): string {
  if (!setCookieHeader) return '';
  return setCookieHeader.split(';')[0] || '';
}

async function run() {
  process.env.NODE_ENV = 'production';
  process.env.PORT = '4021';
  process.env.BYPASS_EMAIL_VERIFICATION = 'true';
  process.env.STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY || 'sk_test_fallback_proof';
  if (!process.env.SOVEREIGN_ENCRYPTION_KEY || process.env.SOVEREIGN_ENCRYPTION_KEY.trim().length < 32) {
    process.env.SOVEREIGN_ENCRYPTION_KEY = 'abcdefghijklmnopqrstuvwxyzABCDEF012345';
  }
  if (!process.env.JWT_SECRET || process.env.JWT_SECRET.trim().length < 32) {
    process.env.JWT_SECRET = 'abcdefghijklmnopqrstuvwxyzABCDEF012345';
  }
  if (!process.env.SOVEREIGN_ADMIN_EMAILS) {
    process.env.SOVEREIGN_ADMIN_EMAILS = 'admin@secure.local';
  }

  const nativeFetch = globalThis.fetch.bind(globalThis);
  globalThis.fetch = async (input: any, init?: any): Promise<Response> => {
    const url = typeof input === 'string' ? input : String(input?.url || '');

    // Test-only Stripe stubs to make finalize deterministic and independent of external accounts.
    if (url.startsWith('https://api.stripe.com/v1/account')) {
      return new Response(JSON.stringify({ id: 'acct_test_fallback', default_currency: 'usd' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    if (url.startsWith('https://api.stripe.com/v1/payouts')) {
      return new Response(JSON.stringify({ id: 'po_test_fallback', status: 'paid' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    return nativeFetch(input, init);
  };

  await import('../server.ts');
  await new Promise((resolve) => setTimeout(resolve, 4500));

  const email = `tg-proof-${Date.now()}@example.com`;
  const password = 'CorrectHorseBatteryStaple!42';

  const registerRes = await fetch('http://localhost:4021/api/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email,
      password,
      firstName: 'Fallback',
      lastName: 'Proof',
      citizenship: 'CA'
    })
  });
  assert.equal(registerRes.ok, true, `register failed: ${registerRes.status}`);

  const loginRes = await fetch('http://localhost:4021/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password })
  });
  assert.equal(loginRes.ok, true, `login failed: ${loginRes.status}`);
  const loginJson = await loginRes.json() as { user?: { id?: string } };

  const cookie = parseCookie(loginRes.headers.get('set-cookie'));
  assert.ok(cookie, 'expected authenticated session cookie');
  const userId = String(loginJson?.user?.id || '').trim();
  assert.ok(userId, 'missing user id from login response');

  // Seed balance so withdrawal finalize can execute payout.
  const existingWalletRows = db.execute('SELECT * FROM wallets WHERE user_id = ? AND asset_symbol = ?', [userId, 'USD']) as any[];
  if (existingWalletRows.length > 0) {
    db.execute('UPDATE wallets SET balance = ? WHERE user_id = ? AND asset_symbol = ?', [500, userId, 'USD']);
  } else {
    db.execute(
      'INSERT INTO wallets (id, user_id, asset_symbol, balance) VALUES (?, ?, ?, ?)',
      [`wallet_${Date.now()}`, userId, 'USD', 500]
    );
  }

  const initRes = await fetch('http://localhost:4021/api/withdraw/redirect', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', cookie },
    body: JSON.stringify({ amount: 11.11, bankId: 'tangerine' })
  });
  const initJson = await initRes.json() as { state?: string; authorization_redirect_url?: string };
  assert.equal(initRes.status, 200, `withdraw redirect init failed: ${initRes.status}`);
  assert.ok(initJson.state, 'missing state from initiation');

  const state = String(initJson.state);

  const callbackRes = await fetch(`http://localhost:4021/api/withdraw/callback?state=${encodeURIComponent(state)}`, {
    redirect: 'manual'
  });
  assert.equal(callbackRes.status, 302, `callback did not redirect: ${callbackRes.status}`);

  const location = String(callbackRes.headers.get('location') || '');
  assert.ok(location, 'callback redirect location missing');

  const callbackUrl = new URL(location, 'https://www.pay.sovereigns.ca');
  const fallbackCode = String(callbackUrl.searchParams.get('code') || '');
  const warning = String(callbackUrl.searchParams.get('warning') || '');

  assert.ok(fallbackCode.startsWith('FALLBACK_AUTH_'), `expected fallback code, got: ${fallbackCode}`);
  assert.equal(warning, 'MISSING_CODE_FALLBACK', `expected warning MISSING_CODE_FALLBACK, got: ${warning}`);

  const finalizeRes = await fetch('http://localhost:4021/api/v1/interac/finalize', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', cookie },
    body: JSON.stringify({
      transfer_id: state,
      selected_bank_key: 'tangerine',
      oauth_authorization_token: fallbackCode
    })
  });

  const finalizeJson = await finalizeRes.json() as { status?: string; tracking_reference_id?: string; operation_type?: string; amount_usd?: number };
  assert.equal(finalizeRes.status, 200, `finalize failed: ${finalizeRes.status} ${JSON.stringify(finalizeJson)}`);
  assert.equal(String(finalizeJson.operation_type || ''), 'WITHDRAWAL', 'finalize operation_type should be WITHDRAWAL');
  assert.ok(String(finalizeJson.tracking_reference_id || '').startsWith('0x'), 'tracking reference hash missing');

  console.log('proof_init_status', initRes.status);
  console.log('proof_callback_warning', warning);
  console.log('proof_fallback_code', fallbackCode);
  console.log('proof_finalize_status', finalizeRes.status);
  console.log('proof_finalize_operation', finalizeJson.operation_type);
  console.log('proof_tracking_reference', finalizeJson.tracking_reference_id);
  console.log('Tangerine missing-code fallback finalize E2E passed.');
}

run()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err?.stack || String(err));
    process.exit(1);
  });
