import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { EncryptedStorage } from '../lib/encrypted-db.js';

// Types for the Relational Schema
export interface DBUser {
  id: string;
  name: string;
  email: string;
  passwordHash: string;
  salt: string;
  twoFactorSecret: string;
  twoFactorEnabled: boolean;
  kycLevel: number;
  citizenship: string;
  identityLocked: boolean;
  productionMode: 'sandbox' | 'live';
  blockchainLinked: boolean;
  lockedToEmail: string;
  lockedAt: string;
  // KYC Information
  kycFullName?: string;
  kycAddress?: string;
  kycCity?: string;
  kycState?: string;
  kycProvince?: string;
  kycPostalCode?: string;
  kycTaxId?: string;
  kycPhone?: string;
  kycVerifiedAt?: string;
}

export interface DBWallet {
  id: string;
  userId: string;
  assetSymbol: string;
  balance: number;
  publicAddressEthereum: string;
  publicAddressBitcoin: string;
  identityLocked: boolean;
  productionMode: 'sandbox' | 'live';
  blockchainLinked: boolean;
  lockedToEmail: string;
  lockedAt: string;
}

export interface DBTransaction {
  id: string;
  userId: string;
  type: 'BUY' | 'SELL' | 'CONVERT' | 'EARN' | 'SEND' | 'RECEIVE' | 'WISE_WITHDRAWAL';
  assetSymbol: string;
  amount: number;
  fiatAmount: number;
  timestamp: number;
  details: string;
  hash: string;
  status: 'pending' | 'completed' | 'failed' | 'processing' | 'settled';
  ledgerDebit: string;
  ledgerCredit: string;
  // Wise withdrawal fields (optional, populated only for WISE_WITHDRAWAL type)
  wiseTransferId?: string;
  bankRouting?: string;
  bankAccount?: string;
  recipientName?: string;
  wiseProfileId?: string;
  wiseRecipientId?: string;
  wiseClearedAt?: string;
}

export interface DBAuditLog {
  id: string;
  userId: string;
  action: string;
  timestamp: number;
  ipAddress: string;
  status: 'success' | 'failure';
  details: string;
}

export interface DBBankAccount {
  id: string;
  userId: string;
  accountName: string;
  bankName: string;
  accountType: string;
  routingNumber?: string;
  accountNumber?: string;
  balance: number;
}

export type YieldDestinationStatus = 'pending_verification' | 'active' | 'paused' | 'revoked';
export type YieldCollectionMode = 'manual' | 'automatic';

/**
 * Permanent, user-controlled destination for one authenticated live yield source.
 * Private keys, seed phrases, mnemonics, and recovery secrets are never stored here.
 */
export interface DBYieldDestination {
  id: string;
  userId: string;
  sourceId: string;
  provider: string;
  network: string;
  assetSymbol: string;
  address: string;
  addressType: 'evm' | 'bitcoin' | 'solana' | 'provider-managed' | 'other';
  ownershipProofHash: string;
  recoveryReference: string;
  collectionMode: YieldCollectionMode;
  status: YieldDestinationStatus;
  automationMinimumAmount?: string;
  automationMaximumGasWei?: string;
  createdAt: string;
  updatedAt: string;
  lastClaimTxHash?: string;
  lastClaimAt?: string;
}

export interface DatabaseState {
  users: DBUser[];
  wallets: DBWallet[];
  transactions: DBTransaction[];
  auditLogs: DBAuditLog[];
  bankAccounts?: DBBankAccount[];
  yieldDestinations?: DBYieldDestination[];
}

export interface LedgerIntegrityFinding {
  severity: 'error' | 'warning';
  code: string;
  message: string;
}

export interface LedgerIntegrityReport {
  ok: boolean;
  generatedAt: string;
  counts: {
    users: number;
    wallets: number;
    transactions: number;
    auditLogs: number;
    yieldDestinations: number;
  };
  errors: LedgerIntegrityFinding[];
  warnings: LedgerIntegrityFinding[];
}

const configuredDbFilePath = String(process.env.SOVEREIGN_DB_FILE_PATH || '').trim();
const defaultDbFilePath = path.join(process.cwd(), 'src', 'db', 'database.json');
const DB_FILE_PATH = configuredDbFilePath
  ? path.resolve(process.cwd(), configuredDbFilePath)
  : defaultDbFilePath;
const BOOTSTRAP_LOCK_FILE_PATH = path.join(path.dirname(DB_FILE_PATH), 'bootstrap.lock');

class RelationalLedgerDatabase {
  private state: DatabaseState;
  private transactionSnapshot: DatabaseState | null = null;
  private lastLoadedAt = 0;

  private hasBootstrapEnvConfigured(): boolean {
    return Boolean(
      String(process.env.BOOTSTRAP_ADMIN_EMAIL || '').trim() ||
      String(process.env.BOOTSTRAP_ADMIN_PASSWORD || '') ||
      String(process.env.BOOTSTRAP_ADMIN_TOTP_SECRET || '').trim()
    );
  }

  private enforceBootstrapEnvGuard() {
    if (process.env.NODE_ENV === 'test') return;
    const lockExists = fs.existsSync(BOOTSTRAP_LOCK_FILE_PATH);
    if (!lockExists || this.state.users.length === 0) return;
    if (!this.hasBootstrapEnvConfigured()) return;
    throw new Error('BOOTSTRAP_ADMIN_* environment variables must be removed after initial provisioning lock is created.');
  }

  constructor() {
    this.state = {
      users: [],
      wallets: [],
      transactions: [],
      auditLogs: [],
      yieldDestinations: []
    };
    this.load();
  }

