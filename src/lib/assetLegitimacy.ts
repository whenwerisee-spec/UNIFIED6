/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { UNIVERSAL_TOKEN_REGISTRY, resolveTokenInfo } from './token-network-gas';

export interface AssetLegitimacyInfo {
  symbol: string;
  name: string;
  contractAddress: string;
  formattedAddress: string;
  legitimacyBadge: string;
  legitimacyStatus: 'VERIFIED_ERC20' | 'REGULATED_ISSUER' | 'NATIVE_L1' | 'INSTITUTIONAL';
  verifierName: string;
  networkName: string;
  explorerUrl: string;
  auditRating: string;
}

export const LEGITIMACY_DATABASE: Record<string, AssetLegitimacyInfo> = Object.entries(UNIVERSAL_TOKEN_REGISTRY).reduce(
  (acc, [sym, t]) => {
    let status: AssetLegitimacyInfo['legitimacyStatus'] = 'VERIFIED_ERC20';
    if (t.isNativeL1) status = 'NATIVE_L1';
    else if (t.category === 'Fiat' || t.category === 'Stablecoin') status = 'REGULATED_ISSUER';
    else if (t.category === 'Institutional') status = 'INSTITUTIONAL';

    acc[sym] = {
      symbol: t.symbol,
      name: t.name,
      contractAddress: t.contractAddress,
      formattedAddress: t.formattedAddress,
      legitimacyBadge: t.legitimacyBadge,
      legitimacyStatus: status,
      verifierName: t.verifierName,
      networkName: t.network,
      explorerUrl: t.explorerTokenUrl || t.explorerUrl,
      auditRating: t.auditRating
    };
    return acc;
  },
  {} as Record<string, AssetLegitimacyInfo>
);

export function getAssetLegitimacyInfo(symbol: string): AssetLegitimacyInfo {
  const upper = (symbol || 'USD').toUpperCase();
  if (LEGITIMACY_DATABASE[upper]) {
    return LEGITIMACY_DATABASE[upper];
  }
  const token = resolveTokenInfo(upper);
  let status: AssetLegitimacyInfo['legitimacyStatus'] = 'VERIFIED_ERC20';
  if (token.isNativeL1) status = 'NATIVE_L1';
  else if (token.category === 'Fiat' || token.category === 'Stablecoin') status = 'REGULATED_ISSUER';
  else if (token.category === 'Institutional') status = 'INSTITUTIONAL';

  return {
    symbol: token.symbol,
    name: token.name,
    contractAddress: token.contractAddress,
    formattedAddress: token.formattedAddress,
    legitimacyBadge: token.legitimacyBadge,
    legitimacyStatus: status,
    verifierName: token.verifierName,
    networkName: token.network,
    explorerUrl: token.explorerTokenUrl || token.explorerUrl,
    auditRating: token.auditRating
  };
}
