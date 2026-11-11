import { rateLimit } from 'express-rate-limit';

import type { ApiError } from './standard/http.js';

// Request limit inside the API (issue #31). frontend/nginx.conf limits each client first at 10 requests a
// second with bursts of 40. The API does not trust proxies, so every request through nginx shares one
// bucket: this is a global limit sized for a single-owner app, not a per-client limit.

export type RateLimitOptions = { limit?: number; windowMs?: number };

export function apiRateLimit({ limit = 1200, windowMs = 60_000 }: RateLimitOptions = {}) {
  return rateLimit({
    windowMs,
    limit,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    message: { error: 'Too many requests. Please try again in a moment' } satisfies ApiError,
    // nginx passes a client's forwarding headers through, but the API does not trust proxies:
    // every request counts against the address it came from, so these checks would only log noise.
    validate: { xForwardedForHeader: false, forwardedHeader: false },
  });
}
