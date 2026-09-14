import { JournalEntry, LedgerLine } from '../src/types';
import crypto from 'crypto';

export interface AccountBalance {
  code: string;
  name: string;
  type: 'ASSET' | 'LIABILITY' | 'EQUITY' | 'REVENUE' | 'EXPENSE';
  currency: string;
  balance: number;
}

export class DoubleEntryLedger {
  private journal: JournalEntry[] = [];
  private currentBlockHeight: number = 849200;

  constructor() {
    this.seedInitialLedger();
  }

  private seedInitialLedger() {
    // Initial Reserve Capital and Customer Balances
    this.recordTransaction({
      transactionId: 'genesis-vault-deposit',
      memo: 'Custodial Reserve Capital Injection & Cold Vault Capitalization',
      lines: [
        {
          accountCode: '1010-VAULT-BTC',
          accountName: 'Bitcoin Cold & Hot Vaults',
          accountType: 'ASSET',
          debit: 52000000.00,
          credit: 0,
          currency: 'USD'
        },
        {
          accountCode: '1020-VAULT-ETH',
          accountName: 'Ethereum Cold & Hot Vaults',
          accountType: 'ASSET',
          debit: 38000000.00,
          credit: 0,
          currency: 'USD'
        },
        {
          accountCode: '1040-CASH-USD',
          accountName: 'JPMorgan Chase Custody Escrow',
          accountType: 'ASSET',
          debit: 34800000.00,
          credit: 0,
          currency: 'USD'
        },
        {
          accountCode: '2010-CUST-DEPOSITS-FIAT',
          accountName: 'Customer USD Fiat Cash Liabilities',
          accountType: 'LIABILITY',
          debit: 0,
          credit: 34000000.00,
          currency: 'USD'
        },
        {
          accountCode: '2020-CUST-DEPOSITS-CRYPTO',
          accountName: 'Customer Cryptographic Asset Liabilities',
          accountType: 'LIABILITY',
          debit: 0,
          credit: 87900000.00,
          currency: 'USD'
        },
        {
          accountCode: '3010-EQUITY-CAPITAL',
          accountName: 'Coinbase Exchange Capital Reserve Equity',
          accountType: 'EQUITY',
          debit: 0,
          credit: 2900000.00,
          currency: 'USD'
        }
      ]
    });
  }

  public recordTransaction(entry: {
    transactionId: string;
    memo: string;
    lines: LedgerLine[];
  }): JournalEntry {
    const totalDebit = entry.lines.reduce((s, l) => s + l.debit, 0);
    const totalCredit = entry.lines.reduce((s, l) => s + l.credit, 0);
    const balanced = Math.abs(totalDebit - totalCredit) < 0.001;

    this.currentBlockHeight += 1;
    const timestamp = Date.now();
    const payload = `${entry.transactionId}:${timestamp}:${totalDebit}:${totalCredit}:${this.currentBlockHeight}`;
    const sha256Hash = crypto.createHash('sha256').update(payload).digest('hex');

    const journalEntry: JournalEntry = {
      id: `je-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      transactionId: entry.transactionId,
      timestamp,
      memo: entry.memo,
      lines: entry.lines,
      sha256Hash,
      blockHeight: this.currentBlockHeight,
      balanced
    };

    this.journal.unshift(journalEntry);
    return journalEntry;
  }

  public getJournal(): JournalEntry[] {
    return [...this.journal];
  }

  public getBalances(): AccountBalance[] {
    const map = new Map<string, AccountBalance>();

    for (const entry of this.journal) {
      for (const line of entry.lines) {
        if (!map.has(line.accountCode)) {
          map.set(line.accountCode, {
            code: line.accountCode,
            name: line.accountName,
            type: line.accountType,
            currency: line.currency,
            balance: 0
          });
        }
        const acc = map.get(line.accountCode)!;
        if (line.accountType === 'ASSET' || line.accountType === 'EXPENSE') {
          acc.balance += line.debit - line.credit;
        } else {
          acc.balance += line.credit - line.debit;
        }
      }
    }

    return Array.from(map.values());
  }

  public verifyIntegrity(): {
    isBalanced: boolean;
    totalAssets: number;
    totalLiabilities: number;
    totalEquity: number;
    reserveRatioPercent: number;
    unbalancedEntries: number;
  } {
    const balances = this.getBalances();
    let totalAssets = 0;
    let totalLiabilities = 0;
    let totalEquity = 0;

    for (const b of balances) {
      if (b.type === 'ASSET') totalAssets += b.balance;
      if (b.type === 'LIABILITY') totalLiabilities += b.balance;
      if (b.type === 'EQUITY' || b.type === 'REVENUE') totalEquity += b.balance;
    }

    const unbalancedEntries = this.journal.filter((j) => !j.balanced).length;
    const reserveRatioPercent = totalLiabilities > 0 ? (totalAssets / totalLiabilities) * 100 : 100;

    return {
      isBalanced: unbalancedEntries === 0 && Math.abs(totalAssets - (totalLiabilities + totalEquity)) < 1.0,
      totalAssets,
      totalLiabilities,
      totalEquity,
      reserveRatioPercent: parseFloat(reserveRatioPercent.toFixed(2)),
      unbalancedEntries
    };
  }
}

export const globalLedger = new DoubleEntryLedger();
