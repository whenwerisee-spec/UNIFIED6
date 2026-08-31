import { createStructuredLogger } from './structured-logger.js';
import { getWiseApiToken, getWiseClientId, getWiseClientSecret } from './wise-env.js';

const logger = createStructuredLogger('wise-auth-provider');

export type WiseAuthMode = 'personal_token' | 'oauth_client_credentials';

export interface WiseAuthHealthSnapshot {
  mode: WiseAuthMode;
  tokenShape: string;
  hasToken: boolean;
  hasCachedToken: boolean;
  expiresAt: string | null;
  expiresInSeconds: number | null;
  refreshInFlight: boolean;
}

type OAuthTokenResponse = {
  access_token?: string;
  token_type?: string;
  expires_in?: number;
  expires_at?: string;
  error?: string;
  error_description?: string;
};

function tokenShape(token: string): string {
  if (!token) return 'missing';
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(token)) {
    return 'uuid_opaque';
  }
  if (token.includes('.')) return 'jwt_or_jwe';
  return 'opaque_string';
}

function parseExpiryMs(response: OAuthTokenResponse): number {
  const now = Date.now();
  if (response.expires_at) {
    const parsed = Date.parse(response.expires_at);
    if (Number.isFinite(parsed)) return parsed;
  }
  const expiresIn = Number(response.expires_in || 0);
  if (Number.isFinite(expiresIn) && expiresIn > 0) {
    return now + (expiresIn * 1000);
  }
  return now + (12 * 60 * 60 * 1000);
}

export class WiseAuthProvider {
  private mode: WiseAuthMode;
  private personalToken: string;
  private oauthClientId: string;
  private oauthClientSecret: string;
  private oauthTokenUrl: string;
  private cachedToken: string;
  private cachedExpiryMs: number;
  private refreshPromise: Promise<string> | null;

  constructor(inputToken: string, isSandbox: boolean) {
    const explicitToken = String(inputToken || '').trim();
    const envToken = getWiseApiToken();
    this.personalToken = explicitToken || envToken;

    this.oauthClientId = getWiseClientId();
    this.oauthClientSecret = getWiseClientSecret();
    const defaultBase = isSandbox ? 'https://api.sandbox.wise.com' : 'https://api.wise.com';
    this.oauthTokenUrl = String(process.env.WISE_OAUTH_TOKEN_URL || `${defaultBase}/oauth/token`).trim();

    const hasOauthClientCreds = Boolean(this.oauthClientId && this.oauthClientSecret);
    this.mode = hasOauthClientCreds ? 'oauth_client_credentials' : 'personal_token';

    if (this.mode === 'personal_token' && !this.personalToken) {
      throw new Error('Wise auth is not configured. Provide WISE_API_TOKEN or WISE_CLIENT_ID/WISE_CLIENT_SECRET.');
    }

    this.cachedToken = '';
    this.cachedExpiryMs = 0;
    this.refreshPromise = null;

    logger.info('Wise auth provider initialized', {
      mode: this.mode,
      tokenShape: tokenShape(this.personalToken)
    });
  }

  getMode(): WiseAuthMode {
    return this.mode;
  }

  getHealthSnapshot(): WiseAuthHealthSnapshot {
    const now = Date.now();
    const activeToken = this.mode === 'oauth_client_credentials'
      ? this.cachedToken
      : this.personalToken;

    const ttlSeconds = this.mode === 'oauth_client_credentials' && this.cachedToken && this.cachedExpiryMs > 0
      ? Math.max(0, Math.floor((this.cachedExpiryMs - now) / 1000))
      : null;

    return {
      mode: this.mode,
      tokenShape: tokenShape(activeToken),
      hasToken: Boolean(activeToken),
      hasCachedToken: Boolean(this.cachedToken),
      expiresAt: this.mode === 'oauth_client_credentials' && this.cachedExpiryMs > 0
        ? new Date(this.cachedExpiryMs).toISOString()
        : null,
      expiresInSeconds: ttlSeconds,
      refreshInFlight: Boolean(this.refreshPromise)
    };
  }

  canRefresh(): boolean {
    return this.mode === 'oauth_client_credentials';
  }

  async getAccessToken(forceRefresh = false): Promise<string> {
    if (this.mode === 'personal_token') {
      return this.personalToken;
    }

    const now = Date.now();
    if (!forceRefresh && this.cachedToken && (this.cachedExpiryMs - now > 60_000)) {
      return this.cachedToken;
    }

    if (this.refreshPromise) {
      return this.refreshPromise;
    }

    this.refreshPromise = this.issueClientCredentialsToken();
    try {
      return await this.refreshPromise;
    } finally {
      this.refreshPromise = null;
    }
  }

  private async issueClientCredentialsToken(): Promise<string> {
    const basic = Buffer.from(`${this.oauthClientId}:${this.oauthClientSecret}`, 'utf8').toString('base64');

    const response = await fetch(this.oauthTokenUrl, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${basic}`,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: 'grant_type=client_credentials'
    });

    const text = await response.text();
    let json: OAuthTokenResponse = {};
    try {
      json = JSON.parse(text) as OAuthTokenResponse;
    } catch {
      json = { error_description: text };
    }

    if (!response.ok || !json.access_token) {
      const detail = json.error_description || json.error || response.statusText || 'Unknown token error';
      if (response.status === 401) {
        throw new Error(`WISE_TOKEN_INVALID: OAuth client credentials rejected by Wise (${detail})`);
      }
      if (response.status === 429) {
        throw new Error(`WISE_RATE_LIMITED: Wise OAuth token endpoint rate-limited (${detail})`);
      }
      throw new Error(`WISE_TOKEN_REFRESH_FAILED: ${detail}`);
    }

    this.cachedToken = String(json.access_token).trim();
    this.cachedExpiryMs = parseExpiryMs(json);

    logger.info('Wise OAuth token refreshed', {
      mode: this.mode,
      tokenShape: tokenShape(this.cachedToken),
      expiresAt: new Date(this.cachedExpiryMs).toISOString()
    });

    return this.cachedToken;
  }
}

export default WiseAuthProvider;