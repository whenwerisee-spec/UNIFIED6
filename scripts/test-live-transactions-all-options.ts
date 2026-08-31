import express from 'express';
import fetch from 'node-fetch';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

type TxResult = {
  bank: string;
  initiateOk: boolean;
  callbackOk: boolean;
  finalizeOk: boolean;
  finalizeStatus: number;
  finalizeBody: any;
};

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

  app.post('/token', express.urlencoded({ extended: true }), (_req, res) => {
    const access = 'mock_access_' + crypto.randomBytes(4).toString('hex');
    const idToken = 'header.payload.signature';
    return res.json({
      access_token: access,
      token_type: 'bearer',
      expires_in: 3600,
      id_token: idToken,
    });
  });

  return new Promise<any>((resolve) => {
    const server = app.listen(port, () => resolve(server));
  });
}

async function postJson(url: string, body: any, cookie = '') {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (cookie) headers.cookie = cookie;

  const res = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });

  let json: any = {};
  try {
    json = await res.json();
  } catch {
    json = { error: 'NON_JSON_RESPONSE' };
  }

  return { status: res.status, json, headers: res.headers };
}

async function getUrl(url: string) {
  const res = await fetch(url, { redirect: 'manual' });
  return { status: res.status, headers: res.headers };
}

async function run() {
  const mockBankServer = await startMockBank(9100);
  process.env.PORT = '4002';
  process.env.BYPASS_EMAIL_VERIFICATION = 'true';

  await import('../server.ts');
  await new Promise((r) => setTimeout(r, 3500));

  const email = `live-matrix-${Date.now()}@example.com`;
  const password = 'CorrectHorseBatteryStaple!42';

  try {
    const register = await postJson('http://localhost:4002/api/auth/register', {
      email,
      password,
      firstName: 'Live',
      lastName: 'Matrix',
      citizenship: 'CA',
    });

    if (register.status >= 400) {
      throw new Error(`Register failed: HTTP ${register.status} ${JSON.stringify(register.json)}`);
    }

    const login = await postJson('http://localhost:4002/api/auth/login', { email, password });
    const cookie = parseCookie(login.headers.get('set-cookie'));

    if (!cookie) {
      throw new Error('Login failed: missing cb_session cookie');
    }

    // Seed funds once so withdrawal finalization can settle across all banks.
    const depositInit = await postJson(
      'http://localhost:4002/api/v1/interac/initiate',
      {
        operation_type: 'DEPOSIT',
        recipient_email: email,
        amount_cad: 500,
        security_answer: 'sovereigns',
      },
      cookie
    );

    const seedTransferId = String(depositInit.json?.transfer_id || '');
    if (!seedTransferId) {
      throw new Error(`Seed deposit init failed: HTTP ${depositInit.status} ${JSON.stringify(depositInit.json)}`);
    }

    await getUrl(`http://localhost:4002/api/v1/interac/callback?transfer_id=${encodeURIComponent(seedTransferId)}&state=${encodeURIComponent(seedTransferId)}&code=SEED_DEPOSIT_CODE`);

    const depositFinalize = await postJson(
      'http://localhost:4002/api/v1/interac/finalize',
      {
        transfer_id: seedTransferId,
        selected_bank_key: 'tangerine',
        oauth_authorization_token: 'SEED_DEPOSIT_CODE',
      },
      cookie
    );

    if (depositFinalize.status >= 400) {
      throw new Error(`Seed deposit finalize failed: HTTP ${depositFinalize.status} ${JSON.stringify(depositFinalize.json)}`);
    }

    const registryPath = path.join(process.cwd(), 'config', 'BankRegistry.json');
    const registry = JSON.parse(fs.readFileSync(registryPath, 'utf-8')) as Record<string, any>;
    const banks = Object.keys(registry);

    const results: TxResult[] = [];

    for (const bank of banks) {
      const amount = 5;
      const initiate = await postJson(
        'http://localhost:4002/api/withdraw/redirect',
        { amount, bankId: bank },
        cookie
      );

      const state = String(initiate.json?.state || '');
      const initiateOk = initiate.status >= 200 && initiate.status < 300 && state.length > 0;

      let callbackOk = false;
      let finalizeOk = false;
      let finalizeStatus = 0;
      let finalizeBody: any = { error: 'NOT_RUN' };

      if (initiateOk) {
        const callback = await getUrl(
          `http://localhost:4002/api/withdraw/callback?state=${encodeURIComponent(state)}&code=${encodeURIComponent('LIVE_CODE_' + bank)}`
        );
        callbackOk = callback.status >= 300 && callback.status < 400;

        const finalize = await postJson(
          'http://localhost:4002/api/v1/interac/finalize',
          {
            transfer_id: state,
            selected_bank_key: bank,
            oauth_authorization_token: 'LIVE_CODE_' + bank,
          },
          cookie
        );

        finalizeStatus = finalize.status;
        finalizeBody = finalize.json;
        finalizeOk = finalize.status >= 200 && finalize.status < 300;
      } else {
        finalizeBody = initiate.json;
        finalizeStatus = initiate.status;
      }

      results.push({
        bank,
        initiateOk,
        callbackOk,
        finalizeOk,
        finalizeStatus,
        finalizeBody,
      });
    }

    const passed = results.filter((r) => r.initiateOk && r.callbackOk && r.finalizeOk).length;

    console.log('\n=== Live Transaction Matrix (Per Bank Option) ===');
    console.table(
      results.map((r) => ({
        bank: r.bank,
        initiate: r.initiateOk ? 'PASS' : 'FAIL',
        callback: r.callbackOk ? 'PASS' : 'FAIL',
        finalize: r.finalizeOk ? 'PASS' : 'FAIL',
        finalizeStatus: r.finalizeStatus,
      }))
    );

    console.log(`Passed ${passed}/${results.length} options`);

    const failed = results.filter((r) => !(r.initiateOk && r.callbackOk && r.finalizeOk));
    if (failed.length) {
      console.log('\nFailed option details:');
      for (const f of failed) {
        console.log(`${f.bank}: HTTP ${f.finalizeStatus} ${JSON.stringify(f.finalizeBody)}`);
      }
      process.exitCode = 1;
    } else {
      process.exitCode = 0;
    }
  } finally {
    mockBankServer.close();
  }
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
