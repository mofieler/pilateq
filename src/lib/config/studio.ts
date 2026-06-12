/**
 * Studio info read from environment variables.
 * All fields have safe, generic fallbacks so the app never exposes customer
 * data when variables are missing.
 */
export const STUDIO = {
  name:          process.env.STUDIO_NAME    ?? 'Your Studio',
  address:       process.env.STUDIO_ADDRESS ?? '',
  city:          process.env.STUDIO_CITY    ?? '',
  country:       process.env.STUDIO_COUNTRY ?? 'Germany',
  phone:         process.env.STUDIO_PHONE   ?? '',
  email:         process.env.STUDIO_EMAIL   ?? '',
  steuernummer:  process.env.STUDIO_STEUERNUMMER ?? '',
  finanzamt:     process.env.STUDIO_FINANZAMT    ?? '',
  partners:      process.env.STUDIO_PARTNERS     ?? '',
  website:       process.env.STUDIO_WEBSITE      ?? '',
  bookingUrl:    process.env.NEXT_PUBLIC_APP_URL  ?? '',
} as const;

/**
 * Returns true when the minimum identity fields required for legal documents
 * and invoices are configured.
 */
export function isStudioIdentityComplete(): boolean {
  return Boolean(
    STUDIO.name?.trim() &&
    STUDIO.address?.trim() &&
    STUDIO.city?.trim() &&
    STUDIO.email?.trim(),
  );
}
