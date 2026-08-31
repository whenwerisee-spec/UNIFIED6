import assert from 'assert';
import { createTestResult, type ProofObject } from '../src/lib/external-verification.js';
import { isFinancialOperationVerified } from '../src/lib/critical-operations-enforcer.js';

function run() {
  const pendingProof: ProofObject = {
    type: 'blockchain',
    status: 'pending',
    referenceId: '0xabc',
    rawResponse: { status: '0' },
    timestamp: new Date().toISOString()
  };
  const pendingResult = createTestResult(true, { txHash: '0xabc' }, pendingProof);
  assert.equal(isFinancialOperationVerified(pendingResult), false);

  const verifiedProof: ProofObject = {
    type: 'blockchain',
    status: 'verified',
    referenceId: '0xabc',
    rawResponse: { status: '1', confirmations: 3 },
    timestamp: new Date().toISOString()
  };
  const verifiedResult = createTestResult(true, { txHash: '0xabc' }, verifiedProof);
  assert.equal(isFinancialOperationVerified(verifiedResult), true);

  console.log('financial proof hardening tests passed');
}

run();
