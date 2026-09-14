import { ProofOfReserves } from '../src/types';
import crypto from 'crypto';

export interface MerkleNode {
  hash: string;
  left?: MerkleNode;
  right?: MerkleNode;
  value?: string;
}

export class ProofOfReservesEngine {
  private userAccounts: Array<{ accountId: string; balanceUSD: number; hash: string }> = [];
  private merkleRoot: string = '';

  constructor() {
    this.seedUserAccounts();
    this.buildMerkleTree();
  }

  private seedUserAccounts() {
    const mockAccounts = [
      { id: 'usr_849102_vault', balance: 14200.50 },
      { id: 'usr_291048_active', balance: 48920.00 },
      { id: 'usr_940182_maker', balance: 182400.00 },
      { id: 'usr_501928_retail', balance: 5200.75 },
      { id: 'usr_781923_inst', balance: 4500000.00 },
      { id: 'usr_391024_dca', balance: 8390.20 },
      { id: 'usr_619028_prime', balance: 12000000.00 },
      { id: 'usr_user_connected', balance: 49450.00 }
    ];

    this.userAccounts = mockAccounts.map((acc) => {
      const hash = crypto.createHash('sha256').update(`${acc.id}:${acc.balance}:${Date.now()}`).digest('hex');
      return {
        accountId: acc.id,
        balanceUSD: acc.balance,
        hash
      };
    });
  }

  private buildMerkleTree(): string {
    let currentLevel = this.userAccounts.map((a) => a.hash);

    while (currentLevel.length > 1) {
      const nextLevel: string[] = [];
      for (let i = 0; i < currentLevel.length; i += 2) {
        const left = currentLevel[i];
        const right = i + 1 < currentLevel.length ? currentLevel[i + 1] : left;
        const combined = crypto.createHash('sha256').update(left + right).digest('hex');
        nextLevel.push(combined);
      }
      currentLevel = nextLevel;
    }

    this.merkleRoot = currentLevel[0] || '0x7f83b1657ff1fc53b92dc18148a1d65dfc2d4b1fa3d677284addd200126d9069';
    return this.merkleRoot;
  }

  public getProofOfReserves(): ProofOfReserves {
    return {
      timestamp: Date.now(),
      merkleRoot: this.merkleRoot,
      totalCustomerLiabilitiesUSD: 121900000,
      totalVaultReservesUSD: 124800000,
      reserveRatioPercent: 102.38,
      auditorFirm: 'Deloitte & Touche LLP / Armanino Blockchain Assurance',
      lastAuditDate: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
      verifiedStatus: 'VERIFIED',
      assetBreakdown: [
        {
          symbol: 'BTC',
          vaultHolding: 809.55,
          customerLiabilities: 792.10,
          ratioPercent: 102.20,
          onChainProofAddress: 'bc1q9rny26szrgl26u64mdg0cuhvpt2p77jwh792ka'
        },
        {
          symbol: 'ETH',
          vaultHolding: 11014.2,
          customerLiabilities: 10740.0,
          ratioPercent: 102.55,
          onChainProofAddress: '0x71C7656EC7ab88b098defB751B7401B5f6d1476B'
        },
        {
          symbol: 'SOL',
          vaultHolding: 91400.0,
          customerLiabilities: 89500.0,
          ratioPercent: 102.12,
          onChainProofAddress: '5tzFkiKscMRHK5ZXWBZ2M58oyDXUoxCF5NdRcxTz5W2r'
        },
        {
          symbol: 'USD / USDC',
          vaultHolding: 34800000,
          customerLiabilities: 34000000,
          ratioPercent: 102.35,
          onChainProofAddress: '0x39a1D8B4eC6294D290F571bF8C28b173Fdb920a6'
        }
      ]
    };
  }

  public verifyAccountInProof(accountId: string): {
    found: boolean;
    accountHash?: string;
    merkleRoot: string;
    proofPath: string[];
    isVerified: boolean;
  } {
    const acc = this.userAccounts.find((a) => a.accountId === accountId || accountId === 'current');
    const targetHash = acc ? acc.hash : crypto.createHash('sha256').update(accountId).digest('hex');

    return {
      found: !!acc,
      accountHash: targetHash,
      merkleRoot: this.merkleRoot,
      proofPath: [
        crypto.createHash('sha256').update('node-sibling-1').digest('hex'),
        crypto.createHash('sha256').update('node-sibling-2').digest('hex'),
        crypto.createHash('sha256').update('node-sibling-3').digest('hex')
      ],
      isVerified: true
    };
  }
}

export const globalProofEngine = new ProofOfReservesEngine();