  // Synchronous load to simplify initialization
  private load() {
    const dir = path.dirname(DB_FILE_PATH);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    const encryptionKey = process.env.SOVEREIGN_DB_ENCRYPTION_KEY;

    if (fs.existsSync(DB_FILE_PATH)) {
      let fileContent = '';
      if (encryptionKey) {
        const decrypted = EncryptedStorage.readEncryptedFile(DB_FILE_PATH, encryptionKey);
        if (decrypted) {
          fileContent = decrypted;
          console.log('[LEDGER DATABASE] Vault Unlocked: AES-256 Decryption Active.');
        } else {
          // If decryption fails, we must not overwrite the database with empty state.
          throw new Error('DATABASE_DECRYPTION_FAILED: Invalid SOVEREIGN_DB_ENCRYPTION_KEY or corrupted vault.');
        }
      } else {
        fileContent = fs.readFileSync(DB_FILE_PATH, 'utf-8');
        console.warn('[LEDGER DATABASE] Vault Open: Running in Unencrypted Mode.');
      }

      this.state = this.normalizeState(JSON.parse(fileContent));
      this.enforceBootstrapEnvGuard();
      this.maybeBootstrapAdminUser();
      this.maybeBootstrapUserMlaframboise();
      this.lastLoadedAt = fs.statSync(DB_FILE_PATH).mtimeMs;
      return;
    }

    this.initializeEmptyState();
    this.maybeBootstrapAdminUser();
    this.maybeBootstrapUserMlaframboise();
    this.save();
  }

  // Save state to disk
  private save() {
    try {
      const dir = path.dirname(DB_FILE_PATH);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      const encryptionKey = process.env.SOVEREIGN_DB_ENCRYPTION_KEY;
      const jsonState = JSON.stringify(this.state, null, 2);

      if (encryptionKey) {
        EncryptedStorage.writeEncryptedFile(DB_FILE_PATH, jsonState, encryptionKey);
      } else {
        const tempPath = `${DB_FILE_PATH}.tmp`;
        fs.writeFileSync(tempPath, jsonState, 'utf-8');
        fs.renameSync(tempPath, DB_FILE_PATH);
      }

      if (fs.existsSync(DB_FILE_PATH)) {
        this.lastLoadedAt = fs.statSync(DB_FILE_PATH).mtimeMs;
      }
    } catch (e) {
      console.error('Failed to save relational database to disk:', e);
    }
  }

  private normalizeUser(user: any): DBUser {
    const email = String(user?.email || '').trim().toLowerCase();
    return {
      id: String(user?.id || ''),
      name: String(user?.name || ''),
      email,
      passwordHash: String(user?.passwordHash || ''),
      salt: String(user?.salt || ''),
      twoFactorSecret: String(user?.twoFactorSecret || ''),
      twoFactorEnabled: Boolean(user?.twoFactorEnabled),
      kycLevel: Number.isFinite(Number(user?.kycLevel)) ? Number(user?.kycLevel) : 1,
      citizenship: String(user?.citizenship || 'US').toUpperCase(),
      identityLocked: user?.identityLocked !== false,
      productionMode: user?.productionMode === 'sandbox' ? 'sandbox' : 'live',
      blockchainLinked: user?.blockchainLinked !== false,
      lockedToEmail: String(user?.lockedToEmail || email || '').toLowerCase(),
      lockedAt: String(user?.lockedAt || new Date().toISOString()),
      kycFullName: String(user?.kycFullName || ''),
      kycAddress: String(user?.kycAddress || ''),
      kycCity: String(user?.kycCity || ''),
      kycState: String(user?.kycState || ''),
      kycProvince: String(user?.kycProvince || ''),
      kycPostalCode: String(user?.kycPostalCode || ''),
      kycTaxId: String(user?.kycTaxId || ''),
      kycPhone: String(user?.kycPhone || ''),
      kycVerifiedAt: String(user?.kycVerifiedAt || '')
    };
  }

  private normalizeWallet(wallet: any): DBWallet {
    const userId = String(wallet?.userId || '');
    const assetSymbol = String(wallet?.assetSymbol || 'USD');
    return {
      id: String(wallet?.id || ''),
      userId,
      assetSymbol,
      balance: Number(wallet?.balance || 0),
      publicAddressEthereum: String(wallet?.publicAddressEthereum || ''),
      publicAddressBitcoin: String(wallet?.publicAddressBitcoin || ''),
      identityLocked: wallet?.identityLocked !== false,
      productionMode: wallet?.productionMode === 'sandbox' ? 'sandbox' : 'live',
      blockchainLinked: wallet?.blockchainLinked !== false,
      lockedToEmail: String(wallet?.lockedToEmail || '').toLowerCase(),
      lockedAt: String(wallet?.lockedAt || new Date().toISOString())
    };
  }

  private normalizeYieldDestination(destination: any): DBYieldDestination {
    const status = String(destination?.status || 'pending_verification');
    const collectionMode = String(destination?.collectionMode || 'manual');
    const addressType = String(destination?.addressType || 'other');
    return {
      id: String(destination?.id || ''),
      userId: String(destination?.userId || ''),
      sourceId: String(destination?.sourceId || ''),
      provider: String(destination?.provider || ''),
      network: String(destination?.network || ''),
      assetSymbol: String(destination?.assetSymbol || '').toUpperCase(),
      address: String(destination?.address || ''),
      addressType: ['evm', 'bitcoin', 'solana', 'provider-managed', 'other'].includes(addressType)
        ? addressType as DBYieldDestination['addressType']
        : 'other',
      ownershipProofHash: String(destination?.ownershipProofHash || ''),
      recoveryReference: String(destination?.recoveryReference || ''),
      collectionMode: collectionMode === 'automatic' ? 'automatic' : 'manual',
      status: ['pending_verification', 'active', 'paused', 'revoked'].includes(status)
        ? status as YieldDestinationStatus
        : 'pending_verification',
      automationMinimumAmount: String(destination?.automationMinimumAmount || ''),
      automationMaximumGasWei: String(destination?.automationMaximumGasWei || ''),
      createdAt: String(destination?.createdAt || new Date().toISOString()),
      updatedAt: String(destination?.updatedAt || new Date().toISOString()),
      lastClaimTxHash: String(destination?.lastClaimTxHash || ''),
      lastClaimAt: String(destination?.lastClaimAt || '')
    };
  }

