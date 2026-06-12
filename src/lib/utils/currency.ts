/**
 * Currency utilities — centralise all euro↔cents conversions
 * so rounding, formatting, and division logic lives in one place.
 */

/** Convert euros (as float or string) to integer cents. */
export function euroToCents(euros: string | number): number {
  const parsed = typeof euros === 'string' ? parseFloat(euros) : euros;
  if (Number.isNaN(parsed)) return 0;
  return Math.round(parsed * 100);
}

/** Convert integer cents to euros as a float. */
export function centsToEuro(cents: number): number {
  return cents / 100;
}

/** Format cents as a euro string with 2 decimals (e.g. 11500 → "115.00"). */
export function formatPriceCents(cents: number): string {
  return (cents / 100).toFixed(2);
}

/** Format cents as a display string with € symbol (e.g. 11500 → "€115.00"). */
export function formatPrice(cents: number): string {
  return `€${formatPriceCents(cents)}`;
}
