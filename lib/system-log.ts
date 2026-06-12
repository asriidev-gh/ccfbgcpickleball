import { SystemLog } from "@/models/SystemLog";
import type { SystemLogLevel, SystemLogListItem } from "@/lib/system-log-shared";

export type { SystemLogLevel, SystemLogListItem } from "@/lib/system-log-shared";
export { formatSystemLogUserLabel } from "@/lib/system-log-shared";

export type SystemLogActor = {
  userId: string;
  userEmail: string;
  userName: string;
};

export type RecordSystemLogInput = {
  level: SystemLogLevel;
  source: string;
  message: string;
  stack?: string;
  route?: string;
  method?: string;
  statusCode?: number;
  userId?: string;
  userEmail?: string;
  userName?: string;
  metadata?: Record<string, unknown>;
};

const MAX_MESSAGE_LENGTH = 4_000;
const MAX_STACK_LENGTH = 8_000;

function truncate(value: string | undefined, max: number) {
  if (!value) return undefined;
  if (value.length <= max) return value;
  return `${value.slice(0, max)}…`;
}

function errorMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  return "Unknown error";
}

function errorStack(error: unknown) {
  if (error instanceof Error && error.stack) return error.stack;
  return undefined;
}

/** Best-effort signed-in user from the auth cookie (no database lookup). */
export async function resolveRequestActor(): Promise<SystemLogActor | null> {
  try {
    const { readAuthTokenPayload } = await import("@/lib/auth");
    const payload = await readAuthTokenPayload();
    if (!payload) return null;
    return {
      userId: payload.userId,
      userEmail: payload.email,
      userName: payload.name,
    };
  } catch {
    return null;
  }
}

function mergeActor(
  input: Pick<RecordSystemLogInput, "userId" | "userEmail" | "userName">,
  actor: SystemLogActor | null | undefined,
) {
  return {
    userId: input.userId ?? actor?.userId,
    userEmail: input.userEmail ?? actor?.userEmail,
    userName: input.userName ?? actor?.userName,
  };
}

function buildLogPayload(input: RecordSystemLogInput, actor?: SystemLogActor | null) {
  const user = mergeActor(input, actor);

  return {
    level: input.level,
    source: input.source.trim().slice(0, 120) || "app",
    message: truncate(input.message.trim(), MAX_MESSAGE_LENGTH) ?? "Unknown error",
    stack: truncate(input.stack, MAX_STACK_LENGTH),
    route: input.route?.trim().slice(0, 240),
    method: input.method?.trim().slice(0, 16),
    statusCode: input.statusCode,
    userId: user.userId?.trim().slice(0, 64),
    userEmail: user.userEmail?.trim().slice(0, 240),
    userName: user.userName?.trim().slice(0, 160),
    metadata: input.metadata,
    occurredAt: new Date(),
  };
}

function shouldSkipDatabasePersist(input: RecordSystemLogInput) {
  if (input.source === "db") return true;
  return /mongodb connection failed|connection failed after|must be connected|client was closed/i.test(
    input.message,
  );
}

function writeConsoleLog(payload: ReturnType<typeof buildLogPayload>) {
  const userSuffix = payload.userEmail
    ? ` [user: ${payload.userName ?? payload.userEmail} <${payload.userEmail}>]`
    : "";
  const consoleLine = `[system-log:${payload.level}] ${payload.source}${userSuffix} — ${payload.message}`;

  if (payload.level === "error") {
    console.error(consoleLine, payload.stack ?? "");
  } else if (payload.level === "warn") {
    console.warn(consoleLine);
  } else {
    console.info(consoleLine);
  }
}

/** Persist a system log without blocking the caller. */
export function recordSystemLog(input: RecordSystemLogInput) {
  void (async () => {
    const actor = await resolveRequestActor();
    const payload = buildLogPayload(input, actor);
    writeConsoleLog(payload);

    if (shouldSkipDatabasePersist(input)) return;

    try {
      const { runWithDatabase } = await import("@/lib/db");
      await runWithDatabase(async () => {
        await SystemLog.create(payload);
      });
    } catch (persistError) {
      console.error(
        "[system-log] Failed to persist log entry:",
        persistError instanceof Error ? persistError.message : persistError,
      );
    }
  })();
}

export function logApiError(input: {
  source: string;
  error: unknown;
  request?: Request;
  route?: string;
  method?: string;
  statusCode?: number;
  userId?: string;
  userEmail?: string;
  userName?: string;
  actor?: SystemLogActor | null;
  metadata?: Record<string, unknown>;
}) {
  void (async () => {
    const url = input.request ? new URL(input.request.url) : null;
    const actor =
      input.actor !== undefined ? input.actor : await resolveRequestActor();

    const payload = buildLogPayload(
      {
        level: "error",
        source: input.source,
        message: errorMessage(input.error),
        stack: errorStack(input.error),
        route: input.route ?? url?.pathname,
        method: input.request?.method ?? input.method,
        statusCode: input.statusCode,
        userId: input.userId,
        userEmail: input.userEmail,
        userName: input.userName,
        metadata: input.metadata,
      },
      actor,
    );

    writeConsoleLog(payload);

    if (shouldSkipDatabasePersist(payload)) return;

    try {
      const { runWithDatabase } = await import("@/lib/db");
      await runWithDatabase(async () => {
        await SystemLog.create(payload);
      });
    } catch (persistError) {
      console.error(
        "[system-log] Failed to persist log entry:",
        persistError instanceof Error ? persistError.message : persistError,
      );
    }
  })();
}

export async function listSystemLogs(input: { limit?: number; before?: Date } = {}) {
  const limit = Math.min(Math.max(input.limit ?? 50, 1), 100);
  const filter = input.before ? { occurredAt: { $lt: input.before } } : {};

  const rows = await SystemLog.find(filter)
    .sort({ occurredAt: -1 })
    .limit(limit)
    .lean();

  return rows.map((row) => ({
    id: String(row._id),
    level: row.level as SystemLogLevel,
    source: row.source,
    message: row.message,
    stack: row.stack ?? undefined,
    route: row.route ?? undefined,
    method: row.method ?? undefined,
    statusCode: row.statusCode ?? undefined,
    userId: row.userId ?? undefined,
    userEmail: row.userEmail ?? undefined,
    userName: row.userName ?? undefined,
    metadata: row.metadata as Record<string, unknown> | undefined,
    occurredAt: row.occurredAt.toISOString(),
  })) satisfies SystemLogListItem[];
}