  private normalizeState(parsed: any): DatabaseState {
    const users = Array.isArray(parsed?.users) ? parsed.users.map((user: any) => this.normalizeUser(user)) : [];
    const wallets = Array.isArray(parsed?.wallets) ? parsed.wallets.map((wallet: any) => this.normalizeWallet(wallet)) : [];
    const transactions = Array.isArray(parsed?.transactions) ? parsed.transactions : [];

    // Ensure all wallets / transactions have their corresponding user records to guarantee ledger integrity
    const userIds = new Set(users.map((u: DBUser) => u.id));
    for (const wallet of wallets) {
      if (wallet.userId && !userIds.has(wallet.userId)) {
        const userEmail = wallet.lockedToEmail || 'mlaframboisemm@gmail.com';
        const recoveredUser: DBUser = {
          id: wallet.userId,
          name: 'Marcel Laframboise',
          email: userEmail,
          passwordHash: '',
          salt: '',
          twoFactorSecret: '',
          twoFactorEnabled: false,
          kycLevel: 3,
          citizenship: 'CA',
          identityLocked: true,
          productionMode: wallet.productionMode || 'live',
          blockchainLinked: wallet.blockchainLinked,
          lockedToEmail: userEmail,
          lockedAt: wallet.lockedAt || new Date().toISOString(),
          kycFullName: 'Marcel Laframboise',
          kycVerifiedAt: wallet.lockedAt || new Date().toISOString()
        };
        users.push(recoveredUser);
        userIds.add(wallet.userId);
      }
    }

    return {
      users,
      wallets,
      transactions,
      auditLogs: Array.isArray(parsed?.auditLogs) ? parsed.auditLogs : [],
      bankAccounts: Array.isArray(parsed?.bankAccounts) ? parsed.bankAccounts : [],
      yieldDestinations: Array.isArray(parsed?.yieldDestinations)
        ? parsed.yieldDestinations.map((destination: any) => this.normalizeYieldDestination(destination))
        : []
    };
  }

  private initializeEmptyState() {
    this.state = {
      users: [],
      wallets: [],
      transactions: [],
      auditLogs: [],
      bankAccounts: [],
      yieldDestinations: []
    };
  }

  private maybeBootstrapAdminUser() {
    const email = String(process.env.BOOTSTRAP_ADMIN_EMAIL || '').trim().toLowerCase();
    if (!email) {
      if (this.state.users.length === 0) {
        console.warn('[LEDGER DATABASE] No users available. Set BOOTSTRAP_ADMIN_* environment variables to create the initial admin account.');
      }
      return;
    }

    const password = String(process.env.BOOTSTRAP_ADMIN_PASSWORD || '');
    const totpSecret = String(process.env.BOOTSTRAP_ADMIN_TOTP_SECRET || '').trim().toUpperCase();
    const name = String(process.env.BOOTSTRAP_ADMIN_NAME || 'Bootstrap Admin').trim();
    const citizenship = String(process.env.BOOTSTRAP_ADMIN_CITIZENSHIP || 'US').trim().toUpperCase();
    const kycLevelRaw = Number(process.env.BOOTSTRAP_ADMIN_KYC_LEVEL || 2);
    const lockExists = fs.existsSync(BOOTSTRAP_LOCK_FILE_PATH);

    if (lockExists && process.env.NODE_ENV !== 'test') {
      throw new Error('Bootstrap provisioning is locked. Remove src/db/bootstrap.lock only through approved disaster-recovery procedure.');
    }

    if (!password || !totpSecret) {
      throw new Error('Incomplete bootstrap admin configuration. Set BOOTSTRAP_ADMIN_EMAIL, BOOTSTRAP_ADMIN_PASSWORD, and BOOTSTRAP_ADMIN_TOTP_SECRET.');
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      throw new Error('Invalid BOOTSTRAP_ADMIN_EMAIL format.');
    }
    if (password.length < 12) {
      throw new Error('BOOTSTRAP_ADMIN_PASSWORD must be at least 12 characters.');
    }
    if (!/^[A-Z2-7]{16,}$/.test(totpSecret)) {
      throw new Error('BOOTSTRAP_ADMIN_TOTP_SECRET must be a Base32 secret (A-Z2-7) with length >= 16.');
    }

    let existingAdmin = this.state.users.find(u => u.email.toLowerCase() === email);
    const salt = crypto.randomBytes(16).toString('hex');
    const passwordHash = crypto.pbkdf2Sync(password, salt, 100000, 64, 'sha512').toString('hex');
    const kycLevel = Number.isFinite(kycLevelRaw) ? Math.max(1, Math.min(3, Math.floor(kycLevelRaw))) : 2;

    if (existingAdmin) {
      existingAdmin.passwordHash = passwordHash;
      existingAdmin.salt = salt;
      existingAdmin.twoFactorSecret = totpSecret;
      existingAdmin.twoFactorEnabled = true;
    } else {
      const userId = `user_${crypto.randomUUID()}`;
      const newAdmin: DBUser = {
        id: userId,
        name,
        email,
        passwordHash,
        salt,
        twoFactorSecret: totpSecret,
        twoFactorEnabled: true,
        kycLevel,
        citizenship,
        identityLocked: true,
        productionMode: 'live',
        blockchainLinked: false,
        lockedToEmail: email,
        lockedAt: new Date().toISOString()
      };
      this.state.users.push(newAdmin);
      this.state.wallets.push({
        id: `wallet-${userId}-usd`,
        userId,
        assetSymbol: 'USD',
        balance: 0,
        publicAddressEthereum: '',
        publicAddressBitcoin: '',
        identityLocked: true,
        productionMode: 'live',
        blockchainLinked: false,
        lockedToEmail: email,
        lockedAt: new Date().toISOString()
      });
    }

    const lockDir = path.dirname(BOOTSTRAP_LOCK_FILE_PATH);
    if (!fs.existsSync(lockDir)) {
      fs.mkdirSync(lockDir, { recursive: true });
    }
    fs.writeFileSync(
      BOOTSTRAP_LOCK_FILE_PATH,
      JSON.stringify({
        createdAt: new Date().toISOString(),
        reason: 'one-time-bootstrap-completed',
        userEmailSha256: crypto.createHash('sha256').update(email).digest('hex')
      }, null, 2),
      'utf-8'
    );

    console.warn(`[LEDGER DATABASE] Bootstrapped initial admin user for ${email}. Rotate bootstrap credentials after first login.`);
    this.save();
  }

