import crypto from 'crypto';

function base64url(input) {
  return input.replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');
}

export function createPkcePair() {
  const verifier = crypto.randomBytes(32).toString('base64');
  const verifierUrl = base64url(verifier);
  const sha = crypto.createHash('sha256').update(verifierUrl).digest('base64');
  const challenge = base64url(sha);
  return { verifier: verifierUrl, challenge };
}

export function buildAuthorizationUrl(bank, params = {}) {
  const url = new URL(bank.authUrl);
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null) url.searchParams.set(k, String(v));
  });
  return url.toString();
}

export default { createPkcePair, buildAuthorizationUrl };
