import type { QueryClient } from "@tanstack/react-query";

import {
  operatorQueueQueryKey,
  operatorShellQueryKey,
} from "@/lib/fetch-operator-game";
import type { OperatorQueuePayload, OperatorShellPayload } from "@/lib/operator-payload";

const SHELL_PREFIX = "ccf-operator-shell-cache:";
const QUEUE_PREFIX = "ccf-operator-queue-cache:";
/** Drop cached snapshots older than this (sessionStorage survives tab restores). */
const MAX_AGE_MS = 30 * 60_000;

type TimedShell = { savedAt: number; shell: OperatorShellPayload };
type TimedQueue = { savedAt: number; queue: OperatorQueuePayload };

export type OperatorDashboardSessionCache = {
  savedAt: number;
  shell: OperatorShellPayload;
  queue: OperatorQueuePayload;
};

function shellKey(gameId: string) {
  return `${SHELL_PREFIX}${gameId}`;
}

function queueKey(gameId: string) {
  return `${QUEUE_PREFIX}${gameId}`;
}

/** Avoid persisting large base64 QR payloads in sessionStorage. */
function leanShell(shell: OperatorShellPayload): OperatorShellPayload {
  if (!shell.game.publicQrCodeDataUrl) return shell;
  return {
    ...shell,
    game: {
      ...shell.game,
      publicQrCodeDataUrl: undefined,
    },
  };
}

function isOperatorShellPayload(value: unknown): value is OperatorShellPayload {
  if (!value || typeof value !== "object") return false;
  const game = (value as OperatorShellPayload).game;
  return Boolean(game && typeof game.gameId === "string" && typeof game.title === "string");
}

function isOperatorQueuePayload(value: unknown): value is OperatorQueuePayload {
  if (!value || typeof value !== "object") return false;
  const payload = value as OperatorQueuePayload;
  return (
    Array.isArray(payload.queue) &&
    Array.isArray(payload.courts) &&
    Array.isArray(payload.checkedOut) &&
    (payload.status === "draft" || payload.status === "active" || payload.status === "ended")
  );
}

function readTimedShell(gameId: string): TimedShell | null {
  if (typeof window === "undefined" || !gameId) return null;
  try {
    const raw = sessionStorage.getItem(shellKey(gameId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<TimedShell>;
    if (typeof parsed.savedAt !== "number" || !isOperatorShellPayload(parsed.shell)) {
      sessionStorage.removeItem(shellKey(gameId));
      return null;
    }
    if (Date.now() - parsed.savedAt > MAX_AGE_MS) {
      sessionStorage.removeItem(shellKey(gameId));
      return null;
    }
    return { savedAt: parsed.savedAt, shell: parsed.shell };
  } catch {
    return null;
  }
}

function readTimedQueue(gameId: string): TimedQueue | null {
  if (typeof window === "undefined" || !gameId) return null;
  try {
    const raw = sessionStorage.getItem(queueKey(gameId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<TimedQueue>;
    if (typeof parsed.savedAt !== "number" || !isOperatorQueuePayload(parsed.queue)) {
      sessionStorage.removeItem(queueKey(gameId));
      return null;
    }
    if (Date.now() - parsed.savedAt > MAX_AGE_MS) {
      sessionStorage.removeItem(queueKey(gameId));
      return null;
    }
    return { savedAt: parsed.savedAt, queue: parsed.queue };
  } catch {
    return null;
  }
}

export function readOperatorDashboardSessionCache(
  gameId: string,
): OperatorDashboardSessionCache | null {
  const shell = readTimedShell(gameId);
  const queue = readTimedQueue(gameId);
  if (!shell || !queue) return null;
  return {
    savedAt: Math.min(shell.savedAt, queue.savedAt),
    shell: shell.shell,
    queue: queue.queue,
  };
}

export function readOperatorShellSessionCache(gameId: string): OperatorShellPayload | null {
  return readTimedShell(gameId)?.shell ?? null;
}

export function readOperatorQueueSessionCache(gameId: string): OperatorQueuePayload | null {
  return readTimedQueue(gameId)?.queue ?? null;
}

export function writeOperatorShellSessionCache(gameId: string, shell: OperatorShellPayload) {
  if (typeof window === "undefined" || !gameId) return;
  try {
    const payload: TimedShell = { savedAt: Date.now(), shell: leanShell(shell) };
    sessionStorage.setItem(shellKey(gameId), JSON.stringify(payload));
  } catch {
    // Quota or private mode — ignore.
  }
}

export function writeOperatorQueueSessionCache(gameId: string, queue: OperatorQueuePayload) {
  if (typeof window === "undefined" || !gameId) return;
  try {
    const payload: TimedQueue = { savedAt: Date.now(), queue };
    sessionStorage.setItem(queueKey(gameId), JSON.stringify(payload));
  } catch {
    // Quota or private mode — ignore.
  }
}

export function persistOperatorDashboardSessionCacheFromClient(
  queryClient: QueryClient,
  gameId: string,
) {
  if (!gameId) return;
  const shell = queryClient.getQueryData<OperatorShellPayload>(operatorShellQueryKey(gameId));
  const queue = queryClient.getQueryData<OperatorQueuePayload>(operatorQueueQueryKey(gameId));
  if (shell) writeOperatorShellSessionCache(gameId, shell);
  if (queue) writeOperatorQueueSessionCache(gameId, queue);
}

/** Seed React Query from sessionStorage so refresh can paint before the network returns. */
export function hydrateOperatorDashboardSessionCache(
  queryClient: QueryClient,
  gameId: string,
): boolean {
  if (!gameId) return false;
  let hydrated = false;
  const shell = readOperatorShellSessionCache(gameId);
  const queue = readOperatorQueueSessionCache(gameId);

  // Mark as stale so React Query refetches immediately while still showing this snapshot.
  const staleUpdatedAt = 0;

  if (shell && !queryClient.getQueryData(operatorShellQueryKey(gameId))) {
    queryClient.setQueryData(operatorShellQueryKey(gameId), shell, {
      updatedAt: staleUpdatedAt,
    });
    hydrated = true;
  }
  if (queue && !queryClient.getQueryData(operatorQueueQueryKey(gameId))) {
    queryClient.setQueryData(operatorQueueQueryKey(gameId), queue, {
      updatedAt: staleUpdatedAt,
    });
    hydrated = true;
  }
  return hydrated;
}

export function clearOperatorDashboardSessionCache(gameId: string) {
  if (typeof window === "undefined" || !gameId) return;
  try {
    sessionStorage.removeItem(shellKey(gameId));
    sessionStorage.removeItem(queueKey(gameId));
  } catch {
    // ignore
  }
}
