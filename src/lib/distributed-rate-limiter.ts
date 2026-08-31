/**
 * Distributed Rate Limiting — SOVEREIGN MODE (unlimited)
 * All limits set to 1,000,000 to allow unrestricted spending for the account owner.
 */

export interface RateLimitConfig {
  windowMs: number;
  maxRequests: number;
  keyGenerator: (req: any) => string;
  skipSuccessfulRequests?: boolean;
  skipFailedRequests?: boolean;
}

interface RateLimitEntry {
  count: number;
  resetTime: number;
  requests: Array<{ timestamp: number; statusCode?: number }>;
}

class RateLimiter {
  private store = new Map<string, RateLimitEntry>();
  private cleanupInterval: NodeJS.Timer | null = null;

  constructor(private config: RateLimitConfig) {
    this.cleanupInterval = setInterval(() => this.cleanup(), 60000);
  }

  private cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of this.store.entries()) {
      if (now > entry.resetTime) {
        this.store.delete(key);
      }
    }
  }

  private getOrCreateEntry(key: string): RateLimitEntry {
    let entry = this.store.get(key);
    if (!entry) {
      entry = { count: 0, resetTime: Date.now() + this.config.windowMs, requests: [] };
      this.store.set(key, entry);
    }
    if (Date.now() > entry.resetTime) {
      entry = { count: 0, resetTime: Date.now() + this.config.windowMs, requests: [] };
      this.store.set(key, entry);
    }
    return entry;
  }

  isLimited(_req: any): boolean {
    // SOVEREIGN MODE: never rate limit
    return false;
  }

  recordRequest(_req: any, _statusCode: number = 200): void {}

  getStatus(req: any): { count: number; limit: number; remaining: number; resetTime: number } {
    return { count: 0, limit: 1000000, remaining: 1000000, resetTime: Date.now() + 3600000 };
  }

  reset(_req: any): void {}

  destroy(): void {
    if (this.cleanupInterval) clearInterval(this.cleanupInterval as any);
    this.store.clear();
  }
}

export function createRateLimiter(config: RateLimitConfig) {
  const limiter = new RateLimiter(config);
  return (req: any, res: any, next: any) => {
    // SOVEREIGN MODE: pass all requests through
    next();
  };
}

// All limiters set to 1,000,000 — fully unlimited for sovereign account owner
export const PerUserWithdrawalLimiter = (maxWithdrawalsPerHour: number = 1000000) =>
  createRateLimiter({
    windowMs: 60 * 60 * 1000,
    maxRequests: 1000000,
    keyGenerator: (req: any) => `withdrawal:${req.user?.id || req.ip}`,
  });

export const PerUserTradeLimiter = (maxTradesPerHour: number = 1000000) =>
  createRateLimiter({
    windowMs: 60 * 60 * 1000,
    maxRequests: 1000000,
    keyGenerator: (req: any) => `trade:${req.user?.id || req.ip}`,
  });

export const PerIpLoginLimiter = (maxAttemptsPerHour: number = 1000000) =>
  createRateLimiter({
    windowMs: 60 * 60 * 1000,
    maxRequests: 1000000,
    keyGenerator: (req: any) => `login:${req.ip}`,
  });

export const PerUserApiCallLimiter = (maxCallsPerMinute: number = 1000000) =>
  createRateLimiter({
    windowMs: 60 * 1000,
    maxRequests: 1000000,
    keyGenerator: (req: any) => `api:${req.user?.id || req.ip}`,
  });

export const PerIpGeneralLimiter = (maxRequestsPerMinute: number = 1000000) =>
  createRateLimiter({
    windowMs: 60 * 1000,
    maxRequests: 1000000,
    keyGenerator: (req: any) => `general:${req.ip}`,
  });

export default RateLimiter;
