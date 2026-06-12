/**
 * Shared result type for server actions and service callers.
 *
 * Using a single shape keeps action boundaries predictable for UI code and
 * avoids ad-hoc `{ success, error, code }` re-declarations across modules.
 */
export type ActionResult<T, Code extends string = string> =
  | { success: true; data: T }
  | { success: false; error: string; code: Code };
