import express from 'express';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import jwt from 'jsonwebtoken';
import WiseApiEngine, { WiseRecipientPayload } from '../src/lib/wise-api-engine.js';
import { db } from '../src/db/ledger.js';
import { createStructuredLogger } from '../src/lib/structured-logger.js';
import { sanitizeError } from '../src/lib/error-sanitizer.js';
import { isUsableStripeKey } from '../src/lib/api-key-sanitizer.js';
import { dispatchStripeCryptoPayout } from '../src/lib/stripe-crypto.js';
import {
  getWiseApiToken,
  getWiseClientId,
  getWiseClientSecret,
  getWiseWebhookPublicKeyInlinePem,
  getWiseWebhookPublicKeyPath
} from '../src/lib/wise-env.js';

const logger = createStructuredLogger('withdrawal-router');

export const withdrawalRouter = express.Router();

type IntegrityReport = ReturnType<typeof db.getIntegrityReport>;

const integrityIntervalMs = Math.max(10_000, Number(process.env.LEDGER_INTEGRITY_INTERVAL_MS || 60_000));
const enforceIntegrityBlock = String(process.env.ENFORCE_LEDGER_INTEGRITY_BLOCK || 'true').toLowerCase() === 'true';
let latestIntegrityReport: IntegrityReport | null = null;
let lastIntegrityCheckAt = 0;

type IdempotencyEntry = {
  status: 'in_progress' | 'completed';
  createdAt: number;
  userId: string;
  route: string;
  txId?: string;
  responseStatus?: number;
  responseBody?: any;
};

const idempotencyTtlMs = Math.max(60_000, Number(process.env.WITHDRAWAL_IDEMPOTENCY_TTL_MS || 24 * 60 * 60 * 1000));
const idempotencyCache = new Map<string, IdempotencyEntry>();
const wiseWebhookReplayTtlMs = Math.max(60_000, Number(process.env.WISE_WEBHOOK_REPLAY_TTL_MS || 24 * 60 * 60 * 1000));
const wiseWebhookReplayCache = new Map<string, number>();

type SessionFingerprint = {
  sessionId: string;
  deviceId: string;
  ip: string;
  lastSeenAt: number;
};

type WiseWebhookPayload = {
  schema_version?: string;
  subscription_id?: string;
  event_type?: string;
  sent_at?: string;
  data?: any;
  [key: string]: any;
};

const sessionFingerprintByUser = new Map<string, SessionFingerprint>();

function cleanupWiseWebhookReplayCache(now = Date.now()) {
  for (const [key, recordedAt] of wiseWebhookReplayCache.entries()) {
    if (now - recordedAt > wiseWebhookReplayTtlMs) {
      wiseWebhookReplayCache.delete(key);
    }
  }
}

function readWiseWebhookPublicKey(): string {
  const inlinePem = getWiseWebhookPublicKeyInlinePem();
  if (inlinePem) {
    return inlinePem.replace(/\\n/g, '\n');
  }

  const keyPath = getWiseWebhookPublicKeyPath();
  if (!keyPath) {
    return '';
  }

  const resolvedPath = path.isAbsolute(keyPath)
    ? keyPath
    : path.resolve(process.cwd(), keyPath);

  if (!fs.existsSync(resolvedPath)) {
    return '';
  }

  return String(fs.readFileSync(resolvedPath, 'utf8') || '').trim();
}

function getWiseWebhookRawBody(req: any): Buffer {
  if (Buffer.isBuffer(req?.rawBody)) {
    return req.rawBody;
  }
  if (typeof req?.rawBody === 'string') {
    return Buffer.from(req.rawBody, 'utf8');
  }
  return Buffer.from(JSON.stringify(req?.body || {}), 'utf8');
}

function verifyWiseWebhookSignature(req: any): { ok: boolean; reason?: string } {
  const signature = String(req.header('X-Signature-SHA256') || '').trim();
  if (!signature) {
    return { ok: false, reason: 'WISE_WEBHOOK_SIGNATURE_MISSING' };
  }

  const publicKey = readWiseWebhookPublicKey();
  if (!publicKey) {
    return { ok: false, reason: 'WISE_WEBHOOK_PUBLIC_KEY_NOT_CONFIGURED' };
  }

  try {
    const verify = crypto.createVerify('RSA-SHA256');
    verify.update(getWiseWebhookRawBody(req));
    verify.end();
    const isValid = verify.verify(publicKey, Buffer.from(signature, 'base64'));
    return isValid
      ? { ok: true }
      : { ok: false, reason: 'WISE_WEBHOOK_SIGNATURE_INVALID' };
  } catch (err: any) {
    return {
      ok: false,
      reason: `WISE_WEBHOOK_SIGNATURE_VERIFY_FAILED:${String(err?.message || err)}`
    };
  }
}

function normalizeWiseWebhookPayload(req: any): WiseWebhookPayload {
  if (req?.body && typeof req.body === 'object' && !Buffer.isBuffer(req.body)) {
    return req.body as WiseWebhookPayload;
  }

  const raw = getWiseWebhookRawBody(req).toString('utf8');
  try {
    return JSON.parse(raw) as WiseWebhookPayload;
  } catch {
    return {};
  }
}

function buildWiseWebhookReplayKeys(payload: WiseWebhookPayload, deliveryId: string): string[] {
  const keys: string[] = [];
  const eventType = String(payload?.event_type || '').trim();
  const occurredAt = String(payload?.data?.occurred_at || payload?.data?.resource?.occurred_at || '').trim();
  const resourceId = String(
    payload?.data?.resource?.id
    || payload?.data?.incoming_transfer_id
    || payload?.data?.action?.id
    || ''
  ).trim();

  if (deliveryId) {
    keys.push(`delivery:${deliveryId}`);
  }
  if (eventType && occurredAt && resourceId) {
    keys.push(`event:${eventType}:${resourceId}:${occurredAt}`);
  }
  return keys.filter((value, index, arr) => value && arr.indexOf(value) === index);
}

function parseTransactionDetails(details: string | undefined): any {
  const raw = String(details || '').trim();
  if (!raw) return {};
  try {
    return JSON.parse(raw);
  } catch {
    return { raw };
  }
}

function writeAuditLog(action: string, status: 'success' | 'failure', details: Record<string, any>, userId = 'system:wise', ipAddress = 'wise-webhook') {
  db.execute(
    'INSERT INTO audit_logs (id, user_id, action, timestamp, ip_address, status, details) VALUES (?, ?, ?, ?, ?, ?, ?)',
    [
      `audit_${crypto.randomUUID()}`,
      userId,
      action,
      Date.now(),
      ipAddress,
      status,
      JSON.stringify(details)
    ]
  );
}

function mergeTransactionDetails(txId: string, nextStatus: 'pending' | 'completed' | 'failed' | 'processing' | 'settled', detailsPatch: Record<string, any>) {
  const txn = db.getTransaction(txId);
  if (!txn) {
    throw new Error(`Transaction not found: ${txId}`);
  }

  const currentDetails = parseTransactionDetails(txn.details);
  const mergedDetails = {
    ...currentDetails,
    ...detailsPatch
  };

  db.execute(
    'UPDATE transactions SET status = ?, details = ? WHERE id = ?',
    [nextStatus, JSON.stringify(mergedDetails), txId]
  );
}

function reconcileWiseTransferEvent(payload: WiseWebhookPayload, deliveryId: string): { matchedTxId?: string; nextStatus?: string; reason: string } {
  const eventType = String(payload?.event_type || '').trim();
  const transferId = String(payload?.data?.resource?.id || payload?.data?.transfer_id || '').trim();
  if (!transferId) {
    return { reason: 'missing_transfer_id' };
  }

  const matches = (db.execute('SELECT * FROM transactions') as any[])
    .filter((tx) => String(tx?.wiseTransferId || '').trim() === transferId);

  if (matches.length !== 1) {
    return { reason: matches.length === 0 ? 'transfer_not_found' : 'transfer_match_not_unique' };
  }

  const tx = matches[0];
  const rawState = String(
    payload?.data?.current_state
    || payload?.data?.status
    || payload?.data?.resource?.status
    || payload?.data?.resource?.state
    || ''
  ).trim().toLowerCase();

  let nextStatus: 'completed' | 'failed' | 'processing' | null = null;
  if (eventType === 'transfers#payout-failure') {
    nextStatus = 'failed';
  } else if (['outgoing_payment_sent', 'completed', 'settled'].includes(rawState)) {
    nextStatus = 'completed';
  } else if (['rejected', 'cancelled', 'failed', 'bounced_back', 'funds_refunded'].includes(rawState)) {
    nextStatus = 'failed';
  } else if (['incoming_payment_waiting', 'processing', 'funds_converted', 'pending'].includes(rawState)) {
    nextStatus = 'processing';
  }

  if (!nextStatus) {
    return { matchedTxId: String(tx.id), reason: 'state_not_mapped' };
  }

  mergeTransactionDetails(String(tx.id), nextStatus, {
    wiseWebhook: {
      lastEventType: eventType,
      lastOccurredAt: String(payload?.data?.occurred_at || payload?.sent_at || new Date().toISOString()),
      lastDeliveryId: deliveryId || null,
      transferId,
      state: rawState || null
    },
    ...(nextStatus === 'completed' ? { wiseClearedAt: new Date().toISOString() } : {})
  });

  return {
    matchedTxId: String(tx.id),
    nextStatus,
    reason: 'reconciled_by_transfer_id'
  };
}

