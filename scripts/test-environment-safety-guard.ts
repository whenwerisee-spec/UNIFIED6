/**
 * Comprehensive test suite for environment-safety-guard.ts
 * Verifies that destructive operations are properly blocked based on environment
 */

import { 
  verifyEnvironmentSafetyForDestructiveOperation,
  assertEnvironmentSafeForDestructiveOperation 
} from '../src/lib/environment-safety-guard.js';

console.log('🔐 ENVIRONMENT SAFETY GUARD TEST SUITE\n');

const tests: Array<{
  name: string;
  fn: () => boolean;
}> = [];

// TEST 1: Destructive ops on user paths should be rejected
tests.push({
  name: 'Reject destructive op on user personal data path',
  fn: () => {
    const result = verifyEnvironmentSafetyForDestructiveOperation({
      operationType: 'clear',
      targetPath: '/Users/winnneer/Downloads/database.json',
      explicitlyAllowed: true, // Even with allowlist
    });
    return !result.isSafe && result.pathIndicatesProduction;
  }
});

// TEST 2: Destructive ops without allowlist should be rejected
tests.push({
  name: 'Reject destructive op without explicit allowlist',
  fn: () => {
    const result = verifyEnvironmentSafetyForDestructiveOperation({
      operationType: 'reset',
      targetPath: '/tmp/test.json',
      explicitlyAllowed: false,
    });
    return !result.isSafe;
  }
});

// TEST 3: Non-destructive ops should generally be allowed
tests.push({
  name: 'Allow non-destructive read operations',
  fn: () => {
    const result = verifyEnvironmentSafetyForDestructiveOperation({
      operationType: 'read' as any,
      targetPath: '/any/path/file.json',
      explicitlyAllowed: false,
    });
    return result.isSafe && !result.isDestructiveOperation;
  }
});

// TEST 4: Production environment should always reject
tests.push({
  name: 'Production env should reject all destructive ops',
  fn: () => {
    const originalEnv = process.env.NODE_ENV;
    try {
      process.env.NODE_ENV = 'production';
      const result = verifyEnvironmentSafetyForDestructiveOperation({
        operationType: 'drop',
        targetPath: '/tmp/test.json',
        explicitlyAllowed: true,
      });
      return !result.isSafe && result.environment === 'production';
    } finally {
      process.env.NODE_ENV = originalEnv;
    }
  }
});

// TEST 5: Destructive ops with allowlist in dev should work
tests.push({
  name: 'Allow destructive op in dev with allowlist on safe path',
  fn: () => {
    const originalEnv = process.env.NODE_ENV;
    try {
      process.env.NODE_ENV = 'development';
      const result = verifyEnvironmentSafetyForDestructiveOperation({
        operationType: 'seed',
        targetPath: '/tmp/test_db.json',
        explicitlyAllowed: true,
      });
      return result.isSafe && !result.pathIndicatesProduction;
    } finally {
      process.env.NODE_ENV = originalEnv;
    }
  }
});

// TEST 6: Path detection should catch user directories
tests.push({
  name: 'Detect production paths (user directories)',
  fn: () => {
    const result = verifyEnvironmentSafetyForDestructiveOperation({
      operationType: 'clear',
      targetPath: 'c:\\Users\\WINNNEER\\AppData\\database.json',
      explicitlyAllowed: true,
    });
    return result.pathIndicatesProduction;
  }
});

// TEST 7: assertEnvironmentSafeForDestructiveOperation should throw
tests.push({
  name: 'assertEnvironmentSafeForDestructiveOperation throws on unsafe',
  fn: () => {
    try {
      assertEnvironmentSafeForDestructiveOperation({
        operationType: 'clear',
        targetPath: '/Users/winnneer/Downloads/data.json',
        explicitlyAllowed: true,
      });
      return false; // Should have thrown
    } catch (error: any) {
      return error.message.includes('ENVIRONMENT SAFETY VIOLATION');
    }
  }
});

// TEST 8: Multiple destructive operation types should be detected
tests.push({
  name: 'Detect all destructive operation types',
  fn: () => {
    const types = ['clear', 'reset', 'seed', 'drop', 'truncate'] as const;
    return types.every(type => {
      const result = verifyEnvironmentSafetyForDestructiveOperation({
        operationType: type,
        targetPath: '/Users/winnneer/test.json',
        explicitlyAllowed: true,
      });
      return result.isDestructiveOperation && !result.isSafe;
    });
  }
});

// TEST 9: Documents and Desktop paths should be detected
tests.push({
  name: 'Detect production paths (Documents, Desktop)',
  fn: () => {
    const paths = [
      '/Users/winnneer/Documents/data.json',
      'C:\\Users\\WINNNEER\\Desktop\\db.json',
      'c:\\users\\winnneer\\documents\\ledger.json',
    ];
    return paths.every(targetPath => {
      const result = verifyEnvironmentSafetyForDestructiveOperation({
        operationType: 'clear',
        targetPath,
        explicitlyAllowed: true,
      });
      return result.pathIndicatesProduction && !result.isSafe;
    });
  }
});

// TEST 10: Test environment should reject destructive ops like production
tests.push({
  name: 'Test environment should be treated as dev (explicit allowlist required)',
  fn: () => {
    const originalEnv = process.env.NODE_ENV;
    try {
      process.env.NODE_ENV = 'test';
      const result = verifyEnvironmentSafetyForDestructiveOperation({
        operationType: 'seed',
        targetPath: '/tmp/test.json',
        explicitlyAllowed: false,
      });
      return !result.isSafe && result.environment === 'test';
    } finally {
      process.env.NODE_ENV = originalEnv;
    }
  }
});

// Run all tests
let passed = 0;
let failed = 0;

for (const test of tests) {
  try {
    const result = test.fn();
    if (result) {
      console.log(`✅ PASS: ${test.name}`);
      passed++;
    } else {
      console.log(`❌ FAIL: ${test.name}`);
      failed++;
    }
  } catch (error: any) {
    console.log(`❌ FAIL: ${test.name}`);
    console.log(`   Error: ${error.message}`);
    failed++;
  }
}

console.log(`\n📊 RESULTS: ${passed} passed, ${failed} failed out of ${tests.length} tests`);

if (failed > 0) {
  process.exit(1);
}

console.log('\n✨ All environment safety tests passed!');
console.log('🔒 Destructive operations are properly gated and protected.');
