"use client";

import { useEffect } from "react";

import {
  shouldIgnoreClientError,
  shouldReportClientErrorsInBrowser,
  type ClientErrorReportKind,
  type ClientErrorReportPayload,
} from "@/lib/client-error-reporting-shared";

const DEDUPE_WINDOW_MS = 60_000;
const recentClientKeys = new Set<string>();

function rememberClientKey(key: string) {
  if (recentClientKeys.has(key)) return false;
  recentClientKeys.add(key);
  window.setTimeout(() => recentClientKeys.delete(key), DEDUPE_WINDOW_MS);
  return true;
}

function sendClientErrorReport(payload: ClientErrorReportPayload) {
  if (!shouldReportClientErrorsInBrowser()) return;
  if (shouldIgnoreClientError(payload.message, payload.stack)) return;

  const dedupeKey = `${payload.kind}|${payload.route ?? ""}|${payload.message}`;
  if (!rememberClientKey(dedupeKey)) return;

  void fetch("/api/system-logs/report", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      ...payload,
      route: payload.route ?? window.location.pathname,
      userAgent: navigator.userAgent,
    }),
  }).catch(() => {
    // Best-effort only.
  });
}

function reportFromUnknown(kind: ClientErrorReportKind, error: unknown) {
  if (error instanceof Error) {
    sendClientErrorReport({
      kind,
      message: error.message || error.name || "Unknown error",
      stack: error.stack,
      route: window.location.pathname,
    });
    return;
  }

  sendClientErrorReport({
    kind,
    message: typeof error === "string" ? error : "Unknown error",
    route: window.location.pathname,
  });
}

export function ClientErrorReporter({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    if (!shouldReportClientErrorsInBrowser()) return;

    const onError = (event: ErrorEvent) => {
      sendClientErrorReport({
        kind: "uncaught",
        message: event.message || "Uncaught error",
        stack: event.error instanceof Error ? event.error.stack : undefined,
        route: window.location.pathname,
      });
    };

    const onUnhandledRejection = (event: PromiseRejectionEvent) => {
      reportFromUnknown("unhandledrejection", event.reason);
    };

    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onUnhandledRejection);
    return () => {
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onUnhandledRejection);
    };
  }, []);

  return children;
}
