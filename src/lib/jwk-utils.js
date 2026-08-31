import crypto from 'crypto';

function base64urlDecode(input) {
  input = input.replace(/-/g, '+').replace(/_/g, '/');
  while (input.length % 4) input += '=';
  return Buffer.from(input, 'base64');
}

export function jwkToPem(jwk) {
  // Leverage Node's crypto which accepts JWK objects
  try {
    const keyObject = crypto.createPublicKey({ key: jwk, format: 'jwk' });
    return keyObject.export({ type: 'spki', format: 'pem' });
  } catch (e) {
    throw new Error('Failed to convert JWK to PEM: ' + e.message);
  }
}

export function decodeJwt(token) {
  const parts = String(token || '').split('.');
  if (parts.length < 2) return null;
  const header = JSON.parse(base64urlDecode(parts[0]).toString('utf8'));
  const payload = JSON.parse(base64urlDecode(parts[1]).toString('utf8'));
  return { header, payload, signature: parts[2] };
}

export default { jwkToPem, decodeJwt };
