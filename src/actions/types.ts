/**
 * `limit` is an optional, additive payload on the error branch — existing
 * callers that only read `{ ok, error }` are unaffected. Set it only when
 * the failure IS a usage-limit rejection, so the UI can render an upgrade
 * prompt (feature, used/cap, tier) instead of a generic error toast.
 */
export interface LimitInfo {
  feature: string;
  used: number;
  cap: number;
  tier: string;
}

export type ActionResult<T = null> =
  | { ok: true; data: T }
  | { ok: false; error: string; limit?: LimitInfo };

export const actionError = (error: string): ActionResult<never> => ({
  ok: false,
  error,
});

export const actionLimitError = (
  error: string,
  limit: LimitInfo,
): ActionResult<never> => ({
  ok: false,
  error,
  limit,
});
