#!/usr/bin/env node

import fetch from 'node-fetch';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';

const credentialsPath = path.join(process.cwd(), 'config', '.env.credentials');
if (fs.existsSync(credentialsPath)) {
  dotenv.config({ path: credentialsPath, override: false });
}

const localApiBaseUrl = String(process.env.BASE_URL || 'http://localhost:3000').trim();
const isSandbox = String(process.env.WISE_SANDBOX_MODE || 'false').toLowerCase() === 'true';
const wiseBaseUrl = isSandbox ? 'https://api.sandbox.wise.com' : 'https://api.wise.com';
const wiseToken = String(process.env.WISE_API_TOKEN || '').trim();
const minimumTestAmount = 10;

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
  disabledReason?: any;
  disabledReasons?: any;
  reason?: any;
  reasons?: any;
}

interface PaymentOptionState {
  ready: boolean;
  detail: string;
}

function detectTokenShape(token: string): string {
  if (!token) return 'MISSING';
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(token)) {
    return 'UUID_OPAQUE';
  }
  if (token.includes('.')) {
    const parts = token.split('.').length;
    if (parts >= 3) return 'JWT_OR_JWE';
  }
  return 'OPAQUE_STRING';
}

function detectAuthModel(): string {
  const hasOauthClient = Boolean(String(process.env.WISE_CLIENT_ID || '').trim() && String(process.env.WISE_CLIENT_SECRET || '').trim());
  if (hasOauthClient) return 'OAUTH_PARTNER';
  if (wiseToken) return 'PERSONAL_API_TOKEN';
  return 'UNCONFIGURED';
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
    return reasons.map((item) => stringifyItem(item)).filter((value) => value.length > 0).join('; ');
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

function getPaymentOptionState(quote: any, payIn: string): PaymentOptionState {
  const options = (quote?.paymentOptions || []) as PaymentOption[];
  const option = options.find((item) => String(item?.payIn || '').toUpperCase() === payIn.toUpperCase());
  if (!option) {
    return {
      ready: false,
      detail: `${payIn} payment option not found in quote payment options`
    };
  }
  if (option.disabled === false) {
    return {
      ready: true,
      detail: `${payIn} payment option is enabled in quote`
    };
  }

  const reason = summarizeDisabled(option);
  return {
    ready: false,
    detail: reason ? `${payIn} present but disabled: ${reason}` : `${payIn} present but disabled`
  };
}

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

async function outboundTransferTest() {
  console.log('\n╔═════════════════════════════════════════════════════════════╗');
  console.log('║   WISE SEND ANYWHERE - OPERATOR REPORT                     ║');
  console.log('╚═════════════════════════════════════════════════════════════╝\n');

  console.log(`Environment: ${isSandbox ? 'SANDBOX' : 'PRODUCTION'}`);
  console.log(`Wise Base URL: ${wiseBaseUrl}`);
  console.log(`Local API Base URL: ${localApiBaseUrl}\n`);

  try {
    const ledgerResp = await fetch(`${localApiBaseUrl}/api/withdrawal/ledger/balance`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' }
    });

    let ledgerUsd = 0;
    let ledgerSource = 'file';
    if (ledgerResp.ok) {
      const ledgerData = await ledgerResp.json() as any;
      ledgerUsd = Number(ledgerData?.balances?.USD || 0);
      ledgerSource = 'api';
    } else {
      ledgerUsd = readLedgerUsdBalanceFromFile();
    }

    let profileId: number | null = null;
    let businessName = '';
    let wiseUsdBalance = 0;
    let directDebitState: PaymentOptionState = {
      ready: false,
      detail: 'Direct debit check not run'
    };
    let outboundBalanceState: PaymentOptionState = {
      ready: false,
      detail: 'Outbound balance check not run'
    };
    let configError = '';

    if (!wiseToken) {
      configError = 'WISE_API_TOKEN is missing.';
    } else {
      const headers = {
        Authorization: `Bearer ${wiseToken}`,
        'Content-Type': 'application/json'
      };

      const profilesRes = await fetch(`${wiseBaseUrl}/v1/profiles`, { method: 'GET', headers });
      if (!profilesRes.ok) {
        const err = await safeJson(profilesRes);
        configError = `Unable to load Wise profiles: ${JSON.stringify(err)}`;
      } else {
        const profiles = (await profilesRes.json()) as WiseProfile[];
        const business = profiles.find((profile) => profile.type === 'business');
        if (!business) {
          configError = 'No business profile found for token.';
        } else {
          profileId = business.id;
          businessName = String(business.details?.name || '').trim();

          const balancesRes = await fetch(`${wiseBaseUrl}/v4/profiles/${profileId}/balances?types=STANDARD`, {
            method: 'GET',
            headers
          });
          if (balancesRes.ok) {
            const balances = (await balancesRes.json()) as any[];
            wiseUsdBalance = Number(balances.find((balance: any) => balance.currency === 'USD')?.amount?.value || 0);
          }

          const directDebitQuoteRes = await fetch(`${wiseBaseUrl}/v3/profiles/${profileId}/quotes`, {
            method: 'POST',
            headers,
            body: JSON.stringify({
              sourceCurrency: 'USD',
              targetCurrency: 'USD',
              targetAmount: 100,
              profile: profileId,
              payInMethod: 'DIRECT_DEBIT'
            })
          });
          const directDebitQuote = await safeJson(directDebitQuoteRes);
          directDebitState = directDebitQuoteRes.ok
            ? getPaymentOptionState(directDebitQuote, 'DIRECT_DEBIT')
            : {
                ready: false,
                detail: `Quote request failed: ${JSON.stringify(directDebitQuote)}`
              };

          const outboundQuoteRes = await fetch(`${wiseBaseUrl}/v3/profiles/${profileId}/quotes`, {
            method: 'POST',
            headers,
            body: JSON.stringify({
              sourceCurrency: 'USD',
              targetCurrency: 'USD',
              sourceAmount: 10,
              profile: profileId
            })
          });
          const outboundQuote = await safeJson(outboundQuoteRes);
          outboundBalanceState = outboundQuoteRes.ok
            ? getPaymentOptionState(outboundQuote, 'BALANCE')
            : {
                ready: false,
                detail: `Quote request failed: ${JSON.stringify(outboundQuote)}`
              };
        }
      }
    }

    const outboundOperationalReady = outboundBalanceState.ready && wiseUsdBalance >= minimumTestAmount;
    const directDebitOperationalReady = directDebitState.ready;
    const tokenShape = detectTokenShape(wiseToken);
    const authModel = detectAuthModel();

    const blockers: string[] = [];
    if (configError) blockers.push('CONFIG_ERROR');
    if (!directDebitOperationalReady && !configError) blockers.push('DIRECT_DEBIT_UNAVAILABLE');
    if (!outboundOperationalReady && !configError) blockers.push('OUTBOUND_BALANCE_UNAVAILABLE');

    const overallStatus = blockers.length === 0
      ? 'GREEN'
      : (configError ? 'RED' : 'AMBER');

    console.log('Current State:');
    console.log(`  Wise Auth Model: ${authModel}`);
    console.log(`  Wise Token Shape: ${tokenShape}`);
    if (profileId !== null) {
      console.log(`  Wise Business Profile ID: ${profileId}`);
    }
    if (businessName) {
      console.log(`  Wise Business Name: ${businessName}`);
    }
    console.log(`  Wise USD Balance (rail): ${wiseUsdBalance}`);
    console.log(`  Ledger USD (source of truth, ${ledgerSource}): ${ledgerUsd}`);
    console.log(`  Direct debit rail: ${directDebitOperationalReady ? 'READY' : 'BLOCKED'}`);
    console.log(`  Direct debit detail: ${directDebitState.detail}`);
    console.log(`  Outbound balance rail: ${outboundOperationalReady ? 'READY' : 'BLOCKED'}`);
    console.log(`  Outbound detail: ${outboundBalanceState.detail}`);
    console.log('');

    console.log('Likely Root Causes & Prevention:');
    if (authModel === 'PERSONAL_API_TOKEN') {
      console.log('  - AUTH_MODE: Personal API token mode (SMB scope).');
      console.log('  - Prevention: for advanced partner flows (OAuth+mTLS+SCA/OTT), onboard OAuth client credentials in Developer Hub.');
    }
    if (tokenShape === 'JWT_OR_JWE') {
      console.log('  - TOKEN_FORMAT: OAuth/client-credentials token appears JWT/JWE-like.');
      console.log('  - Prevention: treat token as opaque string only; do not parse as UUID or enforce fixed length.');
    }
    if (configError) {
      console.log(`  - CONFIG_ERROR: ${configError}`);
      console.log('  - Prevention: verify WISE_API_TOKEN and profile permissions in config/.env.credentials.');
    }
    if (!directDebitOperationalReady && !configError) {
      console.log('  - DIRECT_DEBIT_UNAVAILABLE: Wise profile can quote direct debit but cannot execute funding.');
      console.log('  - Prevention: verify connected bank account mandate, regional eligibility, and profile funding permissions in Wise.');
    }
    if (!outboundOperationalReady && !configError) {
      console.log('  - OUTBOUND_BALANCE_UNAVAILABLE: BALANCE rail not currently fundable for immediate outbound.');
      if (wiseUsdBalance < minimumTestAmount) {
        console.log(`  - Prevention: keep Wise USD balance >= $${minimumTestAmount} before outbound tests.`);
      }
      console.log('  - Prevention: execute direct debit top-up first when BALANCE rail is disabled due insufficient eligible USD.');
    }
    if (directDebitOperationalReady && outboundOperationalReady && !configError) {
      console.log('  - No active Wise rail blockers detected.');
    }
    console.log('');

    console.log('Operational Runbook:');
    console.log('  1. Run readiness: npm run test:wise-readiness');
    console.log('  2. Run direct debit E2E: npm exec tsx test-wise-e2e.ts');
    console.log('  3. Run outbound E2E: npm run test:wise-outbound-e2e');
    console.log('  4. Validate transfer status: GET /api/withdrawal/wise-status/:transferId');
    console.log('  5. Run full operator gate: npm run test:wise-production-suite');
    console.log('');

    console.log('Security & Integrity Guards:');
    console.log('  - Ledger remains the source of truth for amount and balance authority');
    console.log('  - Outbound request amount must match ledger transaction amount');
    console.log('  - Production auth is enforced (test bypass requires explicit non-production flag)');
    console.log('');

    console.log('Operator Verdict:');
    console.log(`  Status: ${overallStatus}`);
    console.log(`  Blockers: ${blockers.length > 0 ? blockers.join(', ') : 'NONE'}`);

    const jsonMode = process.argv.includes('--json');
    if (jsonMode) {
      console.log(JSON.stringify({
        environment: isSandbox ? 'sandbox' : 'production',
        wiseBaseUrl,
        localApiBaseUrl,
        profileId,
        businessName,
        wiseUsdBalance,
        ledgerUsd,
        ledgerSource,
        directDebitOperationalReady,
        outboundOperationalReady,
        authModel,
        tokenShape,
        directDebitDetail: directDebitState.detail,
        outboundDetail: outboundBalanceState.detail,
        blockers,
        status: overallStatus
      }));
    }

    console.log('\nStatus Utility Complete.');

  } catch (err: any) {
    console.error('Error:', err.message);
    process.exitCode = 1;
  }
}

outboundTransferTest().catch(console.error);
