import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';
import net from 'net';

const repoRoot = process.cwd();
const dbPath = path.join(repoRoot, 'src', 'db', 'database.json');

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

async function waitForServerReady(proc: ReturnType<typeof spawn>): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    let settled = false;
    const timeout = setTimeout(() => {
      if (settled) return;
      settled = true;
      reject(new Error('Timed out waiting for server startup.'));
    }, 45000);

    const handleData = (chunk: any) => {
      const text = String(chunk || '');
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
      reject(new Error(`Server exited before ready (code=${code ?? 'unknown'})`));
    });
  });
}

async function main() {
  const originalDb = fs.existsSync(dbPath) ? fs.readFileSync(dbPath, 'utf-8') : null;
  const testPort = await getAvailablePort();

  const seededDb = {
    users: [
      {
        id: 'user_demo',
        name: 'Demo User',
        email: 'demo@example.com',
        passwordHash: 'demo-hash',
        salt: 'demo-salt',
        twoFactorSecret: '',
        twoFactorEnabled: false,
        kycLevel: 1,
        citizenship: 'US',
        identityLocked: true,
        productionMode: 'live',
        blockchainLinked: true,
        lockedToEmail: 'demo@example.com',
        lockedAt: new Date().toISOString()
      }
    ],
    wallets: [],
    transactions: [],
    auditLogs: []
  };

  fs.writeFileSync(dbPath, JSON.stringify(seededDb, null, 2), 'utf-8');

  const serverProc = spawn('node', ['dist/server.cjs'], {
    cwd: repoRoot,
    shell: true,
    stdio: ['ignore', 'pipe', 'pipe'],
    env: {
      ...process.env,
      NODE_ENV: 'development',
      PORT: String(testPort),
      JWT_SECRET: '12345678901234567890123456789012',
      SOVEREIGN_ENCRYPTION_KEY: 'abcdefghijklmnopqrstuvwxyzABCDEF',
      BOOTSTRAP_ADMIN_EMAIL: 'admin@secure.local',
      BOOTSTRAP_ADMIN_PASSWORD: 'CorrectHorseBatteryStaple!42',
      BOOTSTRAP_ADMIN_TOTP_SECRET: 'JBSWY3DPEHPK3PXP',
      BOOTSTRAP_ADMIN_NAME: 'Secure Admin',
      BOOTSTRAP_ADMIN_CITIZENSHIP: 'US',
      BOOTSTRAP_ADMIN_KYC_LEVEL: '2'
    }
  });

  try {
    await waitForServerReady(serverProc);

    const loginRes = await fetch(`http://127.0.0.1:${testPort}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'demo@example.com', password: 'AnyPassword123!' })
    });

    const body = await loginRes.json();
    assert(loginRes.status === 200, `Expected login 200, got ${loginRes.status}: ${JSON.stringify(body)}`);
    assert(Boolean(body?.token), 'Expected token in successful login response.');
    console.log('local-auth-flow-test:ok');
  } finally {
    if (serverProc && !serverProc.killed) {
      serverProc.kill();
    }
    if (originalDb === null) {
      fs.unlinkSync(dbPath);
    } else {
      fs.writeFileSync(dbPath, originalDb, 'utf-8');
    }
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
