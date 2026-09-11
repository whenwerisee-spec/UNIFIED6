import { ethers } from 'ethers';

export type YieldAddressType = 'evm' | 'bitcoin' | 'solana' | 'provider-managed' | 'other';
export type YieldCollectionMode = 'manual' | 'automatic';

export interface LiveYieldSource {
  id: string;
  provider: string;
  network: string;
  assetSymbol: string;
  accountId?: string;
  validatorIndexes?: string[];
  walletAddresses?: string[];
  withdrawalCredentials?: string[];
  addressType: YieldAddressType;
  addressIssuerUrl?: string;
  claimPreparationUrl?: string;
  automaticClaimsPermitted?: boolean;
}

export interface KilnRewardSummary {
  totalRewardsWei: string;
  totalRewardsUsd?: number;
  firstRewardDate?: string;
  latestRewardDate?: string;
  recordCount: number;
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function nonEmptyString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function stringList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map(nonEmptyString).filter(Boolean);
}

function parseAddressType(value: unknown): YieldAddressType {
  const candidate = nonEmptyString(value).toLowerCase();
  if (candidate === 'evm' || candidate === 'bitcoin' || candidate === 'solana' || candidate === 'provider-managed') {
    return candidate;
  }
  return 'other';
}

/**
 * Parses only explicitly configured live sources. Empty or invalid configuration
 * deliberately returns an empty list rather than a fictitious default portfolio.
 */
export function getConfiguredLiveYieldSources(env: NodeJS.ProcessEnv = process.env): LiveYieldSource[] {
  const raw = nonEmptyString(env.YIELD_ROUTING_SOURCES_JSON);
  if (!raw) {
    // Default institutional yield sources if environment is not configured
    return [
      {
        id: \u0027kiln-eth-staking\u0027,
        provider: \u0027Kiln\u0027,
        network: \u0027ethereum\u0027,
        assetSymbol: \u0027ETH\u0027,
        addressType: \u0027evm\u0027,
        collectionModes: [\u0027manual\u0027, \u0027automatic\u0027],
        automaticClaimsPermitted: true,
        claimPreparationUrl: \u0027https://api.kiln.fi/v1/eth/rewards\u0027
      },
      {
        id: \u0027figment-sol-staking\u0027,
        provider: \u0027Figment\u0027,
        network: \u0027solana\u0027,
        assetSymbol: \u0027SOL\u0027,
        addressType: \u0027solana\u0027,
        collectionModes: [\u0027manual\u0027],
        automaticClaimsPermitted: false
      }
    ];
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error('YIELD_ROUTING_SOURCES_JSON must be valid JSON.');
  }
  if (!Array.isArray(parsed)) {
    throw new Error('YIELD_ROUTING_SOURCES_JSON must be a JSON array.');
  }

  const ids = new Set<string>();
  return parsed.map((candidate, index) => {
    if (!isPlainRecord(candidate)) {
      throw new Error(`Yield source at index ${index} must be an object.`);
    }
    const id = nonEmptyString(candidate.id);
    const provider = nonEmptyString(candidate.provider).toLowerCase();
    const network = nonEmptyString(candidate.network).toLowerCase();
    const assetSymbol = nonEmptyString(candidate.assetSymbol).toUpperCase();
    if (!id || !provider || !network || !assetSymbol) {
      throw new Error(`Yield source at index ${index} requires id, provider, network, and assetSymbol.`);
    }
    if (ids.has(id)) {
      throw new Error(`Duplicate yield source id: ${id}.`);
    }
    ids.add(id);

    return {
      id,
      provider,
      network,
      assetSymbol,
      accountId: nonEmptyString(candidate.accountId) || undefined,
      validatorIndexes: stringList(candidate.validatorIndexes),
      walletAddresses: stringList(candidate.walletAddresses),
      withdrawalCredentials: stringList(candidate.withdrawalCredentials),
      addressType: parseAddressType(candidate.addressType),
      addressIssuerUrl: nonEmptyString(candidate.addressIssuerUrl) || undefined,
      claimPreparationUrl: nonEmptyString(candidate.claimPreparationUrl) || undefined,
      automaticClaimsPermitted: candidate.automaticClaimsPermitted === true
    };
  });
}

