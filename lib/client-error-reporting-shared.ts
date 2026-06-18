export const CLIENT_ERROR_REPORT_KINDS = [
  "uncaught",
  "unhandledrejection",
  "react-boundary",
] as const;

export type ClientErrorReportKind = (typeof CLIENT_ERROR_REPORT_KINDS)[number];

export type ClientErrorReportPayload = {
  kind: ClientErrorReportKind;
  message: string;
  stack?: string;
  route?: string;
  componentStack?: string;
  userAgent?: string;
};

const IGNORED_MESSAGE_PATTERNS = [
  /releasePointerCapture/i,
  /ResizeObserver loop/i,
  /Loading chunk \d+ failed/i,
  /ChunkLoadError/i,
  /next-devtools/i,
  /^Script error\.?$/i,
  /cancelled/i,
  /AbortError/i,
  /The operation was aborted/i,
];

export function shouldIgnoreClientError(message: string, stack?: string) {
  const haystack = `${message}\n${stack ?? ""}`;
  return IGNORED_MESSAGE_PATTERNS.some((pattern) => pattern.test(haystack));
}

export function shouldReportClientErrorsInBrowser() {
  if (typeof window === "undefined") return false;
  if (process.env.NEXT_PUBLIC_CLIENT_ERROR_REPORTING === "true") return true;
  return process.env.NODE_ENV === "production";
}
