import { createHash } from 'crypto';

/**
 * Studio liability waiver content.
 *
 * The text can be overridden via the `WAIVER_TEXT` environment variable
 * (server-side only). A version hash is computed from the final text so that
 * signed waivers can be tied to the exact document the user agreed to.
 */

const DEFAULT_WAIVER_TEXT = `
Liability Waiver and Release of Claims

By signing this waiver, you acknowledge that participation in Pilates, yoga, reformer, mat, chair, and any other movement classes offered by the studio involves inherent risks, including but not limited to muscle strain, injury, dizziness, fatigue, and aggravation of pre-existing conditions. You voluntarily assume all risks associated with your participation.

You confirm that you are in good physical health and have consulted a physician if you have any condition that may affect your ability to participate safely. You agree to inform the instructor of any medical concerns, injuries, or limitations before class.

In consideration of being permitted to participate, you hereby release, waive, discharge, and covenant not to sue the studio, its owners, instructors, employees, and agents from any and all liability, claims, demands, actions, or causes of action arising out of or related to any loss, damage, or injury sustained during or as a result of your participation, whether caused by negligence or otherwise.

You agree that this waiver is binding on you, your heirs, executors, administrators, and assigns. If any provision of this waiver is found to be unenforceable, the remaining provisions shall continue in full force and effect.
`;

function normalizeText(text: string): string {
  return text.replace(/\r\n/g, '\n').trim();
}

export const WAIVER_TEXT = normalizeText(process.env.WAIVER_TEXT ?? DEFAULT_WAIVER_TEXT);

export function computeWaiverVersion(text: string): string {
  return createHash('sha256').update(text).digest('hex').slice(0, 16);
}

export const WAIVER_VERSION = computeWaiverVersion(WAIVER_TEXT);
