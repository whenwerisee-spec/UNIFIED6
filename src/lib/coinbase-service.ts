import crypto from 'crypto';

export interface ParsedCoinbaseCredentials {
  apiKeyId: string;
  privateKeyPem: string;
  isValid: boolean;
  keyType: 'cdp_ec' | 'legacy_hmac' | 'invalid';
  error?: string;
}

export interface CoinbaseRequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  path: string;
  body?: any;
  keyId?: string;
  secretRaw?: string;
  host?: string;
  timeoutMs?: number;
}

export interface CoinbaseResponse<T = any> {
  ok: boolean;
  status: number;
  data?: T;
  error?: string;
  rawText?: string;
}

/**
 * Robust parser for Coinbase Developer Platform (CDP) API keys and legacy HMAC keys.
 * Handles:
 * - Direct JSON exports from CDP portal ({ name: "organizations/...", privateKey: "..." })
 * - Escaped newlines (\n) in environment variables
 * - Headerless PEM or base64 EC keys
 * - Legacy HMAC secrets
 */
export function parseCoinbaseCredentials(customKeyId?: string, customSecret?: string): ParsedCoinbaseCredentials {
  let keyId = String(customKeyId || process.env.COINBASE_API_KEY_ID || process.env.CDP_API_KEY_NAME || '').trim();
  let secret = String(customSecret || process.env.COINBASE_API_SECRET_RAW || process.env.COINBASE_API_SECRET || process.env.CDP_API_KEY_PRIVATE_KEY || '').trim();

  // 1. Detect if keyId or secret is a complete JSON blob exported from Coinbase CDP
  if (keyId.startsWith('{') && keyId.endsWith('}')) {
    try {
      const parsed = JSON.parse(keyId);
      if (parsed.name && parsed.privateKey) {
        secret = parsed.privateKey;
        keyId = parsed.name;
      }
    } catch {}
  }
  if (secret.startsWith('{') && secret.endsWith('}')) {
    try {
      const parsed = JSON.parse(secret);
      if (parsed.name && !keyId) {
        keyId = parsed.name;
      }
      if (parsed.privateKey) {
        secret = parsed.privateKey;
      }
    } catch {}
  }

  // Filter placeholder strings
  const isPlaceholder = (val: string) => !val || val.includes('placeholder') || val.includes('••••');
  if (isPlaceholder(keyId) || isPlaceholder(secret)) {
    return {
      apiKeyId: keyId,
      privateKeyPem: secret,
      isValid: false,
      keyType: 'invalid',
      error: 'Coinbase credentials are not configured or contain placeholder values.'
    };
  }

  // Normalize newlines in private key
  let normalizedSecret = secret.replace(/\\n/g, '\n').trim();

  // Check for PEM header
  const hasPemHeader =
    normalizedSecret.includes('-----BEGIN PRIVATE KEY-----') ||
    normalizedSecret.includes('-----BEGIN EC PRIVATE KEY-----') ||
    normalizedSecret.includes('-----BEGIN RSA PRIVATE KEY-----');

  if (hasPemHeader) {
    try {
      // Validate key readability
      crypto.createPrivateKey(normalizedSecret);
      return {
        apiKeyId: keyId,
        privateKeyPem: normalizedSecret,
        isValid: true,
        keyType: 'cdp_ec'
      };
    } catch (e: any) {
      return {
        apiKeyId: keyId,
        privateKeyPem: normalizedSecret,
        isValid: false,
        keyType: 'invalid',
        error: `Invalid PEM EC private key formatting: ${e.message}`
      };
    }
  }

  // Attempt raw base64 unadorned EC key wrapping
  if (normalizedSecret.length > 80 && !normalizedSecret.includes(' ') && /^[A-Za-z0-9+/=]+$/.test(normalizedSecret)) {
    const wrappedEc = `-----BEGIN EC PRIVATE KEY-----\n${normalizedSecret}\n-----END EC PRIVATE KEY-----`;
    try {
      crypto.createPrivateKey(wrappedEc);
      return {
        apiKeyId: keyId,
        privateKeyPem: wrappedEc,
        isValid: true,
        keyType: 'cdp_ec'
      };
    } catch {
      const wrappedPkcs8 = `-----BEGIN PRIVATE KEY-----\n${normalizedSecret}\n-----END PRIVATE KEY-----`;
      try {
        crypto.createPrivateKey(wrappedPkcs8);
        return {
          apiKeyId: keyId,
          privateKeyPem: wrappedPkcs8,
          isValid: true,
          keyType: 'cdp_ec'
        };
      } catch {}
    }
  }

  // Fallback to legacy HMAC secret
  return {
    apiKeyId: keyId,
    privateKeyPem: normalizedSecret,
    isValid: true,
    keyType: 'legacy_hmac'
  };
}

