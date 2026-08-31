import crypto from 'crypto';
import dotenv from 'dotenv';
import fetch from 'node-fetch';

dotenv.config();

function generateCoinbaseJWT(): string {
  const keyId = process.env.COINBASE_API_KEY_ID;
  const privateKey = process.env.COINBASE_API_SECRET_RAW;

  if (!keyId || !privateKey) {
    throw new Error('Coinbase API credentials not configured');
  }

  // Handle double escapes and newlines in private key
  let formattedKey = privateKey;
  if (formattedKey.startsWith('"') && formattedKey.endsWith('"')) {
    formattedKey = formattedKey.slice(1, -1);
  }
  formattedKey = formattedKey.replace(/\\n/g, '\n');

  const header = {
    alg: 'ES256',
    kid: keyId,
    nonce: crypto.randomBytes(16).toString('hex'),
    typ: 'JWT',
  };

  const payload = {
    iss: 'cdp_service',
    nbf: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 60,
    iat: Math.floor(Date.now() / 1000),
    sub: keyId,
  };

  const encodedHeader = Buffer.from(JSON.stringify(header)).toString('base64url');
  const encodedPayload = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const message = `${encodedHeader}.${encodedPayload}`;

  const sign = crypto.createSign('SHA256');
  sign.update(message);

  let signature: string;
  try {
    // Try auto-detecting key format
    signature = sign.sign(formattedKey, 'base64url');
  } catch (err: any) {
    console.log('Failed signing with default options, trying with explicit pkcs8/sec1 configurations:', err.message);
    try {
      signature = sign.sign(
        {
          key: formattedKey,
          format: 'pem',
          type: 'sec1',
        },
        'base64url'
      );
    } catch (err2: any) {
      console.log('Failed sec1 signing:', err2.message);
      // Try parsing key first
      const keyObj = crypto.createPrivateKey({
        key: formattedKey,
        format: 'pem'
      });
      signature = sign.sign(keyObj, 'base64url');
    }
  }

  return `${message}.${signature}`;
}

async function run() {
  console.log('Querying Coinbase Advanced Trade balances...');
  try {
    const jwt = generateCoinbaseJWT();
    const url = 'https://api.coinbase.com/api/v3/brokerage/accounts';
    const res = await fetch(url, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${jwt}`,
        'Content-Type': 'application/json',
      },
    });

    if (!res.ok) {
      const err = await res.text();
      console.error(`Coinbase API error: ${res.status}`, err);
      return;
    }

    const data: any = await res.json();
    const accounts = data.accounts || [];
    console.log(`Total accounts found: ${accounts.length}`);
    const nonZero = accounts.filter((a: any) => parseFloat(a.available_balance.value) > 0);
    console.log(`Non-zero accounts:`);
    nonZero.forEach((a: any) => {
      console.log(`- ${a.name} (${a.currency}): ${a.available_balance.value}`);
    });
  } catch (e: any) {
    console.error('Failed to query Coinbase accounts:', e.message || e);
  }
}

run();