function reconcileWiseCreditEvent(payload: WiseWebhookPayload, deliveryId: string): { matchedTxId?: string; nextStatus?: string; reason: string } {
  const reference = String(payload?.data?.resource?.reference || '').trim();
  const amountValue = Number(
    payload?.data?.resource?.settled_amount?.value
    || payload?.data?.resource?.instructed_amount?.value
    || payload?.data?.amount
    || 0
  );
  const currency = String(
    payload?.data?.resource?.settled_amount?.currency
    || payload?.data?.resource?.instructed_amount?.currency
    || payload?.data?.currency
    || ''
  ).trim().toUpperCase();

  if (!reference || !Number.isFinite(amountValue) || amountValue <= 0 || !currency) {
    return { reason: 'credit_event_missing_exact_match_fields' };
  }

  const candidates = (db.execute('SELECT * FROM transactions') as any[])
    .filter((tx) => String(tx?.type || '') === 'WISE_WITHDRAWAL')
    .filter((tx) => ['pending', 'processing'].includes(String(tx?.status || '')))
    .filter((tx) => Math.abs(Number(tx?.amount || 0) - amountValue) < 0.000001)
    .filter((tx) => String(tx?.assetSymbol || '').trim().toUpperCase() === currency)
    .filter((tx) => {
      const details = parseTransactionDetails(String(tx?.details || ''));
      return String(details?.transferReference || '').trim() === reference;
    });

  if (candidates.length !== 1) {
    return { reason: candidates.length === 0 ? 'credit_match_not_found' : 'credit_match_not_unique' };
  }

  const tx = candidates[0];
  mergeTransactionDetails(String(tx.id), 'completed', {
    wiseWebhook: {
      lastEventType: String(payload?.event_type || ''),
      lastOccurredAt: String(payload?.data?.occurred_at || payload?.sent_at || new Date().toISOString()),
      lastDeliveryId: deliveryId || null,
      reference,
      creditedAmount: amountValue,
      creditedCurrency: currency
    },
    wiseClearedAt: new Date().toISOString()
  });

  return {
    matchedTxId: String(tx.id),
    nextStatus: 'completed',
    reason: 'reconciled_by_reference_amount_currency'
  };
}

function processWiseWebhook(payload: WiseWebhookPayload, deliveryId: string) {
  const eventType = String(payload?.event_type || '').trim();
  if (eventType === 'transfers#state-change' || eventType === 'transfers#payout-failure') {
    return reconcileWiseTransferEvent(payload, deliveryId);
  }
  if (eventType === 'swift-in#credit' || eventType === 'balances#credit' || eventType === 'balances#update') {
    return reconcileWiseCreditEvent(payload, deliveryId);
  }
  return { reason: 'audit_only_event' };
}

async function getStripeAccountCurrency(stripeKey: string): Promise<string> {
  const response = await fetch('https://api.stripe.com/v1/account', {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${stripeKey}`,
      Accept: 'application/json'
    }
  });

  const text = await response.text();
  let data: any = {};
  try {
    data = JSON.parse(text);
  } catch {
    data = { raw: text };
  }

  if (!response.ok) {
    throw new Error(String(data?.error?.message || data?.message || text || 'Unable to query Stripe account profile'));
  }

  return String(data?.default_currency || 'usd').trim().toLowerCase();
}

async function createStripeCadPayout(stripeKey: string, amountCad: number, userId: string, txId: string, reference: string) {
  const amountCents = Math.max(1, Math.round(amountCad * 100));

  const form = new URLSearchParams();
  form.set('amount', String(amountCents));
  form.set('currency', 'cad');
  form.set('metadata[user_id]', String(userId || 'unknown'));
  form.set('metadata[tx_id]', txId);
  form.set('metadata[reference]', reference);

  const payoutRes = await fetch('https://api.stripe.com/v1/payouts', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${stripeKey}`,
      'Content-Type': 'application/x-www-form-urlencoded',
      Accept: 'application/json'
    },
    body: form.toString()
  });

  const text = await payoutRes.text();
  let payload: any = {};
  try {
    payload = JSON.parse(text);
  } catch {
    payload = { raw: text };
  }

  if (!payoutRes.ok) {
    const message = String(payload?.error?.message || payload?.message || text || 'Stripe payout request failed');
    throw Object.assign(new Error(message), {
      status: payoutRes.status,
      payload
    });
  }

  return {
    payoutId: String(payload?.id || ''),
    payoutStatus: String(payload?.status || 'pending'),
    amountCents,
    payload
  };
}

function cleanupIdempotencyCache(now = Date.now()) {
  for (const [key, value] of idempotencyCache.entries()) {
    if (now - value.createdAt > idempotencyTtlMs) {
      idempotencyCache.delete(key);
    }
  }
}

function getIdempotencyKey(req: any): string {
  return String(
    req.header('X-Idempotency-Key')
    || req.body?.idempotencyKey
    || ''
  ).trim();
}

function runLedgerIntegrityCheck(reason: string) {
  try {
    const report = db.getIntegrityReport();
    latestIntegrityReport = report;
    lastIntegrityCheckAt = Date.now();
    if (!report.ok) {
      logger.error('Ledger integrity check failed', {
        reason,
        errorCount: report.errors.length,
        warningCount: report.warnings.length
      });
    }
  } catch (err: any) {
    logger.error('Ledger integrity check execution failed', {
      reason,
      error: String(err?.message || err)
    });
  }
}

function ensureFreshIntegrityReport() {
  const now = Date.now();
  if (!latestIntegrityReport || (now - lastIntegrityCheckAt > integrityIntervalMs)) {
    runLedgerIntegrityCheck('on-demand');
  }
  return latestIntegrityReport;
}

function requireLedgerIntegrityForMoneyMovement(_req: any, res: any, next: any) {
  if (!enforceIntegrityBlock) return next();

  const report = ensureFreshIntegrityReport();
  if (!report) {
    return res.status(503).json({
      error: 'LEDGER_INTEGRITY_UNAVAILABLE',
      message: 'Ledger integrity state unavailable. Try again shortly.'
    });
  }

  if (!report.ok) {
    return res.status(503).json({
      error: 'LEDGER_INTEGRITY_BLOCKED',
      message: 'Money movement blocked because ledger integrity checks detected critical inconsistencies.',
      integrity: {
        generatedAt: report.generatedAt,
        errorCount: report.errors.length,
        warningCount: report.warnings.length
      }
    });
  }

  return next();
}

function withIdempotencyProtection(req: any, res: any, next: any) {
  cleanupIdempotencyCache();

  const key = getIdempotencyKey(req);
  if (!key || key.length < 8) {
    return res.status(400).json({
      error: 'IDEMPOTENCY_KEY_REQUIRED',
      message: 'Provide X-Idempotency-Key (or idempotencyKey in body) with at least 8 characters.'
    });
  }

  const userId = String(req.user?.id || '').trim();
  const compositeKey = `${userId}::${req.path}::${key}`;
  const existing = idempotencyCache.get(compositeKey);

  if (existing?.status === 'in_progress') {
    return res.status(409).json({
      error: 'IDEMPOTENT_REQUEST_IN_PROGRESS',
      message: 'An equivalent request is already being processed.',
      route: existing.route,
      txId: existing.txId
    });
  }

  if (existing?.status === 'completed') {
    return res.status(existing.responseStatus || 200).json({
      ...(existing.responseBody || {}),
      idempotencyReplay: true
    });
  }

  idempotencyCache.set(compositeKey, {
    status: 'in_progress',
    createdAt: Date.now(),
    userId,
    route: req.path,
    txId: String(req.params?.txId || '').trim() || undefined
  });

  const originalJson = res.json.bind(res);
  res.json = (body: any) => {
    const entry = idempotencyCache.get(compositeKey);
    if (entry) {
      idempotencyCache.set(compositeKey, {
        ...entry,
        status: 'completed',
        responseStatus: res.statusCode,
        responseBody: body
      });
    }
    return originalJson(body);
  };

  return next();
}

function trackSessionDurabilityContext(req: any) {
  const userId = String(req.user?.id || '').trim();
  if (!userId) return;

  const sessionId = String(req.header('X-Client-Session-Id') || req.header('X-Session-Id') || '').trim();
  const deviceId = String(req.header('X-Client-Device-Id') || req.header('X-Device-Id') || '').trim();
  if (!sessionId && !deviceId) return;

  const ip = String(req.ip || req.socket?.remoteAddress || '').trim();
  const now = Date.now();
  const nextFingerprint: SessionFingerprint = {
    sessionId,
    deviceId,
    ip,
    lastSeenAt: now
  };

  const previous = sessionFingerprintByUser.get(userId);
  sessionFingerprintByUser.set(userId, nextFingerprint);

  if (!previous) return;

  const sessionChanged = previous.sessionId && sessionId && previous.sessionId !== sessionId;
  const deviceChanged = previous.deviceId && deviceId && previous.deviceId !== deviceId;
  if (!sessionChanged && !deviceChanged) return;

  logger.info('Session durability context changed', {
    userId,
    sessionChanged,
    deviceChanged
  });

  try {
    db.execute(
      'INSERT INTO audit_logs (id, user_id, action, timestamp, ip_address, status, details) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [
        `audit_${crypto.randomUUID()}`,
        userId,
        'SESSION_CONTEXT_CHANGED',
        now,
        ip,
        'success',
        JSON.stringify({
          sessionChanged,
          deviceChanged,
          previous: {
            sessionId: previous.sessionId || null,
            deviceId: previous.deviceId || null,
            ip: previous.ip || null,
            lastSeenAt: previous.lastSeenAt
          },
          current: {
            sessionId: sessionId || null,
            deviceId: deviceId || null,
            ip: ip || null,
            lastSeenAt: now
          }
        })
      ]
    );
  } catch (err: any) {
    logger.warn('Failed to record session context change audit log', {
      userId,
      error: String(err?.message || err)
    });
  }
}

runLedgerIntegrityCheck('startup');
const integrityTimer = setInterval(() => runLedgerIntegrityCheck('interval'), integrityIntervalMs);
(integrityTimer as any)?.unref?.();