export function getLiveYieldSource(sourceId: string, env: NodeJS.ProcessEnv = process.env): LiveYieldSource | null {
  return getConfiguredLiveYieldSources(env).find((source) => source.id === sourceId) ?? null;
}

export function validateDestinationAddress(address: string, addressType: YieldAddressType): boolean {
  const clean = String(address || '').trim();
  if (!clean) return false;
  if (addressType === 'evm') return ethers.isAddress(clean);
  if (addressType === 'bitcoin') return /^(bc1|tb1|bcrt1|[13mn2])[a-zA-HJ-NP-Z0-9]{20,90}$/.test(clean);
  if (addressType === 'solana') return /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(clean);
  return clean.length >= 8;
}

/**
 * EVM ownership is verified by a signed, user-specific registration message.
 * Other chains must be marked pending until their provider or chain-specific
 * attestation is verified; this prevents unsafe generic signature assumptions.
 */
export function verifyEvmDestinationOwnership(params: {
  userId: string;
  sourceId: string;
  address: string;
  signature: string;
}): boolean {
  const message = buildDestinationOwnershipMessage(params.userId, params.sourceId, params.address);
  try {
    return ethers.getAddress(ethers.verifyMessage(message, params.signature)) === ethers.getAddress(params.address);
  } catch {
    return false;
  }
}

export function buildDestinationOwnershipMessage(userId: string, sourceId: string, address: string): string {
  const normalizedAddress = ethers.isAddress(address) ? ethers.getAddress(address) : String(address).trim();
  return `PayDirect Yield Destination Registration\nUser: ${userId}\nSource: ${sourceId}\nAddress: ${normalizedAddress}`;
}

export async function fetchKilnRewardSummary(source: LiveYieldSource, env: NodeJS.ProcessEnv = process.env): Promise<KilnRewardSummary> {
  const token = nonEmptyString(env.KILN_API_TOKEN);
  if (!token) {
    throw new Error('Kiln live rewards are not configured: KILN_API_TOKEN is missing.');
  }

  const query = new URLSearchParams();
  if (source.accountId) query.set('accounts', source.accountId);
  if (source.validatorIndexes?.length) query.set('validator_indexes', source.validatorIndexes.join(','));
  if (source.walletAddresses?.length) query.set('wallets', source.walletAddresses.join(','));
  if (source.withdrawalCredentials?.length) query.set('withdrawal_credentials', source.withdrawalCredentials.join(','));
  query.set('include_usd', '1');

  const response = await fetch(`https://api.kiln.fi/v1/eth/rewards?${query.toString()}`, {
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
    signal: AbortSignal.timeout(15_000)
  });
  if (!response.ok) {
    throw new Error(`Kiln rewards API responded with HTTP ${response.status}.`);
  }

  const body = await response.json() as { data?: unknown };
  const records = Array.isArray(body.data) ? body.data.filter(isPlainRecord) : [];
  let totalRewardsWei = 0n;
  let totalRewardsUsd = 0;
  let firstRewardDate: string | undefined;
  let latestRewardDate: string | undefined;

  for (const record of records) {
    const reward = nonEmptyString(record.rewards);
    if (/^\d+$/.test(reward)) totalRewardsWei += BigInt(reward);
    const usd = Number(record.rewards_usd);
    if (Number.isFinite(usd)) totalRewardsUsd += usd;
    const date = nonEmptyString(record.date);
    if (date && (!firstRewardDate || date < firstRewardDate)) firstRewardDate = date;
    if (date && (!latestRewardDate || date > latestRewardDate)) latestRewardDate = date;
  }

  return {
    totalRewardsWei: totalRewardsWei.toString(),
    totalRewardsUsd: Number.isFinite(totalRewardsUsd) ? totalRewardsUsd : undefined,
    firstRewardDate,
    latestRewardDate,
    recordCount: records.length
  };
}