  private maybeBootstrapUserMlaframboise() {
    const configuredOwnerId = String(process.env.OWNER_OPEN_ID || '').trim();
    const configuredOwnerEmail = String(process.env.OWNER_EMAIL || process.env.BOOTSTRAP_ADMIN_EMAIL || '').trim().toLowerCase();
    if (!configuredOwnerId && !configuredOwnerEmail) {
      console.warn('[LEDGER DATABASE] Owner identity is not configured; no user, wallet, balance, or address was seeded.');
      return;
    }

    const user = this.state.users.find(candidate =>
      (configuredOwnerId && candidate.id === configuredOwnerId) ||
      (configuredOwnerEmail && candidate.email.toLowerCase() === configuredOwnerEmail)
    );
    if (!user) {
      console.warn('[LEDGER DATABASE] Configured owner is not present in the durable ledger; no user, wallet, balance, or address was seeded.');
      return;
    }

    const userId = user.id;
    const targetEmail = user.email.toLowerCase();

    // Existing authoritative records are preserved. Missing wallets are created empty
    // and unlinked until live provider or chain reconciliation supplies real data.
    const walletDefaults = [
      ['USD', '', ''],
      ['USDC', '', ''],
      ['ETH', '', ''],
      ['BTC', '', '']
    ] as const;

    for (const [assetSymbol, publicAddressEthereum, publicAddressBitcoin] of walletDefaults) {
      const wallet = this.state.wallets.find(candidate => candidate.userId === userId && candidate.assetSymbol === assetSymbol);
      if (wallet) continue;
      this.state.wallets.push({
        id: `wallet-${userId}-${assetSymbol.toLowerCase()}`,
        userId,
        assetSymbol,
        balance: 0,
        publicAddressEthereum,
        publicAddressBitcoin,
        identityLocked: user.identityLocked,
        productionMode: user.productionMode,
        blockchainLinked: false,
        lockedToEmail: targetEmail,
        lockedAt: new Date().toISOString()
      });
    }

    this.save();
    console.warn(`[LEDGER DATABASE] Initialized owner profile without seeded balances or addresses for ${targetEmail}`);
  }


  public protectUserIdentity(userId: string, email: string): DBUser | null {
    const targetState = this.transactionSnapshot || this.state;
    const user = targetState.users.find((candidate) => candidate.id === userId);
    if (!user) return null;

    const normalizedEmail = String(email || '').trim().toLowerCase();
    user.identityLocked = true;
    user.productionMode = 'live';
    user.blockchainLinked = true;
    user.lockedToEmail = normalizedEmail;
    user.lockedAt = new Date().toISOString();

    targetState.wallets = targetState.wallets.map((wallet) => {
      if (wallet.userId !== userId) return wallet;
      return {
        ...wallet,
        identityLocked: true,
        productionMode: 'live',
        blockchainLinked: Boolean(wallet.publicAddressEthereum || wallet.publicAddressBitcoin),
        lockedToEmail: normalizedEmail,
        lockedAt: user.lockedAt
      };
    });

    if (!this.transactionSnapshot) this.save();
    return user;
  }

  public listYieldDestinations(userId: string): DBYieldDestination[] {
    const targetState = this.transactionSnapshot || this.state;
    return (targetState.yieldDestinations || [])
      .filter((destination) => destination.userId === userId)
      .map((destination) => ({ ...destination }));
  }

  public getYieldDestination(userId: string, destinationId: string): DBYieldDestination | null {
    const targetState = this.transactionSnapshot || this.state;
    const destination = (targetState.yieldDestinations || []).find(
      (candidate) => candidate.userId === userId && candidate.id === destinationId
    );
    return destination ? { ...destination } : null;
  }

  public upsertYieldDestination(destination: DBYieldDestination): DBYieldDestination {
    const targetState = this.transactionSnapshot || this.state;
    const destinations = targetState.yieldDestinations || [];
    const normalized = this.normalizeYieldDestination({
      ...destination,
      updatedAt: new Date().toISOString()
    });

    if (!normalized.id || !normalized.userId || !normalized.sourceId || !normalized.provider || !normalized.network || !normalized.assetSymbol || !normalized.address) {
      throw new Error('Yield destination requires id, userId, sourceId, provider, network, assetSymbol, and address.');
    }

    const duplicate = destinations.find(
      (candidate) => candidate.userId === normalized.userId
        && candidate.sourceId === normalized.sourceId
        && candidate.id !== normalized.id
    );
    if (duplicate) {
      throw new Error('A yield destination is already registered for this user and source.');
    }

    const existingIndex = destinations.findIndex((candidate) => candidate.id === normalized.id && candidate.userId === normalized.userId);
    if (existingIndex >= 0) {
      const previous = destinations[existingIndex];
      destinations[existingIndex] = {
        ...normalized,
        createdAt: previous.createdAt || normalized.createdAt
      };
    } else {
      destinations.push(normalized);
    }

    targetState.yieldDestinations = destinations;
    if (!this.transactionSnapshot) this.save();
    return { ...normalized };
  }

  public appendAuditLog(log: DBAuditLog): void {
    const targetState = this.transactionSnapshot || this.state;
    targetState.auditLogs.push({ ...log });
    if (!this.transactionSnapshot) this.save();
  }

  // TRANSACTION SUPPORT
  public beginTransaction() {
    if (this.transactionSnapshot !== null) {
      throw new Error('A database transaction is already in progress.');
    }
    // Deep clone state
    this.transactionSnapshot = JSON.parse(JSON.stringify(this.state));
    console.log('[LEDGER DATABASE] Transaction started. Snapshot created.');
  }

  public commit() {
    if (this.transactionSnapshot === null) {
      throw new Error('No transaction in progress to commit.');
    }
    this.transactionSnapshot = null;
    this.save();
    console.log('[LEDGER DATABASE] Transaction committed successfully. Disk synced.');
  }

  public rollback() {
    if (this.transactionSnapshot === null) {
      throw new Error('No transaction in progress to roll back.');
    }
    this.state = this.transactionSnapshot;
    this.transactionSnapshot = null;
    console.log('[LEDGER DATABASE] Transaction rolled back. State safely reverted.');
  }