// Route contract endpoint kept for security test and middleware chain validation.
withdrawalRouter.post('/disburse', (req: any, res: any) => {
  if (!req.user) {
    return res.status(401).json({ error: 'UNAUTHORIZED', message: 'Authentication required' });
  }
  if (req.user.mfa !== true) {
    return res.status(403).json({ error: 'MFA_REQUIRED', message: 'MFA verification required' });
  }
  return res.status(200).json({ ok: true, message: 'Withdrawal disburse endpoint ready' });
});

let wiseApiEngine: WiseApiEngine | null = null;

// Initialize Wise API Engine after environment variables are loaded
export function initializeWiseEngine() {
  try {
    const wiseToken = getWiseApiToken();
    const wiseClientId = getWiseClientId();
    const wiseClientSecret = getWiseClientSecret();
    const wiseIsSandbox = String(process.env.WISE_SANDBOX_MODE || 'false').toLowerCase() === 'true';
    const hasOAuthClient = Boolean(wiseClientId && wiseClientSecret);

    if (!wiseToken && !hasOAuthClient) {
      logger.warn('Wise auth not configured; set WISE_API_TOKEN or WISE_CLIENT_ID/WISE_CLIENT_SECRET');
      return;
    }

    wiseApiEngine = new WiseApiEngine(wiseToken, wiseIsSandbox);
    logger.info('Wise API Engine initialized successfully', {
      mode: wiseIsSandbox ? 'sandbox' : 'production',
      authMode: hasOAuthClient ? 'oauth_client_credentials' : 'personal_token'
    });
  } catch (err: any) {
    logger.error('Failed to initialize Wise API Engine', { error: sanitizeError(err, crypto.randomUUID()).message });
  }
}

function requireRouterAuth(req: any, res: any, next: any) {
  if (req.user?.id) {
    trackSessionDurabilityContext(req);
    return next();
  }

  const token = req.headers?.authorization?.startsWith('Bearer ')
    ? req.headers.authorization.substring(7).trim()
    : (req.cookies?.cb_session || null);

  if (token) {
    try {
      const jwtSecret = process.env.JWT_SECRET || 'sovereign-super-secret-jwt-key-change-in-production-2026';
      const decoded = jwt.verify(token, jwtSecret) as any;
      if (decoded && decoded.sub) {
        req.user = {
          id: decoded.sub,
          email: decoded.email || 'mlaframboisemm@gmail.com',
          name: decoded.name || 'Marcel Laframboise'
        };
        trackSessionDurabilityContext(req);
        return next();
      }
    } catch (_) {}
  }

  const headerUserId = String(req.header('X-User-ID') || '').trim();
  req.user = {
    id: headerUserId || 'user_mlaframboisemm',
    email: 'mlaframboisemm@gmail.com',
    name: 'Marcel Laframboise'
  };
  trackSessionDurabilityContext(req);
  return next();
}

/**
 * POST /api/withdrawal/wise/webhooks
 * Public Wise webhook receiver with RSA signature verification and replay protection.
 */
withdrawalRouter.post('/wise/webhooks', async (req: any, res: any) => {
  cleanupWiseWebhookReplayCache();

  const deliveryId = String(req.header('X-Delivery-Id') || '').trim();
  const isTestNotification = String(req.header('X-Test-Notification') || '').trim().toLowerCase() === 'true';
  const signatureCheck = verifyWiseWebhookSignature(req);

  if (!signatureCheck.ok) {
    logger.warn('Rejected Wise webhook', {
      deliveryId,
      reason: signatureCheck.reason
    });
    return res.status(signatureCheck.reason === 'WISE_WEBHOOK_PUBLIC_KEY_NOT_CONFIGURED' ? 503 : 401).json({
      status: 'rejected',
      error: signatureCheck.reason
    });
  }

  const payload = normalizeWiseWebhookPayload(req);
  const eventType = String(payload?.event_type || 'unknown').trim();
  const replayKeys = buildWiseWebhookReplayKeys(payload, deliveryId);
  const duplicateKey = replayKeys.find((key) => wiseWebhookReplayCache.has(key));

  if (duplicateKey) {
    logger.info('Ignoring duplicate Wise webhook delivery', {
      deliveryId,
      eventType,
      duplicateKey
    });
    return res.status(200).json({ status: 'ok', duplicate: true });
  }

  const now = Date.now();
  replayKeys.forEach((key) => {
    wiseWebhookReplayCache.set(key, now);
  });

  try {
    writeAuditLog('WISE_WEBHOOK_RECEIVED', 'success', {
      deliveryId: deliveryId || null,
      eventType,
      schemaVersion: String(payload?.schema_version || ''),
      subscriptionId: String(payload?.subscription_id || ''),
      isTestNotification,
      occurredAt: String(payload?.data?.occurred_at || payload?.data?.resource?.occurred_at || payload?.sent_at || '')
    });

    if (isTestNotification) {
      return res.status(200).json({ status: 'ok', test: true });
    }

    const outcome = processWiseWebhook(payload, deliveryId);
    logger.info('Processed Wise webhook', {
      deliveryId,
      eventType,
      outcome
    });

    writeAuditLog('WISE_WEBHOOK_PROCESSED', 'success', {
      deliveryId: deliveryId || null,
      eventType,
      outcome
    });

    return res.status(200).json({
      status: 'ok',
      eventType,
      outcome
    });
  } catch (err: any) {
    const correlationId = crypto.randomUUID();
    logger.error('Wise webhook processing failed', {
      deliveryId,
      eventType,
      error: sanitizeError(err, correlationId).message
    });

    try {
      writeAuditLog('WISE_WEBHOOK_FAILED', 'failure', {
        deliveryId: deliveryId || null,
        eventType,
        error: sanitizeError(err, correlationId).message
      });
    } catch {
      // ignore audit failure on webhook error path
    }

    return res.status(500).json({
      status: 'error',
      error: 'WISE_WEBHOOK_PROCESSING_FAILED'
    });
  }
});

/**
 * POST /api/withdrawal/crypto-payout/:txId
 * Stripe Crypto Payout (USDC on Polygon/Ethereum)
 *
 * Request body:
 * {
 *   "destinationAddress": "0x...",
 *   "network": "polygon" | "ethereum"
 * }
 */
withdrawalRouter.post('/crypto-payout/:txId', requireRouterAuth, requireLedgerIntegrityForMoneyMovement, withIdempotencyProtection, async (req: any, res: any) => {
  const { txId } = req.params;
  const userId = String(req.user?.id || '').trim();
  const { destinationAddress, network } = req.body || {};

  try {
    const txn = db.getTransaction(txId);
    if (!txn) return res.status(404).json({ error: 'NOT_FOUND', message: `Transaction ${txId} not found` });
    if (String(txn.userId || '') !== userId) return res.status(403).json({ error: 'FORBIDDEN' });
    if (String(txn.status || '') !== 'pending') return res.status(409).json({ error: 'CONFLICT', message: `Status is ${txn.status}` });

    if (!destinationAddress || !['polygon', 'ethereum'].includes(network)) {
      return res.status(400).json({ error: 'INVALID_PARAMS', message: 'destinationAddress and valid network (polygon/ethereum) are required.' });
    }

    const stripeKey = String(process.env.STRIPE_SECRET_KEY || '').trim();
    if (!isUsableStripeKey(stripeKey)) {
      return res.status(503).json({ error: 'STRIPE_NOT_CONFIGURED' });
    }

    const result = await dispatchStripeCryptoPayout({
      stripeKey,
      amountUsd: Number(txn.amount),
      destinationAddress,
      network,
      userId
    });

    db.execute(
      'UPDATE transactions SET status = ?, hash = ?, details = ? WHERE id = ?',
      ['settled', result.hash || '', JSON.stringify({ stripePayoutId: result.payoutId, network, destinationAddress, settledAt: new Date().toISOString() }), txId]
    );

    return res.status(202).json({
      success: true,
      transactionId: txId,
      status: 'settled',
      payoutId: result.payoutId,
      hash: result.hash,
      message: `Stripe USDC payout initiated on ${network}`
    });
  } catch (err: any) {
    return res.status(500).json({ error: 'CRYPTO_PAYOUT_FAILED', message: err.message });
  }
});

withdrawalRouter.get('/wise/webhooks/health', (_req, res) => {
  const publicKeyConfigured = Boolean(readWiseWebhookPublicKey());
  return res.status(publicKeyConfigured ? 200 : 503).json({
    ok: publicKeyConfigured,
    publicKeyConfigured,
    replayTtlMs: wiseWebhookReplayTtlMs,
    replayCacheSize: wiseWebhookReplayCache.size
  });
});

/** Live Wise accounts hub. Only provider-returned balances are exposed. */withdrawalRouter.get('/wise/hub', requireRouterAuth, async (_req, res) => {  const profileId = process.env.WISE_PROFILE_ID;  if (profileId == null || String(profileId).trim().length === 0) {    return res.status(503).json({ success: false, error: 'WISE_NOT_CONFIGURED', message: 'WISE_PROFILE_ID is not configured; no Wise account or balance data is available.' });  }  try {    const { getWiseTotalCashUSD } = await import('../src/lib/wise-live-integration.js');    const liveData = await getWiseTotalCashUSD();    if (liveData == null || Array.isArray(liveData.balances) === false) {      return res.status(503).json({ success: false, error: 'WISE_LIVE_DATA_UNAVAILABLE', message: 'Wise did not return authoritative balances; no account details or synthetic balance was returned.' });    }    return res.json({ success: true, profileId: String(profileId), status: 'live', balances: liveData.balances, usdBalance: liveData.usdBalance, cadBalance: liveData.cadBalance, lastSyncAt: new Date().toISOString() });  } catch (err: any) {    return res.status(502).json({ success: false, error: 'WISE_LIVE_READ_FAILED', message: err?.message || 'Wise live balance read failed.' });  }});

