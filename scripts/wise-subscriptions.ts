import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import {
  getWiseApiToken,
  getWiseClientId,
  getWiseClientKey,
  getWiseClientSecret,
  getWiseWebhookCallbackUrl
} from '../src/lib/wise-env.js';

const credentialsPath = path.join(process.cwd(), 'config', '.env.credentials');
if (fs.existsSync(credentialsPath)) {
  dotenv.config({ path: credentialsPath, override: true });
}

const wiseBaseUrl = String(process.env.WISE_BASE_URL || 'https://api.wise.com').trim().replace(/\/$/, '');
const oauthTokenUrl = String(process.env.WISE_OAUTH_TOKEN_URL || `${wiseBaseUrl}/oauth/token`).trim();
const clientId = getWiseClientId();
const clientSecret = getWiseClientSecret();
const clientKey = getWiseClientKey();
const webhookUrl = getWiseWebhookCallbackUrl();
const defaultProfileEvents = [
  'transfers#state-change',
  'transfers#payout-failure',
  'balances#update',
  'swift-in#credit'
];

type Subscription = {
  id?: string;
  name?: string;
  trigger_on?: string;
  delivery?: {
    version?: string;
    url?: string;
  };
};

async function getClientCredentialsToken(): Promise<string> {
  if (!clientId || !clientSecret) {
    throw new Error('WISE_CLIENT_ID and WISE_CLIENT_SECRET are required');
  }

  const basic = Buffer.from(`${clientId}:${clientSecret}`, 'utf8').toString('base64');
  const response = await fetch(oauthTokenUrl, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${basic}`,
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: 'grant_type=client_credentials'
  });

  const text = await response.text();
  let json: any = {};
  try {
    json = JSON.parse(text);
  } catch {
    json = { raw: text };
  }

  if (!response.ok || !json?.access_token) {
    throw new Error(`Unable to obtain client credentials token: ${JSON.stringify(json)}`);
  }

  return String(json.access_token).trim();
}

async function fetchBusinessProfileId(personalToken: string): Promise<string> {
  const response = await fetch(`${wiseBaseUrl}/v1/profiles`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${personalToken}`,
      'Content-Type': 'application/json'
    }
  });

  const text = await response.text();
  let json: any[] = [];
  try {
    json = JSON.parse(text);
  } catch {
    throw new Error(`Failed to parse profiles response: ${text}`);
  }

  const business = json.find((profile: any) => profile?.type === 'business');
  if (!business) {
    throw new Error('No business profile found for WISE_API_TOKEN');
  }

  return String(business.id);
}

async function wiseRequest(method: string, apiPath: string, bearerToken: string, body?: unknown): Promise<any> {
  const response = await fetch(`${wiseBaseUrl}${apiPath}`, {
    method,
    headers: {
      Authorization: `Bearer ${bearerToken}`,
      'Content-Type': 'application/json',
      'X-External-Correlation-Id': crypto.randomUUID()
    } as any,
    body: body ? JSON.stringify(body) : undefined
  });

  const text = await response.text();
  let json: any = text;
  try {
    json = JSON.parse(text);
  } catch {
    // raw text fallback
  }

  if (!response.ok) {
    throw new Error(`${method} ${apiPath} failed (${response.status}): ${JSON.stringify(json)}`);
  }

  return json;
}

async function listSubscriptions() {
  const mode = String(process.argv[2] || 'profile').trim().toLowerCase();
  if (mode === 'application') {
    if (!clientKey) {
      throw new Error('WISE_CLIENT_KEY is required for application-level subscriptions');
    }
    const token = await getClientCredentialsToken();
    const result = await wiseRequest('GET', `/v3/applications/${clientKey}/subscriptions`, token);
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  const personalToken = getWiseApiToken();
  if (!personalToken) {
    throw new Error('WISE_API_TOKEN is required for profile-level subscriptions');
  }
  const profileId = await fetchBusinessProfileId(personalToken);
  const result = await wiseRequest('GET', `/v3/profiles/${profileId}/subscriptions`, personalToken);
  console.log(JSON.stringify(result, null, 2));
}

async function ensureProfileSubscriptions() {
  const personalToken = getWiseApiToken();
  if (!personalToken) {
    throw new Error('WISE_API_TOKEN is required for profile-level subscription creation');
  }
  if (!webhookUrl) {
    throw new Error('WISE_WEBHOOK_CALLBACK_URL is required');
  }

  const profileId = await fetchBusinessProfileId(personalToken);
  const existing = await wiseRequest('GET', `/v3/profiles/${profileId}/subscriptions`, personalToken);
  const existingList = Array.isArray(existing) ? existing : (Array.isArray(existing?.subscriptions) ? existing.subscriptions : []);

  for (const eventType of defaultProfileEvents) {
    const found = (existingList as Subscription[]).find((subscription) => {
      return String(subscription?.trigger_on || '') === eventType
        && String(subscription?.delivery?.url || '') === webhookUrl;
    });

    if (found) {
      console.log(`exists ${eventType} -> ${String(found.id || found.name || 'unknown')}`);
      continue;
    }

    const created = await wiseRequest('POST', `/v3/profiles/${profileId}/subscriptions`, personalToken, {
      name: `Sovereigns ${eventType}`,
      trigger_on: eventType,
      delivery: {
        version: eventType === 'swift-in#credit' ? '4.2.0' : '4.0.0',
        url: webhookUrl
      }
    });

    console.log(`created ${eventType}`);
    console.log(JSON.stringify(created, null, 2));
  }
}

async function main() {
  const command = String(process.argv[2] || 'list').trim().toLowerCase();
  if (command === 'list' || command === 'application' || command === 'profile') {
    await listSubscriptions();
    return;
  }
  if (command === 'ensure-profile') {
    await ensureProfileSubscriptions();
    return;
  }

  throw new Error('Usage: tsx scripts/wise-subscriptions.ts [list|profile|application|ensure-profile]');
}

main().catch((err: any) => {
  console.error(err?.stack || String(err));
  process.exit(1);
});