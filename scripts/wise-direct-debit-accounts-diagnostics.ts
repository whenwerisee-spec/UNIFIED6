import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { getWiseApiToken } from '../src/lib/wise-env.js';

const credentialsPath = path.join(process.cwd(), 'config', '.env.credentials');
if (fs.existsSync(credentialsPath)) {
  dotenv.config({ path: credentialsPath, override: true });
}

const wiseBaseUrl = String(process.env.WISE_BASE_URL || 'https://api.wise.com').trim().replace(/\/$/, '');
const token = getWiseApiToken();

async function wiseFetch(apiPath: string): Promise<{ ok: boolean; status: number; json: any; }> {
  const response = await fetch(`${wiseBaseUrl}${apiPath}`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    }
  });
  const text = await response.text();
  let json: any = text;
  try {
    json = JSON.parse(text);
  } catch {
    // keep raw text
  }
  return {
    ok: response.ok,
    status: response.status,
    json
  };
}

async function main() {
  if (!token) {
    console.error('WISE_API_TOKEN missing in config/.env.credentials');
    process.exit(1);
  }

  const profilesRes = await wiseFetch('/v1/profiles');
  if (!profilesRes.ok) {
    console.error('profiles failed', profilesRes.status, JSON.stringify(profilesRes.json, null, 2));
    process.exit(1);
  }

  const business = (Array.isArray(profilesRes.json) ? profilesRes.json : []).find((profile: any) => profile?.type === 'business');
  if (!business) {
    console.error('No business profile found');
    process.exit(1);
  }

  const profileId = String(business.id);
  console.log(`profileId=${profileId}`);
  console.log(`businessName=${String(business?.details?.name || '').trim() || 'n/a'}`);

  const accountsRes = await wiseFetch(`/v1/profiles/${profileId}/direct-debit-accounts`);
  console.log(`status=${accountsRes.status}`);
  console.log(JSON.stringify(accountsRes.json, null, 2));
}

main().catch((err: any) => {
  console.error(err?.stack || String(err));
  process.exit(1);
});