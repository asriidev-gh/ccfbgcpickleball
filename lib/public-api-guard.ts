import { createHash, timingSafeEqual } from "node:crypto";

/**
 * Guard for the read-only API consumed by other websites: API key, optional origin allow-list
 * and a per-key fixed-window rate limit.
 *
 * Env:
 *   PUBLIC_API_KEYS            comma-separated keys; the API is disabled when empty
 *   PUBLIC_API_ALLOWED_ORIGINS comma-separated origins allowed for browser calls (CORS)
 *   PUBLIC_API_RATE_LIMIT      requests per minute per key + IP (default 60)
 *
 * The limiter is in memory, so it is per server instance; that is enough to blunt scraping
 * but is not a hard global cap on a multi-instance deployment.
 */

const WINDOW_MS = 60_000;
const DEFAULT_LIMIT = 60;
const MAX_TRACKED_CLIENTS = 5_000;

type Bucket = { count: number; resetAt: number };
const buckets = new Map<string, Bucket>();

function list(value: string | undefined) {
  return (value ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function digest(value: string) {
  return createHash("sha256").update(value).digest();
}

/** Constant-time compare so response timing does not leak how much of a key matched. */
function matchesAnyKey(provided: string, keys: string[]) {
  const providedDigest = digest(provided);
  let matched = false;
  for (const key of keys) {
    if (timingSafeEqual(providedDigest, digest(key))) matched = true;
  }
  return matched;
}

function readApiKey(request: Request) {
  const bearer = request.headers.get("authorization")?.match(/^Bearer\s+(.+)$/i)?.[1];
  return (bearer ?? request.headers.get("x-api-key") ?? "").trim();
}

function clientIp(request: Request) {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || request.headers.get("x-real-ip") || "unknown";
}

function rateLimitPerMinute() {
  const parsed = Number.parseInt(process.env.PUBLIC_API_RATE_LIMIT ?? "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_LIMIT;
}

function consume(clientKey: string, limit: number) {
  const now = Date.now();

  if (buckets.size > MAX_TRACKED_CLIENTS) {
    for (const [key, bucket] of buckets) {
      if (bucket.resetAt <= now) buckets.delete(key);
    }
  }

  const existing = buckets.get(clientKey);
  const bucket =
    existing && existing.resetAt > now ? existing : { count: 0, resetAt: now + WINDOW_MS };
  bucket.count += 1;
  buckets.set(clientKey, bucket);

  return {
    allowed: bucket.count <= limit,
    remaining: Math.max(0, limit - bucket.count),
    retryAfterSeconds: Math.max(1, Math.ceil((bucket.resetAt - now) / 1000)),
    resetAtSeconds: Math.ceil(bucket.resetAt / 1000),
  };
}

/** CORS headers for an allow-listed origin; empty for anything else (server-to-server calls). */
export function publicApiCorsHeaders(request: Request): Record<string, string> {
  const origin = request.headers.get("origin");
  if (!origin || !list(process.env.PUBLIC_API_ALLOWED_ORIGINS).includes(origin)) return {};
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Headers": "Authorization, X-API-Key",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  };
}

export type PublicApiGuardResult =
  | { ok: true; headers: Record<string, string> }
  | { ok: false; status: number; message: string; headers: Record<string, string> };

export function guardPublicApiRequest(request: Request): PublicApiGuardResult {
  const headers: Record<string, string> = { ...publicApiCorsHeaders(request) };

  const keys = list(process.env.PUBLIC_API_KEYS);
  if (keys.length === 0) {
    return { ok: false, status: 503, message: "API is not enabled.", headers };
  }

  // Throttle by IP before checking the key, so wrong-key guessing is rate limited too.
  const limit = rateLimitPerMinute();
  const ip = clientIp(request);
  const apiKey = readApiKey(request);

  if (!apiKey || !matchesAnyKey(apiKey, keys)) {
    const attempt = consume(`bad:${ip}`, limit);
    if (!attempt.allowed) {
      return {
        ok: false,
        status: 429,
        message: "Too many requests.",
        headers: { ...headers, "Retry-After": String(attempt.retryAfterSeconds) },
      };
    }
    return { ok: false, status: 401, message: "Missing or invalid API key.", headers };
  }

  const result = consume(`${digest(apiKey).toString("hex").slice(0, 16)}:${ip}`, limit);
  headers["X-RateLimit-Limit"] = String(limit);
  headers["X-RateLimit-Remaining"] = String(result.remaining);
  headers["X-RateLimit-Reset"] = String(result.resetAtSeconds);

  if (!result.allowed) {
    return {
      ok: false,
      status: 429,
      message: "Too many requests.",
      headers: { ...headers, "Retry-After": String(result.retryAfterSeconds) },
    };
  }

  return { ok: true, headers };
}
