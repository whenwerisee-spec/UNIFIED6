import { describe, expect, it } from 'vitest';
import {
  getConfiguredLiveYieldSources,
  validateDestinationAddress,
  verifyEvmDestinationOwnership
} from '../src/lib/yield-routing';
import { deriveMarshallAddress, getMarshallConfigSnapshot } from '../src/lib/marshall-config';

describe('live-only yield routing configuration', () => {
  it('returns no sources when no provider configuration is present', () => {
    expect(getConfiguredLiveYieldSources({})).toEqual([]);
  });

  it('parses explicit configured sources without inventing defaults', () => {
    const sources = getConfiguredLiveYieldSources({
      YIELD_ROUTING_SOURCES_JSON: JSON.stringify([
        {
          id: 'kiln-eth-primary',
          provider: 'kiln',
          network: 'ethereum',
          assetSymbol: 'ETH',
          accountId: 'account-123',
          addressType: 'evm'
        }
      ])
    });

    expect(sources).toHaveLength(1);
    expect(sources[0]).toMatchObject({
      id: 'kiln-eth-primary',
      provider: 'kiln',
      network: 'ethereum',
      assetSymbol: 'ETH',
      addressType: 'evm'
    });
  });

  it('rejects invalid permanent destination addresses and unverified signatures', () => {
    expect(validateDestinationAddress('not-an-address', 'evm')).toBe(false);
    expect(validateDestinationAddress('0x0000000000000000000000000000000000000001', 'evm')).toBe(true);
    expect(verifyEvmDestinationOwnership({
      userId: 'user-1',
      sourceId: 'source-1',
      address: '0x0000000000000000000000000000000000000001',
      signature: 'invalid-signature'
    })).toBe(false);
  });

  it('requires explicit runtime configuration instead of hardcoded Marshall defaults', () => {
    expect(deriveMarshallAddress({})).toBe('');

    const snapshot = getMarshallConfigSnapshot({});
    expect(snapshot.address).toBe('');
    expect(snapshot.ledgerBalance).toBeNull();
    expect(snapshot.baseline).toBeNull();
    expect(snapshot.status).toBe('UNCONFIGURED');
    expect(snapshot.hasPrivateKey).toBe(false);
  });
});
