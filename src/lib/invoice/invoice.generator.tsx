import React from 'react';
import path from 'path';
import {
  Document,
  Page,
  Text,
  View,
  Image,
  StyleSheet,
  renderToBuffer,
} from '@react-pdf/renderer';
import { getLogger } from '@/lib/logger';
import type { StudioConfig } from '@/lib/studio/studio.config.schema';

const logger = getLogger('invoice-pdf');

// ─── Studio invoice config ────────────────────────────────────────────────────

export interface StudioInvoiceConfig {
  name: string;
  address: string;
  city: string;
  phone: string;
  email: string;
  vatId: string;
  taxId: string;
  vatRate: number;
  kleinunternehmer: boolean;
  bankName: string;
  bankIban: string;
  bankBic: string;
  owners: string;
}

export class InvoiceIdentityIncompleteError extends Error {
  constructor() {
    super('INVOICE_IDENTITY_INCOMPLETE');
    this.name = 'InvoiceIdentityIncompleteError';
  }
}

function studioConfigToInvoiceConfig(studioConfig: StudioConfig): StudioInvoiceConfig {
  const identity = studioConfig.identity ?? {};
  const financial = studioConfig.financial ?? {};
  const vatRate = (financial.taxRatePercent ?? 0) / 100;
  const city = [identity.postalCode, identity.city].filter(Boolean).join(' ');

  return {
    name: identity.name || '',
    address: identity.address || '',
    city: city || identity.city || '',
    phone: identity.phone || '',
    email: identity.email || '',
    vatId: financial.vatId ?? '',
    taxId: identity.taxNumber || '',
    vatRate,
    kleinunternehmer: vatRate === 0,
    bankName: financial.bankName ?? '',
    bankIban: financial.bankIban ?? '',
    bankBic: financial.bankBic ?? '',
    owners: financial.owners ?? '',
  };
}

// ─── Types ────────────────────────────────────────────────────────────────────

export interface InvoiceData {
  invoiceNumber:   string;
  invoiceDate:     Date;
  dueDate:         Date;
  customerName:    string;
  customerEmail:   string;
  customerAddress: string | null;
  customerId?:     string | null;
  packageName:     string;
  creditsAmount:   number;
  creditType:      string;
  priceCents:      number;
  currency:        string;
  paymentMethod:   string;
  paymentStatus?:  string;
}

