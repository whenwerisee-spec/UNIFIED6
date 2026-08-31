import fetch from 'node-fetch';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';

const credentialsPath = path.join(process.cwd(), 'config', '.env.credentials');
if (fs.existsSync(credentialsPath)) {
  dotenv.config({ path: credentialsPath, override: false });
}

const isSandbox = String(process.env.WISE_SANDBOX_MODE || 'false').toLowerCase() === 'true';
const baseUrl = isSandbox ? 'https://api.sandbox.wise.com' : 'https://api.wise.com';
const token = String(process.env.WISE_API_TOKEN || '').trim();
const localApiBaseUrl = String(process.env.BASE_URL || 'http://localhost:3000').trim();
const requireLedgerMinimum = String(process.env.WISE_REQUIRE_LEDGER_BALANCE || 'false').toLowerCase() === 'true';

function getLedgerDbFilePath(): string {
  const configured = String(process.env.SOVEREIGN_DB_FILE_PATH || '').trim();
  if (configured) {
    return path.resolve(process.cwd(), configured);
  }
  return path.join(process.cwd(), 'src', 'db', 'database.json');
}

function readLedgerUsdBalanceFromFile(): number {
  const dbFilePath = getLedgerDbFilePath();
  if (!fs.existsSync(dbFilePath)) return 0;
  const parsed = JSON.parse(fs.readFileSync(dbFilePath, 'utf-8')) as any;
  const wallets = Array.isArray(parsed?.wallets) ? parsed.wallets : [];
  return wallets.reduce((sum: number, wallet: any) => {
    const symbol = String(wallet?.assetSymbol || wallet?.asset_symbol || '').toUpperCase();
    if (symbol !== 'USD') return sum;
    return sum + Number(wallet?.balance || 0);
  }, 0);
}

async function readLedgerUsdBalanceFromApi(): Promise<number | null> {
  try {
    const response = await fetch(`${localApiBaseUrl}/api/withdrawal/ledger/balance`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' }
    });
    if (!response.ok) return null;
    const data = await response.json() as any;
    return Number(data?.balances?.USD || 0);
  } catch {
    return null;
  }
}

interface WiseProfile {
  id: number;
  type: string;
  details?: {
    name?: string;
  };
}

interface PaymentOption {
  payIn?: string;
  disabled?: boolean;
  fee?: any;
  price?: any;
}

function summarizeDisabled(option: any): string {
  const reasons = option?.disabledReason || option?.disabledReasons || option?.reason || option?.reasons;
  if (!reasons) return '';

  const stringifyItem = (item: any): string => {
    if (item == null) return '';
    if (typeof item === 'string' || typeof item === 'number' || typeof item === 'boolean') {
      return String(item);
    }
    if (typeof item === 'object') {
      return String(item.message || item.code || JSON.stringify(item));
    }
    return String(item);
  };

  if (Array.isArray(reasons)) {
    return reasons.map((item) => stringifyItem(item)).filter((x) => x.length > 0).join('; ');
  }
  return stringifyItem(reasons);
}

async function safeJson(response: any): Promise<any> {
  const text = await response.text();
  try {
    return JSON.parse(text);
  } catch {
    return { raw: text };
  }
}

