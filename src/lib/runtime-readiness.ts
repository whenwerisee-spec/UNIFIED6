import { getCriticalOperationsEnforcementState } from './critical-operations-enforcer.js';

export interface RuntimeReadinessReport {
  isReady: boolean;
  missingConfig: string[];
  checks: Array<{
    name: string;
    status: 'configured' | 'missing' | 'safe' | 'unsafe';
    details?: string;
  }>;
}

function hasExchangeProviderConfigured(env: NodeJS.ProcessEnv): boolean {
  return Boolean(
    (env.COINBASE_API_KEY_ID && env.COINBASE_API_SECRET_RAW) ||
    (env.KRAKEN_API_KEY && env.KRAKEN_API_SECRET)
  );
}

function hasEmailProviderConfigured(env: NodeJS.ProcessEnv): boolean {
  return Boolean(
    env.MAILERSEND_API_KEY ||
    (env.SMTP_HOST && env.SMTP_USER && env.SMTP_PASS)
  );
}

function hasAtmProviderConfigured(env: NodeJS.ProcessEnv): boolean {
  return Boolean(
    env.ATM_ENABLE_LIVE_OPERATIONS === 'true' &&
    env.ATM_NETWORK &&
    env.ATM_PROVIDER_API_URL &&
    env.ATM_PROVIDER_API_KEY &&
    env.ATM_PROVIDER_MERCHANT_ID &&
    env.ATM_PROVIDER_WEBHOOK_SECRET
  );
}

export async function buildRuntimeReadinessReport(env: NodeJS.ProcessEnv): Promise<RuntimeReadinessReport> {
  const missingConfig: string[] = [];

  if (!env.SOVEREIGN_ENCRYPTION_KEY || env.SOVEREIGN_ENCRYPTION_KEY.trim().length < 32) {
    missingConfig.push('SOVEREIGN_ENCRYPTION_KEY(>=32 chars)');
  }
  if (!env.JWT_SECRET || env.JWT_SECRET.trim().length < 32) {
    missingConfig.push('JWT_SECRET(>=32 chars)');
  }
  if (!env.MARSHALL_WALLET_PRIVATE_KEY) {
    missingConfig.push('MARSHALL_WALLET_PRIVATE_KEY');
  }
  if (!hasExchangeProviderConfigured(env)) {
    missingConfig.push('Coinbase or Kraken exchange API credentials');
  }
  if (!hasEmailProviderConfigured(env)) {
    missingConfig.push('MAILERSEND_API_KEY or SMTP credentials');
  }
  if (!env.SOVEREIGN_ADMIN_EMAILS || !env.SOVEREIGN_ADMIN_EMAILS.trim()) {
    missingConfig.push('SOVEREIGN_ADMIN_EMAILS');
  }
  if (!hasAtmProviderConfigured(env)) {
    missingConfig.push('ATM provider configuration (disabled until explicitly enabled)');
  }

  const enforcementState = getCriticalOperationsEnforcementState();
  const enforcementSafe = enforcementState.requiresVerifiedExternalProof && enforcementState.moneyMovingOperationsBlockedUntilVerified;

  const checks: RuntimeReadinessReport['checks'] = [
    {
      name: 'SOVEREIGN_ENCRYPTION_KEY',
      status: env.SOVEREIGN_ENCRYPTION_KEY && env.SOVEREIGN_ENCRYPTION_KEY.trim().length >= 32 ? 'configured' : 'missing'
    },
    {
      name: 'JWT_SECRET',
      status: env.JWT_SECRET && env.JWT_SECRET.trim().length >= 32 ? 'configured' : 'missing'
    },
    {
      name: 'MARSHALL_WALLET_PRIVATE_KEY',
      status: env.MARSHALL_WALLET_PRIVATE_KEY ? 'configured' : 'missing'
    },
    {
      name: 'Exchange credentials',
      status: hasExchangeProviderConfigured(env) ? 'configured' : 'missing'
    },
    {
      name: 'Email credentials',
      status: hasEmailProviderConfigured(env) ? 'configured' : 'missing'
    },
    {
      name: 'Admin emails',
      status: env.SOVEREIGN_ADMIN_EMAILS && env.SOVEREIGN_ADMIN_EMAILS.trim() ? 'configured' : 'missing'
    },
    {
      name: 'Bitcoin ATM provider',
      status: hasAtmProviderConfigured(env) ? 'configured' : 'missing',
      details: hasAtmProviderConfigured(env)
        ? 'Live ATM operations are explicitly enabled with provider credentials and webhook verification.'
        : 'ATM live operations are disabled until an operator API, merchant ID, webhook secret, and explicit enablement are configured.'
    },
    {
      name: 'Financial proof enforcement',
      status: enforcementSafe ? 'safe' : 'unsafe',
      details: enforcementSafe
        ? 'Money-moving routes require verified external proof before success is reported.'
        : 'Financial proof enforcement is not active.'
    }
  ];

  return {
    isReady: missingConfig.length === 0 && enforcementSafe,
    missingConfig,
    checks
  };
}
