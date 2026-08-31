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
  const port = await getAvailablePort();

  fs.writeFileSync(dbPath, JSON.stringify({ users: [], wallets: [], transactions: [], auditLogs: [] }, null, 2), 'utf-8');

  const serverProc = spawn('node', ['dist/server.cjs'], {
    cwd: repoRoot,
    shell: true,
    stdio: ['ignore', 'pipe', 'pipe'],
    env: {
      ...process.env,
      NODE_ENV: 'test',
      PORT: String(port),
      JWT_SECRET: '12345678901234567890123456789012',
      SOVEREIGN_ENCRYPTION_KEY: 'abcdefghijklmnopqrstuvwxyzABCDEF'
    }
  });

  try {
    await waitForServerReady(serverProc);

    const createRes = await fetch(`http://127.0.0.1:${port}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'consistency@example.com', password: 'StrongPassword123!', firstName: 'Test', lastName: 'User', citizenship: 'US' })
    });
    const createBody = await createRes.json();
    assert(createRes.status === 201, `Expected 201 on first register, got ${createRes.status}: ${JSON.stringify(createBody)}`);

    const duplicateRes = await fetch(`http://127.0.0.1:${port}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'consistency@example.com', password: 'AnotherPassword123!', firstName: 'Test', lastName: 'User', citizenship: 'US' })
    });
    const duplicateBody = await duplicateRes.json();
    assert(duplicateRes.status === 409, `Expected 409 on duplicate register, got ${duplicateRes.status}: ${JSON.stringify(duplicateBody)}`);
    assert(String(duplicateBody?.message || '').includes('Please sign in instead.'), `Unexpected duplicate message: ${JSON.stringify(duplicateBody)}`);

    const loginRes = await fetch(`http://127.0.0.1:${port}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'consistency@example.com', password: 'wrong-password' })
    });
    const loginBody = await loginRes.json();
    assert(loginRes.status === 401, `Expected 401 on wrong password login, got ${loginRes.status}: ${JSON.stringify(loginBody)}`);
    assert(String(loginBody?.message || '').includes('password'), `Unexpected wrong-password message: ${JSON.stringify(loginBody)}`);

    console.log('auth-message-consistency-test:ok');
  } finally {
    if (serverProc && !serverProc.killed) serverProc.kill();
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
