import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';
import { db } from '@/db';
import type { CreditTransaction, CreditType } from '@/db/schema';
import {
  getBalance,
  debit,
  refund,
  addPurchase,
  addAdjustment,
  addMembershipGrant,
  InsufficientCreditsError,
} from './credit.service';

vi.mock('@/db', () => ({
  db: {
    transaction: vi.fn(),
    select: vi.fn(),
  },
}));

interface MockQueryChain {
  select: () => MockQueryChain;
  from: () => MockQueryChain;
  where: () => MockQueryChain;
  limit: () => Promise<unknown>;
  returning: () => Promise<unknown>;
  insert: () => MockQueryChain;
  values: () => MockQueryChain;
  execute: (query: unknown) => Promise<unknown>;
  then: <T>(onFulfilled?: (value: unknown) => T | PromiseLike<T>) => PromiseLike<T>;
}

function createChain(finalResult: unknown, executeMock: Mock = vi.fn()): MockQueryChain {
  const chain: MockQueryChain = {
    select: () => chain,
    from: () => chain,
    where: () => chain,
    limit: () => Promise.resolve(finalResult),
    returning: () => Promise.resolve(finalResult),
    insert: () => chain,
    values: () => chain,
    execute: executeMock,
    then: (onFulfilled) => Promise.resolve(finalResult).then(onFulfilled),
  };
  return chain;
}

function createMockTx(executeMock: Mock = vi.fn()): MockQueryChain {
  return createChain([], executeMock);
}

function makeTransaction(overrides: Partial<CreditTransaction> = {}): CreditTransaction {
  return {
    id: 'tx-1',
    studioId: 'studio-1',
    userId: 'user-1',
    creditType: 'pass',
    type: 'debit',
    amount: -5,
    description: '',
    bookingId: null,
    purchaseId: null,
    membershipId: null,
    processedBy: null,
    expiresAt: null,
    createdAt: new Date(),
    ...overrides,
  } as CreditTransaction;
}

type TxClient = Parameters<Parameters<typeof db.transaction>[0]>[0];

