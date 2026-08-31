import crypto from 'crypto';

export interface SessionClaims {
  sub: string;
  email: string;
  name?: string;
  sid: string;
  mfa: boolean;
  iat: number;
  exp: number;
}

function base64UrlEncode(input: string | Buffer): string {
  const buffer = Buffer.isBuffer(input) ? input : Buffer.from(input, 'utf8');
  return buffer
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

function base64UrlDecode(input: string): Buffer {
  let normalized = input.replace(/-/g, '+').replace(/_/g, '/');
  while (normalized.length % 4) normalized += '=';
  return Buffer.from(normalized, 'base64');
}

export function signSessionToken(claims: Omit<SessionClaims, 'iat' | 'exp'>, secret: string, ttlSeconds = 900): string {
  const now = Math.floor(Date.now() / 1000);
  const payload: SessionClaims = {
    ...claims,
    iat: now,
    exp: now + ttlSeconds
  };

  const header = { alg: 'HS256', typ: 'JWT' };
  const encodedHeader = base64UrlEncode(JSON.stringify(header));
  const encodedPayload = base64UrlEncode(JSON.stringify(payload));
  const signature = crypto
    .createHmac('sha256', secret)
    .update(`${encodedHeader}.${encodedPayload}`)
    .digest();

  return `${encodedHeader}.${encodedPayload}.${base64UrlEncode(signature)}`;
}

export function verifySessionToken(token: string, secret: string): SessionClaims | null {
  try {
    const [headerPart, payloadPart, signaturePart] = token.split('.');
    if (!headerPart || !payloadPart || !signaturePart) return null;

    const expectedSignature = crypto
      .createHmac('sha256', secret)
      .update(`${headerPart}.${payloadPart}`)
      .digest();
    const actualSignature = base64UrlDecode(signaturePart);

    if (expectedSignature.length !== actualSignature.length) return null;
    if (!crypto.timingSafeEqual(expectedSignature, actualSignature)) return null;

    const payload = JSON.parse(base64UrlDecode(payloadPart).toString('utf8')) as SessionClaims;
    const now = Math.floor(Date.now() / 1000);
    if (!payload.exp || now > payload.exp) return null;
    if (!payload.sid || !payload.sub) return null;

    return payload;
  } catch {
    return null;
  }
}

export function generateSessionId(): string {
  return `sess_${crypto.randomUUID()}`;
}

export function verifyPassword(password: string, salt: string, expectedHashHex: string): boolean {
  const normalizedHash = String(expectedHashHex || '').trim();
  if (!/^[0-9a-f]+$/i.test(normalizedHash) || normalizedHash.length % 2 !== 0) {
    return false;
  }

  const candidateIterations = [100000, 10000, 1000];
  const expected = Buffer.from(normalizedHash, 'hex');
  if (expected.length === 0) {
    return false;
  }

  for (const iterations of candidateIterations) {
    const computed = crypto.pbkdf2Sync(password, salt, iterations, 64, 'sha512');
    if (computed.length === expected.length && crypto.timingSafeEqual(computed, expected)) {
      return true;
    }
  }

  return false;
}

function decodeBase32(secret: string): Buffer {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  const normalized = secret.toUpperCase().replace(/=+$/g, '').replace(/\s+/g, '');
  let bits = '';

  for (const char of normalized) {
    const idx = alphabet.indexOf(char);
    if (idx < 0) continue;
    bits += idx.toString(2).padStart(5, '0');
  }

  const bytes: number[] = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) {
    bytes.push(parseInt(bits.slice(i, i + 8), 2));
  }

  return Buffer.from(bytes);
}

function hotp(secretBase32: string, counter: number, digits = 6): string {
  const key = decodeBase32(secretBase32);
  const counterBuffer = Buffer.alloc(8);
  counterBuffer.writeBigUInt64BE(BigInt(counter));

  const hmac = crypto.createHmac('sha1', key).update(counterBuffer).digest();
  const offset = hmac[hmac.length - 1] & 0x0f;
  const code =
    ((hmac[offset] & 0x7f) << 24) |
    ((hmac[offset + 1] & 0xff) << 16) |
    ((hmac[offset + 2] & 0xff) << 8) |
    (hmac[offset + 3] & 0xff);

  const otp = (code % 10 ** digits).toString().padStart(digits, '0');
  return otp;
}

export function verifyTotpCode(secretBase32: string, code: string, windowSteps = 1, stepSeconds = 30): boolean {
  if (!/^\d{6}$/.test(code)) return false;
  const nowCounter = Math.floor(Date.now() / 1000 / stepSeconds);

  for (let offset = -windowSteps; offset <= windowSteps; offset++) {
    if (hotp(secretBase32, nowCounter + offset) === code) {
      return true;
    }
  }

  return false;
}

export function generateTotpCode(secretBase32: string, forTimeMs = Date.now(), stepSeconds = 30): string {
  const counter = Math.floor(forTimeMs / 1000 / stepSeconds);
  return hotp(secretBase32, counter);
}
