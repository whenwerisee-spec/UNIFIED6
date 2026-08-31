import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

const credentialsPath = path.join(process.cwd(), 'config', '.env.credentials');
if (fs.existsSync(credentialsPath)) {
  dotenv.config({ path: credentialsPath, override: true });
}

async function wiseApi(method: string, apiPath: string, body?: any) {
  const token = String(process.env.WISE_API_TOKEN || '').trim();
  const headers = {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json'
  };
  const res = await fetch(`https://api.wise.com${apiPath}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined
  });
  const txt = await res.text();
  let data: any = txt;
  try {
    data = JSON.parse(txt);
  } catch {
    // non-json
  }
  return { ok: res.ok, status: res.status, data };
}

async function run() {
  const profiles = await wiseApi('GET', '/v1/profiles');
  if (!profiles.ok) {
    console.log('profiles fail', profiles.status, profiles.data);
    return;
  }
  const business = (profiles.data as any[]).find((p: any) => p.type === 'business');
  if (!business) {
    console.log('no business profile');
    return;
  }

  const profileId = String(business.id);
  console.log('profileId', profileId);

  const quote = await wiseApi('POST', `/v3/profiles/${profileId}/quotes`, {
    sourceCurrency: 'USD',
    targetCurrency: 'USD',
    targetAmount: 10,
    profile: profileId,
    payInMethod: 'DIRECT_DEBIT'
  });
  console.log('quote', quote.status, quote.data?.id || quote.data);
  if (!quote.ok) return;

  const transfer = await wiseApi('POST', '/v1/transfers', {
    targetAccount: profileId,
    quoteUuid: quote.data.id,
    customerTransactionId: crypto.randomUUID(),
    details: {
      reference: 'Inbound probe'
    }
  });
  console.log('transfer', transfer.status, transfer.data?.id || transfer.data);
  if (!transfer.ok) return;

  const paymentA = await wiseApi('POST', `/v3/profiles/${profileId}/transfers/${transfer.data.id}/payments`, {
    type: 'DIRECT_DEBIT'
  });
  console.log('paymentA', paymentA.status, paymentA.data);

  const paymentB = await wiseApi('POST', `/v3/profiles/${profileId}/transfers/${transfer.data.id}/payments`, {
    type: 'DIRECT_DEBIT',
    paymentMethodDetails: {
      routingNumber: '021000021',
      accountNumber: '9900000000',
      accountHolderName: 'Sandbox Test',
      accountType: 'CHECKING'
    }
  });
  console.log('paymentB', paymentB.status, paymentB.data);
}

run().catch((e) => {
  console.error(e?.stack || String(e));
  process.exit(1);
});
