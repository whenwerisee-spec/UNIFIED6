/**
 * Utility to validate and sanitize API keys and secret tokens before use in HTTP headers and crypto engines.
 * Prevents ByteString runtime errors caused by masked bullet points (• / U+2022) or invalid characters.
 */

export function isUsableApiKey(key: string | undefined | null): boolean {
  if (!key || typeof key !== 'string') return false;
  const trimmed = key.trim();
  if (trimmed.length < 8) return false;
  if (
    trimmed.includes('placeholder') ||
    trimmed.includes('••••') ||
    trimmed.includes('...') ||
    trimmed.includes('•')
  ) {
    return false;
  }
  // Check for ByteString safety: all characters must be standard printable ASCII (33 to 126)
  for (let i = 0; i < trimmed.length; i++) {
    const code = trimmed.charCodeAt(i);
    if (code <= 32 || code > 126) {
      return false;
    }
  }
  return true;
}

export function isUsableStripeKey(key: string | undefined | null): boolean {
  if (!isUsableApiKey(key)) return false;
  const trimmed = key!.trim();
  return /^(sk|rk|pk)_(live|test)_[A-Za-z0-9_]+$/.test(trimmed);
}

export function isUsableWiseToken(token: string | undefined | null): boolean {
  if (!isUsableApiKey(token)) return false;
  const trimmed = token!.trim();
  return trimmed.length >= 10;
}
