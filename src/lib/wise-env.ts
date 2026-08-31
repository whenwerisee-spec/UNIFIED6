import { isUsableApiKey } from './api-key-sanitizer.js';

function firstNonEmpty(values: Array<string | undefined | null>): string {
  for (const value of values) {
    const normalized = String(value || '').trim();
    if (normalized && isUsableApiKey(normalized)) {
      return normalized;
    }
  }
  return '';
}

export function getWiseApiToken(): string {
  return firstNonEmpty([
    process.env.WISE_API_TOKEN,
    process.env.WISE_ALL_ACCESS_KEY,
    process.env.WISE_PERSONAL_TOKEN,
    process.env.WISE_ACCESS_TOKEN
  ]);
}

export function getWiseClientId(): string {
  return firstNonEmpty([
    process.env.WISE_CLIENT_ID,
    process.env.WISE_OAUTH_CLIENT_ID,
    process.env.WISE_APP_CLIENT_ID,
    process.env.WISE_PLATFORM_CLIENT_ID
  ]);
}

export function getWiseClientSecret(): string {
  return firstNonEmpty([
    process.env.WISE_CLIENT_SECRET,
    process.env.WISE_OAUTH_CLIENT_SECRET,
    process.env.WISE_APP_CLIENT_SECRET,
    process.env.WISE_PLATFORM_CLIENT_SECRET
  ]);
}

export function getWiseClientKey(): string {
  return firstNonEmpty([
    process.env.WISE_CLIENT_KEY,
    process.env.WISE_APP_CLIENT_KEY,
    process.env.WISE_PLATFORM_CLIENT_KEY
  ]);
}

export function getWiseWebhookCallbackUrl(): string {
  const explicit = firstNonEmpty([
    process.env.WISE_WEBHOOK_CALLBACK_URL,
    process.env.WISE_WEBHOOK_URL,
    process.env.WISE_CALLBACK_URL
  ]);
  if (explicit) {
    return explicit.replace(/\/$/, '');
  }

  const appBase = firstNonEmpty([
    process.env.APP_URL,
    process.env.PUBLIC_URL,
    process.env.SOV_TERMINAL_URL
  ]).replace(/\/$/, '');

  return appBase ? `${appBase}/api/withdrawal/wise/webhooks` : '';
}

export function getWiseWebhookPublicKeyInlinePem(): string {
  return firstNonEmpty([
    process.env.WISE_WEBHOOK_PUBLIC_KEY_PEM,
    process.env.WISE_PUBLIC_KEY_PEM,
    process.env.WISE_JOSE_PUBLIC_KEY_PEM
  ]);
}

export function getWiseWebhookPublicKeyPath(): string {
  return firstNonEmpty([
    process.env.WISE_WEBHOOK_PUBLIC_KEY_PATH,
    process.env.WISE_PUBLIC_KEY_PATH,
    process.env.WISE_JOSE_PUBLIC_KEY_PATH
  ]);
}