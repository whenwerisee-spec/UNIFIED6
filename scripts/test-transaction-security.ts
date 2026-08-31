import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';
import net from 'net';
import crypto from 'crypto';

const repoRoot = process.cwd();
const dbPath = path.join(repoRoot, 'src', 'db', 'database.json');
const verificationPath = path.join(repoRoot, 'src', 'db', 'email_verifications.json');
const nodeExecPath = process.execPath;
const tsxCliPath = path.join(repoRoot, 'node_modules', 'tsx', 'dist', 'cli.mjs');

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(message);
}

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
  console.log('Running transaction security integration tests...');

  const originalDb = readFileIfExists(dbPath);
  const originalVerification = readFileIfExists(verificationPath);

  let serverProc: ReturnType<typeof spawn> | null = null;

  try {
    const port = await getAvailablePort();

    fs.writeFileSync(
      dbPath,
      JSON.stringify({ users: [], wallets: [], transactions: [], auditLogs: [] }, null, 2),
      'utf-8'
    );
    fs.writeFileSync(verificationPath, JSON.stringify({}, null, 2), 'utf-8');

    serverProc = spawn(nodeExecPath, [tsxCliPath, 'server.ts'], {
      cwd: repoRoot,
      shell: false,
      stdio: ['ignore', 'pipe', 'pipe'],
      env: {
        ...process.env,
        NODE_ENV: 'test',
        PORT: String(port),
        JWT_SECRET: '12345678901234567890123456789012',
        SOVEREIGN_ENCRYPTION_KEY: 'abcdefghijklmnopqrstuvwxyzABCDEF',
        SOVEREIGN_ADMIN_EMAILS: 'tx@test.local'
      }
    });

    await waitForServerReady(serverProc);

    const base = `http://localhost:${port}`;

    const unauthTrade = await fetch(`${base}/api/exchanges/trade`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'buy', symbol: 'ETH', amount: '0.01', exchange: 'coinbase' })
    });
    assert(unauthTrade.status === 401, `Expected unauthenticated trade 401, got ${unauthTrade.status}`);

    const unauthWithdraw = await fetch(`${base}/api/withdrawal/disburse`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ amount: 100, email: 'dest@example.com', securityQuestion: 'q', securityAnswer: 'a' })
    });
    assert(unauthWithdraw.status === 401, `Expected unauthenticated withdrawal disburse 401, got ${unauthWithdraw.status}`);

    const unauthAudit = await fetch(`${base}/api/trade/audit-risk`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fromAsset: 'ETH', toAsset: 'BTC', amount: '1' })
    });
    assert(unauthAudit.status === 401, `Expected unauthenticated trade audit 401, got ${unauthAudit.status}`);

    const email = `tx-test-${Date.now()}@test.local`;
    const password = 'TxSecurityPass2026X';

    const registerRes = await fetch(`${base}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, firstName: 'Tx', lastName: 'Tester', citizenship: 'US' })
    });
    assert(registerRes.status === 201, `Expected register 201, got ${registerRes.status}`);

    const dbData = JSON.parse(fs.readFileSync(dbPath, 'utf-8')) as any;
    const user = (dbData.users || []).find((u: any) => u.email === email);
    assert(Boolean(user), 'Expected registered user in database.json');

    const verData = JSON.parse(fs.readFileSync(verificationPath, 'utf-8')) as any;
    const now = new Date().toISOString();
    verData[email] = {
      userId: user.id,
      email,
      tokenHash: 'transaction-security-local-verify',
      createdAt: now,
      expiresAt: Date.now() + 86400000,
      verifiedAt: now
    };
    fs.writeFileSync(verificationPath, JSON.stringify(verData, null, 2), 'utf-8');

    const loginRes = await fetch(`${base}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    assert(loginRes.status === 200, `Expected login 200, got ${loginRes.status}`);

    const loginBody = await loginRes.json() as any;
    assert(Boolean(loginBody?.token), 'Expected login token');

    const cookie = parseCookie(loginRes.headers.get('set-cookie'));
    assert(Boolean(cookie), 'Expected cb_session cookie');

    // Route Contract Test: Verify MFA middleware chain blocks withdrawal disbursement
    const downgradeTokenMfa = (token: string, secret: string): string => {
      const [headerPart, payloadPart] = token.split('.');
      const base64UrlDecode = (input: string): Buffer => {
        let normalized = input.replace(/-/g, '+').replace(/_/g, '/');
        while (normalized.length % 4) normalized += '=';
        return Buffer.from(normalized, 'base64');
      };
      const base64UrlEncode = (input: string | Buffer): string => {
        const buffer = Buffer.isBuffer(input) ? input : Buffer.from(input, 'utf8');
        return buffer.toString('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
      };
      const payload = JSON.parse(base64UrlDecode(payloadPart!).toString('utf8'));
      payload.mfa = false;
      
      const encodedHeader = headerPart!;
      const encodedPayload = base64UrlEncode(JSON.stringify(payload));
      const signature = crypto
        .createHmac('sha256', secret)
        .update(`${encodedHeader}.${encodedPayload}`)
        .digest();
      return `${encodedHeader}.${encodedPayload}.${base64UrlEncode(signature)}`;
    };

    const jwtSecret = '12345678901234567890123456789012';
    const downgradedToken = downgradeTokenMfa(loginBody.token, jwtSecret);
    const mfaPendingCookie = `cb_session=${encodeURIComponent(downgradedToken)}`;

    const mfaPendingDisburse = await fetch(`${base}/api/withdrawal/disburse`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', cookie: mfaPendingCookie },
      body: JSON.stringify({ amount: 50 })
    });
    assert(
      mfaPendingDisburse.status === 401 || mfaPendingDisburse.status === 403,
      `Expected withdrawal disbursement to be blocked by auth/mfa middleware with 401/403, got ${mfaPendingDisburse.status}`
    );

    const spendabilityRes = await fetch(`${base}/api/transactions/spendability`, {
      headers: { cookie }
    });
    assert(spendabilityRes.status === 200, `Expected spendability endpoint 200, got ${spendabilityRes.status}`);

    const spendabilityBody = await spendabilityRes.json() as any;
    assert(typeof spendabilityBody.assetsSafe === 'boolean', 'Expected assetsSafe boolean in spendability payload.');
    assert(typeof spendabilityBody.allRailsSpendable === 'boolean', 'Expected allRailsSpendable boolean in spendability payload.');
    assert(spendabilityBody.rails?.walletSend, 'Expected rails.walletSend in spendability payload.');

    const unknownTransferRes = await fetch(`${base}/api/exchanges/etransfer/get/non-existent-transfer-id`, {
      headers: { cookie }
    });
    assert(unknownTransferRes.status === 404, `Expected unknown e-transfer lookup 404, got ${unknownTransferRes.status}`);

    console.log('Transaction security integration tests passed.');
  } finally {
    if (serverProc && !serverProc.killed) {
      serverProc.kill();
    }

    writeFileOrDelete(dbPath, originalDb);
    writeFileOrDelete(verificationPath, originalVerification);
  }
}

main().then(() => {
  process.exit(0);
}).catch((err) => {
  console.error(err);
  process.exit(1);
});
