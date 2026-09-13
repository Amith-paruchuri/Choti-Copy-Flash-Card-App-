export type ActionResult<T = null> =
  | { ok: true; data: T }
  | { ok: false; error: string };

export const actionError = (error: string): ActionResult<never> => ({
  ok: false,
  error,
});
