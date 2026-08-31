import fetch from 'node-fetch';

function parseCookie(setCookieHeader: string | null): string {
  if (!setCookieHeader) return '';
  return setCookieHeader.split(';')[0] || '';
}

async function run() {
  process.env.NODE_ENV = 'production';
  process.env.PORT = '4011';
  process.env.BYPASS_EMAIL_VERIFICATION = 'true';
  if (!process.env.SOVEREIGN_ENCRYPTION_KEY || process.env.SOVEREIGN_ENCRYPTION_KEY.trim().length < 32) {
    process.env.SOVEREIGN_ENCRYPTION_KEY = 'abcdefghijklmnopqrstuvwxyzABCDEF012345';
  }
  if (!process.env.JWT_SECRET || process.env.JWT_SECRET.trim().length < 32) {
    process.env.JWT_SECRET = 'abcdefghijklmnopqrstuvwxyzABCDEF012345';
  }
  if (!process.env.SOVEREIGN_ADMIN_EMAILS) {
    process.env.SOVEREIGN_ADMIN_EMAILS = 'admin@secure.local';
  }

  await import('../server.ts');
  await new Promise((resolve) => setTimeout(resolve, 4500));

  const email = `tg-redirect-${Date.now()}@example.com`;
  const password = 'CorrectHorseBatteryStaple!42';

  const registerRes = await fetch('http://localhost:4011/api/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email,
      password,
      firstName: 'Tangerine',
      lastName: 'Redirect',
      citizenship: 'CA'
    })
  });

  if (!registerRes.ok) {
    throw new Error(`Register failed with status ${registerRes.status}`);
  }

  const loginRes = await fetch('http://localhost:4011/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password })
  });

  if (!loginRes.ok) {
    throw new Error(`Login failed with status ${loginRes.status}`);
  }

  const cookie = parseCookie(loginRes.headers.get('set-cookie'));
  if (!cookie) {
    throw new Error('Expected authenticated session cookie.');
  }

  const initRes = await fetch('http://localhost:4011/api/withdraw/redirect', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', cookie },
    body: JSON.stringify({ amount: 11.11, bankId: 'tangerine' })
  });

  const initJson = await initRes.json() as { authorization_redirect_url?: string; state?: string; error?: string; message?: string };
  if (!initRes.ok) {
    throw new Error(`Initiation failed (${initRes.status}): ${initJson.error || ''} ${initJson.message || ''}`.trim());
  }

  const redirectUrl = String(initJson.authorization_redirect_url || '');
  const state = String(initJson.state || '');
  if (!redirectUrl || !state) {
    throw new Error('Expected authorization_redirect_url and state from initiation response.');
  }

  const parsed = new URL(redirectUrl);
  const opType = parsed.searchParams.get('operation_type');
  const operation = parsed.searchParams.get('operation');

  if (!parsed.hostname.toLowerCase().includes('tangerine.ca')) {
    throw new Error(`Unexpected redirect host: ${parsed.hostname}`);
  }
  if (opType !== 'WITHDRAWAL' || operation !== 'WITHDRAWAL') {
    throw new Error(`Unexpected operation flags: operation_type=${opType}, operation=${operation}`);
  }

  console.log('status', initRes.status);
  console.log('state', state);
  console.log('redirect', redirectUrl);
  console.log('operation_type', opType);
  console.log('operation', operation);
}

run()
  .then(() => {
    console.log('Tangerine withdrawal redirect smoke test passed.');
    process.exit(0);
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
