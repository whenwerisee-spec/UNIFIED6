export interface SanitizedError {
  error: string;
  code: string;
  correlationId: string;
  timestamp: string;
  message?: string;
}

const SENSITIVE_PATTERNS = [
  /([A-Za-z0-9_-]{40,})/g,  // Very long strings that might be keys/tokens
  /sk_[a-zA-Z0-9_-]+/g,     // Stripe/Coinbase secret keys
  /pk_[a-zA-Z0-9_-]+/g,     // Public keys
  /secret[_\s]?key/gi,      // References to secrets
  /password/gi,              // Password references
  /api[_\s]?key/gi,         // API key references
  /authorization/gi,         // Authorization headers
  /bearer/gi,                // Bearer tokens
  /token/gi,                 // Generic token references
  /credentials/gi,           // Credentials references
];

const ERROR_MESSAGES: Record<string, string> = {
  'COINBASE_API_ERROR': 'External exchange provider returned an error',
  'KRAKEN_API_ERROR': 'External exchange provider returned an error',
  'DATABASE_ERROR': 'Data operation failed',
  'AUTHENTICATION_ERROR': 'Authentication failed',
  'VALIDATION_ERROR': 'Request validation failed',
  'NETWORK_ERROR': 'External service unavailable',
  'PERMISSION_ERROR': 'Operation not permitted',
  'RATE_LIMIT_ERROR': 'Too many requests',
  'INTERNAL_ERROR': 'An internal error occurred',
};

/**
 * Sanitize error message to prevent leaking sensitive information
 * Converts raw errors to generic, safe error objects for client responses
 */
export function sanitizeError(error: any, correlationId: string): SanitizedError {
  const rawMessage = error?.message || String(error) || 'Unknown error';
  
  // Detect error type from message content
  let errorCode = 'INTERNAL_ERROR';
  
  if (rawMessage.includes('COINBASE')) errorCode = 'COINBASE_API_ERROR';
  else if (rawMessage.includes('KRAKEN')) errorCode = 'KRAKEN_API_ERROR';
  else if (rawMessage.includes('database') || rawMessage.includes('Database')) errorCode = 'DATABASE_ERROR';
  else if (rawMessage.includes('auth') || rawMessage.includes('unauthorized')) errorCode = 'AUTHENTICATION_ERROR';
  else if (rawMessage.includes('validation') || rawMessage.includes('invalid')) errorCode = 'VALIDATION_ERROR';
  else if (rawMessage.includes('network') || rawMessage.includes('ECONNREFUSED') || rawMessage.includes('ENOTFOUND')) errorCode = 'NETWORK_ERROR';
  else if (rawMessage.includes('permission') || rawMessage.includes('denied')) errorCode = 'PERMISSION_ERROR';
  else if (rawMessage.includes('rate') || rawMessage.includes('limit') || rawMessage.includes('429')) errorCode = 'RATE_LIMIT_ERROR';

  const safeMessage = ERROR_MESSAGES[errorCode] || 'An error occurred';

  return {
    error: errorCode,
    code: errorCode,
    correlationId,
    timestamp: new Date().toISOString(),
    message: safeMessage
  };
}

/**
 * Remove sensitive strings from a given string
 * Used for sanitizing logs and error messages
 */
export function sanitizeString(str: string): string {
  if (!str || typeof str !== 'string') {
    return str;
  }

  let sanitized = str;
  for (const pattern of SENSITIVE_PATTERNS) {
    sanitized = sanitized.replace(pattern, '[REDACTED]');
  }
  return sanitized;
}

/**
 * Check if a string contains potentially sensitive information
 */
export function containsSensitiveData(str: string): boolean {
  if (!str || typeof str !== 'string') {
    return false;
  }

  for (const pattern of SENSITIVE_PATTERNS) {
    if (pattern.test(str)) {
      return true;
    }
  }
  return false;
}
