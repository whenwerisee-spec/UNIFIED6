import fs from 'fs';
import os from 'os';
import path from 'path';
import { pathToFileURL } from 'url';

const repoRoot = process.cwd();
const ledgerModulePath = path.resolve(repoRoot, 'src', 'db', 'ledger.ts');

const bootstrapEnvKeys = [
  'BOOTSTRAP_ADMIN_EMAIL',
  'BOOTSTRAP_ADMIN_PASSWORD',
  'BOOTSTRAP_ADMIN_TOTP_SECRET',
  'BOOTSTRAP_ADMIN_NAME',
  'BOOTSTRAP_ADMIN_CITIZENSHIP',
  'BOOTSTRAP_ADMIN_KYC_LEVEL'
] as const;

type BootstrapKey = (typeof bootstrapEnvKeys)[number];

function setBootstrapEnv(overrides: Partial<Record<BootstrapKey, string>>) {
  for (const key of bootstrapEnvKeys) {
    const nextVal = overrides[key];
    if (typeof nextVal === 'string') {
      process.env[key] = nextVal;
    } else {
      delete process.env[key];
    }
  }
}

function readJson(filePath: string): any {
  return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
}

async function importLedger(uniqueTag: string) {
  const url = `${pathToFileURL(ledgerModulePath).href}?${uniqueTag}-${Date.now()}-${Math.random()}`;
  return import(url);
}

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(message);
  }
}

function makeTempDbWorkspace(): string {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'coinbase-bootstrap-test-'));
  fs.mkdirSync(path.join(tempRoot, 'src', 'db'), { recursive: true });
  return tempRoot;
}

function setTempDbPath() {
  process.env.SOVEREIGN_DB_FILE_PATH = path.join('src', 'db', 'database.json');
}

function clearTempDbPath() {
  delete process.env.SOVEREIGN_DB_FILE_PATH;
}

function cleanupTempWorkspace(tempPath: string) {
  try {
    fs.rmSync(tempPath, { recursive: true, force: true });
  } catch {
    // Best-effort cleanup on Windows where transient file locks can occur.
  }
}

async function testNoBootstrapEnvLeavesEmptyState() {
  const tmp = makeTempDbWorkspace();
  const prevCwd = process.cwd();
  try {
    process.chdir(tmp);
    setTempDbPath();
    setBootstrapEnv({});

    await importLedger('no-bootstrap-env');

    const dbPath = path.join(tmp, 'src', 'db', 'database.json');
    const lockPath = path.join(tmp, 'src', 'db', 'bootstrap.lock');
    const db = readJson(dbPath);

    assert(Array.isArray(db.users) && db.users.length === 0, 'Expected zero users when bootstrap env is absent.');
    assert(!fs.existsSync(lockPath), 'Bootstrap lock file must not exist when no bootstrap user was created.');
  } finally {
    clearTempDbPath();
    process.chdir(prevCwd);
    cleanupTempWorkspace(tmp);
  }
}

async function testPartialBootstrapEnvFailsClosed() {
  const tmp = makeTempDbWorkspace();
  const prevCwd = process.cwd();
  try {
    process.chdir(tmp);
    setTempDbPath();
    setBootstrapEnv({ BOOTSTRAP_ADMIN_EMAIL: 'partial@local.test' });

    let threw = false;
    try {
      await importLedger('partial-bootstrap-env');
    } catch (err: any) {
      threw = true;
      assert(String(err?.message || err).includes('Incomplete bootstrap admin configuration'), 'Expected incomplete bootstrap configuration error.');
    }

    assert(threw, 'Expected import to fail when bootstrap env is partial.');
  } finally {
    clearTempDbPath();
    process.chdir(prevCwd);
    cleanupTempWorkspace(tmp);
  }
}

async function testOneTimeBootstrapLockBehavior() {
  const tmp = makeTempDbWorkspace();
  const prevCwd = process.cwd();
  try {
    process.chdir(tmp);
    setTempDbPath();
    setBootstrapEnv({
      BOOTSTRAP_ADMIN_EMAIL: 'admin@secure.local',
      BOOTSTRAP_ADMIN_PASSWORD: 'CorrectHorseBatteryStaple!42',
      BOOTSTRAP_ADMIN_TOTP_SECRET: 'JBSWY3DPEHPK3PXP',
      BOOTSTRAP_ADMIN_NAME: 'Secure Admin',
      BOOTSTRAP_ADMIN_CITIZENSHIP: 'US',
      BOOTSTRAP_ADMIN_KYC_LEVEL: '2'
    });

    await importLedger('bootstrap-first-run');

    const dbPath = path.join(tmp, 'src', 'db', 'database.json');
    const lockPath = path.join(tmp, 'src', 'db', 'bootstrap.lock');
    const db = readJson(dbPath);

    assert(db.users.length === 1, 'Expected one bootstrapped user on first run.');
    assert(db.users[0].email === 'admin@secure.local', 'Bootstrapped email did not match expected value.');
    assert(fs.existsSync(lockPath), 'Expected bootstrap lock file after first successful bootstrap.');

    fs.writeFileSync(
      dbPath,
      JSON.stringify({ users: [], wallets: [], transactions: [], auditLogs: [] }, null, 2),
      'utf-8'
    );

    let threw = false;
    try {
      await importLedger('bootstrap-second-run-locked');
    } catch (err: any) {
      threw = true;
      assert(String(err?.message || err).includes('Bootstrap provisioning is locked'), 'Expected bootstrap lock enforcement error.');
    }

    assert(threw, 'Expected second bootstrap attempt to fail once lock exists.');
  } finally {
    clearTempDbPath();
    process.chdir(prevCwd);
    cleanupTempWorkspace(tmp);
  }
}

async function testBootstrapEnvMustBeRemovedAfterProvisioning() {
  const tmp = makeTempDbWorkspace();
  const prevCwd = process.cwd();
  try {
    process.chdir(tmp);
    setTempDbPath();
    setBootstrapEnv({
      BOOTSTRAP_ADMIN_EMAIL: 'admin@secure.local',
      BOOTSTRAP_ADMIN_PASSWORD: 'CorrectHorseBatteryStaple!42',
      BOOTSTRAP_ADMIN_TOTP_SECRET: 'JBSWY3DPEHPK3PXP'
    });

    await importLedger('bootstrap-env-guard-initial');

    let threw = false;
    try {
      await importLedger('bootstrap-env-guard-restart');
    } catch (err: any) {
      threw = true;
      assert(
        String(err?.message || err).includes('BOOTSTRAP_ADMIN_* environment variables must be removed after initial provisioning lock is created.'),
        'Expected startup guard error when bootstrap env vars remain after lock creation.'
      );
    }

    assert(threw, 'Expected startup guard to fail when bootstrap env vars are left set post-provisioning.');
  } finally {
    clearTempDbPath();
    process.chdir(prevCwd);
    cleanupTempWorkspace(tmp);
  }
}

async function main() {
  console.log('Running bootstrap security tests...');

  await testNoBootstrapEnvLeavesEmptyState();
  await testPartialBootstrapEnvFailsClosed();
  await testOneTimeBootstrapLockBehavior();
  await testBootstrapEnvMustBeRemovedAfterProvisioning();

  setBootstrapEnv({});
  process.chdir(repoRoot);
  console.log('Bootstrap security tests passed.');
}

main().catch((err) => {
  setBootstrapEnv({});
  process.chdir(repoRoot);
  console.error(err);
  process.exit(1);
});
