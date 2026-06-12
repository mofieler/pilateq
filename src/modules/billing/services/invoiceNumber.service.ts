/**
 * Centralized invoice-number generator.
 *
 * Generates sequential invoice numbers per studio and prefix. Must always be
 * called inside a transaction so concurrent callers serialize on the
 * advisory lock taken per studio/prefix.
 */

import { db } from '@/db';
import { creditPurchases } from '@/db/schema';
import { and, desc, eq, like, sql } from 'drizzle-orm';
import type { StudioConfig } from '@/lib/studio/studio.config.schema';

type TxClient = Parameters<Parameters<typeof db.transaction>[0]>[0];

/**
 * Build the invoice-number prefix for a studio and year.
 *
 * Format: `${prefix}-BS-${year}-` where prefix defaults to 'POS'.
 * Example: prefix = 'POS', year = 2026 -> 'POS-BS-2026-'
 */
export function getInvoicePrefix(studioConfig: StudioConfig, year?: number): string {
  const y = year ?? new Date().getFullYear();
  const prefix = studioConfig.financial?.invoiceNumberPrefix ?? 'POS';
  return `${prefix}-BS-${y}-`;
}

/**
 * Generate the next sequential invoice number for the given studio and prefix.
 *
 * Format: `{prefix}{NNNN}` where NNNN is zero-padded to 4 digits.
 * Example: prefix = 'POS-BS-2026-'  ->  'POS-BS-2026-0001'
 *
 * The sequence read is protected by a PostgreSQL advisory transaction lock
 * keyed on the studio and prefix, eliminating race conditions between
 * concurrent invoice creators. The unique index on invoiceNumber remains as
 * a final safety net.
 */
export async function generateInvoiceNumber(
  tx: TxClient,
  studioId: string,
  prefix: string,
): Promise<string> {
  const lockKey = `invoice_numbers:${studioId}:${prefix}`;
  await tx.execute(
    sql`SELECT pg_advisory_xact_lock(hashtextextended(${lockKey}, 0))`,
  );

  const [lastRow] = await tx
    .select({ num: creditPurchases.invoiceNumber })
    .from(creditPurchases)
    .where(
      and(
        eq(creditPurchases.studioId, studioId),
        like(creditPurchases.invoiceNumber, `${prefix}%`),
      ),
    )
    .orderBy(desc(creditPurchases.invoiceNumber))
    .limit(1);

  const lastSeq = lastRow?.num ? parseInt(lastRow.num.slice(prefix.length), 10) : 0;
  return `${prefix}${String(lastSeq + 1).padStart(4, '0')}`;
}
