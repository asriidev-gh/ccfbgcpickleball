import { NextResponse } from "next/server";

import { logApiError, type SystemLogActor } from "@/lib/system-log";

type HandleApiErrorOptions = {
  source: string;
  request?: Request;
  status?: number;
  message?: string;
  actor?: SystemLogActor | null;
  metadata?: Record<string, unknown>;
};

/** Log the failure (with signed-in user when available) and return a JSON error response. */
export function handleApiError(error: unknown, options: HandleApiErrorOptions) {
  const status = options.status ?? 400;
  logApiError({
    source: options.source,
    error,
    request: options.request,
    statusCode: status,
    actor: options.actor,
    metadata: options.metadata,
  });

  const message =
    options.message ??
    (error instanceof Error ? error.message : "Request failed.");

  return NextResponse.json({ message }, { status });
}