/**
 * Cryptographic helper to generate Coinbase Advanced Trade API v3 JWTs.
 * Compliant with Coinbase Developer Platform (CDP) API specification:
 * - Header: { alg: 'ES256', kid: keyName, nonce, typ: 'JWT' }
 * - Payload: { iss: 'cdp', nbf, exp, sub: keyName, uri: `${method} ${host}${path}` }
 * - Uses IEEE P1363 (raw 64-byte) signature formatting for ES256 as required by RFC 7518.
 */
export function generateCoinbaseJWT(
  keyId: string,
  secretRaw: string,
  path: string,
  method: string = 'GET',
  host: string = 'api.coinbase.com'
): string {
  const creds = parseCoinbaseCredentials(keyId, secretRaw);
  const cleanKeyId = creds.apiKeyId || keyId;
  const rawPath = path.startsWith('/') ? path : `/${path}`;
  const cleanMethod = (method || 'GET').toUpperCase();
  const uri = `${cleanMethod} ${host}${rawPath}`;

  const alg = creds.keyType === 'legacy_hmac' ? 'HS256' : 'ES256';

  const header = {
    alg,
    kid: cleanKeyId,
    nonce: crypto.randomBytes(16).toString('hex'),
    typ: 'JWT'
  };

  const nowSeconds = Math.floor(Date.now() / 1000);
  const payload = {
    iss: 'cdp',
    nbf: nowSeconds - 5,
    exp: nowSeconds + 120,
    sub: cleanKeyId,
    uri
  };

  const headerB64 = Buffer.from(JSON.stringify(header)).toString('base64url');
  const payloadB64 = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const unsignedToken = `${headerB64}.${payloadB64}`;

  if (creds.keyType === 'cdp_ec') {
    try {
      // Node.js crypto: IEEE P1363 is required for RFC 7518 ES256 JWTs (raw 64 bytes r||s)
      const sign = crypto.createSign('SHA256');
      sign.update(unsignedToken);
      sign.end();
      const signatureB64 = sign.sign({ key: creds.privateKeyPem, dsaEncoding: 'ieee-p1363' }, 'base64url');
      return `${unsignedToken}.${signatureB64}`;
    } catch (err: any) {
      try {
        const sig = crypto.sign('SHA256', Buffer.from(unsignedToken), {
          key: creds.privateKeyPem,
          dsaEncoding: 'ieee-p1363'
        });
        return `${unsignedToken}.${sig.toString('base64url')}`;
      } catch (err2) {
        console.warn('[Coinbase Auth] ES256 signature generation error:', err);
      }
    }
  }

  // Fallback for legacy HMAC secret keys
  const signatureHS256 = crypto
    .createHmac('sha256', creds.privateKeyPem || secretRaw)
    .update(unsignedToken)
    .digest('base64url');
  return `${unsignedToken}.${signatureHS256}`;
}

/**
 * Resilient HTTP client for Coinbase Advanced Trade REST API.
 * Automatically injects valid CDP JWT headers, handles HTTP timeouts, and returns structured responses.
 */
