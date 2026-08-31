/**
 * CRITICAL SAFETY MODULE: Environment Safety Guard
 * 
 * Prevents destructive operations (clear, reset, seed, drop) from executing
 * on anything that resembles a production or persistent database unless
 * explicitly configured and environment-verified.
 * 
 * This module acts as a hard kill-switch enforced at operation boundaries,
 * not as advisory validation. If ANY ambiguity exists about environment safety,
 * operations MUST NOT proceed.
 * 
 * Fail-closed principle: When in doubt, block the operation.
 */

export interface EnvironmentSafetyCheckOptions {
  operationType: 'clear' | 'reset' | 'seed' | 'drop' | 'truncate';
  targetPath: string;
  targetName?: string;
  explicitlyAllowed?: boolean;
  forceAllowInProduction?: string; // Secret phrase required to override in production
}

export interface EnvironmentCheckResult {
  isSafe: boolean;
  reason: string;
  environment: 'production' | 'development' | 'test' | 'unknown';
  isDestructiveOperation: boolean;
  pathIndicatesProduction: boolean;
  envVarIndicatesProduction: boolean;
}

/**
 * Core safety check that MUST pass before any destructive operation.
 * This is the single authoritative gate for environment verification.
 */
export function verifyEnvironmentSafetyForDestructiveOperation(
  options: EnvironmentSafetyCheckOptions
): EnvironmentCheckResult {
  const {
    operationType,
    targetPath,
    targetName,
    explicitlyAllowed = false,
    forceAllowInProduction,
  } = options;

  const result: EnvironmentCheckResult = {
    isSafe: false,
    reason: '',
    environment: 'unknown',
    isDestructiveOperation: ['clear', 'reset', 'seed', 'drop', 'truncate'].includes(operationType),
    pathIndicatesProduction: false,
    envVarIndicatesProduction: false,
  };

  // Step 1: Determine environment from NODE_ENV
  const nodeEnv = (process.env.NODE_ENV || '').toLowerCase();
  result.envVarIndicatesProduction = nodeEnv === 'production' || nodeEnv === 'prod';
  
  if (nodeEnv === 'production' || nodeEnv === 'prod') {
    result.environment = 'production';
  } else if (nodeEnv === 'test' || nodeEnv === 'testing') {
    result.environment = 'test';
  } else if (nodeEnv === 'development' || nodeEnv === 'dev' || !nodeEnv) {
    result.environment = 'development';
  }

  // Step 2: Analyze path for production indicators
  const pathLower = targetPath.toLowerCase();
  const productionPathIndicators = [
    'production',
    'prod',
    'live',
    'appdata',
    'documents',
    'users/winnneer', // User's personal data directories
    'downloads',
    'desktop',
  ];

  result.pathIndicatesProduction = productionPathIndicators.some(indicator =>
    pathLower.includes(indicator)
  );

  // Step 3: REJECT if destructive operation AND any production indicator
  if (result.isDestructiveOperation) {
    // In production environment, ALWAYS reject unless special override provided
    if (result.envVarIndicatesProduction) {
      result.isSafe = false;
      result.reason = `BLOCKED: Cannot execute ${operationType} in PRODUCTION environment. Destructive operations are forbidden in production.`;
      return result;
    }

    // Path-based production detection: REJECT destructive ops on any production-like paths
    if (result.pathIndicatesProduction) {
      result.isSafe = false;
      result.reason = `BLOCKED: Target path "${targetPath}" appears to be production/personal data. Destructive operations (${operationType}) are forbidden on production-like paths unless in verified test environment with explicit allowlist.`;
      return result;
    }

    // Development environment: Still require explicit allowlist for destructive ops
    // to prevent accidents even in dev
    if (!explicitlyAllowed) {
      result.isSafe = false;
      result.reason = `BLOCKED: Destructive operation (${operationType}) requires explicit allowlist entry. Set explicitlyAllowed=true only if you have verified this is a safe target.`;
      return result;
    }
  }

  // Step 4: Non-destructive operations - generally safe
  if (!result.isDestructiveOperation) {
    result.isSafe = true;
    result.reason = `Safe operation: ${operationType} is not destructive.`;
    return result;
  }

  // Step 5: If we reached here, it's a destructive operation that passed checks
  result.isSafe = true;
  result.reason = `Allowed: Destructive operation ${operationType} approved (development environment, explicit allowlist, non-production path).`;
  return result;
}

/**
 * Convenience function to assert environment safety before executing destructive ops.
 * Throws if operation is unsafe.
 */
export function assertEnvironmentSafeForDestructiveOperation(
  options: EnvironmentSafetyCheckOptions
): void {
  const check = verifyEnvironmentSafetyForDestructiveOperation(options);
  
  if (!check.isSafe) {
    throw new Error(
      `[ENVIRONMENT SAFETY VIOLATION] ${check.reason}\n` +
      `Environment: ${check.environment}\n` +
      `Target: ${options.targetPath}\n` +
      `Operation: ${options.operationType}\n` +
      `Destructive: ${check.isDestructiveOperation}\n\n` +
      `This operation has been BLOCKED for your protection. ` +
      `If this is intentional, verify you are in a development/test environment ` +
      `and use explicit allowlist flags.`
    );
  }
}

/**
 * Generate a test harness verification for test suites.
 * Ensures safety checks are working correctly.
 */
export function createEnvironmentSafetyTestHarness() {
  return {
    testProductionReject: () => {
      const result = verifyEnvironmentSafetyForDestructiveOperation({
        operationType: 'clear',
        targetPath: '/Users/winnneer/Downloads/test.json',
        explicitlyAllowed: true,
      });
      
      // In production, should always reject
      if (process.env.NODE_ENV === 'production') {
        if (result.isSafe) {
          throw new Error('SAFETY TEST FAILED: Production environment should reject destructive ops');
        }
      }
    },

    testPathDetection: () => {
      const result = verifyEnvironmentSafetyForDestructiveOperation({
        operationType: 'clear',
        targetPath: '/Users/winnneer/AppData/database.json',
        explicitlyAllowed: true,
      });
      
      // User path should be detected as production-like
      if (!result.pathIndicatesProduction) {
        throw new Error('SAFETY TEST FAILED: User path should be detected as production');
      }
    },

    testAllowlistRequired: () => {
      const result = verifyEnvironmentSafetyForDestructiveOperation({
        operationType: 'clear',
        targetPath: '/tmp/test.json',
        explicitlyAllowed: false,
      });
      
      // Without allowlist, should reject even in /tmp
      if (result.isSafe) {
        throw new Error('SAFETY TEST FAILED: Destructive ops should require explicit allowlist');
      }
    },
  };
}
