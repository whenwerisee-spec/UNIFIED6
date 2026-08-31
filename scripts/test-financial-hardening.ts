import assert from 'node:assert/strict';
import {
  canCoverWithdrawal,
  convertCadToUsd,
  DEFAULT_USD_CAD_RATE,
  isWithinRateTolerance,
  resolveFxRateFromPayload
} from '../src/lib/financial-hardening.ts';

const amountUsd = convertCadToUsd(1000, DEFAULT_USD_CAD_RATE);
assert.equal(amountUsd, 734.11);

assert.equal(canCoverWithdrawal(100, 99.995, 0.01), true);
assert.equal(canCoverWithdrawal(100, 99.98, 0.01), false);
assert.equal(isWithinRateTolerance(1.3622, 1.3690, 0.01), true);
assert.equal(isWithinRateTolerance(1.3622, 1.3760, 0.01), false);
assert.equal(resolveFxRateFromPayload('1.3622'), 1.3622);
assert.equal(resolveFxRateFromPayload(undefined), DEFAULT_USD_CAD_RATE);

console.log('financial hardening regression checks passed');
