import {
  parseCoinbaseCredentials,
  generateCoinbaseJWT,
  checkCoinbaseHealth
} from '../src/lib/coinbase-service.js';
import crypto from 'crypto';

console.log('🧪 Starting Coinbase Authentication & Cryptography Test Suite...');

// Generate a real ephemeral EC P-256 key pair for mathematical verification
const { privateKey, publicKey } = crypto.generateKeyPairSync('ec', {
  namedCurve: 'prime256v1',
  publicKeyEncoding: { type: 'spki', format: 'pem' },
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' }
});

// 1. Test CDP JSON Blob parsing
console.log('\n--- Test 1: CDP JSON Export Parser ---');
const cdpJson = JSON.stringify({
  name: 'organizations/org-test-uuid/apiKeys/key-test-uuid',
  privateKey: privateKey.replace(/\n/g, '\\n')
});

const parsedFromJson = parseCoinbaseCredentials(cdpJson);
if (!parsedFromJson.isValid || parsedFromJson.keyType !== 'cdp_ec') {
  throw new Error(`Failed to parse CDP JSON credentials: ${parsedFromJson.error}`);
}
if (parsedFromJson.apiKeyId !== 'organizations/org-test-uuid/apiKeys/key-test-uuid') {
  throw new Error(`Mismatched apiKeyId: ${parsedFromJson.apiKeyId}`);
}
console.log('✅ CDP JSON parsing passed: Org/Key ID and PEM private key extracted seamlessly.');

// 2. Test ES256 JWT Generation and Cryptographic Verification
console.log('\n--- Test 2: ES256 JWT Generation & URI Claim Verification ---');
const testPath = '/api/v3/brokerage/accounts';
const jwt = generateCoinbaseJWT(parsedFromJson.apiKeyId, parsedFromJson.privateKeyPem, testPath, 'GET');

const parts = jwt.split('.');
if (parts.length !== 3) {
  throw new Error(`Generated JWT is invalid, parts count = ${parts.length}`);
}

const header = JSON.parse(Buffer.from(parts[0], 'base64url').toString('utf8'));
const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));

if (header.alg !== 'ES256' || header.typ !== 'JWT' || !header.nonce) {
  throw new Error(`Invalid JWT header: ${JSON.stringify(header)}`);
}

if (payload.iss !== 'cdp' || payload.sub !== parsedFromJson.apiKeyId) {
  throw new Error(`Invalid JWT payload claims: ${JSON.stringify(payload)}`);
}

if (payload.uri !== 'GET api.coinbase.com/api/v3/brokerage/accounts') {
  throw new Error(`Invalid JWT uri claim: ${payload.uri}`);
}

// Verify ES256 signature mathematically with public key
const unsignedToken = `${parts[0]}.${parts[1]}`;
const signatureBuffer = Buffer.from(parts[2], 'base64url');

// Signature must be exactly 64 bytes (IEEE P1363)
if (signatureBuffer.length !== 64) {
  throw new Error(`Signature length is ${signatureBuffer.length} bytes; expected exactly 64 bytes for RFC 7518 ES256.`);
}

const isSignatureValid = crypto.verify(
  'SHA256',
  Buffer.from(unsignedToken),
  { key: publicKey, dsaEncoding: 'ieee-p1363' },
  signatureBuffer
);

if (!isSignatureValid) {
  throw new Error('Mathematical signature verification failed against EC P-256 public key!');
}
console.log('✅ ES256 JWT mathematical verification passed with 64-byte IEEE P1363 signature.');

// 3. Test POST order JWT URI claim
console.log('\n--- Test 3: POST Order JWT URI Claim ---');
const orderPath = '/api/v3/brokerage/orders';
const orderJwt = generateCoinbaseJWT(parsedFromJson.apiKeyId, parsedFromJson.privateKeyPem, orderPath, 'POST');
const orderPayload = JSON.parse(Buffer.from(orderJwt.split('.')[1], 'base64url').toString('utf8'));
if (orderPayload.uri !== 'POST api.coinbase.com/api/v3/brokerage/orders') {
  throw new Error(`Order JWT uri claim incorrect: ${orderPayload.uri}`);
}
console.log(`✅ Order JWT verified: ${orderPayload.uri}`);

// 4. Test Legacy HMAC fallback
console.log('\n--- Test 4: Legacy HMAC Secret Fallback ---');
const legacyKeyId = 'legacy-key-123';
const legacySecret = 'legacy-hmac-secret-string-abc-123-xyz';
const parsedHmac = parseCoinbaseCredentials(legacyKeyId, legacySecret);
if (parsedHmac.keyType !== 'legacy_hmac') {
  throw new Error(`Expected legacy_hmac keyType, got: ${parsedHmac.keyType}`);
}
const hmacJwt = generateCoinbaseJWT(legacyKeyId, legacySecret, testPath, 'GET');
const hmacHeader = JSON.parse(Buffer.from(hmacJwt.split('.')[0], 'base64url').toString('utf8'));
if (hmacHeader.alg !== 'HS256') {
  throw new Error(`Expected HS256 algorithm for legacy key, got: ${hmacHeader.alg}`);
}
console.log('✅ Legacy HMAC fallback passed with HS256 signing.');

// 5. Test diagnostic health probe on unconfigured environment
console.log('\n--- Test 5: Health Check Diagnostic Graceful Fallback ---');
const healthCheck = await checkCoinbaseHealth('', '');
if (healthCheck.isConfigured !== false || healthCheck.isValid !== false) {
  throw new Error('Health check should gracefully report unconfigured when keys are empty');
}
console.log('✅ Health diagnostic fallback reporting passed.');

console.log('\n🎉 ALL COINBASE INTEGRATION TESTS PASSED SUCCESSFULLY.\n');
