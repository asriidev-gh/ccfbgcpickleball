import {
  shouldIgnoreClientError,
  type ClientErrorReportPayload,
} from "@/lib/client-error-reporting-shared";
import { recordSystemLog } from "@/lib/system-log";

const MAX_MESSAGE_LENGTH = 4_000;
const MAX_STACK_LENGTH = 8_000;
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX_PER_KEY = 8;

const recentReports = new Map<string, number[]>();

function truncate(value: string | undefined, max: number) {
  if (!value) return undefined;
  if (value.length <= max) return value;
  return `${value.slice(0, max)}…`;
}

function buildRateLimitKey(input: ClientErrorReportPayload, clientKey: string) {
  return `${clientKey}|${input.kind}|${input.route ?? ""}|${input.message.slice(0, 200)}`;
}

function isRateLimited(key: string) {
  const now = Date.now();
  const timestamps = (recentReports.get(key) ?? []).filter(
    (value) => now - value < RATE_LIMIT_WINDOW_MS,
  );
  if (timestamps.length >= RATE_LIMIT_MAX_PER_KEY) {
    recentReports.set(key, timestamps);
    return true;
  }
  timestamps.push(now);
  recentReports.set(key, timestamps);
  return false;
}

export function ingestClientErrorReport(
  input: ClientErrorReportPayload,
  clientKey: string,
) {
  const message = input.message.trim();
  if (!message) return { accepted: false as const, reason: "empty" };

  const stack = truncate(input.stack, MAX_STACK_LENGTH);
  if (shouldIgnoreClientError(message, stack)) {
    return { accepted: false as const, reason: "ignored" };
  }

  const rateLimitKey = buildRateLimitKey(input, clientKey);
  if (isRateLimited(rateLimitKey)) {
    return { accepted: false as const, reason: "rate_limited" };
  }

  recordSystemLog({
    level: "error",
    source: `client/${input.kind}`,
    message: truncate(message, MAX_MESSAGE_LENGTH) ?? message,
    stack,
    route: input.route?.trim().slice(0, 240),
    metadata: {
      userAgent: input.userAgent?.trim().slice(0, 500),
      componentStack: truncate(input.componentStack, MAX_STACK_LENGTH),
    },
  });

  return { accepted: true as const };
}