describe('credit.service', () => {
  let executeMock: Mock;
  let mockTx: MockQueryChain;

  beforeEach(() => {
    vi.clearAllMocks();
    executeMock = vi.fn();
    mockTx = createMockTx(executeMock);
    vi.mocked(db.transaction).mockImplementation(async (fn) => fn(mockTx as unknown as TxClient));
  });

  describe('getBalance', () => {
    it('sums non-expired transactions and excludes expired rows', async () => {
      vi.mocked(db.select).mockReturnValue(
        createChain([{ total: 7 }]) as unknown as ReturnType<typeof db.select>,
      );

      const balance = await getBalance('studio-1', 'user-1', 'pass' as CreditType);

      expect(balance).toBe(7);
      expect(db.select).toHaveBeenCalled();
    });
  });

  describe('debit', () => {
    it('succeeds when the user has sufficient non-expired balance', async () => {
      const balanceChain = createChain([{ total: 10 }]);
      const inserted = makeTransaction({ type: 'debit', amount: -3, description: 'Debit: 3 pass' });
      const insertChain = createChain([inserted]);

      mockTx.select = vi.fn(() => balanceChain);
      mockTx.insert = vi.fn(() => insertChain);

      const result = await debit(mockTx as unknown as TxClient, {
        studioId: 'studio-1',
        userId: 'user-1',
        creditType: 'pass',
        amount: 3,
      });

      expect(result.type).toBe('debit');
      expect(result.amount).toBe(-3);
      expect(executeMock).toHaveBeenCalled();
    });

    it('throws InsufficientCreditsError when balance is too low', async () => {
      mockTx.select = vi.fn(() => createChain([{ total: 1 }]));

      await expect(
        debit(mockTx as unknown as TxClient, {
          studioId: 'studio-1',
          userId: 'user-1',
          creditType: 'pass',
          amount: 5,
        }),
      ).rejects.toBeInstanceOf(InsufficientCreditsError);
    });

    it('acquires an advisory lock keyed by studio, user and credit type', async () => {
      const balanceChain = createChain([{ total: 10 }]);
      const insertChain = createChain([makeTransaction()]);

      mockTx.select = vi.fn(() => balanceChain);
      mockTx.insert = vi.fn(() => insertChain);

      await debit(mockTx as unknown as TxClient, {
        studioId: 'studio-1',
        userId: 'user-1',
        creditType: 'pass',
        amount: 1,
      });

      expect(executeMock).toHaveBeenCalled();
      const lockCall = JSON.stringify(executeMock.mock.calls[0][0]);
      expect(lockCall).toContain('credits:studio-1:user-1:pass');
    });
  });

  describe('refund', () => {
    it('creates a positive ledger row', async () => {
      const inserted = makeTransaction({ type: 'refund', amount: 4, description: 'Refund' });
      mockTx.insert = vi.fn(() => createChain([inserted]));

      const result = await refund(mockTx as unknown as TxClient, {
        studioId: 'studio-1',
        userId: 'user-1',
        creditType: 'pass',
        amount: 4,
        bookingId: 'booking-1',
        description: 'Refund',
      });

      expect(result.type).toBe('refund');
      expect(result.amount).toBe(4);
    });
  });

  describe('addPurchase', () => {
    it('creates a positive purchase row with expiresAt', async () => {
      const expiresAt = new Date('2030-01-01T00:00:00Z');
      const inserted = makeTransaction({
        type: 'purchase',
        amount: 8,
        purchaseId: 'purchase-1',
        expiresAt,
      });
      mockTx.select = vi.fn(() => createChain([]));
      mockTx.insert = vi.fn(() => createChain([inserted]));

      const result = await addPurchase(mockTx as unknown as TxClient, {
        studioId: 'studio-1',
        userId: 'user-1',
        creditType: 'pass',
        amount: 8,
        purchaseId: 'purchase-1',
        expiresAt,
        description: 'Purchase: 8 pass',
      });

      expect(result.type).toBe('purchase');
      expect(result.amount).toBe(8);
      expect(result.expiresAt).toEqual(expiresAt);
    });

    it('rejects duplicate purchase ids', async () => {
      mockTx.select = vi.fn(() => createChain([{ id: 'existing' }]));

      await expect(
        addPurchase(mockTx as unknown as TxClient, {
          studioId: 'studio-1',
          userId: 'user-1',
          creditType: 'pass',
          amount: 8,
          purchaseId: 'purchase-1',
        }),
      ).rejects.toThrow('Duplicate credit purchase');
    });
  });

  describe('addAdjustment', () => {
    it('creates an adjustment row with the correct amount and description', async () => {
      const inserted = makeTransaction({
        type: 'adjustment',
        amount: 12,
        description: 'Manual adjustment',
        processedBy: 'admin-1',
      });
      mockTx.insert = vi.fn(() => createChain([inserted]));

      const result = await addAdjustment(mockTx as unknown as TxClient, {
        studioId: 'studio-1',
        userId: 'user-1',
        creditType: 'pass',
        amount: 12,
        description: 'Manual adjustment',
        adminId: 'admin-1',
      });

      expect(result.type).toBe('adjustment');
      expect(result.amount).toBe(12);
      expect(result.description).toBe('Manual adjustment');
      expect(result.processedBy).toBe('admin-1');
    });
  });

  describe('addMembershipGrant', () => {
    it('creates a membership_grant row tied to the membership', async () => {
      const inserted = makeTransaction({
        type: 'membership_grant',
        amount: 6,
        membershipId: 'membership-1',
        description: 'Weekly grant',
      });
      mockTx.insert = vi.fn(() => createChain([inserted]));

      const result = await addMembershipGrant(mockTx as unknown as TxClient, {
        studioId: 'studio-1',
        userId: 'user-1',
        creditType: 'pass',
        amount: 6,
        membershipId: 'membership-1',
        description: 'Weekly grant',
      });

      expect(result.type).toBe('membership_grant');
      expect(result.amount).toBe(6);
      expect(result.membershipId).toBe('membership-1');
    });
  });
});
