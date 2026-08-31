export function validateBankWithdrawalRequest({ amount, bankId, operationType } = {}, registry = {}) {
  const numeric = Number(amount);
  if (!amount || Number.isNaN(numeric) || numeric <= 0) {
    return { valid: false, error: 'INVALID_AMOUNT' };
  }

  if (operationType !== 'WITHDRAWAL') {
    return { valid: false, error: 'INVALID_OPERATION' };
  }

  if (!bankId || typeof registry !== 'object' || !registry[bankId]) {
    return { valid: false, error: 'UNKNOWN_BANK' };
  }

  return { valid: true };
}

export default validateBankWithdrawalRequest;