// ─── Styles (clean white, minimal — matches invoice screenshot) ───────────────
const S = StyleSheet.create({
  page: {
    fontFamily:        'Helvetica',
    fontSize:          9,
    color:             '#1a1a1a',
    backgroundColor:   '#ffffff',
    paddingTop:        28,
    paddingBottom:     40,
    paddingHorizontal: 48,
  },

  // Logo
  logoWrap: { alignItems: 'center', marginBottom: 10 },
  logo:     { width: 75, height: 75 },

  // RECHNUNG/INVOICE heading
  headingWrap: {
    borderBottomWidth: 1.5,
    borderBottomColor: '#1a1a1a',
    borderBottomStyle: 'solid',
    marginBottom:      18,
    paddingBottom:     5,
  },
  heading: {
    fontSize:   20,
    fontFamily: 'Helvetica-Bold',
    letterSpacing: 0.5,
  },

  // Info row (customer left, invoice meta right)
  infoRow: {
    flexDirection:  'row',
    justifyContent: 'space-between',
    marginBottom:   10,
  },
  infoCol: { flex: 1 },

  infoLine: {
    flexDirection: 'row',
    marginBottom:  3,
  },
  infoLabel: {
    fontFamily: 'Helvetica-Bold',
    width:      68,
    fontSize:   9,
  },
  infoValue: { fontSize: 9 },

  // Thank-you text
  intro: { fontSize: 9, marginBottom: 8, lineHeight: 1.3 },

  // ── Table ──────────────────────────────────────────────────────────────────
  tableHeaderRow: {
    flexDirection:   'row',
    borderTopWidth:  1,
    borderTopColor:  '#1a1a1a',
    borderTopStyle:  'solid',
    borderBottomWidth: 1,
    borderBottomColor: '#1a1a1a',
    borderBottomStyle: 'solid',
    paddingVertical:   5,
    paddingHorizontal: 4,
  },
  tableHeaderCell: {
    fontSize:   9,
    fontFamily: 'Helvetica-Bold',
  },
  tableRow: {
    flexDirection:      'row',
    borderBottomWidth:  0.5,
    borderBottomColor:  '#cccccc',
    borderBottomStyle:  'solid',
    paddingVertical:    5,
    paddingHorizontal:  4,
  },
  tableRowLast: {
    borderBottomWidth: 1,
    borderBottomColor: '#1a1a1a',
  },
  tableCell: { fontSize: 9 },

  colPos:   { width: 28 },
  colDesc1: { flex: 2 },
  colDesc2: { flex: 3 },
  colPrice: { width: 72, textAlign: 'right' as const },

  // ── Totals ─────────────────────────────────────────────────────────────────
  totalsWrap: {
    alignItems:   'flex-end',
    marginTop:    6,
  },
  totalsBlock: { width: 200 },

  totalRow: {
    flexDirection:  'row',
    justifyContent: 'space-between',
    paddingVertical: 3,
  },
  totalLabel: { fontSize: 9 },
  totalValue: { fontSize: 9 },

  grandRow: {
    flexDirection:  'row',
    justifyContent: 'space-between',
    marginTop:      4,
    paddingTop:     4,
    borderTopWidth: 1,
    borderTopColor: '#1a1a1a',
    borderTopStyle: 'solid',
  },
  grandLabel: { fontSize: 10, fontFamily: 'Helvetica-Bold' },
  grandValue: { fontSize: 10, fontFamily: 'Helvetica-Bold' },

  // Due date
  dueSection: { marginTop: 14, marginBottom: 8 },
  dueLine:    { flexDirection: 'row' },
  dueLabel:   { fontFamily: 'Helvetica-Bold', fontSize: 9, width: 100 },
  dueValue:   { fontSize: 9, fontFamily: 'Helvetica-Bold' },

  // Payment instructions
  paymentSection: {
    marginTop: 10,
    marginBottom: 8,
    padding: 10,
    backgroundColor: '#faf9f7',
    borderWidth: 1,
    borderColor: '#ede8e5',
    borderRadius: 4,
  },
  paymentHeading: {
    fontSize: 10,
    fontFamily: 'Helvetica-Bold',
    color: '#4e2b22',
    marginBottom: 8,
  },
  paymentRow: {
    flexDirection: 'row',
    marginBottom: 3,
  },
  paymentLabel: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 9,
    width: 80,
    color: '#6b3d32',
  },
  paymentValue: {
    fontSize: 9,
    color: '#4e2b22',
    flex: 1,
  },
  paymentNote: {
    fontSize: 9,
    color: '#6b3d32',
    marginTop: 8,
    lineHeight: 1.4,
  },

  // Closing
  closing:   { fontSize: 9, marginBottom: 6, lineHeight: 1.3 },
  greeting:  { fontSize: 9, marginBottom: 2 },
  owners:    { fontSize: 9 },

  // Legal note
  legalNote: {
    marginTop:        10,
    paddingTop:       6,
    borderTopWidth:   0.5,
    borderTopColor:   '#cccccc',
    borderTopStyle:   'solid',
    marginBottom:     4,
  },
  legalNoteText: {
    fontSize:   7,
    color:      '#888888',
    lineHeight: 1.5,
  },

  // Footer
  footer: {
    position: 'absolute',
    bottom:   20,
    left:     52,
    right:    52,
    alignItems: 'center',
  },
  footerLine: {
    fontSize:   7.5,
    color:      '#555555',
    textAlign:  'center' as const,
    lineHeight: 1.5,
  },
  stampWrap: {
    position:        'absolute',
    top:             22,
    right:           44,
    borderWidth:     3,
    borderRadius:    6,
    paddingVertical: 10,
    paddingHorizontal: 18,
    transform:       'rotate(-6deg)',
    opacity:         0.92,
  },
  stampPaid: {
    borderColor:     '#2d6a2d',
    color:           '#2d6a2d',
    backgroundColor: '#e8f5e8',
  },
  stampPending: {
    borderColor:     '#b87a3a',
    color:           '#b87a3a',
    backgroundColor: '#fff8ee',
  },
  stampText: {
    fontSize:        13,
    fontFamily:      'Helvetica-Bold',
    letterSpacing:   1.5,
    textAlign:       'center',
  },
});