async function main() {
  if (!token) {
    throw new Error('WISE_API_TOKEN is missing.');
  }

  const headers = {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json'
  };

  console.log('═══════════════════════════════════════════════════════════');
  console.log('  WISE READINESS PREFLIGHT');
  console.log('═══════════════════════════════════════════════════════════');
  console.log(`Mode: ${isSandbox ? 'SANDBOX' : 'PRODUCTION'}`);
  console.log(`Base URL: ${baseUrl}`);

  const profilesRes = await fetch(`${baseUrl}/v1/profiles`, { method: 'GET', headers });
  if (!profilesRes.ok) {
    const err = await safeJson(profilesRes);
    throw new Error(`Unable to load Wise profiles: ${JSON.stringify(err)}`);
  }

  const profiles = (await profilesRes.json()) as WiseProfile[];
  const business = profiles.find((p) => p.type === 'business');
  if (!business) {
    throw new Error('No business profile found for token.');
  }

  console.log(`Business Profile ID: ${business.id}`);
  if (business.details?.name) {
    console.log(`Business Name: ${business.details.name}`);
  }

  const balancesRes = await fetch(`${baseUrl}/v4/profiles/${business.id}/balances?types=STANDARD`, {
    method: 'GET',
    headers
  });
  if (!balancesRes.ok) {
    const err = await safeJson(balancesRes);
    throw new Error(`Unable to load balances: ${JSON.stringify(err)}`);
  }

  const balances = (await balancesRes.json()) as any[];
  const wiseUsdBalance = Number(balances.find((b: any) => b.currency === 'USD')?.amount?.value || 0);

  const ledgerUsdFromApi = await readLedgerUsdBalanceFromApi();
  const ledgerUsdFromFile = readLedgerUsdBalanceFromFile();
  const ledgerUsdBalance = ledgerUsdFromApi ?? ledgerUsdFromFile;
  const ledgerSource = ledgerUsdFromApi !== null ? 'api' : 'file';
  const ledgerKnown = ledgerUsdFromApi !== null || ledgerUsdFromFile > 0;

  console.log(`Wise USD Balance (rail): ${wiseUsdBalance}`);
  console.log(`Ledger USD Balance (source of truth, ${ledgerSource}): ${ledgerUsdBalance}`);

  const directDebitQuoteRes = await fetch(`${baseUrl}/v3/profiles/${business.id}/quotes`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      sourceCurrency: 'USD',
      targetCurrency: 'USD',
      targetAmount: 100,
      profile: business.id,
      payInMethod: 'DIRECT_DEBIT'
    })
  });

  const directDebitQuote = await safeJson(directDebitQuoteRes);
  let directDebitReady = false;
  let directDebitMessage = 'DIRECT_DEBIT option not found in quote payment options';

  if (directDebitQuoteRes.ok) {
    const options = (directDebitQuote?.paymentOptions || []) as PaymentOption[];
    const option = options.find((o) => String(o?.payIn || '').toUpperCase() === 'DIRECT_DEBIT');
    if (option && option.disabled === false) {
      directDebitReady = true;
      directDebitMessage = 'DIRECT_DEBIT payment option is enabled in quote';
    } else if (option) {
      const reason = summarizeDisabled(option);
      directDebitMessage = reason
        ? `DIRECT_DEBIT present but disabled: ${reason}`
        : 'DIRECT_DEBIT present but disabled';
    }
  } else {
    directDebitMessage = `Quote request failed: ${JSON.stringify(directDebitQuote)}`;
  }

  const outboundQuoteRes = await fetch(`${baseUrl}/v3/profiles/${business.id}/quotes`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      sourceCurrency: 'USD',
      targetCurrency: 'USD',
      sourceAmount: 10,
      profile: business.id
    })
  });

  const outboundQuote = await safeJson(outboundQuoteRes);
  let balancePayInEnabled = false;
  let balanceMessage = 'BALANCE payment option not found in quote payment options';

  if (outboundQuoteRes.ok) {
    const options = (outboundQuote?.paymentOptions || []) as PaymentOption[];
    const option = options.find((o) => String(o?.payIn || '').toUpperCase() === 'BALANCE');
    if (option && option.disabled === false) {
      balancePayInEnabled = true;
      balanceMessage = 'BALANCE payment option is enabled in quote';
    } else if (option) {
      const reason = summarizeDisabled(option);
      balanceMessage = reason
        ? `BALANCE present but disabled: ${reason}`
        : 'BALANCE present but disabled';
    }
  } else {
    balanceMessage = `Quote request failed: ${JSON.stringify(outboundQuote)}`;
  }

  const minimumTestAmount = 10;
  const ledgerSourceReady = !requireLedgerMinimum || (ledgerKnown ? ledgerUsdBalance >= minimumTestAmount : true);
  const outboundImmediateReady = balancePayInEnabled && wiseUsdBalance >= minimumTestAmount;
  const outboundOperationalReady = (outboundImmediateReady || directDebitReady);

  console.log('');
  console.log('Direct Debit Readiness:');
  console.log(`  Ready: ${directDebitReady ? 'YES' : 'NO'}`);
  console.log(`  Detail: ${directDebitMessage}`);

  console.log('');
  console.log('Outbound (Immediate Wise Balance Rail):');
  console.log(`  Ready: ${outboundImmediateReady ? 'YES' : 'NO'}`);
  console.log(`  Detail: ${balanceMessage}`);
  if (wiseUsdBalance < minimumTestAmount) {
    console.log('  Additional: USD balance below required test amount ($10).');
  }

  console.log('');
  console.log('Ledger Source-of-Truth Readiness:');
  console.log(`  Ready: ${ledgerSourceReady ? 'YES' : 'NO'}`);
  console.log(`  Mode: ${requireLedgerMinimum ? 'STRICT' : 'ADVISORY'}`);
  if (!ledgerKnown) {
    console.log('  Additional: Ledger source not reachable from preflight context; not treated as blocking.');
  } else if (!ledgerSourceReady) {
    console.log('  Additional: Ledger USD below required test amount ($10).');
  }

  console.log('');
  console.log('Outbound Operational Readiness (Ledger + Available Rail):');
  console.log(`  Ready: ${outboundOperationalReady ? 'YES' : 'NO'}`);
  if (!outboundImmediateReady && directDebitReady) {
    console.log('  Detail: Requires direct-debit top-up rail before/while executing outbound.');
  }

  console.log('');
  console.log('Summary:');
  console.log(`  directDebitReady=${directDebitReady}`);
  console.log(`  ledgerSourceReady=${ledgerSourceReady}`);
  console.log(`  outboundImmediateReady=${outboundImmediateReady}`);
  console.log(`  outboundOperationalReady=${outboundOperationalReady}`);

  const preflightPassed = directDebitReady && outboundOperationalReady && ledgerSourceReady;

  console.log('');
  console.log(`Preflight Status: ${preflightPassed ? 'PASS' : 'FAIL'}`);

  console.log('');
  console.log('Recommended Next Action:');
  if (outboundImmediateReady) {
    console.log('  Run: npm run test:wise-outbound-e2e');
  } else if (directDebitReady && ledgerSourceReady) {
    console.log('  Run: npm exec tsx test-wise-e2e.ts (top-up rail), then npm run test:wise-outbound-e2e');
  } else if (!directDebitReady) {
    console.log('  Resolve direct-debit rail availability in Wise profile settings, then re-run readiness.');
  } else {
    console.log('  Ensure ledger USD >= $10 and re-run readiness.');
  }

  if (process.argv.includes('--json')) {
    console.log(JSON.stringify({
      mode: isSandbox ? 'sandbox' : 'production',
      profileId: business.id,
      directDebitReady,
      ledgerSourceReady,
      outboundImmediateReady,
      outboundOperationalReady,
      preflightPassed,
      wiseUsdBalance,
      ledgerUsdBalance,
      directDebitMessage,
      balanceMessage
    }));
  }

  if (!preflightPassed) {
    process.exitCode = 1;
  }
}

main().catch((err: any) => {
  console.error('Readiness preflight failed:', err?.message || String(err));
  process.exit(1);
});
