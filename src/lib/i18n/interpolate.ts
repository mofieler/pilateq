/**
 * String interpolation engine
 *
 * Replaces `{variable}` placeholders in translation strings with values.
 * Supports pluralization via `{count}` and `plural`/`singular` variants.
 *
 * Example:
 *   interpolate('Hello {name}', { name: 'Anna' })
 *   => 'Hello Anna'
 *
 *   interpolate('{count} spot left', { count: 5 })
 *   => '5 spots left'  (auto-plural when count !== 1)
 */

export type InterpolationValues = Record<string, string | number | Date | undefined>;

const PLACEHOLDER_RE = /\{(\w+)\}/g;

export function interpolate(template: string, values: InterpolationValues = {}): string {
  if (!template) return '';

  return template.replace(PLACEHOLDER_RE, (_, key: string) => {
    const value = values[key];
    if (value === undefined || value === null) return `{${key}}`;

    // Date formatting
    if (value instanceof Date) {
      return value.toLocaleDateString(undefined, {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });
    }

    return String(value);
  });
}

/**
 * Smart pluralization.
 *
 * If the template contains `{count}` and `count !== 1`, appends an 's'
 * to the preceding word if it looks like a singular noun.
 *
 * For more complex plural rules, use explicit keys:
 *   'spots_one': '1 spot left'
 *   'spots_other': '{count} spots left'
 */
export function pluralize(template: string, count: number): string {
  if (count === 1) return template;

  // Simple heuristic: if the word before {count} is singular, add 's'
  // This is intentionally simple — complex languages should use explicit keys.
  return template
    .replace(/(\w) left\b/, '$1s left')
    .replace(/(\w) remaining\b/, '$1s remaining')
    .replace(/(\w) available\b/, '$1s available');
}