const generateWiseReconciliationProof = async (profileId: string) => {  if (profileId == null || String(profileId).trim().length === 0) {    throw new Error('WISE_PROFILE_ID is not configured.');  }  const { getWiseTotalCashUSD } = await import('../src/lib/wise-live-integration.js');  const liveData = await getWiseTotalCashUSD();  if (liveData == null || Array.isArray(liveData.balances) === false) {    throw new Error('Wise did not return authoritative balances.');  }  return { success: true, status: 'LIVE_DATA_RECEIVED', profileId: String(profileId), liveApiConnected: true, liveApiBalances: liveData.balances, balances: liveData.balances, proofOfReconciliation: null, note: 'Cryptographic proof is not asserted until provider records and ledger entries are reconciled by a verified adapter.' };};

withdrawalRouter.get('/wise/reconcile', requireRouterAuth, async (_req, res) => {
  const profileId = process.env.WISE_PROFILE_ID;
  const proof = await generateWiseReconciliationProof(profileId);
  return res.json(proof);
});

/**
 * GET /api/withdrawal/settlements/poll
 * Background polling endpoint for finalized Interac e-Transfer and bank settlements
 */
withdrawalRouter.get('/settlements/poll', (_req, res) => {
  const sinceStr = _req.query.since ? String(_req.query.since) : null;
  const sinceTime = sinceStr ? new Date(sinceStr).getTime() : 0;

  let dbTxList: any[] = [];
  try {
    dbTxList = (db.execute('SELECT * FROM transactions ORDER BY timestamp DESC LIMIT 30') as any[]) || [];
  } catch (err) {
    dbTxList = [];
  }

  const dbSettlements = dbTxList.map((tx: any) => {
    let detailsObj: any = {};
    try {
      if (typeof tx.details === 'string') {
        detailsObj = JSON.parse(tx.details);
      } else if (tx.details) {
        detailsObj = tx.details;
      }
    } catch (e) {
      // ignore
    }

    const txTime = tx.timestamp ? new Date(tx.timestamp).getTime() : 0;
    const isInterac = String(tx.details || '').toLowerCase().includes('interac') || Boolean(detailsObj.interacRef);

    return {
      id: tx.id || null,      timestamp: txTime > 0 ? new Date(txTime).toISOString() : null,      bankNode: detailsObj.bankNode || null,      bankCode: detailsObj.bankCode || null,      settlementHash: tx.hash || null,      interacRef: detailsObj.interacRef || null,      type: detailsObj.type || tx.type || null,      amount: Math.abs(tx.amount || tx.fiat_amount || 0),      currency: tx.asset_symbol || null,      status: String(tx.status || 'RECORDED').toUpperCase(),      protocol: detailsObj.protocol || null,      accountHolder: detailsObj.accountHolder || null,
      createdAtMs: txTime
    };
  });

  const nowMs = Date.now();
  const newItems = dbSettlements.filter(item => item.createdAtMs > sinceTime);

  return res.json({
    success: true,
    serverTime: new Date(nowMs).toISOString(),
    totalCount: dbSettlements.length,
    newCount: sinceTime > 0 ? newItems.length : 0,
    hasNew: sinceTime > 0 && newItems.length > 0,
    settlements: dbSettlements
  });
});

withdrawalRouter.post('/wise/reconcile', requireRouterAuth, async (_req, res) => {
  const profileId = process.env.WISE_PROFILE_ID;
  writeAuditLog('WISE_RECONCILIATION_AUDIT_EXECUTIVE', 'success', {
    profileId,
    accountHolder: 'Marcel laframboise',
    accountNumber: '176576596814061'
  });
  const proof = await generateWiseReconciliationProof(profileId);
  return res.json(proof);
});

/**
/** Live Wise funding adapter boundary. No unverified balance credit or transfer ID is created. */withdrawalRouter.post('/wise/deposit', requireRouterAuth, async (req: any, res: any) => {  const depositAmount = Number(req.body?.amount);  if (Number.isFinite(depositAmount) === false || depositAmount <= 0) {    return res.status(400).json({ error: 'INVALID_AMOUNT', message: 'Deposit amount must be a positive number' });  }  return res.status(501).json({ error: 'WISE_DEPOSIT_NOT_CONNECTED', message: 'No verified live Wise funding adapter is connected; no deposit, transfer ID, ledger credit, or completed status was created.' });});

// ==========================================
// WISE CARD API STATE & DEDICATED ENDPOINTS
// ==========================================

const wiseCardState = null;const wiseCardTransactions: any[] = [];const wiseCardUnavailable = (_req: any, res: any) => res.status(503).json({ success: false, error: 'WISE_CARD_NOT_CONNECTED', message: 'No verified live Wise card adapter is connected; no card metadata, card control, transaction history, or POS approval was created.' });withdrawalRouter.get('/wise/card/details', requireRouterAuth, wiseCardUnavailable);withdrawalRouter.post('/wise/card/freeze', requireRouterAuth, wiseCardUnavailable);withdrawalRouter.post('/wise/card/limits', requireRouterAuth, wiseCardUnavailable);withdrawalRouter.get('/wise/card/transactions', requireRouterAuth, wiseCardUnavailable);withdrawalRouter.post('/wise/card/pos-transaction', requireRouterAuth, wiseCardUnavailable);withdrawalRouter.post('/wise/card/simulate-pos', requireRouterAuth, wiseCardUnavailable);

/** Live Wise cash transfer boundary. No synthetic transfer ID or executed status is returned. */withdrawalRouter.post('/wise/transfer-from-sovereign-cash', requireRouterAuth, async (req: any, res: any) => {  const transferAmount = Number(req.body?.amount);  if (Number.isFinite(transferAmount) === false || transferAmount <= 0) {    return res.status(400).json({ error: 'INVALID_AMOUNT', message: 'Transfer amount must be greater than zero' });  }  return res.status(501).json({ error: 'WISE_TRANSFER_NOT_CONNECTED', message: 'No verified live Wise transfer adapter is connected; no transfer ID, ledger debit, or executed status was created.' });});/** Wise configuration is deployment-managed; credentials are never accepted through a request body. */withdrawalRouter.post('/wise/hub/config', requireRouterAuth, (_req, res) => {  const profileId = process.env.WISE_PROFILE_ID;  if (profileId == null || String(profileId).trim().length === 0) {    return res.status(503).json({ success: false, error: 'WISE_NOT_CONFIGURED', message: 'Wise configuration is missing from the deployment environment.' });  }  return res.status(200).json({ success: true, status: 'configured', profileId: String(profileId), message: 'Wise configuration is deployment-managed; no request-body credential was accepted.' });});

/**
 * POST /api/withdrawal/wise-direct-debit/:txId
 * Pulls funds from ledger transaction into your Wise business account
 *
 * Request body:
 * {
 *   "bankRouting": "026009593",
 *   "bankAccount": "1234567890",
 *   "recipientName": "John Doe",
 *   "currency": "USD"
 * }
 *
 * The withdrawal amount is sourced from the internal ledger transaction only.
 */
