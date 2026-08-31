import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };

type PaymentOption = {
  payIn?: string;
  disabled?: boolean;
  disabledReason?: string;
  disabledMessage?: string;
  estimatedDelivery?: string;
  [key: string]: JsonValue | undefined;
};

type QuotePayload = {
  sourceCurrency: string;
  targetCurrency: string;
  sourceAmount?: number;
  targetAmount?: number;
  profile: number;
  payInMethod?: string;
};

const credentialsPath = path.join(process.cwd(), 'config', '.env.credentials');
if (fs.existsSync(credentialsPath)) {
  dotenv.config({ path: credentialsPath, override: true });
}

const token = String(process.env.WISE_API_TOKEN || '').trim();
const baseUrl = String(process.env.WISE_BASE_URL || 'https://api.wise.com').trim().replace(/\/$/, '');

function asJson(input: string): any {
  try {
    return JSON.parse(input);
  } catch {
    return input;
  }
}

function summarizeOption(option: PaymentOption): string {
  const payIn = String(option.payIn || 'UNKNOWN').toUpperCase();
  const disabled = option.disabled === true;
  const rawReason = option.disabledReason ?? option.disabledMessage ?? '';
  const reason = typeof rawReason === 'string'
    ? rawReason.trim()
    : (rawReason && typeof rawReason === 'object')
      ? JSON.stringify(rawReason)
      : '';
  const delivery = String(option.estimatedDelivery || '').trim();

  let line = `${payIn} | ${disabled ? 'DISABLED' : 'ENABLED'}`;
  if (reason) line += ` | reason=${reason}`;
  if (delivery) line += ` | eta=${delivery}`;
  return line;
}

async function wiseFetch(method: string, apiPath: string, body?: unknown): Promise<{ status: number; ok: boolean; json: any; raw: string; }> {
  const response = await fetch(`${baseUrl}${apiPath}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: body ? JSON.stringify(body) : undefined
  });

  const raw = await response.text();
  const json = asJson(raw);
  return {
    status: response.status,
    ok: response.ok,
    json,
    raw
  };
}

async function createQuote(profileId: number, label: string, payload: Omit<QuotePayload, 'profile'>): Promise<void> {
  const req: QuotePayload = { ...payload, profile: profileId };
  const res = await wiseFetch('POST', `/v3/profiles/${profileId}/quotes`, req);

  console.log(`\n[QUOTE:${label}] status=${res.status}`);
  if (!res.ok) {
    console.log(JSON.stringify(res.json, null, 2));
    return;
  }

  const quote = res.json || {};
  console.log(`quoteId=${String(quote.id || '')}`);
  console.log(`source=${String(quote.sourceAmount || '')} ${String(quote.sourceCurrency || '')} -> target=${String(quote.targetAmount || '')} ${String(quote.targetCurrency || '')}`);

  const options = Array.isArray(quote.paymentOptions) ? (quote.paymentOptions as PaymentOption[]) : [];
  if (options.length === 0) {
    console.log('paymentOptions: none returned');
    return;
  }

  console.log('paymentOptions:');
  for (const option of options) {
    console.log(`  - ${summarizeOption(option)}`);
  }
}

async function main() {
  if (!token) {
    console.error('WISE_API_TOKEN missing in environment/config/.env.credentials');
    process.exit(1);
  }

  const profilesRes = await wiseFetch('GET', '/v1/profiles');
  if (!profilesRes.ok) {
    console.error(`[profiles] status=${profilesRes.status}`);
    console.error(JSON.stringify(profilesRes.json, null, 2));
    process.exit(1);
  }

  const profiles = Array.isArray(profilesRes.json) ? profilesRes.json : [];
  const business = profiles.find((profile: any) => profile?.type === 'business');
  if (!business) {
    console.error('No business profile found for this token');
    process.exit(1);
  }

  const profileId = Number(business.id);
  console.log(`profileId=${profileId}`);
  console.log(`businessName=${String(business?.details?.name || '').trim() || 'n/a'}`);

  const balancesRes = await wiseFetch('GET', `/v4/profiles/${profileId}/balances?types=STANDARD`);
  console.log(`\n[BALANCES] status=${balancesRes.status}`);
  if (!balancesRes.ok) {
    console.log(JSON.stringify(balancesRes.json, null, 2));
  } else {
    const balances = Array.isArray(balancesRes.json) ? balancesRes.json : [];
    const usd = balances.find((item: any) => String(item?.currency || '').toUpperCase() === 'USD');
    const usdAmount = Number(usd?.amount?.value || 0);
    console.log(`USD balance=${usdAmount}`);
  }

  await createQuote(profileId, 'INBOUND_DEFAULT', {
    sourceCurrency: 'USD',
    targetCurrency: 'USD',
    targetAmount: 100
  });

  await createQuote(profileId, 'INBOUND_DIRECT_DEBIT', {
    sourceCurrency: 'USD',
    targetCurrency: 'USD',
    targetAmount: 100,
    payInMethod: 'DIRECT_DEBIT'
  });

  await createQuote(profileId, 'OUTBOUND_DEFAULT', {
    sourceCurrency: 'USD',
    targetCurrency: 'USD',
    sourceAmount: 10
  });
}

main().catch((error: any) => {
  console.error(error?.stack || String(error));
  process.exit(1);
});
