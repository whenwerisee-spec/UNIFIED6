import fetch from 'node-fetch';

const cache = new Map();
const DEFAULT_TTL_MS = 60 * 60 * 1000; // 1 hour

export async function fetchJwks(jwksUrl) {
  const key = String(jwksUrl);
  const now = Date.now();
  const cached = cache.get(key);
  if (cached && cached.expiresAt > now) return cached.jwks;

  try {
    const res = await fetch(jwksUrl, { method: 'GET' });
    if (!res.ok) throw new Error('JWKS fetch failed: ' + res.status);
    const jwks = await res.json();
    const ttl = parseInt(process.env.JWKS_CACHE_TTL_MS || '') || DEFAULT_TTL_MS;
    cache.set(key, { jwks, expiresAt: now + ttl });
    return jwks;
  } catch (e) {
    if (cached) return cached.jwks; // fallback to stale
    throw e;
  }
}

export function clearJwksCache(jwksUrl) {
  cache.delete(String(jwksUrl));
}

export default { fetchJwks, clearJwksCache };