export async function coinbaseRequest<T = any>(options: CoinbaseRequestOptions): Promise<CoinbaseResponse<T>> {
  const method = options.method || 'GET';
  const path = options.path.startsWith('/') ? options.path : `/${options.path}`;
  const host = options.host || 'api.coinbase.com';
  const creds = parseCoinbaseCredentials(options.keyId, options.secretRaw);

  if (!creds.isValid) {
    return {
      ok: false,
      status: 401,
      error: creds.error || 'Coinbase credentials are not configured or invalid.'
    };
  }

  const jwt = generateCoinbaseJWT(creds.apiKeyId, creds.privateKeyPem, path, method, host);
  const url = `https://${host}${path}`;

  const headers: Record<string, string> = {
    Authorization: `Bearer ${jwt}`,
    Accept: 'application/json'
  };

  let bodyStr: string | undefined;
  if (options.body && (method === 'POST' || method === 'PUT')) {
    headers['Content-Type'] = 'application/json';
    bodyStr = typeof options.body === 'string' ? options.body : JSON.stringify(options.body);
  }

  const controller = new AbortController();
  const timeoutMs = options.timeoutMs || 15000;
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      method,
      headers,
      body: bodyStr,
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    const rawText = await response.text();
    let data: any = null;
    try {
      data = JSON.parse(rawText);
    } catch {}

    if (!response.ok) {
      const errorMsg = data?.message || data?.error || rawText || `HTTP ${response.status}`;
      return {
        ok: false,
        status: response.status,
        data,
        error: `Coinbase API error (${response.status}): ${errorMsg}`,
        rawText
      };
    }

    return {
      ok: true,
      status: response.status,
      data: (data ?? rawText) as T,
      rawText
    };
  } catch (err: any) {
    clearTimeout(timeoutId);
    if (err.name === 'AbortError') {
      return {
        ok: false,
        status: 504,
        error: `Coinbase API request timed out after ${timeoutMs}ms.`
      };
    }
    return {
      ok: false,
      status: 502,
      error: `Failed to connect to Coinbase API: ${err?.message || String(err)}`
    };
  }
}

/**
 * Execute real order on Coinbase Advanced Trade v3 (/api/v3/brokerage/orders)
 */
export async function executeCoinbaseOrder(
  side: 'BUY' | 'SELL',
  symbol: string,
  amount: string,
  fiat = 'USD',
  userId: string,
  seed?: string
) {
  if (!userId || !String(userId).trim()) {
    throw new Error('executeCoinbaseOrder requires an authenticated userId.');
  }

  const creds = parseCoinbaseCredentials();
  if (!creds.isValid) {
    throw new Error(`Coinbase API execution unavailable: ${creds.error || 'Invalid credentials'}`);
  }

  const productId = `${symbol.toUpperCase()}-${fiat.toUpperCase()}`;
  const normalizedSeed = String(seed || `${userId}:${side}:${productId}:${amount}`).trim();

  // Deterministic UUIDv4 client order id for idempotent order routing
  const hashVal = crypto.createHash('sha256').update(normalizedSeed).digest('hex');
  const clientOrderId = `${hashVal.substring(0, 8)}-${hashVal.substring(8, 12)}-${hashVal.substring(12, 16)}-${hashVal.substring(16, 20)}-${hashVal.substring(20, 32)}`;

  const body = {
    client_order_id: clientOrderId,
    product_id: productId,
    side,
    order_configuration: {
      market_market_ioc: {
        ...(side === 'BUY' ? { quote_size: amount } : { base_size: amount })
      }
    }
  };

  const path = '/api/v3/brokerage/orders';
  const result = await coinbaseRequest({
    method: 'POST',
    path,
    body,
    keyId: creds.apiKeyId,
    secretRaw: creds.privateKeyPem
  });

  if (!result.ok) {
    throw new Error(`Coinbase order execution failed: ${result.error || result.rawText}`);
  }

  return result.data;
}

/**
 * Diagnostic health check against Coinbase Advanced Trade accounts endpoint
 */
export async function checkCoinbaseHealth(customKeyId?: string, customSecret?: string) {
  const creds = parseCoinbaseCredentials(customKeyId, customSecret);
  if (!creds.isValid) {
    return {
      isConfigured: false,
      isValid: false,
      keyType: creds.keyType,
      error: creds.error,
      accountsCount: 0
    };
  }

  const result = await coinbaseRequest<{ accounts?: any[] }>({
    method: 'GET',
    path: '/api/v3/brokerage/accounts',
    keyId: creds.apiKeyId,
    secretRaw: creds.privateKeyPem
  });

  return {
    isConfigured: true,
    isValid: result.ok,
    status: result.status,
    keyType: creds.keyType,
    accountsCount: result.data?.accounts?.length || 0,
    error: result.ok ? undefined : result.error,
    rawDetails: result.rawText
  };
}