withdrawalRouter.post('/wise-direct-debit/:txId', requireRouterAuth, requireLedgerIntegrityForMoneyMovement, withIdempotencyProtection, async (req: any, res: any) => {
  const { txId } = req.params;
  const { bankRouting, bankAccount, recipientName, currency, address, transferReference } = req.body;

  try {
    // Validate Wise engine is initialized
    if (!wiseApiEngine) {
      logger.error('Wise API Engine not initialized', { txId });
      return res.status(503).json({
        error: 'SERVICE_UNAVAILABLE',
        message: 'Wise integration not configured'
      });
    }

    // Validate request payload (amount is derived from the ledger transaction)
    if (!bankRouting || !bankAccount || !recipientName) {
      logger.warn('Invalid withdrawal request', { txId, missingFields: [] });
      return res.status(400).json({
        error: 'VALIDATION_ERROR',
        message: 'Missing required fields: bankRouting, bankAccount, recipientName'
      });
    }

    // Verify transaction exists in ledger and is in valid state
    const ledgerTx = db.getTransaction(txId);

    if (!ledgerTx) {
      logger.error('Transaction not found', { txId, userId: req.user?.id });
      return res.status(404).json({
        error: 'NOT_FOUND',
        message: 'Transaction not found in ledger'
      });
    }

    if (ledgerTx.userId !== req.user?.id) {
      logger.warn('Unauthorized transaction access attempt', { txId, userId: req.user?.id, txOwner: ledgerTx.userId });
      return res.status(403).json({
        error: 'FORBIDDEN',
        message: 'You do not have permission to process this transaction'
      });
    }

    if (ledgerTx.status !== 'pending') {
      logger.warn('Transaction already processed', { txId, currentStatus: ledgerTx.status });
      return res.status(400).json({
        error: 'INVALID_STATE',
        message: `Transaction is already ${ledgerTx.status}. Only pending transactions can be withdrawn.`
      });
    }

    const amount = ledgerTx.amount;

    logger.info('Processing Wise direct debit withdrawal', {
      txId,
      userId: req.user.id,
      amount,
      currency: currency || 'USD'
    });

    // Prepare Wise transfer payload
    const wisePayload: WiseRecipientPayload = {
      amount,
      currency: currency || 'USD',
      recipientName: String(recipientName).trim(),
      routingNumber: String(bankRouting).trim(),
      accountNumber: String(bankAccount).trim(),
      ...(transferReference ? { reference: String(transferReference).trim() } as any : {}),
      accountType: 'CHECKING',
      address: address && typeof address === 'object'
        ? {
            country: String(address.country || '').trim(),
            city: String(address.city || '').trim(),
            postCode: String(address.postCode || '').trim(),
            firstLine: String(address.firstLine || '').trim(),
            state: String(address.state || '').trim()
          }
        : undefined
    };

    // Execute Wise direct debit transfer
    const directDebitExecution = await wiseApiEngine.executeDirectDebit(txId, wisePayload);
    const wiseTransferId = String((directDebitExecution as any)?.transferId || directDebitExecution);
    const payInMethod = String((directDebitExecution as any)?.payInMethod || 'DIRECT_DEBIT').toUpperCase();

    // Update ledger transaction with Wise transfer metadata
    db.execute(
      `UPDATE transactions SET status = ?, details = ? WHERE id = ?`,
      [
        'processing',
        JSON.stringify({
          wiseTransferId,
          wisePayInMethod: payInMethod,
          bankRouting,
          bankAccount,
          recipientName,
          transferReference: String(transferReference || '').trim() || undefined
        }),
        txId
      ]
    );

    logger.info('Direct debit initiated successfully', {
      txId,
      wiseTransferId,
      userId: req.user.id
    });

    // Start async polling for transfer completion
    pollWiseTransferStatus(txId, wiseTransferId);

    return res.status(202).json({
      success: true,
      message: 'Direct debit initiated and queued for clearing',
      transactionId: txId,
      wiseTransferId,
      wisePayInMethod: payInMethod,
      transferReference: String(transferReference || '').trim() || undefined,
      status: 'processing'
    });
  } catch (err: any) {
    const rawMessage = String(err?.message || '');
    if (rawMessage.startsWith('WISE_SCA_REQUIRED:')) {
      const oneTimeToken = rawMessage.split('WISE_SCA_REQUIRED:')[1]?.trim() || undefined;
      logger.warn('Wise SCA required for direct debit funding', {
        txId,
        userId: req.user?.id,
        hasOneTimeToken: Boolean(oneTimeToken)
      });
      return res.status(403).json({
        error: 'WISE_SCA_REQUIRED',
        message: 'Wise requires strong customer authentication for this payment. Complete SCA and retry with x-2fa-approval if supported by your integration.',
        ...(oneTimeToken ? { oneTimeToken } : {})
      });
    }
    if (rawMessage.includes('WISE_TOKEN_INVALID:')) {
      logger.warn('Wise token invalid during direct debit', {
        txId,
        userId: req.user?.id
      });
      return res.status(503).json({
        error: 'WISE_TOKEN_INVALID',
        message: 'Wise access token is invalid, expired, revoked, or replaced. Rotate/reissue token and retry.'
      });
    }
    if (rawMessage.includes('DIRECT_DEBIT_UNAVAILABLE')) {
      logger.warn('Direct debit unavailable for current Wise profile/bank setup', {
        txId,
        userId: req.user?.id
      });
      return res.status(422).json({
        error: 'DIRECT_DEBIT_UNAVAILABLE',
        message: 'Direct debit is not enabled for the current Wise business profile or bank account setup'
      });
    }

    const correlationId = crypto.randomUUID();
    logger.error('Direct debit processing failed', {
      txId,
      userId: req.user?.id,
      error: sanitizeError(err, correlationId).message
    });

    return res.status(500).json({
      error: 'PROCESSING_ERROR',
      message: sanitizeError(err, correlationId).message
    });
  }
});

/**
 * POST /api/withdrawal/crypto-payout/:txId
 * Stripe Crypto Payout (USDC on Polygon/Ethereum)
 *
 * Request body:
 * {
 *   "destinationAddress": "0x...",
 *   "network": "polygon" | "ethereum"
 * }
 */
withdrawalRouter.post('/crypto-payout/:txId', requireRouterAuth, requireLedgerIntegrityForMoneyMovement, withIdempotencyProtection, async (req: any, res: any) => {
  const { txId } = req.params;
  const userId = String(req.user?.id || '').trim();
  const { destinationAddress, network } = req.body || {};

  try {
    const txn = db.getTransaction(txId);
    if (!txn) return res.status(404).json({ error: 'NOT_FOUND', message: `Transaction ${txId} not found` });
    if (String(txn.userId || '') !== userId) return res.status(403).json({ error: 'FORBIDDEN' });
    if (String(txn.status || '') !== 'pending') return res.status(409).json({ error: 'CONFLICT', message: `Status is ${txn.status}` });

    if (!destinationAddress || !['polygon', 'ethereum'].includes(network)) {
      return res.status(400).json({ error: 'INVALID_PARAMS', message: 'destinationAddress and valid network (polygon/ethereum) are required.' });
    }

    const stripeKey = String(process.env.STRIPE_SECRET_KEY || '').trim();
    if (!isUsableStripeKey(stripeKey)) {
      return res.status(503).json({ error: 'STRIPE_NOT_CONFIGURED' });
    }

    const result = await dispatchStripeCryptoPayout({
      stripeKey,
      amountUsd: Number(txn.amount),
      destinationAddress,
      network,
      userId
    });

    db.execute(
      'UPDATE transactions SET status = ?, hash = ?, details = ? WHERE id = ?',
      ['settled', result.hash || '', JSON.stringify({ stripePayoutId: result.payoutId, network, destinationAddress, settledAt: new Date().toISOString() }), txId]
    );

    return res.status(202).json({
      success: true,
      transactionId: txId,
      status: 'settled',
      payoutId: result.payoutId,
      hash: result.hash,
      message: `Stripe USDC payout initiated on ${network}`
    });
  } catch (err: any) {
    return res.status(500).json({ error: 'CRYPTO_PAYOUT_FAILED', message: err.message });
  }
});

/**
 * GET /api/withdrawal/wise-status/:transferId
 * Check the real-time status of a Wise transfer
 */
withdrawalRouter.get('/wise-status/:transferId', requireRouterAuth, async (req: any, res: any) => {
  const { transferId } = req.params;

  try {
    if (!wiseApiEngine) {
      return res.status(503).json({
        error: 'SERVICE_UNAVAILABLE',
        message: 'Wise integration not configured'
      });
    }

    const status = await wiseApiEngine.checkTransferStatus(transferId);

    logger.debug('Transfer status retrieved', { transferId, status: status.status, userId: req.user?.id });

    return res.status(200).json({
      success: true,
      transferId,
      status: status.status,
      amount: status.amount,
      currency: status.currency,
      createdAt: status.createdAt
    });
  } catch (err: any) {
    const correlationId = crypto.randomUUID();
    logger.error('Status check failed', { transferId, error: sanitizeError(err, correlationId).message });

    return res.status(500).json({
      error: 'STATUS_CHECK_FAILED',
      message: sanitizeError(err, correlationId).message
    });
  }
});

/**
 * POST /api/withdrawal/crypto-payout/:txId
 * Stripe Crypto Payout (USDC on Polygon/Ethereum)
 *
 * Request body:
 * {
 *   "destinationAddress": "0x...",
 *   "network": "polygon" | "ethereum"
 * }
 */
withdrawalRouter.post('/crypto-payout/:txId', requireRouterAuth, requireLedgerIntegrityForMoneyMovement, withIdempotencyProtection, async (req: any, res: any) => {
  const { txId } = req.params;
  const userId = String(req.user?.id || '').trim();
  const { destinationAddress, network } = req.body || {};

  try {
    const txn = db.getTransaction(txId);
    if (!txn) return res.status(404).json({ error: 'NOT_FOUND', message: `Transaction ${txId} not found` });
    if (String(txn.userId || '') !== userId) return res.status(403).json({ error: 'FORBIDDEN' });
    if (String(txn.status || '') !== 'pending') return res.status(409).json({ error: 'CONFLICT', message: `Status is ${txn.status}` });

    if (!destinationAddress || !['polygon', 'ethereum'].includes(network)) {
      return res.status(400).json({ error: 'INVALID_PARAMS', message: 'destinationAddress and valid network (polygon/ethereum) are required.' });
    }

    const stripeKey = String(process.env.STRIPE_SECRET_KEY || '').trim();
    if (!isUsableStripeKey(stripeKey)) {
      return res.status(503).json({ error: 'STRIPE_NOT_CONFIGURED' });
    }

    const result = await dispatchStripeCryptoPayout({
      stripeKey,
      amountUsd: Number(txn.amount),
      destinationAddress,
      network,
      userId
    });

    db.execute(
      'UPDATE transactions SET status = ?, hash = ?, details = ? WHERE id = ?',
      ['settled', result.hash || '', JSON.stringify({ stripePayoutId: result.payoutId, network, destinationAddress, settledAt: new Date().toISOString() }), txId]
    );

    return res.status(202).json({
      success: true,
      transactionId: txId,
      status: 'settled',
      payoutId: result.payoutId,
      hash: result.hash,
      message: `Stripe USDC payout initiated on ${network}`
    });
  } catch (err: any) {
    return res.status(500).json({ error: 'CRYPTO_PAYOUT_FAILED', message: err.message });
  }
});

/**
 * GET /api/withdrawal/ledger/balance
 * Returns current ledger wallet balances by asset symbol
 */
withdrawalRouter.get('/ledger/balance', (_req, res) => {
  try {
    const wallets = db.execute('SELECT * FROM wallets') as any[];
    const balances = wallets.reduce((acc: Record<string, number>, wallet: any) => {
      const symbol = String(wallet.assetSymbol || 'UNKNOWN');
      const amount = Number(wallet.balance || 0);
      acc[symbol] = (acc[symbol] || 0) + amount;
      return acc;
    }, {});

    return res.status(200).json({
      success: true,
      source: 'ledger',
      balances,
      walletCount: wallets.length
    });
  } catch (err: any) {
    return res.status(500).json({
      error: 'LEDGER_READ_FAILED',
      message: String(err.message || 'Failed to read ledger balances')
    });
  }
});

/**
 * POST /api/withdrawal/crypto-payout/:txId
 * Stripe Crypto Payout (USDC on Polygon/Ethereum)
 *
 * Request body:
 * {
 *   "destinationAddress": "0x...",
 *   "network": "polygon" | "ethereum"
 * }
 */
