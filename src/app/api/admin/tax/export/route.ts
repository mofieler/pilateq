import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth/auth';
import { getTaxSummaryAction } from '@/modules/billing/actions/taxSummary.actions';
import { format } from 'date-fns';

function toGermanDecimal(cents: number): string {
  return (cents / 100).toFixed(2).replace('.', ',');
}

function toGermanDate(date: Date | null | undefined): string {
  if (!date) return '';
  return format(new Date(date), 'dd.MM.yyyy');
}

function escapeCsv(value: string | null | undefined): string {
  const str = value ?? '';
  return str.includes(';') || str.includes('"') || str.includes('\n')
    ? `"${str.replace(/"/g, '""')}"`
    : str;
}

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const year = parseInt(request.nextUrl.searchParams.get('year') ?? '', 10);
  if (isNaN(year) || year < 2020 || year > 2100) {
    return NextResponse.json({ error: 'Invalid year' }, { status: 400 });
  }

  const result = await getTaxSummaryAction(year);
  if (!result.success || !result.data) {
    return NextResponse.json({ error: result.error ?? 'Failed to load data' }, { status: 500 });
  }

  const { invoiceRegistry } = result.data;

  const header = [
    'Invoice Date',
    'Invoice Number',
    'Description',
    'Gross Amount EUR',
    'Payment Status',
    'Payment Date',
    'Due Date',
    'Client Name',
    'Client Email',
    'Package',
  ].join(';');

  const rows = invoiceRegistry.map((e) =>
    [
      escapeCsv(toGermanDate(e.invoiceDate)),
      escapeCsv(e.invoiceNumber),
      escapeCsv(e.packageName ?? 'Credit Package'),
      toGermanDecimal(e.priceCents),
      escapeCsv(e.paymentStatus),
      escapeCsv(toGermanDate(e.paidAt)),
      escapeCsv(toGermanDate(e.dueDate)),
      escapeCsv(e.clientName),
      escapeCsv(e.clientEmail),
      escapeCsv(e.packageName),
    ].join(';'),
  );

  // UTF-8 BOM for Excel compatibility
  const bom = '﻿';
  const csv = bom + [header, ...rows].join('\r\n');

  return new NextResponse(csv, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="Tax-Export-${year}.csv"`,
      'Cache-Control': 'no-store',
    },
  });
}