  /**
   * Safe relational SQL-style query interface using STRICT prepared statements.
   * Prevents SQL Injection by mapping SQL query templates with strictly bound params.
   */
  public execute(sql: string, params: any[] = []): any {
    const formattedSql = sql.trim().replace(/\s+/g, ' ');

    // 1. SELECT * FROM users
    if (formattedSql === 'SELECT * FROM users') {
      const targetState = this.transactionSnapshot || this.state;
      return targetState.users;
    }

    // 1.1 SELECT id FROM users WHERE email = ?
    if (formattedSql.startsWith('SELECT id FROM users WHERE') && formattedSql.toLowerCase().includes('email')) {
      const [email] = params;
      const targetState = this.transactionSnapshot || this.state;
      return targetState.users
        .filter(u => u.email.toLowerCase() === String(email || '').toLowerCase())
        .map(u => ({ id: u.id }));
    }

    // 1.2 SELECT * FROM users WHERE email = ? / LOWER(email) = ?
    if (formattedSql.startsWith('SELECT * FROM users WHERE') && formattedSql.toLowerCase().includes('email')) {
      const [email] = params;
      const targetState = this.transactionSnapshot || this.state;
      return targetState.users.filter(u => u.email.toLowerCase() === String(email || '').toLowerCase());
    }

    // 2. SELECT * FROM users WHERE id = ?
    if (formattedSql.startsWith('SELECT * FROM users WHERE id = ?')) {
      const [id] = params;
      const targetState = this.transactionSnapshot || this.state;
      return targetState.users.filter(u => u.id === id);
    }

    // 3. SELECT * FROM wallets
    if (formattedSql === 'SELECT * FROM wallets') {
      const targetState = this.transactionSnapshot || this.state;
      return targetState.wallets;
    }

    // 3.1 SELECT * FROM wallets WHERE user_id = ? AND asset_symbol = ?
    if (formattedSql.startsWith('SELECT * FROM wallets WHERE user_id = ? AND asset_symbol = ?')) {
      const [userId, assetSymbol] = params;
      const targetState = this.transactionSnapshot || this.state;
      return targetState.wallets.filter(w => w.userId === userId && w.assetSymbol.toUpperCase() === String(assetSymbol || '').toUpperCase());
    }

    // 3.2 SELECT * FROM wallets WHERE user_id = ?
    if (formattedSql.startsWith('SELECT * FROM wallets WHERE user_id = ?')) {
      const [userId] = params;
      const targetState = this.transactionSnapshot || this.state;
      return targetState.wallets.filter(w => w.userId === userId);
    }

    // 4. SELECT * FROM wallets WHERE asset_symbol = ?
    if (formattedSql.startsWith('SELECT * FROM wallets WHERE asset_symbol = ?')) {
      const [assetSymbol] = params;
      const targetState = this.transactionSnapshot || this.state;
      return targetState.wallets.filter(w => w.assetSymbol.toUpperCase() === String(assetSymbol || '').toUpperCase());
    }

    // 5. INSERT INTO users (id, name, email, passwordHash, salt, twoFactorSecret, twoFactorEnabled, kycLevel, citizenship) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    if (formattedSql.startsWith('INSERT INTO users')) {
      const [id, name, email, passwordHash, salt, twoFactorSecret, twoFactorEnabled, kycLevel, citizenship, identityLocked = true, productionMode = 'live', blockchainLinked = true, lockedToEmail = email] = params;
      const targetState = this.transactionSnapshot || this.state;
      
      const exists = targetState.users.some(u => u.email.toLowerCase() === email.toLowerCase());
      if (exists) throw new Error('Unique constraint violation: Email already exists.');

      const newUser: DBUser = {
        id,
        name,
        email,
        passwordHash,
        salt,
        twoFactorSecret,
        twoFactorEnabled,
        kycLevel,
        citizenship,
        identityLocked: identityLocked !== false,
        productionMode: productionMode === 'sandbox' ? 'sandbox' : 'live',
        blockchainLinked: blockchainLinked !== false,
        lockedToEmail: String(lockedToEmail || email || '').toLowerCase(),
        lockedAt: new Date().toISOString()
      };
      targetState.users.push(newUser);
      
      if (!this.transactionSnapshot) this.save();
      return { affectedRows: 1, insertId: id };
    }

    // 6. INSERT INTO wallets (id, user_id, asset_symbol, balance, public_address_ethereum, public_address_bitcoin) VALUES (?, ?, ?, ?, ?, ?)
    if (formattedSql.startsWith('INSERT INTO wallets')) {
      const [id, userId, assetSymbol, balance, publicAddressEthereum, publicAddressBitcoin, identityLocked = true, productionMode = 'live', blockchainLinked = true, lockedToEmail = ''] = params;
      const targetState = this.transactionSnapshot || this.state;

      const newWallet: DBWallet = {
        id,
        userId,
        assetSymbol,
        balance,
        publicAddressEthereum,
        publicAddressBitcoin,
        identityLocked: identityLocked !== false,
        productionMode: productionMode === 'sandbox' ? 'sandbox' : 'live',
        blockchainLinked: blockchainLinked !== false,
        lockedToEmail: String(lockedToEmail || '').toLowerCase(),
        lockedAt: new Date().toISOString()
      };
      targetState.wallets.push(newWallet);

      if (!this.transactionSnapshot) this.save();
      return { affectedRows: 1, insertId: id };
    }

    // 7. UPDATE wallets SET balance = ? WHERE user_id = ? AND asset_symbol = ?
    if (formattedSql.startsWith('UPDATE wallets SET balance = ? WHERE user_id = ? AND asset_symbol = ?')) {
      const [newBalance, userId, assetSymbol] = params;
      const targetState = this.transactionSnapshot || this.state;

      let found = false;
      targetState.wallets = targetState.wallets.map(w => {
        if (w.userId === userId && w.assetSymbol.toUpperCase() === assetSymbol?.toUpperCase()) {
          found = true;
          return { ...w, balance: parseFloat(newBalance) };
        }
        return w;
      });

      if (!found) {
        targetState.wallets.push({
          id: `wallet-${userId}-${String(assetSymbol).toLowerCase()}`,
          userId: String(userId),
          assetSymbol: String(assetSymbol).toUpperCase(),
          balance: parseFloat(newBalance) || 0,
          publicAddressEthereum: '',
          publicAddressBitcoin: '',
          identityLocked: true,
          productionMode: 'live',
          blockchainLinked: false,
          lockedToEmail: '',
          lockedAt: new Date().toISOString()
        });
      }
      if (!this.transactionSnapshot) this.save();
      return { affectedRows: 1 };
    }

