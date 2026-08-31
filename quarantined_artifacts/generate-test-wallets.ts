/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { ethers } from 'ethers';
import * as crypto from 'crypto';

export function generateTestWallets() {
  // 1. Generate EVM Wallet (Ethereum, Polygon, BNB, Arbitrum, etc.)
  const evmWallet = ethers.Wallet.createRandom();

  // 2. Generate Solana mock/keypair structure
  // Using random 32 bytes for demo keypair derivation
  const solanaSecret = crypto.randomBytes(32);
  const solanaAddressMock = `So1${crypto.randomBytes(32).toString('hex').substring(0, 40)}`;

  // 3. Generate Bitcoin Bech32 Address structure
  const btcPubHash = crypto.randomBytes(20);
  const bitcoinAddressMock = `bc1q${crypto.randomBytes(20).toString('hex')}test`;

  return {
    evm: {
      address: evmWallet.address,
      privateKey: evmWallet.privateKey,
      network: 'EVM (Ethereum / Polygon / BNB / Base)'
    },
    solana: {
      address: solanaAddressMock,
      network: 'Solana'
    },
    bitcoin: {
      address: bitcoinAddressMock,
      network: 'Bitcoin Bech32'
    }
  };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const wallets = generateTestWallets();
  console.log('=== Newly Generated Test Receiving Wallets ===');
  console.log(JSON.stringify(wallets, null, 2));
}
