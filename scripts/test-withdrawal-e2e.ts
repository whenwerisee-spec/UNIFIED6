import express from 'express';
import fetch from 'node-fetch';
import crypto from 'crypto';

function parseCookie(setCookieHeader: string | null): string {
  if (!setCookieHeader) return '';
  return setCookieHeader.split(';')[0] || '';
}

async function startMockBank(port = 9100) {
  const app = express();
  app.use(express.urlencoded({ extended: true }));
  app.get('/authorize', (req, res) => {
    const { redirect_uri, state } = req.query;
    return res.redirect(`${redirect_uri}?code=MOCKCODE123&state=${state}`);
  });

  app.post('/token', express.urlencoded({ extended: true }), (req, res) => {
    const access = 'mock_access_' + crypto.randomBytes(4).toString('hex');
    const idToken = 'header.payload.signature';
    return res.json({ access_token: access, token_type: 'bearer', expires_in: 3600, id_token: idToken });
  });

  return new Promise((resolve) => {
    const server = app.listen(port, () => resolve(server));
  });
}

async function run() {
  const bankServer: any = await startMockBank(9100);
  console.log('Mock bank started on 9100');

  process.env.PORT = '4001';
  process.env.BYPASS_EMAIL_VERIFICATION = 'true';
  await import('../server.ts');
  await new Promise((r) => setTimeout(r, 4000));

  try {
    const email = `e2e-${Date.now()}@example.com`;
    const password = 'CorrectHorseBatteryStaple!42';

    const registerRes = await fetch('http://localhost:4001/api/auth/register', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, firstName: 'Live', lastName: 'Test', citizenship: 'US' })
    });
    const registerJson = await registerRes.json();
    console.log('Register response:', registerJson);

    const loginRes = await fetch('http://localhost:4001/api/auth/login', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    const loginJson = await loginRes.json();
    const cookie = parseCookie(loginRes.headers.get('set-cookie'));
    console.log('Login response:', loginJson);

    if (!cookie) {
      throw new Error('Expected cb_session cookie from login response.');
    }

    const initRes = await fetch('http://localhost:4001/api/withdraw/redirect', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', cookie },
      body: JSON.stringify({ amount: 12.34, bankId: 'mockbank' })
    });
    const initJson = (await initRes.json()) as { state?: string };
    console.log('Initiation response:', initJson);

    const state = initJson.state;
    if (!state) {
      throw new Error('Expected state from withdrawal redirect initiation response.');
    }

    await fetch(`http://localhost:4001/api/withdraw/callback?state=${state}&code=MOCKCODE123`, { redirect: 'manual' });

    const finalizeRes = await fetch('http://localhost:4001/api/v1/interac/finalize', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', cookie },
      body: JSON.stringify({ transfer_id: state, selected_bank_key: 'mockbank', oauth_authorization_token: 'MOCKCODE123' })
    });
    const finJson = await finalizeRes.json();
    console.log('Finalize response:', finJson);
  } finally {
    bankServer.close();
  }
}

run()
  .then(() => {
    console.log('E2E withdrawal transaction flow completed successfully.');
    process.exit(0);
  })
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