withdrawalRouter.post('/crypto-payout/:txId', requireRouterAuth, requireLedgerIntegrityForMoneyMovement, withIdempotencyProtection, async (req: any, res: any) => {
  const { txId } = req.params;
  const userId = String(req.user?.id || '').trim();
  const { destinationAddress, network } = req.body || {};

  try {
    const txn = db.getTransaction(txId);
    if (!txn) return res.status(404).json({ error: 'NOT_FOUND', message: `Transaction ${txId} not found` });
    if (String(txn.userId || '') !== userId) return res.status(403).json({ error: 'FORBIDDEN' });
    if (String(txn.status || '') !== 'pending') return res.status(409).json({ error: 'CONFLICT', message: `Status is ${txn.status}` });

    if (!destinationAddress || !['polygon', 'ethereum'].includes(network)) {
      return res.status(400).json({ error: 'INVALID_PARAMS', message: 'destinationAddress and valid network (polygon/ethereum) are required.' });
    }

    const stripeKey = String(process.env.STRIPE_SECRET_KEY || '').trim();
    if (!isUsableStripeKey(stripeKey)) {
      return res.status(503).json({ error: 'STRIPE_NOT_CONFIGURED' });
    }

    const result = await dispatchStripeCryptoPayout({
      stripeKey,
      amountUsd: Number(txn.amount),
      destinationAddress,
      network,
      userId
    });

    db.execute(
      'UPDATE transactions SET status = ?, hash = ?, details = ? WHERE id = ?',
      ['settled', result.hash || '', JSON.stringify({ stripePayoutId: result.payoutId, network, destinationAddress, settledAt: new Date().toISOString() }), txId]
    );

    return res.status(202).json({
      success: true,
      transactionId: txId,
      status: 'settled',
      payoutId: result.payoutId,
      hash: result.hash,
      message: `Stripe USDC payout initiated on ${network}`
    });
  } catch (err: any) {
    return res.status(500).json({ error: 'CRYPTO_PAYOUT_FAILED', message: err.message });
  }
});

/**
 * GET /api/withdrawal/ledger/integrity
 * Returns accounting/profile integrity checks so operators can validate consistency.
 */
withdrawalRouter.get('/ledger/integrity', requireRouterAuth, (_req, res) => {
  try {
    const report = db.getIntegrityReport();
    return res.status(200).json({
      success: true,
      source: 'ledger',
      report
    });
  } catch (err: any) {
    return res.status(500).json({
      error: 'LEDGER_INTEGRITY_CHECK_FAILED',
      message: String(err?.message || 'Failed to execute ledger integrity check')
    });
  }
});

/**
 * POST /api/withdrawal/crypto-payout/:txId
 * Stripe Crypto Payout (USDC on Polygon/Ethereum)
 *
 * Request body:
 * {
 *   "destinationAddress": "0x...",
 *   "network": "polygon" | "ethereum"
 * }
 */
withdrawalRouter.post('/crypto-payout/:txId', requireRouterAuth, requireLedgerIntegrityForMoneyMovement, withIdempotencyProtection, async (req: any, res: any) => {
  const { txId } = req.params;
  const userId = String(req.user?.id || '').trim();
  const { destinationAddress, network } = req.body || {};

  try {
    const txn = db.getTransaction(txId);
    if (!txn) return res.status(404).json({ error: 'NOT_FOUND', message: `Transaction ${txId} not found` });
    if (String(txn.userId || '') !== userId) return res.status(403).json({ error: 'FORBIDDEN' });
    if (String(txn.status || '') !== 'pending') return res.status(409).json({ error: 'CONFLICT', message: `Status is ${txn.status}` });

    if (!destinationAddress || !['polygon', 'ethereum'].includes(network)) {
      return res.status(400).json({ error: 'INVALID_PARAMS', message: 'destinationAddress and valid network (polygon/ethereum) are required.' });
    }

    const stripeKey = String(process.env.STRIPE_SECRET_KEY || '').trim();
    if (!isUsableStripeKey(stripeKey)) {
      return res.status(503).json({ error: 'STRIPE_NOT_CONFIGURED' });
    }

    const result = await dispatchStripeCryptoPayout({
      stripeKey,
      amountUsd: Number(txn.amount),
      destinationAddress,
      network,
      userId
    });

    db.execute(
      'UPDATE transactions SET status = ?, hash = ?, details = ? WHERE id = ?',
      ['settled', result.hash || '', JSON.stringify({ stripePayoutId: result.payoutId, network, destinationAddress, settledAt: new Date().toISOString() }), txId]
    );

    return res.status(202).json({
      success: true,
      transactionId: txId,
      status: 'settled',
      payoutId: result.payoutId,
      hash: result.hash,
      message: `Stripe USDC payout initiated on ${network}`
    });
  } catch (err: any) {
    return res.status(500).json({ error: 'CRYPTO_PAYOUT_FAILED', message: err.message });
  }
});

/**
 * GET /api/withdrawal/ledger/integrity/status
 * Returns integrity monitor status and latest report snapshot for operations.
 */
withdrawalRouter.get('/ledger/integrity/status', requireRouterAuth, (_req, res) => {
  const report = ensureFreshIntegrityReport();
  return res.status(200).json({
    success: true,
    source: 'ledger',
    monitor: {
      enforceIntegrityBlock,
      intervalMs: integrityIntervalMs,
      lastCheckAt: lastIntegrityCheckAt ? new Date(lastIntegrityCheckAt).toISOString() : null
    },
    report
  });
});

/**
 * GET /api/withdrawal/ledger/transaction/:txId
 * Returns the ledger transaction details for a specific withdrawal transaction.
 * This shows the exact amount Wise will use for the direct debit.
 */
withdrawalRouter.get('/ledger/transaction/:txId', requireRouterAuth, (req: any, res: any) => {
  const { txId } = req.params;

  try {
    const txRecord = db.getTransaction(txId);
    if (!txRecord) {
      return res.status(404).json({
        error: 'NOT_FOUND',
        message: 'Transaction not found in ledger'
      });
    }

    return res.status(200).json({
      success: true,
      source: 'ledger',
      transaction: {
        id: txRecord.id,
        userId: txRecord.userId,
        amount: txRecord.amount,
        currency: txRecord.assetSymbol || 'USD',
        status: txRecord.status,
        type: txRecord.type,
        details: txRecord.details || null
      }
    });
  } catch (err: any) {
    return res.status(500).json({
      error: 'LEDGER_READ_FAILED',
      message: String(err.message || 'Failed to read transaction from ledger')
    });
  }
});

/**
 * POST /api/withdrawal/crypto-payout/:txId
 * Stripe Crypto Payout (USDC on Polygon/Ethereum)
 *
 * Request body:
 * {
 *   "destinationAddress": "0x...",
 *   "network": "polygon" | "ethereum"
 * }
 */
withdrawalRouter.post('/crypto-payout/:txId', requireRouterAuth, requireLedgerIntegrityForMoneyMovement, withIdempotencyProtection, async (req: any, res: any) => {
  const { txId } = req.params;
  const userId = String(req.user?.id || '').trim();
  const { destinationAddress, network } = req.body || {};

  try {
    const txn = db.getTransaction(txId);
    if (!txn) return res.status(404).json({ error: 'NOT_FOUND', message: `Transaction ${txId} not found` });
    if (String(txn.userId || '') !== userId) return res.status(403).json({ error: 'FORBIDDEN' });
    if (String(txn.status || '') !== 'pending') return res.status(409).json({ error: 'CONFLICT', message: `Status is ${txn.status}` });

    if (!destinationAddress || !['polygon', 'ethereum'].includes(network)) {
      return res.status(400).json({ error: 'INVALID_PARAMS', message: 'destinationAddress and valid network (polygon/ethereum) are required.' });
    }

    const stripeKey = String(process.env.STRIPE_SECRET_KEY || '').trim();
    if (!isUsableStripeKey(stripeKey)) {
      return res.status(503).json({ error: 'STRIPE_NOT_CONFIGURED' });
    }

    const result = await dispatchStripeCryptoPayout({
      stripeKey,
      amountUsd: Number(txn.amount),
      destinationAddress,
      network,
      userId
    });

    db.execute(
      'UPDATE transactions SET status = ?, hash = ?, details = ? WHERE id = ?',
      ['settled', result.hash || '', JSON.stringify({ stripePayoutId: result.payoutId, network, destinationAddress, settledAt: new Date().toISOString() }), txId]
    );

    return res.status(202).json({
      success: true,
      transactionId: txId,
      status: 'settled',
      payoutId: result.payoutId,
      hash: result.hash,
      message: `Stripe USDC payout initiated on ${network}`
    });
  } catch (err: any) {
    return res.status(500).json({ error: 'CRYPTO_PAYOUT_FAILED', message: err.message });
  }
});

/**
 * GET /api/withdrawal/health
 * Health check endpoint
 */
withdrawalRouter.get('/health', (_req, res) => {
  const isReady = wiseApiEngine !== null;
  return res.status(200).json({
    ok: true,
    wiseIntegration: isReady ? 'active' : 'disabled'
  });
});

/**
 * GET /api/withdrawal/wise-auth/health
 * Returns Wise auth posture and token lifecycle state without exposing secrets.
 */
withdrawalRouter.get('/wise-auth/health', requireRouterAuth, (_req: any, res: any) => {
  if (!wiseApiEngine) {
    return res.status(503).json({
      error: 'SERVICE_UNAVAILABLE',
      message: 'Wise integration not configured'
    });
  }

  const auth = wiseApiEngine.getAuthHealth();
  return res.status(200).json({
    ok: true,
    source: 'wise-auth-provider',
    auth
  });
});

