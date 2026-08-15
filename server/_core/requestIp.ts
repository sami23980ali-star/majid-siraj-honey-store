/**
 * Single source of truth for "who sent this request".
 *
 * `_core/index.ts` configures `trust proxy`, so express derives `req.ip` from the
 * rightmost hop it does not trust in `x-forwarded-for`. That is the value to use:
 * reading the leftmost entry of the raw header — which is what this code did
 * before — lets any client prepend a fabricated address and poison both the
 * admin login audit trail and any per-IP rate limit.
 *
 * The raw header is consulted only when express produced nothing, which happens
 * for synthetic request objects in tests.
 */

const MAX_IP_LENGTH = 64;

type IpBearingRequest = {
  ip?: string;
  headers: Record<string, string | string[] | undefined>;
  socket?: { remoteAddress?: string };
};

function firstHeaderValue(value: string | string[] | undefined) {
  if (Array.isArray(value)) return value[0];
  return value?.split(",")[0];
}

/** Normalized client address, or `undefined` when it cannot be determined. */
export function getClientIp(request: IpBearingRequest): string | undefined {
  const candidates = [
    request.ip,
    request.socket?.remoteAddress,
    firstHeaderValue(request.headers["x-forwarded-for"]),
  ];

  for (const candidate of candidates) {
    const normalized = candidate?.trim().slice(0, MAX_IP_LENGTH);
    if (normalized) return normalized;
  }

  return undefined;
}

/** Never-empty variant, for use as a rate-limit bucket key. */
export function getRateLimitKey(request: IpBearingRequest, scope: string) {
  return `${scope}:${getClientIp(request) ?? "unknown"}`;
}
