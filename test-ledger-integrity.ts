import { db } from './src/db/ledger.js';

function main() {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('  LEDGER INTEGRITY CHECK');
  console.log('═══════════════════════════════════════════════════════════');

  const report = db.getIntegrityReport();

  console.log(`Generated: ${report.generatedAt}`);
  console.log(`Users: ${report.counts.users}`);
  console.log(`Wallets: ${report.counts.wallets}`);
  console.log(`Transactions: ${report.counts.transactions}`);
  console.log(`Audit Logs: ${report.counts.auditLogs}`);
  console.log(`Errors: ${report.errors.length}`);
  console.log(`Warnings: ${report.warnings.length}`);

  if (report.errors.length > 0) {
    console.log('');
    console.log('Critical Findings:');
    for (const finding of report.errors.slice(0, 25)) {
      console.log(`  - [${finding.code}] ${finding.message}`);
    }
  }

  if (report.warnings.length > 0) {
    console.log('');
    console.log('Warnings:');
    for (const finding of report.warnings.slice(0, 25)) {
      console.log(`  - [${finding.code}] ${finding.message}`);
    }
  }

  if (!report.ok) {
    process.exitCode = 1;
    console.error('Ledger integrity status: FAIL');
    return;
  }

  console.log('Ledger integrity status: PASS');
}

main();