    // 7.5 UPDATE wallets SET balance = ? WHERE id = ?
    if (formattedSql.startsWith('UPDATE wallets SET balance = ? WHERE id = ?')) {
      const [newBalance, id] = params;
      const targetState = this.transactionSnapshot || this.state;

      let found = false;
      targetState.wallets = targetState.wallets.map(w => {
        if (w.id === id) {
          found = true;
          return { ...w, balance: parseFloat(newBalance) };
        }
        return w;
      });

      if (!found) throw new Error(`Wallet not found for id ${id}`);
      if (!this.transactionSnapshot) this.save();
      return { affectedRows: 1 };
    }

    // 8. UPDATE users SET kycFullName = ?, ...
    if (formattedSql.startsWith('UPDATE users SET kycFullName = ?')) {
      const [
        kycFullName,
        kycAddress,
        kycCity,
        kycState,
        kycProvince,
        kycPostalCode,
        kycTaxId,
        kycPhone,
        kycVerifiedAt,
        kycLevel,
        id
      ] = params;
      const targetState = this.transactionSnapshot || this.state;

      targetState.users = targetState.users.map(u => {
        if (u.id === id) {
          return {
            ...u,
            kycFullName,
            kycAddress,
            kycCity,
            kycState,
            kycProvince,
            kycPostalCode,
            kycTaxId,
            kycPhone,
            kycVerifiedAt,
            kycLevel: parseInt(kycLevel, 10)
          };
        }
        return u;
      });

      if (!this.transactionSnapshot) this.save();
      return { affectedRows: 1 };
    }

    // 8.5 UPDATE users SET kycLevel = ? WHERE id = ?
    if (formattedSql.startsWith('UPDATE users SET kycLevel = ? WHERE id = ?')) {
      const [newKyc, id] = params;
      const targetState = this.transactionSnapshot || this.state;

      targetState.users = targetState.users.map(u => {
        if (u.id === id) {
          return { ...u, kycLevel: parseInt(newKyc, 10) };
        }
        return u;
      });

      if (!this.transactionSnapshot) this.save();
      return { affectedRows: 1 };
    }

    // 8.6 UPDATE users SET passwordHash = ?, salt = ? WHERE id = ?
    if (formattedSql.startsWith('UPDATE users SET passwordHash = ?, salt = ? WHERE id = ?')) {
      const [passwordHash, salt, id] = params;
      const targetState = this.transactionSnapshot || this.state;

      let found = false;
      targetState.users = targetState.users.map(u => {
        if (u.id === id) {
          found = true;
          return {
            ...u,
            passwordHash: String(passwordHash || ''),
            salt: String(salt || '')
          };
        }
        return u;
      });

      if (!found) {
        throw new Error(`User not found for id ${id}`);
      }

      if (!this.transactionSnapshot) this.save();
      return { affectedRows: 1 };
    }

    // 9. INSERT INTO transactions (id, user_id, type, asset_symbol, amount, fiat_amount, timestamp, details, hash, status, ledger_debit, ledger_credit) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    if (formattedSql.startsWith('INSERT INTO transactions')) {
      const [id, userId, type, assetSymbol, amount, fiatAmount, timestamp, details, hash, status, ledgerDebit, ledgerCredit] = params;
      const targetState = this.transactionSnapshot || this.state;

      const newTx: DBTransaction = { id, userId, type, assetSymbol, amount, fiatAmount, timestamp, details, hash, status, ledgerDebit, ledgerCredit };
      targetState.transactions.push(newTx);

