import { spawn, exec } from 'child_process';
import path from 'path';
import fetch from 'node-fetch';

const ROOT_DIR = process.cwd();
const SERVER_URL = process.env.BASE_URL || 'http://127.0.0.1:3000';
const HEALTH_URL = `${SERVER_URL}/api/withdrawal/health`;

function spawnServer() {
  const serverProcess = spawn('npx', ['tsx', 'server.ts'], {
    cwd: ROOT_DIR,
    env: {
      ...process.env,
      NODE_ENV: 'test'
    },
    shell: true,
    stdio: ['ignore', 'inherit', 'inherit']
  });

  serverProcess.on('error', (err) => {
    console.error('[E2E RUNNER] Failed to start server:', err);
    process.exit(1);
  });

  return serverProcess;
}

async function waitForHealth(timeoutMs = 30000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(HEALTH_URL, { method: 'GET' });
      if (response.status === 200) {
        return;
      }
    } catch {
      // ignore until server becomes available
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error(`Server did not become healthy at ${HEALTH_URL} within ${timeoutMs}ms`);
}

async function runTest() {
  return new Promise<void>((resolve, reject) => {
    const testProcess = exec('npx tsx test-wise-e2e.ts', { cwd: ROOT_DIR, env: { ...process.env, BASE_URL: SERVER_URL } }, (error, stdout, stderr) => {
      if (stdout) process.stdout.write(stdout);
      if (stderr) process.stderr.write(stderr);
      if (error) {
        reject(error);
      } else {
        resolve();
      }
    });

    testProcess.on('error', (err) => reject(err));
  });
}

async function main() {
  console.log('[E2E RUNNER] Starting local server...');
  const serverProcess = spawnServer();

  const cleanup = () => {
    if (!serverProcess.killed) {
      serverProcess.kill();
    }
  };

  process.on('SIGINT', cleanup);
  process.on('SIGTERM', cleanup);
  process.on('exit', cleanup);

  try {
    await waitForHealth();
    console.log('[E2E RUNNER] Local server is healthy. Running E2E test...');
    await runTest();
    console.log('[E2E RUNNER] E2E test completed successfully.');
  } catch (err: any) {
    console.error('[E2E RUNNER] Error:', err.message || err);
    process.exit(1);
  } finally {
    cleanup();
  }
}

main().catch((err) => {
  console.error('[E2E RUNNER] Unexpected failure:', err);
  process.exit(1);
});
