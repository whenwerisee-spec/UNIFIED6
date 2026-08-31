import Redis from 'ioredis';

const redisUrl = process.env.REDIS_URL || process.env.REDIS_TLS_URL || '';
let redisClient = null;
if (redisUrl) {
  try {
    redisClient = new Redis(redisUrl);
  } catch (e) {
    console.warn('Failed to initialize Redis rate limiter, falling back to memory:', e.message || e);
    redisClient = null;
  }
}

// In-memory fallback
const memoryMap = new Map();

const WINDOW_MS = parseInt(process.env.INTERBANK_WINDOW_MS || '') || 60 * 60 * 1000;
const MAX_PER_WINDOW = parseInt(process.env.INTERBANK_MAX_PER_WINDOW || '') || 10;

export async function consume(key) {
  const now = Date.now();
  if (redisClient) {
    // Use Redis INCR with TTL
    const redisKey = `rl:${key}`;
    const count = await redisClient.incr(redisKey);
    if (count === 1) {
      await redisClient.pexpire(redisKey, WINDOW_MS);
    }
    return { allowed: count <= MAX_PER_WINDOW, remaining: Math.max(0, MAX_PER_WINDOW - count) };
  }

  let rec = memoryMap.get(key) || { count: 0, start: now };
  if (now - rec.start > WINDOW_MS) {
    rec = { count: 0, start: now };
  }
  rec.count += 1;
  memoryMap.set(key, rec);
  return { allowed: rec.count <= MAX_PER_WINDOW, remaining: Math.max(0, MAX_PER_WINDOW - rec.count) };
}

export default { consume };