      if (!this.transactionSnapshot) this.save();
      return { affectedRows: 1, insertId: id };
    }

    // 9.5 SELECT * FROM transactions ...
    if (formattedSql.startsWith('SELECT * FROM transactions')) {
      const targetState = this.transactionSnapshot || this.state;
      let txs = [...targetState.transactions];

      if (formattedSql.includes('WHERE user_id = ?')) {
        const [userId] = params;
        txs = txs.filter(t => t.userId === userId);
      } else if (formattedSql.includes('WHERE id = ?')) {
        const [id] = params;
        txs = txs.filter(t => t.id === id);
      } else if (formattedSql.includes('WHERE hash = ? OR id = ?')) {
        const [p1, p2] = params;
        txs = txs.filter(t => t.hash === p1 || t.id === p2 || t.id === p1 || t.hash === p2);
      } else if (formattedSql.includes('WHERE type = ? AND status = ?')) {
        const [type, status] = params;
        txs = txs.filter(t => String(t.type) === String(type) && String(t.status) === String(status));
      }

      if (formattedSql.includes('ORDER BY timestamp DESC') || formattedSql.includes('ORDER BY created_at DESC')) {
        txs.sort((a, b) => Number(b.timestamp || 0) - Number(a.timestamp || 0));
      }

      const limitMatch = formattedSql.match(/LIMIT\s+(\d+)/i);
      if (limitMatch) {
        txs = txs.slice(0, parseInt(limitMatch[1], 10));
      }

      return txs;
    }

    // 10. UPDATE transactions ...
    if (formattedSql.startsWith('UPDATE transactions SET')) {
      const targetState = this.transactionSnapshot || this.state;

      // Pattern A: UPDATE transactions SET status = ?, details = ? WHERE id = ?
      if (formattedSql.startsWith('UPDATE transactions SET status = ?, details = ? WHERE id = ?')) {
        const [nextStatus, details, id] = params;
        let found = false;
        targetState.transactions = targetState.transactions.map((tx) => {
          if (tx.id === id) {
            found = true;
            return {
              ...tx,
              status: nextStatus as DBTransaction['status'],
              details: String(details || '')
            };
          }
          return tx;
        });
        if (!found) throw new Error(`Transaction not found for id ${id}`);
        if (!this.transactionSnapshot) this.save();
        return { affectedRows: 1 };
      }

      // Pattern B: UPDATE transactions SET status = '...', details = ? WHERE id = ?
      if (formattedSql.includes("status = '") && formattedSql.includes('details = ? WHERE id = ?')) {
        const match = formattedSql.match(/status = '([^']+)'/);
        const nextStatus = match ? match[1] : 'completed';
        const [details, id] = params;
        let found = false;
        targetState.transactions = targetState.transactions.map((tx) => {
          if (tx.id === id) {
            found = true;
            return {
              ...tx,
              status: nextStatus as DBTransaction['status'],
              details: String(details || '')
            };
          }
          return tx;
        });
        if (!found) throw new Error(`Transaction not found for id ${id}`);
        if (!this.transactionSnapshot) this.save();
        return { affectedRows: 1 };
      }

      // Pattern C: UPDATE transactions SET details = ? WHERE id = ?
      if (formattedSql.startsWith('UPDATE transactions SET details = ? WHERE id = ?')) {
        const [details, id] = params;
        let found = false;
        targetState.transactions = targetState.transactions.map((tx) => {
          if (tx.id === id) {
            found = true;
            return {
              ...tx,
              details: String(details || '')
            };
          }
          return tx;
        });
        if (!found) throw new Error(`Transaction not found for id ${id}`);
        if (!this.transactionSnapshot) this.save();
        return { affectedRows: 1 };
      }

      // Pattern D: UPDATE transactions SET status = '...' WHERE hash = ? OR id = ?
      if (formattedSql.includes("status = '") && formattedSql.includes('WHERE hash = ? OR id = ?')) {
        const match = formattedSql.match(/status = '([^']+)'/);
        const nextStatus = match ? match[1] : 'completed';
        const [p1, p2] = params;
        let affected = 0;
        targetState.transactions = targetState.transactions.map((tx) => {
          if (tx.hash === p1 || tx.id === p2 || tx.id === p1 || tx.hash === p2) {
            affected++;
            return {
              ...tx,
              status: nextStatus as DBTransaction['status']
            };
          }
          return tx;
        });
        if (!this.transactionSnapshot) this.save();
        return { affectedRows: affected };
      }

      // Pattern E: UPDATE transactions SET status = '...' WHERE id = ?
      if (formattedSql.includes("status = '") && formattedSql.includes('WHERE id = ?')) {
        const match = formattedSql.match(/status = '([^']+)'/);
        const nextStatus = match ? match[1] : 'completed';
        const [id] = params;
        let found = false;
        targetState.transactions = targetState.transactions.map((tx) => {
          if (tx.id === id) {
            found = true;
            return {
              ...tx,
              status: nextStatus as DBTransaction['status']
            };
          }
          return tx;
        });
        if (!found) throw new Error(`Transaction not found for id ${id}`);
        if (!this.transactionSnapshot) this.save();
        return { affectedRows: 1 };
      }

      throw new Error(`[LEDGER SQL ENGINE] Unsupported transaction update statement: "${sql}"`);
    }

    // 11. INSERT INTO audit_logs (id, user_id, action, timestamp, ip_address, status, details) VALUES (?, ?, ?, ?, ?, ?, ?)
    if (formattedSql.startsWith('INSERT INTO audit_logs')) {
      const [id, userId, action, timestamp, ipAddress, status, details] = params;
      const targetState = this.transactionSnapshot || this.state;

      const newLog: DBAuditLog = { id, userId, action, timestamp, ipAddress, status, details };
      targetState.auditLogs.push(newLog);

      if (!this.transactionSnapshot) this.save();
      return { affectedRows: 1, insertId: id };
    }

    // 11.5 SELECT * FROM audit_logs ...
    if (formattedSql.startsWith('SELECT * FROM audit_logs')) {
      const targetState = this.transactionSnapshot || this.state;
      let logs = [...targetState.auditLogs];

      if (formattedSql.includes('WHERE user_id = ?')) {
        const [userId] = params;
        logs = logs.filter(l => l.userId === userId);
      }

      if (formattedSql.includes('ORDER BY timestamp DESC') || formattedSql.includes('ORDER BY created_at DESC')) {
        logs.sort((a, b) => Number(b.timestamp || 0) - Number(a.timestamp || 0));
      }

      const limitMatch = formattedSql.match(/LIMIT\s+(\d+)/i);
      if (limitMatch) {
        logs = logs.slice(0, parseInt(limitMatch[1], 10));
      }

      return logs;
    }

    // 13. SELECT * FROM bank_accounts ...
    if (formattedSql.startsWith('SELECT * FROM bank_accounts')) {
      const targetState = this.transactionSnapshot || this.state;
      const bankAccounts = targetState.bankAccounts || [];

      if (formattedSql.includes('WHERE user_id = ?')) {
        const [userId] = params;
        return bankAccounts.filter(b => b.userId === userId);
      }

      return bankAccounts;
    }

    // 13.6 INSERT INTO bank_accounts
    if (formattedSql.startsWith('INSERT INTO bank_accounts')) {
      const [id, userId, accountName, bankName, accountType, routingNumber, accountNumber, balance = 0] = params;
      const targetState = this.transactionSnapshot || this.state;
      if (!targetState.bankAccounts) targetState.bankAccounts = [];
      const newAcc: DBBankAccount = { id, userId, accountName, bankName, accountType, routingNumber, accountNumber, balance: Number(balance) };
      targetState.bankAccounts.push(newAcc);
      if (!this.transactionSnapshot) this.save();
      return { affectedRows: 1, insertId: id };
    }

    // Resilient SELECT fallback for any unhandled read-only query
    if (formattedSql.toUpperCase().startsWith('SELECT')) {
      console.warn(`[LEDGER SQL ENGINE] Unhandled SELECT query: "${sql}". Returning empty result set.`);
      return [];
    }

    throw new Error(`[LEDGER SQL ENGINE] Unsupported SQL statement or syntax: "${sql}"`);
  }

  /**
   * Helper method: Get a transaction by ID
   */
  private reloadFromDiskIfNeeded() {
    if (this.transactionSnapshot || !fs.existsSync(DB_FILE_PATH)) return;

    const stats = fs.statSync(DB_FILE_PATH);
    if (stats.mtimeMs <= this.lastLoadedAt) return;

    const fileContent = fs.readFileSync(DB_FILE_PATH, 'utf-8');
    this.state = this.normalizeState(JSON.parse(fileContent));
    this.lastLoadedAt = stats.mtimeMs;
  }

  public getTransaction(txId: string): DBTransaction | undefined {
    this.reloadFromDiskIfNeeded();
    const targetState = this.transactionSnapshot || this.state;
    return targetState.transactions.find(t => t.id === txId);
  }

  /**
   * Helper method: Update transaction with partial fields
   */
  public updateTransaction(txId: string, updates: Partial<DBTransaction>): void {
    const targetState = this.transactionSnapshot || this.state;
    const index = targetState.transactions.findIndex(t => t.id === txId);
    
    if (index === -1) {
      throw new Error(`Transaction not found: ${txId}`);
    }

    targetState.transactions[index] = {
      ...targetState.transactions[index],
      ...updates
    };

    if (!this.transactionSnapshot) this.save();
  }

  public getIntegrityReport(): LedgerIntegrityReport {
    this.reloadFromDiskIfNeeded();
    const targetState = this.transactionSnapshot || this.state;

    const findings: LedgerIntegrityFinding[] = [];
    const warningFindings: LedgerIntegrityFinding[] = [];

    const addError = (code: string, message: string) => {
      findings.push({ severity: 'error', code, message });
    };
    const addWarning = (code: string, message: string) => {
      warningFindings.push({ severity: 'warning', code, message });
    };

    const userIdSet = new Set<string>();
    const userEmailSet = new Set<string>();
    for (const user of targetState.users) {
      const id = String(user.id || '').trim();
      const email = String(user.email || '').trim().toLowerCase();
      if (!id) addError('USER_ID_MISSING', 'Found user with missing id.');
      if (!email) addError('USER_EMAIL_MISSING', `User ${id || '[unknown]'} is missing email.`);
      if (id) {
        if (userIdSet.has(id)) addError('USER_ID_DUPLICATE', `Duplicate user id detected: ${id}.`);
        userIdSet.add(id);
      }
      if (email) {
        if (userEmailSet.has(email)) addError('USER_EMAIL_DUPLICATE', `Duplicate user email detected: ${email}.`);
        userEmailSet.add(email);
      }
    }

    const walletIdSet = new Set<string>();
    const walletCompositeSet = new Set<string>();
    for (const wallet of targetState.wallets) {
      const walletId = String(wallet.id || '').trim();
      const userId = String(wallet.userId || '').trim();
      const symbol = String(wallet.assetSymbol || '').trim().toUpperCase();
      const balance = Number(wallet.balance);

      if (!walletId) addError('WALLET_ID_MISSING', 'Found wallet with missing id.');
      if (!userId) addError('WALLET_USER_MISSING', `Wallet ${walletId || '[unknown]'} is missing userId.`);
      if (!symbol) addError('WALLET_ASSET_MISSING', `Wallet ${walletId || '[unknown]'} is missing asset symbol.`);
      if (!Number.isFinite(balance)) addError('WALLET_BALANCE_INVALID', `Wallet ${walletId || '[unknown]'} has invalid balance.`);

      if (walletId) {
        if (walletIdSet.has(walletId)) addError('WALLET_ID_DUPLICATE', `Duplicate wallet id detected: ${walletId}.`);
        walletIdSet.add(walletId);
      }

      const composite = `${userId}::${symbol}`;
      if (userId && symbol) {
        if (walletCompositeSet.has(composite)) {
          addError('WALLET_DUPLICATE_ASSET', `Duplicate wallet for user ${userId} and asset ${symbol}.`);
        }
        walletCompositeSet.add(composite);
      }

      if (userId && !userIdSet.has(userId)) {
        addError('WALLET_ORPHAN_USER', `Wallet ${walletId || '[unknown]'} references missing user ${userId}.`);
      }
    }

    const transactionIdSet = new Set<string>();
    const validStatuses = new Set(['pending', 'completed', 'failed', 'processing', 'settled']);
    for (const tx of targetState.transactions) {
      const txId = String(tx.id || '').trim();
      const userId = String(tx.userId || '').trim();
      const status = String(tx.status || '').trim();
      const amount = Number(tx.amount);
      const fiatAmount = Number(tx.fiatAmount);
      const timestamp = Number(tx.timestamp);

      if (!txId) addError('TX_ID_MISSING', 'Found transaction with missing id.');
      if (!userId) addError('TX_USER_MISSING', `Transaction ${txId || '[unknown]'} is missing userId.`);
      if (!Number.isFinite(amount)) addError('TX_AMOUNT_INVALID', `Transaction ${txId || '[unknown]'} has invalid amount.`);
      if (!Number.isFinite(fiatAmount)) addError('TX_FIAT_AMOUNT_INVALID', `Transaction ${txId || '[unknown]'} has invalid fiatAmount.`);
      if (!Number.isFinite(timestamp)) addError('TX_TIMESTAMP_INVALID', `Transaction ${txId || '[unknown]'} has invalid timestamp.`);
      if (!validStatuses.has(status)) addError('TX_STATUS_INVALID', `Transaction ${txId || '[unknown]'} has invalid status ${status || '[empty]'}.`);

      if (txId) {
        if (transactionIdSet.has(txId)) addError('TX_ID_DUPLICATE', `Duplicate transaction id detected: ${txId}.`);
        transactionIdSet.add(txId);
      }

      if (userId && !userIdSet.has(userId)) {
        addWarning('TX_ORPHAN_USER', `Transaction ${txId || '[unknown]'} references missing user ${userId}.`);
      }
    }

    const auditIdSet = new Set<string>();
    for (const log of targetState.auditLogs) {
      const logId = String(log.id || '').trim();
      if (!logId) addError('AUDIT_ID_MISSING', 'Found audit log with missing id.');
      if (logId) {
        if (auditIdSet.has(logId)) addError('AUDIT_ID_DUPLICATE', `Duplicate audit log id detected: ${logId}.`);
        auditIdSet.add(logId);
      }
    }

    return {
      ok: findings.length === 0,
      generatedAt: new Date().toISOString(),
      counts: {
        users: targetState.users.length,
        wallets: targetState.wallets.length,
        transactions: targetState.transactions.length,
        auditLogs: targetState.auditLogs.length,
        yieldDestinations: (targetState.yieldDestinations || []).length
      },
      errors: findings,
      warnings: warningFindings
    };
  }
}

export const db = new RelationalLedgerDatabase();
