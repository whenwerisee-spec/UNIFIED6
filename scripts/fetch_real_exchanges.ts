import crypto from 'crypto';
import fs from 'fs';
import fetch from 'node-fetch';

// Load variables from tasks_extracted/.env
const envPath = 'C:\\Users\\WINNNEER\\.gemini\\antigravity\\brain\\616f4b00-fb98-4aa7-a888-97390dde4740\\scratch\\tasks_extracted\\.env';
const envContent = fs.readFileSync(envPath, 'utf8');
const env: Record<string, string> = {};
envContent.split('\n').forEach((line) => {
  const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)\s*$/);
  if (match) {
    let val = match[2].trim();
    if (val.startsWith('"') && val.endsWith('"')) {
      val = val.slice(1, -1);
    } else if (val.startsWith("'") && val.endsWith("'")) {
      val = val.slice(1, -1);
    }
    env[match[1]] = val;
  }
});

console.log('Real VITE_MARSHALL_ADDRESS:', env['VITE_MARSHALL_ADDRESS']);
console.log('Real COINBASE_API_KEY_ID:', env['COINBASE_API_KEY_ID']);

function generateCoinbaseJWT(): string {
  const keyId = env['COINBASE_API_KEY_ID'];
  const privateKey = env['COINBASE_API_SECRET_RAW'];

  if (!keyId || !privateKey) {
    throw new Error('Coinbase API credentials not configured');
  }

  const formattedKey = privateKey.replace(/\\n/g, '\n');

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
  const signature = sign.sign(
    {
      key: formattedKey,
      format: 'pem',
    },
    'base64url'
  );

  return `${message}.${signature}`;
}

async function queryCoinbase() {
  console.log('\n--- Querying Coinbase Advanced Trade ---');
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
      console.error(`Coinbase API error: ${res.status}`, await res.text());
      return;
    }

    const data: any = await res.json();
    const accounts = data.accounts || [];
    console.log(`Total accounts: ${accounts.length}`);
    const nonZero = accounts.filter((a: any) => parseFloat(a.available_balance.value) > 0);
    nonZero.forEach((a: any) => {
      console.log(`- ${a.name} (${a.currency}): ${a.available_balance.value}`);
    });
  } catch (e: any) {
    console.error('Failed to query Coinbase:', e.message || e);
  }
}

function generateKrakenSignature(urlPath: string, postData: string, secret: string): string {
  // Let's implement the correct signature calculation from security.ts (since that's what the app uses):
  const message = postData + crypto.createHash('sha256').update(postData).digest();
  const signature = crypto
    .createHmac('sha512', Buffer.from(secret, 'base64'))
    .update(message)
    .digest('base64');
  return signature;
}

async function queryKraken() {
  console.log('\n--- Querying Kraken ---');
  const apiKey = env['KRAKEN_API_KEY'];
  const apiSecret = env['KRAKEN_API_SECRET'];
  
  if (!apiKey || !apiSecret) {
    console.log('Kraken credentials not configured');
    return;
  }

  try {
    const nonce = Date.now().toString();
    const postData = `nonce=${nonce}`;
    const signature = generateKrakenSignature('/0/private/Balance', postData, apiSecret);

    const res = await fetch('https://api.kraken.com/0/private/Balance', {
      method: 'POST',
      headers: {
        'API-Sign': signature,
        'API-Key': apiKey,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: postData,
    });

    if (!res.ok) {
      console.error(`Kraken API error: ${res.status}`, await res.text());
      return;
    }

    const data: any = await res.json();
    if (data.error && data.error.length > 0) {
      console.error('Kraken returned error:', data.error);
      return;
    }

    console.log('Kraken balances:', data.result);
  } catch (e: any) {
    console.error('Failed to query Kraken:', e.message || e);
  }
}

async function main() {
  await queryCoinbase();
  await queryKraken();
}

main();
