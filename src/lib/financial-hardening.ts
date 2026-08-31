export const DEFAULT_USD_CAD_RATE = 1.3622;
export const FX_RATE_TOLERANCE = 0.01;
export const CURRENCY_EPSILON = 0.01;

export const normalizeCurrency = (value: number) => Math.round(value * 100) / 100;

export const convertCadToUsd = (cad: number, usdCadRate: number) => normalizeCurrency(cad / usdCadRate);

export const convertUsdToCad = (usd: number, usdCadRate: number) => normalizeCurrency(usd * usdCadRate);

export const resolveFxRateFromPayload = (rawRate: unknown, fallbackRate: number = DEFAULT_USD_CAD_RATE) => {
  const parsed = typeof rawRate === 'string' ? Number(rawRate) : typeof rawRate === 'number' ? rawRate : NaN;
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallbackRate;
  }
  return parsed;
};

export const isWithinRateTolerance = (observedRate: number, serverRate: number, tolerance: number = FX_RATE_TOLERANCE) => {
  const delta = Math.abs(observedRate - serverRate);
  return delta <= tolerance;
};

export const canCoverWithdrawal = (withdrawalUsd: number, availableUsd: number, epsilon: number = CURRENCY_EPSILON) => {
  return withdrawalUsd <= availableUsd + epsilon;
};