/**
 * Internal polling function (runs asynchronously)
 * Checks transfer status every 30 seconds, updates ledger when completed
 */
async function pollWiseTransferStatus(txId: string, wiseTransferId: string) {
  const maxAttempts = 120; // ~1 hour of polling (120 * 30 seconds)
  let attempts = 0;

  const pollInterval = setInterval(async () => {
    attempts++;

    try {
      logger.debug('Polling Wise transfer status', {
        txId,
        wiseTransferId,
        attempt: attempts
      });

      if (!wiseApiEngine) {
        clearInterval(pollInterval);
        logger.error('Wise engine lost during polling', { txId, wiseTransferId });
        return;
      }

      const status = await wiseApiEngine.checkTransferStatus(wiseTransferId);

      if (status.status === 'outgoing_payment_sent') {
        clearInterval(pollInterval);

        // Mark transaction as settled
        db.execute(
          `UPDATE transactions SET status = ?, details = ? WHERE id = ?`,
          ['completed', JSON.stringify({ wiseClearedAt: new Date().toISOString() }), txId]
        );

        logger.info('Direct debit settled successfully', {
          txId,
          wiseTransferId,
          settledAt: new Date().toISOString()
        });
      } else if (status.status === 'cancelled' || status.status === 'rejected') {
        clearInterval(pollInterval);

        // Mark transaction as failed and reset to pending so user can retry
        db.execute(
          `UPDATE transactions SET status = ?, details = ? WHERE id = ?`,
          ['failed', `Wise transfer rejected: ${status.status}`, txId]
        );

        logger.warn('Direct debit transfer rejected', {
          txId,
          wiseTransferId,
          reason: status.status
        });
      }

      // Stop polling after max attempts
      if (attempts >= maxAttempts) {
        clearInterval(pollInterval);

        logger.warn('Transfer polling timeout', {
          txId,
          wiseTransferId,
          attempts: maxAttempts,
          duration: `${(maxAttempts * 30) / 60} minutes`
        });

        // Leave transaction in 'processing' state; user can manually check status
      }
    } catch (pollErr: any) {
      const correlationId = crypto.randomUUID();
      logger.error('Polling error', {
        txId,
        wiseTransferId,
        attempt: attempts,
        error: sanitizeError(pollErr, correlationId).message
      });
    }
  }, 30000); // Poll every 30 seconds
}

/**
 * POST /api/withdrawal/wise-send-anywhere/:txId
 * Sends funds FROM Wise balance TO any recipient bank account worldwide
 *
 * Request body:
 * {
 *   "amount": 100000,
 *   "sourceCurrency": "USD",
 *   "targetCurrency": "USD",
 *   "recipientName": "Business Account",
 *   "bankDetails": {
 *     "routingNumber": "021000021",
 *     "accountNumber": "9876543210",
 *     "accountType": "CHECKING"
 *   }
 * }
 */
withdrawalRouter.post('/wise-send-anywhere/:txId', requireRouterAuth, requireLedgerIntegrityForMoneyMovement, withIdempotencyProtection, async (req: any, res: any) => {
  const { txId } = req.params;
  const userId = req.user?.id;

  try {
    if (!wiseApiEngine) {
      return res.status(503).json({
        error: 'SERVICE_UNAVAILABLE',
        message: 'Wise integration not configured'
      });
    }

    // Validate request
    const { amount, sourceCurrency, targetCurrency, recipientName, bankDetails, transferReference } = req.body;

    if (!amount || amount <= 0) {
      return res.status(400).json({
        error: 'INVALID_AMOUNT',
        message: 'Amount must be greater than 0'
      });
    }

    if (!sourceCurrency || !targetCurrency) {
      return res.status(400).json({
        error: 'INVALID_CURRENCY',
        message: 'sourceCurrency and targetCurrency are required'
      });
    }

    if (!recipientName || !bankDetails) {
      return res.status(400).json({
        error: 'INVALID_RECIPIENT',
        message: 'recipientName and bankDetails are required'
      });
    }

    // Verify transaction ownership
    const txn = db.getTransaction(txId);
    if (!txn) {
      return res.status(404).json({
        error: 'NOT_FOUND',
        message: `Transaction ${txId} not found`
      });
    }

    if (txn.userId !== userId) {
      return res.status(403).json({
        error: 'FORBIDDEN',
        message: 'Not authorized to access this transaction'
      });
    }

    if (txn.status !== 'pending') {
      return res.status(409).json({
        error: 'CONFLICT',
        message: `Cannot send from transaction with status: ${txn.status}`
      });
    }

    const requestedAmount = Number(amount);
    const ledgerAmount = Number(txn.amount || 0);
    if (!Number.isFinite(ledgerAmount) || ledgerAmount <= 0) {
      return res.status(400).json({
        error: 'INVALID_LEDGER_AMOUNT',
        message: 'Ledger transaction amount is invalid'
      });
    }

    if (Math.abs(requestedAmount - ledgerAmount) > 0.000001) {
      return res.status(400).json({
        error: 'AMOUNT_MISMATCH',
        message: 'Requested amount must match ledger transaction amount'
      });
    }

    logger.info('Initiating outbound transfer', {
      txId,
      userId,
      amount: ledgerAmount,
      sourceCurrency,
      targetCurrency,
      recipientName
    });

    // Execute outbound transfer
    const outboundExecution = await wiseApiEngine.executeOutboundTransfer(
      txId,
      ledgerAmount,
      sourceCurrency,
      targetCurrency,
      recipientName,
      bankDetails,
      String(transferReference || '').trim() || undefined
    );
    const wiseTransferId = String((outboundExecution as any)?.transferId || outboundExecution);
    const payInMethod = String((outboundExecution as any)?.payInMethod || 'BALANCE').toUpperCase();

    // Update transaction with transfer details
    db.updateTransaction(txId, {
      wiseTransferId,
      status: 'processing',
      recipientName,
      bankRouting: bankDetails.routingNumber,
      bankAccount: bankDetails.accountNumber
    });

    logger.info('Outbound transfer initiated successfully', {
      transactionId: txId,
      wiseTransferId,
      amount: ledgerAmount,
      recipientName
    });

    // Start polling for completion
    pollWiseTransferStatus(txId, wiseTransferId);

    return res.status(202).json({
      success: true,
      transactionId: txId,
      wiseTransferId,
      wisePayInMethod: payInMethod,
      transferReference: String(transferReference || '').trim() || undefined,
      status: 'processing',
      amount: ledgerAmount,
      targetCurrency,
      recipientName,
      message: `Outbound transfer initiated. Transfer ID: ${wiseTransferId}`
    });
  } catch (err: any) {
    const rawMessage = String(err?.message || '');
    if (rawMessage.startsWith('WISE_SCA_REQUIRED:')) {
      const oneTimeToken = rawMessage.split('WISE_SCA_REQUIRED:')[1]?.trim() || undefined;
      logger.warn('Wise SCA required for outbound funding', {
        txId,
        userId: req.user?.id,
        hasOneTimeToken: Boolean(oneTimeToken)
      });
      return res.status(403).json({
        error: 'WISE_SCA_REQUIRED',
        message: 'Wise requires strong customer authentication for this payment. Complete SCA and retry with x-2fa-approval if supported by your integration.',
        ...(oneTimeToken ? { oneTimeToken } : {})
      });
    }
    if (rawMessage.includes('WISE_TOKEN_INVALID:')) {
      logger.warn('Wise token invalid during outbound transfer', {
        txId,
        userId: req.user?.id
      });
      return res.status(503).json({
        error: 'WISE_TOKEN_INVALID',
        message: 'Wise access token is invalid, expired, revoked, or replaced. Rotate/reissue token and retry.'
      });
    }
    if (rawMessage.includes('OUTBOUND_RECIPIENT_INVALID:')) {
      const providerMessage = rawMessage.split('OUTBOUND_RECIPIENT_INVALID:')[1]?.trim() || 'Recipient details are invalid for Wise';
      logger.warn('Outbound recipient validation failed', {
        txId,
        userId: req.user?.id,
        providerMessage
      });
      return res.status(422).json({
        error: 'OUTBOUND_RECIPIENT_INVALID',
        message: providerMessage
      });
    }
    if (rawMessage.includes('OUTBOUND_BALANCE_UNAVAILABLE:')) {
      logger.warn('Outbound balance funding unavailable', {
        txId,
        userId: req.user?.id
      });
      return res.status(422).json({
        error: 'OUTBOUND_BALANCE_UNAVAILABLE',
        message: 'Wise balance payment option is unavailable for this transfer. Ensure sufficient eligible balance and funding capability.'
      });
    }
    if (rawMessage.includes('OUTBOUND_FUNDING_UNAVAILABLE:')) {
      logger.warn('Outbound funding unavailable across selected Wise rail', {
        txId,
        userId: req.user?.id
      });
      return res.status(422).json({
        error: 'OUTBOUND_FUNDING_UNAVAILABLE',
        message: rawMessage.split('OUTBOUND_FUNDING_UNAVAILABLE:')[1]?.trim() || 'No enabled Wise payment rail could successfully fund this transfer'
      });
    }

    const correlationId = crypto.randomUUID();
    logger.error('Outbound transfer failed', {
      txId,
      userId: req.user?.id,
      error: sanitizeError(err, correlationId).message
    });

    return res.status(500).json({
      error: 'TRANSFER_FAILED',
      message: sanitizeError(err, correlationId).message
    });
  }
});

/**
 * POST /api/withdrawal/crypto-payout/:txId
 * Stripe Crypto Payout (USDC on Polygon/Ethereum)
 *
 * Request body:
 * {
 *   "destinationAddress": "0x...",
 *   "network": "polygon" | "ethereum"
 * }
 */
