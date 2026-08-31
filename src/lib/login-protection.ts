export interface LoginAttempt {
  email: string;
  timestamp: number;
  success: boolean;
  ipAddress: string;
  userAgent: string;
}

export interface AccountLockStatus {
  lockedUntil: number | null;
  failedAttempts: number;
  reason: string;
}

const loginAttempts = new Map<string, LoginAttempt[]>();
const lockedAccounts = new Map<string, AccountLockStatus>();

const FAILED_ATTEMPT_THRESHOLD = 5;
const LOCKOUT_DURATION_MS = 15 * 60 * 1000; // 15 minutes
const ATTEMPT_WINDOW_MS = 60 * 60 * 1000; // 1 hour

/**
 * Record a login attempt (successful or failed)
 * Automatically locks account if threshold is exceeded
 */
export function recordLoginAttempt(
  email: string,
  success: boolean,
  ipAddress: string,
  userAgent: string
): void {
  const key = email.toLowerCase();
  const now = Date.now();
  
  // Get or initialize attempts array
  const attempts = loginAttempts.get(key) || [];
  
  // Add new attempt
  attempts.push({
    email,
    timestamp: now,
    success,
    ipAddress,
    userAgent
  });
  
  // Keep only attempts from the last hour
  const recentAttempts = attempts.filter(a => now - a.timestamp < ATTEMPT_WINDOW_MS);
  loginAttempts.set(key, recentAttempts);
  
  // Count failed attempts
  const failedCount = recentAttempts.filter(a => !a.success).length;
  
  // Lock account if threshold exceeded
  if (failedCount >= FAILED_ATTEMPT_THRESHOLD) {
    lockAccount(email, `${failedCount} failed login attempts within ${ATTEMPT_WINDOW_MS / 60000} minutes`);
  }
}

/**
 * Manually lock an account for security reasons
 */
export function lockAccount(email: string, reason: string): void {
  const key = email.toLowerCase();
  lockedAccounts.set(key, {
    lockedUntil: Date.now() + LOCKOUT_DURATION_MS,
    failedAttempts: FAILED_ATTEMPT_THRESHOLD,
    reason
  });
}

/**
 * Unlock an account (admin/user action)
 */
export function unlockAccount(email: string): void {
  const key = email.toLowerCase();
  lockedAccounts.delete(key);
}

/**
 * Check if an account is currently locked
 */
export function isAccountLocked(email: string): boolean {
  const key = email.toLowerCase();
  const lock = lockedAccounts.get(key);
  
  if (!lock) return false;
  
  // Check if lockout period has expired
  if (lock.lockedUntil && Date.now() > lock.lockedUntil) {
    lockedAccounts.delete(key);
    return false;
  }
  
  return true;
}

/**
 * Get lock status for an account (if locked)
 */
export function getAccountLockStatus(email: string): AccountLockStatus | null {
  const key = email.toLowerCase();
  const lock = lockedAccounts.get(key);
  
  if (!lock || (lock.lockedUntil && Date.now() > lock.lockedUntil)) {
    lockedAccounts.delete(key);
    return null;
  }
  
  return lock;
}

/**
 * Get all login attempts for an account within specified hours
 */
export function getLoginAttempts(email: string, hoursBack: number = 24): LoginAttempt[] {
  const key = email.toLowerCase();
  const attempts = loginAttempts.get(key) || [];
  const cutoff = Date.now() - (hoursBack * 60 * 60 * 1000);
  
  return attempts.filter(a => a.timestamp >= cutoff);
}

/**
 * Get count of failed attempts for an account in the current window
 */
export function getFailedAttemptsInWindow(email: string): number {
  const key = email.toLowerCase();
  const attempts = loginAttempts.get(key) || [];
  const now = Date.now();
  const recentAttempts = attempts.filter(a => now - a.timestamp < ATTEMPT_WINDOW_MS);
  return recentAttempts.filter(a => !a.success).length;
}

/**
 * Clear all login attempts for an account (after successful login)
 */
export function clearLoginAttempts(email: string): void {
  const key = email.toLowerCase();
  loginAttempts.delete(key);
}
