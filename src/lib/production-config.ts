export interface ProductionSecretValidationResult {
  ok: boolean;
  errors: string[];
  warnings: string[];
}

export interface ProductionSecretValidationOptions {
  requireProviderSecrets?: boolean;
  operation?: 'wallet' | 'exchange' | 'email' | 'sms' | 'settlement' | 'withdrawal' | 'atm';
}

function hasValue(value: string | undefined): boolean {
  return typeof value === 'string' && value.trim().length > 0;
}

function isStrongSecret(value: string | undefined, minLength = 32): boolean {
  return hasValue(value) && value.trim().length >= minLength;
}

function validateProviderSecrets(env: NodeJS.ProcessEnv, operation: ProductionSecretValidationOptions['operation'], requireProviderSecrets: boolean): string[] {
  if (!requireProviderSecrets) {
    return [];
  }

  if (operation === 'wallet') {
    return !isStrongSecret(env.MARSHALL_WALLET_PRIVATE_KEY, 32)
      ? ['MARSHALL_WALLET_PRIVATE_KEY is required for wallet operations in production.']
      : [];
  }

  if (operation === 'exchange') {
    const hasCoinbase = isStrongSecret(env.COINBASE_API_KEY_ID, 8) && isStrongSecret(env.COINBASE_API_SECRET_RAW, 8);
    const hasKraken = isStrongSecret(env.KRAKEN_API_KEY, 8) && isStrongSecret(env.KRAKEN_API_SECRET, 8);
    if (!hasCoinbase && !hasKraken) {
      return ['At least one exchange provider must be fully configured for exchange operations in production (Coinbase or Kraken).'];
    }
    return [];
  }

  if (operation === 'settlement' || operation === 'withdrawal' || operation === 'atm') {
    const hasCoinbase = isStrongSecret(env.COINBASE_API_KEY_ID, 8) && isStrongSecret(env.COINBASE_API_SECRET_RAW, 8);
    const hasKraken = isStrongSecret(env.KRAKEN_API_KEY, 8) && isStrongSecret(env.KRAKEN_API_SECRET, 8);
    if (!hasCoinbase && !hasKraken) {
      return ['A settlement provider must be configured for production settlement operations.'];
    }
    return [];
  }

  if (operation === 'email') {
    return !isStrongSecret(env.MAILERSEND_API_KEY, 8) && !(hasValue(env.SMTP_HOST) && hasValue(env.SMTP_USER) && hasValue(env.SMTP_PASS))
      ? ['An email provider must be configured for production email delivery.']
      : [];
  }

  if (operation === 'sms') {
    return !isStrongSecret(env.TWILIO_AUTH_TOKEN, 8) && !isStrongSecret(env.MAILERSEND_API_KEY, 8)
      ? ['An SMS provider must be configured for production SMS delivery.']
      : [];
  }

  return [];
}

export function validateProductionSecrets(
  env: NodeJS.ProcessEnv = process.env,
  options: ProductionSecretValidationOptions = {},
): ProductionSecretValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  const isProduction = String(env.NODE_ENV || '').trim() === 'production';
  if (!isProduction) {
    return { ok: true, errors: [], warnings: [] };
  }

  if (!isStrongSecret(env.SOVEREIGN_ENCRYPTION_KEY, 32)) {
    errors.push('SOVEREIGN_ENCRYPTION_KEY is required and must be at least 32 characters in production.');
  }

  if (!isStrongSecret(env.JWT_SECRET, 32)) {
    errors.push('JWT_SECRET is required and must be at least 32 characters in production.');
  }

  if (!hasValue(env.SOVEREIGN_ADMIN_EMAILS)) {
    errors.push('SOVEREIGN_ADMIN_EMAILS is required in production.');
  }

  const providerErrors = validateProviderSecrets(env, options.operation, Boolean(options.requireProviderSecrets));
  errors.push(...providerErrors);

  return { ok: errors.length === 0, errors, warnings };
}

export function validateLiveOperationConfig(
  env: NodeJS.ProcessEnv = process.env,
  operation: ProductionSecretValidationOptions['operation'] = 'wallet',
): ProductionSecretValidationResult {
  return validateProductionSecrets(env, { requireProviderSecrets: true, operation });
}