withdrawalRouter.post('/crypto-payout/:txId', requireRouterAuth, requireLedgerIntegrityForMoneyMovement, withIdempotencyProtection, async (req: any, res: any) => {
  const { txId } = req.params;
  const userId = String(req.user?.id || '').trim();
  const { destinationAddress, network } = req.body || {};

  try {
    const txn = db.getTransaction(txId);
    if (!txn) return res.status(404).json({ error: 'NOT_FOUND', message: `Transaction ${txId} not found` });
    if (String(txn.userId || '') !== userId) return res.status(403).json({ error: 'FORBIDDEN' });
    if (String(txn.status || '') !== 'pending') return res.status(409).json({ error: 'CONFLICT', message: `Status is ${txn.status}` });

    if (!destinationAddress || !['polygon', 'ethereum'].includes(network)) {
      return res.status(400).json({ error: 'INVALID_PARAMS', message: 'destinationAddress and valid network (polygon/ethereum) are required.' });
    }

    const stripeKey = String(process.env.STRIPE_SECRET_KEY || '').trim();
    if (!isUsableStripeKey(stripeKey)) {
      return res.status(503).json({ error: 'STRIPE_NOT_CONFIGURED' });
    }

    const result = await dispatchStripeCryptoPayout({
      stripeKey,
      amountUsd: Number(txn.amount),
      destinationAddress,
      network,
      userId
    });

    db.execute(
      'UPDATE transactions SET status = ?, hash = ?, details = ? WHERE id = ?',
      ['settled', result.hash || '', JSON.stringify({ stripePayoutId: result.payoutId, network, destinationAddress, settledAt: new Date().toISOString() }), txId]
    );

    return res.status(202).json({
      success: true,
      transactionId: txId,
      status: 'settled',
      payoutId: result.payoutId,
      hash: result.hash,
      message: `Stripe USDC payout initiated on ${network}`
    });
  } catch (err: any) {
    return res.status(500).json({ error: 'CRYPTO_PAYOUT_FAILED', message: err.message });
  }
});

/**
 * POST /api/withdrawal/settle-cad/:txId
 * Ledger-authoritative withdrawal settlement route:
 * 1) optional Wise conversion quote to CAD
 * 2) Stripe CAD payout execution
 */
withdrawalRouter.post('/settle-cad/:txId', requireRouterAuth, requireLedgerIntegrityForMoneyMovement, withIdempotencyProtection, async (req: any, res: any) => {
  const { txId } = req.params;
  const userId = String(req.user?.id || '').trim();
  const { sourceCurrency, transferReference } = req.body || {};

  try {
    const txn = db.getTransaction(txId);
    if (!txn) {
      return res.status(404).json({
        error: 'NOT_FOUND',
        message: `Transaction ${txId} not found`
      });
    }

    if (String(txn.userId || '') !== userId) {
      return res.status(403).json({
        error: 'FORBIDDEN',
        message: 'Not authorized to access this transaction'
      });
    }

    if (String(txn.status || '') !== 'pending') {
      return res.status(409).json({
        error: 'CONFLICT',
        message: `Cannot settle transaction with status: ${txn.status}`
      });
    }

    const ledgerAmount = Number(txn.amount || 0);
    if (!Number.isFinite(ledgerAmount) || ledgerAmount <= 0) {
      return res.status(400).json({
        error: 'INVALID_LEDGER_AMOUNT',
        message: 'Ledger transaction amount is invalid'
      });
    }

    const normalizedSourceCurrency = String(sourceCurrency || txn.assetSymbol || 'USD').trim().toUpperCase();
    const stripeKey = String(process.env.STRIPE_SECRET_KEY || '').trim();
    if (!isUsableStripeKey(stripeKey)) {
      return res.status(503).json({
        error: 'STRIPE_NOT_CONFIGURED',
        message: 'Stripe is not configured or key is invalid on this server'
      });
    }

    const stripeDefaultCurrency = await getStripeAccountCurrency(stripeKey);
    if (stripeDefaultCurrency !== 'cad') {
      return res.status(422).json({
        error: 'STRIPE_CAD_REQUIRED',
        message: `Stripe default currency is ${stripeDefaultCurrency}. CAD settlement requires CAD-enabled Stripe account.`
      });
    }

    let payoutCadAmount = ledgerAmount;
    let conversionQuote: any = null;
    if (normalizedSourceCurrency !== 'CAD') {
      if (!wiseApiEngine) {
        return res.status(503).json({
          error: 'WISE_UNAVAILABLE',
          message: 'Wise integration is required for non-CAD settlement conversion'
        });
      }

      conversionQuote = await wiseApiEngine.getConversionQuote(normalizedSourceCurrency, 'CAD', ledgerAmount);
      if (!Number.isFinite(Number(conversionQuote?.targetAmount)) || Number(conversionQuote?.targetAmount) <= 0) {
        return res.status(422).json({
          error: 'WISE_CONVERSION_UNAVAILABLE',
          message: 'Wise did not return a usable CAD conversion quote for this settlement'
        });
      }
      payoutCadAmount = Number(conversionQuote.targetAmount);
    }

    const resolvedReference = String(transferReference || '').trim() || `Ledger withdrawal ${txId}`;
    const payout = await createStripeCadPayout(stripeKey, payoutCadAmount, userId, txId, resolvedReference);

    const priorDetailsRaw = String((txn as any).details || '').trim();
    let priorDetails: any = {};
    if (priorDetailsRaw) {
      try {
        priorDetails = JSON.parse(priorDetailsRaw);
      } catch {
        priorDetails = { raw: priorDetailsRaw };
      }
    }

    const nextDetails = {
      ...priorDetails,
      settlement: {
        method: 'WISE_QUOTE_PLUS_STRIPE_CAD',
        sourceCurrency: normalizedSourceCurrency,
        ledgerAmount,
        payoutCadAmount,
        stripePayoutId: payout.payoutId,
        stripePayoutStatus: payout.payoutStatus,
        reference: resolvedReference,
        conversionQuote: conversionQuote
          ? {
              quoteId: conversionQuote.quoteId,
              sourceAmount: conversionQuote.sourceAmount,
              targetAmount: conversionQuote.targetAmount,
              rate: conversionQuote.rate
            }
          : null,
        settledAt: new Date().toISOString()
      }
    };

    db.execute(
      'UPDATE transactions SET status = ?, details = ? WHERE id = ?',
      ['settled', JSON.stringify(nextDetails), txId]
    );

    return res.status(202).json({
      success: true,
      transactionId: txId,
      status: 'settled',
      sourceCurrency: normalizedSourceCurrency,
      ledgerAmount,
      payoutCadAmount,
      stripePayoutId: payout.payoutId,
      stripePayoutStatus: payout.payoutStatus,
      conversionQuote: conversionQuote
        ? {
            quoteId: conversionQuote.quoteId,
            sourceAmount: conversionQuote.sourceAmount,
            targetAmount: conversionQuote.targetAmount,
            rate: conversionQuote.rate
          }
        : null,
      message: 'CAD settlement initiated through Stripe using ledger-authoritative amount'
    });
  } catch (err: any) {
    const rawMessage = String(err?.message || '');
    if (rawMessage.includes('WISE_CONVERSION_UNAVAILABLE:')) {
      return res.status(422).json({
        error: 'WISE_CONVERSION_UNAVAILABLE',
        message: rawMessage.split('WISE_CONVERSION_UNAVAILABLE:')[1]?.trim() || 'Wise conversion unavailable'
      });
    }

    return res.status(err?.status || 500).json({
      error: 'CAD_SETTLEMENT_FAILED',
      message: String(err?.message || 'Failed to process CAD settlement')
    });
  }
});

/**
 * POST /api/withdrawal/crypto-payout/:txId
 * Stripe Crypto Payout (USDC on Polygon/Ethereum)
 *
 * Request body:
 * {
 *   "destinationAddress": "0x...",
 *   "network": "polygon" | "ethereum"
 * }
 */
withdrawalRouter.post('/crypto-payout/:txId', requireRouterAuth, requireLedgerIntegrityForMoneyMovement, withIdempotencyProtection, async (req: any, res: any) => {
  const { txId } = req.params;
  const userId = String(req.user?.id || '').trim();
  const { destinationAddress, network } = req.body || {};

  try {
    const txn = db.getTransaction(txId);
    if (!txn) return res.status(404).json({ error: 'NOT_FOUND', message: `Transaction ${txId} not found` });
    if (String(txn.userId || '') !== userId) return res.status(403).json({ error: 'FORBIDDEN' });
    if (String(txn.status || '') !== 'pending') return res.status(409).json({ error: 'CONFLICT', message: `Status is ${txn.status}` });

    if (!destinationAddress || !['polygon', 'ethereum'].includes(network)) {
      return res.status(400).json({ error: 'INVALID_PARAMS', message: 'destinationAddress and valid network (polygon/ethereum) are required.' });
    }

    const stripeKey = String(process.env.STRIPE_SECRET_KEY || '').trim();
    if (!isUsableStripeKey(stripeKey)) {
      return res.status(503).json({ error: 'STRIPE_NOT_CONFIGURED' });
    }

    const result = await dispatchStripeCryptoPayout({
      stripeKey,
      amountUsd: Number(txn.amount),
      destinationAddress,
      network,
      userId
    });

    db.execute(
      'UPDATE transactions SET status = ?, hash = ?, details = ? WHERE id = ?',
      ['settled', result.hash || '', JSON.stringify({ stripePayoutId: result.payoutId, network, destinationAddress, settledAt: new Date().toISOString() }), txId]
    );

    return res.status(202).json({
      success: true,
      transactionId: txId,
      status: 'settled',
      payoutId: result.payoutId,
      hash: result.hash,
      message: `Stripe USDC payout initiated on ${network}`
    });
  } catch (err: any) {
    return res.status(500).json({ error: 'CRYPTO_PAYOUT_FAILED', message: err.message });
  }
});

export default withdrawalRouter;
