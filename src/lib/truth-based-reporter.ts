/**
 * Truth-Based Test Report Generator
 * 
 * Only reports VERIFIED results with external proof.
 * Replaces all "PRODUCTION READY" self-declarations with actual verification status.
 */

import { TestResult, VerificationStatus } from './external-verification.js';

export interface TestCategory {
  name: string;
  tests: TestResult[];
}

export interface VerificationReport {
  generatedAt: string;
  environment: string;
  internalTestsPassed: number;
  externalVerified: number;
  incomplete: number;
  failed: number;
  totalTests: number;
  categories: TestCategory[];
  finalStatus: 'VERIFIED' | 'NOT VERIFIED' | 'INCOMPLETE';
  notes: string[];
}

/**
 * Generate truth-based report from test results
 */
export function generateVerificationReport(
  categories: TestCategory[],
  environment: string = 'production',
): VerificationReport {
  let internalPassed = 0;
  let externalVerified = 0;
  let incomplete = 0;
  let failed = 0;
  const notes: string[] = [];

  for (const category of categories) {
    for (const test of category.tests) {
      if (test.internalResult.success) {
        internalPassed++;
      }

      if (test.verdict === 'PASS') {
        externalVerified++;
      } else if (test.verdict === 'INCOMPLETE') {
        incomplete++;
      } else if (test.verdict === 'FAIL') {
        failed++;
      }
    }
  }

  const totalTests = internalPassed + incomplete + failed;

  // Determine final status based on actual verification
  let finalStatus: 'VERIFIED' | 'NOT VERIFIED' | 'INCOMPLETE';
  if (failed > 0) {
    finalStatus = 'NOT VERIFIED';
  } else if (incomplete > 0) {
    finalStatus = 'INCOMPLETE';
  } else if (externalVerified === totalTests && totalTests > 0) {
    finalStatus = 'VERIFIED';
  } else {
    finalStatus = 'NOT VERIFIED';
  }

  // Add status notes
  if (incomplete > 0) {
    notes.push(
      `⚠️  ${incomplete} test(s) are INCOMPLETE - external verification pending or unavailable`,
    );
  }

  if (failed > 0) {
    notes.push(
      `❌ ${failed} test(s) FAILED - external verification could not be obtained`,
    );
  }

  if (externalVerified === 0 && totalTests > 0) {
    notes.push(
      '⚠️  NO external verifications obtained yet - tests are marked INCOMPLETE',
    );
  }

  if (externalVerified > 0) {
    notes.push(
      `✅ ${externalVerified} test(s) have external proof of verification`,
    );
  }

  // Critical note about report
  if (finalStatus !== 'VERIFIED') {
    notes.push(
      '❗ This system CANNOT claim "PRODUCTION READY" without VERIFIED status.',
    );
  }

  return {
    generatedAt: new Date().toISOString(),
    environment,
    internalTestsPassed: internalPassed,
    externalVerified,
    incomplete,
    failed,
    totalTests,
    categories,
    finalStatus,
    notes,
  };
}

/**
 * Format verification report as markdown
 */
export function formatReportAsMarkdown(report: VerificationReport): string {
  let markdown = `# 🔍 VERIFICATION REPORT (TRUTH-BASED)

**Generated:** ${new Date(report.generatedAt).toLocaleString()}  
**Environment:** ${report.environment}

---

## Summary

| Metric | Count |
|--------|-------|
| Internal Tests Passed | ${report.internalTestsPassed} |
| External Verified | ${report.externalVerified} |
| Incomplete | ${report.incomplete} |
| Failed | ${report.failed} |
| **Total Tests** | **${report.totalTests}** |

---

## Final Status

### **${report.finalStatus}**

${report.finalStatus === 'VERIFIED' 
  ? '✅ All tests have external verification. System status is VERIFIED.' 
  : report.finalStatus === 'INCOMPLETE'
  ? '⚠️  Some tests lack external verification. System status is INCOMPLETE.'
  : '❌ Tests failed external verification. System status is NOT VERIFIED.'}

---

## Status Notes

${report.notes.map(note => `- ${note}`).join('\n')}

---

## Critical Rules

> **A test is ONLY PASS if BOTH:**
> 1. \`internalResult.success === true\`
> 2. \`externalProof.status === "verified"\`

> **If externalProof is missing:**
> - Verdict = \`INCOMPLETE\`
> - Test counts as "pending external verification"

> **This system CANNOT claim:**
> - "PRODUCTION READY" (unless finalStatus = VERIFIED)
> - "ALL SYSTEMS PASS" (unless externalVerified = totalTests)
> - "REAL-WORLD CONFIRMED" (without external proof attached)

---

## Test Breakdown by Category

`;

  for (const category of report.categories) {
    const categoryPass = category.tests.filter(t => t.verdict === 'PASS').length;
    const categoryIncomplete = category.tests.filter(t => t.verdict === 'INCOMPLETE').length;
    const categoryFail = category.tests.filter(t => t.verdict === 'FAIL').length;

    markdown += `### ${category.name}

| Status | Count |
|--------|-------|
| ✅ PASS | ${categoryPass} |
| ⏳ INCOMPLETE | ${categoryIncomplete} |
| ❌ FAIL | ${categoryFail} |
| **Total** | **${category.tests.length}** |

`;

    // List individual tests
    for (const test of category.tests) {
      const verdict = test.verdict === 'PASS' ? '✅' : test.verdict === 'INCOMPLETE' ? '⏳' : '❌';
      const externalType = test.externalProof?.type || 'none';
      const externalStatus = test.externalProof?.status || 'pending';
      const refId = test.externalProof?.referenceId || 'N/A';

      markdown += `- ${verdict} **${test.internalResult.data?.name || 'Test'}**
  - Internal: ${test.internalResult.success ? '✓' : '✗'}
  - External: ${externalType} (${externalStatus})
  - Ref ID: \`${refId}\`
`;

      if (test.reason) {
        markdown += `  - Note: ${test.reason}\n`;
      }
    }

    markdown += '\n';
  }

  return markdown;
}

/**
 * Format verification report as JSON
 */
export function formatReportAsJson(report: VerificationReport): string {
  return JSON.stringify(report, null, 2);
}

/**
 * Validate that report satisfies safety rules
 */
export function validateReport(report: VerificationReport): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  // Check for invalid claim attempts
  const claimMessage = `SAFETY VIOLATION: Cannot claim "PRODUCTION READY" without finalStatus = "VERIFIED"`;
  
  if (report.finalStatus !== 'VERIFIED' && report.notes.some(n => n.includes('PRODUCTION READY'))) {
    errors.push(claimMessage);
  }

  // All PASS tests must have external proof
  for (const category of report.categories) {
    for (const test of category.tests) {
      if (test.verdict === 'PASS' && !test.externalProof) {
        errors.push(
          `SAFETY VIOLATION: Test marked PASS without external proof in category "${category.name}"`,
        );
      }
    }
  }

  // Incomplete tests should not be reported as verified
  if (report.incomplete > 0 && report.finalStatus === 'VERIFIED') {
    errors.push('SAFETY VIOLATION: Cannot be VERIFIED when incomplete tests exist');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Export report to file
 */
export async function exportReport(
  report: VerificationReport,
  filePath: string,
  format: 'markdown' | 'json' = 'markdown',
): Promise<void> {
  const content = format === 'markdown' 
    ? formatReportAsMarkdown(report)
    : formatReportAsJson(report);

  const fs = await import('fs').then(m => m.promises);
  const tempFilePath = `${filePath}.tmp`;
  await fs.writeFile(tempFilePath, content, 'utf-8');
  await fs.rename(tempFilePath, filePath);
}
