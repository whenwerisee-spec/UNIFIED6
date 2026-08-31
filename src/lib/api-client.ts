/**
 * Sovereign API Client
 * Centralizes API URL construction for Cross-Platform (Web & Android) compatibility.
 */

export const getApiBase = (): string => {
  // 1. Check localStorage for a user-provided override
  try {
    if (typeof window !== 'undefined') {
      const savedBase = localStorage.getItem('sovereign_custom_api_base');
      if (savedBase && savedBase.trim().length > 0) return savedBase.trim();
    }
  } catch {}

  // 2. Check for hardcoded environment variables
  const envBase = (import.meta as any).env?.VITE_API_BASE_URL || (import.meta as any).env?.VITE_API_BASE;
  if (envBase && envBase.trim().length > 0) return envBase.trim();

  // 3. Web Auto-Detection
  if (typeof window !== 'undefined') {
    if (window.location.origin && window.location.origin !== 'null' && !window.location.origin.includes('capacitor://')) {
       return window.location.origin;
    }
  }

  // 4. Default Fallback (Dedicated to Principal)
  return 'https://unified2.onrender.com';
};

/**
 * Builds a full API URL ensuring no double slashes.
 */
export function buildApiUrl(path: string): string {
  const safePath = path.startsWith('/') ? path : `/${path}`;
  const base = getApiBase();

  // Clean the base URL (remove trailing slash)
  const cleanBase = base.endsWith('/') ? base.slice(0, -1) : base;

  // If we are native or have a base, return absolute URL
  const isNative = typeof window !== 'undefined' && (window.location.protocol.includes('capacitor') || window.location.hostname === 'localhost');

  if (isNative || base) {
    return `${cleanBase}${safePath}`;
  }

  return safePath;
}

/**
 * Perform a safe JSON fetch that handles "Unexpected Token <" (HTML error pages)
 */
export async function safeJsonFetch(path: string, options: RequestInit = {}): Promise<any> {
  const url = buildApiUrl(path);

  try {
    const response = await fetch(url, {
      ...options,
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        ...options.headers,
      }
    });

    const contentType = response.headers.get('content-type');

    if (contentType && contentType.includes('application/json')) {
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.message || data.error || `Server Error (${response.status})`);
      }
      return data;
    }

    // Handle HTML error pages (Common when URL is wrong)
    const text = await response.text();
    if (text.trim().startsWith('<')) {
      throw new Error(`Invalid Server Response: Server returned HTML instead of JSON. This usually means your "Backend Server URL" is wrong or the server is down. (URL: ${url})`);
    }

    try {
      return JSON.parse(text);
    } catch {
      throw new Error(`Data format error from ${url}. Please check your server configuration.`);
    }
  } catch (err: any) {
    if (err.name === 'TypeError' || err.message.includes('fetch')) {
      throw new Error(`Network Error: Phone cannot reach server at ${url}. Ensure the server is online and you have internet.`);
    }
    throw err;
  }
}
