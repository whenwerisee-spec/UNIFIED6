import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';
import net from 'net';
import { generateTotpCode } from '../src/lib/auth-security.ts';

const repoRoot = process.cwd();
const dbPath = path.join(repoRoot, 'src', 'db', 'database.json');
const lockPath = path.join(repoRoot, 'src', 'db', 'bootstrap.lock');
async function getAvailablePort(): Promise<number> {
  return await new Promise<number>((resolve, reject) => {
    const server = net.createServer();
    server.on('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const addr = server.address();
      const port = typeof addr === 'object' && addr ? addr.port : 0;
      server.close(() => resolve(port));
    });
  });
}

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(message);
}

function readFileIfExists(filePath: string): string | null {
  return fs.existsSync(filePath) ? fs.readFileSync(filePath, 'utf-8') : null;
}

function writeFileOrDelete(filePath: string, content: string | null) {
  if (content === null) {
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    return;
  }
  fs.writeFileSync(filePath, content, 'utf-8');
}

function parseCookie(setCookieHeader: string | null): string {
  if (!setCookieHeader) return '';
  return setCookieHeader.split(';')[0] || '';
}

async function waitForServerReady(proc: ReturnType<typeof spawn>): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    let settled = false;
    const startupLogs: string[] = [];
    const timeout = setTimeout(() => {
      if (settled) return;
      settled = true;
      reject(new Error(`Timed out waiting for server startup. Logs:\n${startupLogs.join('')}`));
    }, 45000);

    const handleData = (chunk: any) => {
      const text = String(chunk || '');
      startupLogs.push(text);
      if (text.includes('Server running on port')) {
        if (settled) return;
        settled = true;
        clearTimeout(timeout);
        resolve();
      }
    };

    proc.stdout.on('data', handleData);
    proc.stderr.on('data', handleData);

    proc.on('exit', (code) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      reject(new Error(`Server exited before ready (code=${code ?? 'unknown'}). Logs:\n${startupLogs.join('')}`));
    });
  });
}

async function main() {
  console.log('Running auth API security integration tests...');

  const originalDb = readFileIfExists(dbPath);
  const originalLock = readFileIfExists(lockPath);

  let serverProc: ReturnType<typeof spawn> | null = null;

  try {
    const testPort = await getAvailablePort();

    fs.writeFileSync(
      dbPath,
      JSON.stringify({ users: [], wallets: [], transactions: [], auditLogs: [] }, null, 2),
      'utf-8'
    );
    if (fs.existsSync(lockPath)) {
      fs.unlinkSync(lockPath);
    }

    serverProc = spawn('node', ['dist/server.cjs'], {
      cwd: repoRoot,
      shell: true,
      stdio: ['ignore', 'pipe', 'pipe'],
      env: {
        ...process.env,
        NODE_ENV: 'test',
        PORT: String(testPort),
        JWT_SECRET: '12345678901234567890123456789012',
        SOVEREIGN_ENCRYPTION_KEY: 'abcdefghijklmnopqrstuvwxyzABCDEF',
        BOOTSTRAP_ADMIN_EMAIL: 'admin@secure.local',
        BOOTSTRAP_ADMIN_PASSWORD: 'CorrectHorseBatteryStaple!42',
        BOOTSTRAP_ADMIN_TOTP_SECRET: 'JBSWY3DPEHPK3PXP',
        BOOTSTRAP_ADMIN_NAME: 'Secure Admin',
        BOOTSTRAP_ADMIN_CITIZENSHIP: 'US',
        BOOTSTRAP_ADMIN_KYC_LEVEL: '2',
        COINBASE_API_KEY_ID: 'unit-test-key',
        COINBASE_API_SECRET_RAW: 'not-a-valid-pem'
      }
    });

    await waitForServerReady(serverProc);

    const base = `http://localhost:${testPort}`;
    const mfa = generateTotpCode('JBSWY3DPEHPK3PXP');

    const loginRes = await fetch(`${base}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'admin@secure.local', password: 'CorrectHorseBatteryStaple!42', mfaCode: mfa })
    });
    const loginBody = await loginRes.json();
    const cookie = parseCookie(loginRes.headers.get('set-cookie'));

    if (loginRes.status !== 200) {
      console.log('Login failed body:', loginBody);
    }
    assert(loginRes.status === 200, `Expected login 200, got ${loginRes.status}`);
    assert(loginBody?.success === true, 'Expected login success body.');
    assert(Boolean(cookie), 'Expected cb_session cookie on login.');

    const logoutRes = await fetch(`${base}/api/auth/logout`, {
      method: 'POST',
      headers: { cookie }
    });
    const logoutBody = await logoutRes.json();
    assert(logoutRes.status === 200 && logoutBody?.success === true, 'Expected successful logout.');

    const protectedAfterLogoutRes = await fetch(`${base}/api/messaging/emails`, {
      headers: { cookie }
    });
    const protectedAfterLogoutBody = await protectedAfterLogoutRes.json();
    assert(protectedAfterLogoutRes.status === 401, `Expected 401 after logout, got ${protectedAfterLogoutRes.status}`);
    assert(
      ['SESSION_EXPIRED', 'INVALID_TOKEN', 'UNAUTHORIZED_ACCESS'].includes(String(protectedAfterLogoutBody?.error || '')),
      'Expected session invalidation error after logout.'
    );

    const loginAgainRes = await fetch(`${base}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'admin@secure.local', password: 'CorrectHorseBatteryStaple!42', mfaCode: generateTotpCode('JBSWY3DPEHPK3PXP') })
    });
    const cookie2 = parseCookie(loginAgainRes.headers.get('set-cookie'));
    assert(loginAgainRes.status === 200 && Boolean(cookie2), 'Expected second login success with cookie.');

    const idempotencyKey = `idem-${Date.now()}-security-test`;
    const tradePayload = {
      side: 'BUY',
      symbol: 'BTC',
      amount: 0.001,
      fiatAmount: 100
    };

    const tradeAttempt1 = await fetch(`${base}/api/coinbase/trade`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        cookie: cookie2,
        'x-idempotency-key': idempotencyKey
      },
      body: JSON.stringify(tradePayload)
    });
    const tradeBody1 = await tradeAttempt1.json();

    const tradeAttempt2 = await fetch(`${base}/api/coinbase/trade`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        cookie: cookie2,
        'x-idempotency-key': idempotencyKey
      },
      body: JSON.stringify(tradePayload)
    });
    const tradeBody2 = await tradeAttempt2.json();

    assert(tradeAttempt1.status === 400, `Expected first trade attempt 400, got ${tradeAttempt1.status}`);
    assert(tradeAttempt2.status === 400, `Expected idempotent replay 400, got ${tradeAttempt2.status}`);
    assert(JSON.stringify(tradeBody1) === JSON.stringify(tradeBody2), 'Expected replayed idempotency response body to match original cached response.');

    console.log('Auth API security integration tests passed.');
  } finally {
    if (serverProc && !serverProc.killed) {
      serverProc.kill();
    }

    writeFileOrDelete(dbPath, originalDb);
    writeFileOrDelete(lockPath, originalLock);
  }
}

main().then(() => {
  process.exit(0);
}).catch((err) => {
  console.error(err);
  process.exit(1);
});
