/**
 * Lightweight RFC 5545 iCalendar generator for single events.
 * No external dependency — handles escaping, line-folding, and UTC formatting.
 */

import { FROM, STUDIO_NAME, APP_URL } from './_base';

const STUDIO_ADDRESS = process.env.STUDIO_ADDRESS ?? STUDIO_NAME;
const ORGANIZER_EMAIL = FROM;

function appHostname(): string {
  try {
    return new URL(APP_URL).hostname || 'localhost';
  } catch {
    return 'localhost';
  }
}

// ─── Escaping ─────────────────────────────────────────────────────────────────

function escapeIcalText(value: string): string {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '');
}

// ─── Line folding ─────────────────────────────────────────────────────────────

function foldLine(line: string): string {
  const lines: string[] = [];
  let remaining = line;
  while (remaining.length > 0) {
    // Take up to 75 bytes (simple char count is fine for ASCII + basic UTF-8)
    let chunk = remaining.slice(0, 75);
    lines.push(chunk);
    remaining = remaining.slice(75);
    if (remaining.length > 0) {
      remaining = ' ' + remaining;
    }
  }
  return lines.join('\r\n');
}

// ─── UTC date-time formatter ──────────────────────────────────────────────────

function formatUtcDateTime(date: Date): string {
  return date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
}

// ─── Public API ───────────────────────────────────────────────────────────────

export interface IcsEventOptions {
  uid: string;
  method: 'REQUEST' | 'CANCEL';
  status: 'CONFIRMED' | 'CANCELLED';
  sequence: number;
  summary: string;
  description: string;
  location?: string;
  startAt: Date;
  endAt: Date;
  organizerEmail?: string;
  organizerName?: string;
}

export function generateIcsBuffer(opts: IcsEventOptions): Buffer {
  const {
    uid,
    method,
    status,
    sequence,
    summary,
    description,
    location,
    startAt,
    endAt,
    organizerEmail = ORGANIZER_EMAIL,
    organizerName = STUDIO_NAME,
  } = opts;

  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    `PRODID:-//${escapeIcalText(STUDIO_NAME)}//${escapeIcalText(appHostname())}//EN`,
    `METHOD:${method}`,
    'BEGIN:VEVENT',
    `UID:${uid}`,
    `SEQUENCE:${sequence}`,
    `STATUS:${status}`,
    `DTSTART:${formatUtcDateTime(startAt)}`,
    `DTEND:${formatUtcDateTime(endAt)}`,
    `SUMMARY:${escapeIcalText(summary)}`,
    `DESCRIPTION:${escapeIcalText(description)}`,
    `LOCATION:${escapeIcalText(location ?? STUDIO_ADDRESS)}`,
    `ORGANIZER;CN=${escapeIcalText(organizerName)}:mailto:${organizerEmail}`,
    'END:VEVENT',
    'END:VCALENDAR',
  ];

  const folded = lines.map(foldLine).join('\r\n') + '\r\n';
  return Buffer.from(folded, 'utf-8');
}

// ─── Convenience helpers ──────────────────────────────────────────────────────

export function generateBookingIcs(
  bookingId: string,
  method: 'REQUEST' | 'CANCEL',
  status: 'CONFIRMED' | 'CANCELLED',
  sequence: number,
  summary: string,
  description: string,
  startAt: Date,
  endAt: Date,
  location?: string,
): Buffer {
  return generateIcsBuffer({
    uid: `booking-${bookingId}@${appHostname()}`,
    method,
    status,
    sequence,
    summary,
    description,
    location,
    startAt,
    endAt,
  });
}

export function generateSessionIcs(
  sessionId: string,
  method: 'REQUEST' | 'CANCEL',
  status: 'CONFIRMED' | 'CANCELLED',
  sequence: number,
  summary: string,
  description: string,
  startAt: Date,
  endAt: Date,
  location?: string,
): Buffer {
  return generateIcsBuffer({
    uid: `session-${sessionId}@${appHostname()}`,
    method,
    status,
    sequence,
    summary,
    description,
    location,
    startAt,
    endAt,
  });
}

export function generateWelcomeJourneyIcs(
  bookingId: string,
  method: 'REQUEST' | 'CANCEL',
  status: 'CONFIRMED' | 'CANCELLED',
  sequence: number,
  summary: string,
  description: string,
  startAt: Date,
  endAt: Date,
  location?: string,
): Buffer {
  return generateIcsBuffer({
    uid: `wj-booking-${bookingId}@${appHostname()}`,
    method,
    status,
    sequence,
    summary,
    description,
    location,
    startAt,
    endAt,
  });
}