// ─── Helpers ──────────────────────────────────────────────────────────────────
function fmt(cents: number, currency: string): string {
  return new Intl.NumberFormat('de-DE', {
    style: 'currency',
    currency: currency.toUpperCase(),
  }).format(cents / 100);
}

function fmtDate(d: Date): string {
  return d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

// ─── Info line helper ─────────────────────────────────────────────────────────
function InfoLine({ label, value }: { label: string; value: string }) {
  return (
    <View style={S.infoLine}>
      <Text style={S.infoLabel}>{label}</Text>
      <Text style={S.infoValue}>{value}</Text>
    </View>
  );
}

// Number of filler rows shown in the table (minimal — keeps it formal but compact)
const TABLE_ROWS = 2;

// ─── PDF component ────────────────────────────────────────────────────────────
function InvoicePDF({
  data,
  studio,
}: {
  data:   InvoiceData;
  studio: StudioInvoiceConfig;
}) {
  const vatRate    = studio.vatRate;
  const grossCents = data.priceCents;
  // Price is VAT-inclusive; extract net and VAT
  const netCents   = vatRate > 0 ? Math.round(grossCents / (1 + vatRate)) : grossCents;
  const vatCents   = grossCents - netCents;

  const logoSrc = path.join(process.cwd(), 'public', 'logo_transparent.png');

  const customerLabel = data.customerId
    ? data.customerId.replace(/-/g, '').slice(0, 8).toUpperCase()
    : '-';

  return (
    <Document
      title={`Rechnung ${data.invoiceNumber}`}
      author={studio.name}
      subject="Invoice / Rechnung"
    >
      <Page size="A4" style={S.page}>

        {/* Logo */}
        <View style={S.logoWrap}>
          <Image src={logoSrc} style={S.logo} />
        </View>

        {/* Payment Status Stamp — always visible so users know at a glance */}
        <View style={[
          S.stampWrap,
          (data.paymentStatus === 'paid' || data.paymentStatus === 'completed') ? S.stampPaid : S.stampPending
        ]}>
          <Text style={S.stampText}>
            {(data.paymentStatus === 'paid' || data.paymentStatus === 'completed')
              ? 'PAID / BEZAHLT'
              : 'OPEN / OFFEN'}
          </Text>
        </View>

        {/* Heading */}
        <View style={S.headingWrap}>
          <Text style={S.heading}>RECHNUNG/INVOICE</Text>
        </View>

        {/* Customer info (left) | Invoice meta (right) */}
        <View style={S.infoRow}>
          <View style={S.infoCol}>
            <InfoLine label="Kundennr.:" value={customerLabel} />
            <InfoLine label="Name:"       value={data.customerName} />
            <InfoLine label="E-Mail:"     value={data.customerEmail} />
          </View>
          <View style={S.infoCol}>
            <InfoLine label="Rechnung Nr.:" value={data.invoiceNumber} />
            <InfoLine label="Datum:"         value={fmtDate(data.invoiceDate)} />
            <InfoLine label="System:"        value="PilatesOS Buchungssystem" />
          </View>
        </View>

        {/* Intro text */}
        <Text style={S.intro}>
          Vielen Dank für Ihr Vertrauen. Ich stelle Ihnen hiermit folgende Leistungen in Rechnung:
        </Text>

        {/* ── Table ── */}
        {/* Header */}
        <View style={S.tableHeaderRow}>
          <Text style={[S.tableHeaderCell, S.colPos]}>Pos.</Text>
          <Text style={[S.tableHeaderCell, S.colDesc1]}>Beschreibung</Text>
          <Text style={[S.tableHeaderCell, S.colDesc2]}>{''}</Text>
          <Text style={[S.tableHeaderCell, S.colPrice]}>Gesamtpreis</Text>
        </View>

        {/* Row 1: item */}
        <View style={S.tableRow}>
          <Text style={[S.tableCell, S.colPos]}>1.</Text>
          <Text style={[S.tableCell, S.colDesc1]}>
            {data.packageName === 'Welcome Journey' ? 'Welcome Package' : data.packageName}
          </Text>
          <Text style={[S.tableCell, S.colDesc2]}>
            {data.packageName === 'Welcome Journey'
              ? `Welcome Package (${fmt(grossCents, data.currency)})`
              : `${data.packageName} (${data.creditsAmount} ${data.creditType} ${data.creditsAmount === 1 ? 'credit' : 'credits'})`}
          </Text>
          <Text style={[S.tableCell, S.colPrice]}>
            {fmt(vatRate > 0 ? netCents : grossCents, data.currency)}
          </Text>
        </View>

        {/* Filler rows 2–TABLE_ROWS */}
        {Array.from({ length: TABLE_ROWS - 1 }, (_, i) => {
          const rowStyle = i === TABLE_ROWS - 2
            ? [S.tableRow, S.tableRowLast]
            : [S.tableRow];
          return (
            <View key={i} style={rowStyle}>
              <Text style={[S.tableCell, S.colPos]}>{i + 2}.</Text>
              <Text style={[S.tableCell, S.colDesc1]}>-</Text>
              <Text style={[S.tableCell, S.colDesc2]}>-</Text>
              <Text style={[S.tableCell, S.colPrice]}>{''}</Text>
            </View>
          );
        })}

        {/* ── Totals ── */}
        <View style={S.totalsWrap}>
          <View style={S.totalsBlock}>
            {vatRate > 0 && (
              <View style={S.totalRow}>
                <Text style={S.totalLabel}>{Math.round(vatRate * 100)}% VAT</Text>
                <Text style={S.totalValue}>{fmt(vatCents, data.currency)}</Text>
              </View>
            )}
            <View style={S.grandRow}>
              <Text style={S.grandLabel}>Gesamtsumme</Text>
              <Text style={S.grandValue}>{fmt(grossCents, data.currency)}</Text>
            </View>
          </View>
        </View>

        {/* Due date */}
        <View style={S.dueSection}>
          <View style={S.dueLine}>
            <Text style={S.dueLabel}>Fälligkeitsdatum:</Text>
            <Text style={S.dueValue}>{fmtDate(data.dueDate)}</Text>
          </View>
        </View>

        {/* Payment instructions */}
        <View style={S.paymentSection}>
          <Text style={S.paymentHeading}>Zahlung / Payment</Text>
          <View style={S.paymentRow}>
            <Text style={S.paymentLabel}>Method:</Text>
            <Text style={S.paymentValue}>Pay at Studio or via Bank Transfer</Text>
          </View>
          {studio.bankName && (
            <View style={S.paymentRow}>
              <Text style={S.paymentLabel}>Bank:</Text>
              <Text style={S.paymentValue}>{studio.bankName}</Text>
            </View>
          )}
          {studio.bankIban && (
            <View style={S.paymentRow}>
              <Text style={S.paymentLabel}>IBAN:</Text>
              <Text style={S.paymentValue}>{studio.bankIban}</Text>
            </View>
          )}
          {studio.bankBic && (
            <View style={S.paymentRow}>
              <Text style={S.paymentLabel}>BIC:</Text>
              <Text style={S.paymentValue}>{studio.bankBic}</Text>
            </View>
          )}
          <Text style={S.paymentNote}>
            Please pay within 14 days at the studio or transfer to the bank account above.
            Both methods are welcome — choose whichever is more convenient for you.
          </Text>
        </View>

        {/* Closing */}
        <Text style={S.closing}>
          Bei Rückfragen stehe ich selbstverständlich jederzeit gerne zur Verfügung.
        </Text>
        <Text style={S.greeting}>Mit freundlichen Grüßen</Text>
        {studio.owners ? <Text style={S.owners}>{studio.owners}</Text> : null}

        {/* Legal note */}
        <View style={S.legalNote}>
          <Text style={S.legalNoteText}>
            Dieses Dokument wurde automatisch erstellt und ist ohne Unterschrift gültig (§ 14 UStG).
            {'\n'}
            This document was generated automatically and is valid without a signature (§ 14 UStG).
          </Text>
        </View>

        {/* Footer */}
        <View style={S.footer} fixed>
          <Text style={S.footerLine}>{studio.name}</Text>
          <Text style={S.footerLine}>
            {studio.address} x {studio.city}
            {studio.email ? ` x ${studio.email}` : ''}
            {studio.phone ? ` x ${studio.phone}` : ''}
          </Text>
          {(studio.vatId || studio.bankName || studio.bankIban) ? (
            <Text style={S.footerLine}>
              {studio.vatId ? `USt-ID-NR. ${studio.vatId}` : ''}
              {studio.vatId && studio.bankName ? ' x ' : ''}
              {studio.bankName ?? ''}
              {studio.bankIban ? ` x ${studio.bankIban}` : ''}
              {studio.bankBic ? ` x BIC: ${studio.bankBic}` : ''}
            </Text>
          ) : null}
        </View>

      </Page>
    </Document>
  );
}

export class InvoicePDFError extends Error {
  constructor(message = 'PDF generation failed') {
    super(message);
    this.name = 'InvoicePDFError';
  }
}

// ─── Config loader for studioId variant ───────────────────────────────────────
async function loadStudioConfigById(studioId: string): Promise<StudioConfig> {
  const { db } = await import('@/db');
  const { eq } = await import('drizzle-orm');
  const schema = await import('@/db/schema');

  const studiosTable = (schema as unknown as Record<string, unknown>).studios as
    | { slug: unknown; id: unknown; name: unknown; status: unknown; timezone: unknown; defaultLocale: unknown; updatedAt: unknown }
    | undefined;
  const settingsTable = (schema as unknown as Record<string, unknown>).studioSettings as
    | { studioId: unknown; configJson: unknown }
    | undefined;

  if (!studiosTable || !settingsTable) {
    throw new InvoicePDFError('Studio config tables not available');
  }

  const [studioRow] = await db
    .select()
    .from(studiosTable as never)
    .where(eq(studiosTable.id as never, studioId))
    .limit(1);

  if (!studioRow) {
    throw new InvoicePDFError('Studio not found');
  }

  const { parseStudioConfig } = await import('@/lib/studio/studio.config.schema');
  const { DEFAULT_STUDIO_CONFIG } = await import('@/lib/studio/studio.config.default');

  const [settingsRow] = await db
    .select()
    .from(settingsTable as never)
    .where(eq(settingsTable.studioId as never, studioId))
    .limit(1);

  const row = studioRow as Record<string, unknown>;
  const settings = settingsRow as Record<string, unknown> | undefined;
  const configJson = (settings?.configJson as Record<string, unknown> | undefined) ?? {};

  return parseStudioConfig({
    ...configJson,
    id: row.id as string,
    status: row.status as StudioConfig['status'],
    identity: {
      ...DEFAULT_STUDIO_CONFIG.identity,
      name: row.name as string,
      slug: row.slug as string,
      ...(configJson.identity as Record<string, unknown> | undefined),
    },
    timezone: row.timezone as string,
    defaultLocale: row.defaultLocale as string,
    updatedAt: row.updatedAt instanceof Date ? row.updatedAt.toISOString() : (row.updatedAt as string | undefined),
  });
}

function isInvoiceIdentityComplete(studio: StudioInvoiceConfig): boolean {
  return Boolean(
    studio.name?.trim() &&
    studio.address?.trim() &&
    studio.city?.trim() &&
    studio.email?.trim(),
  );
}

// ─── Public API ───────────────────────────────────────────────────────────────
export async function generateInvoicePDF(
  data: InvoiceData,
  studioConfig: StudioConfig | string,
): Promise<Buffer> {
  let config: StudioConfig;
  if (typeof studioConfig === 'string') {
    config = await loadStudioConfigById(studioConfig);
  } else {
    config = studioConfig;
  }

  const studio = studioConfigToInvoiceConfig(config);
  if (!isInvoiceIdentityComplete(studio)) {
    throw new InvoiceIdentityIncompleteError();
  }

  try {
    // eslint-disable-next-line react/jsx-no-useless-fragment
    return await renderToBuffer(<InvoicePDF data={data} studio={studio} />);
  } catch (error) {
    if (error instanceof InvoiceIdentityIncompleteError) throw error;
    logger.error({ err: error, invoiceNumber: data.invoiceNumber }, 'Invoice PDF generation failed');
    throw new InvoicePDFError('PDF generation failed');
  }
}
