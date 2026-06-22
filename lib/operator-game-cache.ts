import type { QueryClient } from "@tanstack/react-query";

import type { GamePayload } from "@/lib/game-payload-mutations";
import { isQuickGame } from "@/lib/local-game-id";
import {
  operatorDetailsQueryKey,
  operatorQueueQueryKey,
  operatorShellQueryKey,
} from "@/lib/fetch-operator-game";
import {
  mergeOperatorGamePayload,
  type OperatorDetailsPayload,
  type OperatorQueuePayload,
  type OperatorShellPayload,
} from "@/lib/operator-payload";
import { readQuickGamePayload, writeQuickGamePayload } from "@/lib/quick-game-store";

export function readOperatorGamePayload(
  queryClient: QueryClient,
  gameId: string,
): GamePayload | undefined {
  if (isQuickGame(gameId)) {
    return readQuickGamePayload(gameId);
  }

  const shell = queryClient.getQueryData<OperatorShellPayload>(operatorShellQueryKey(gameId));
  if (!shell) return undefined;
  const queue = queryClient.getQueryData<OperatorQueuePayload>(operatorQueueQueryKey(gameId));
  const details = queryClient.getQueryData<OperatorDetailsPayload>(operatorDetailsQueryKey(gameId));
  return mergeOperatorGamePayload(shell, queue, details);
}

export function writeOperatorGamePayload(
  queryClient: QueryClient,
  gameId: string,
  next: GamePayload,
) {
  if (isQuickGame(gameId)) {
    writeQuickGamePayload(gameId, next);
    return;
  }

  const shell = queryClient.getQueryData<OperatorShellPayload>(operatorShellQueryKey(gameId));
  if (shell) {
    queryClient.setQueryData<OperatorShellPayload>(operatorShellQueryKey(gameId), {
      game: { ...shell.game, status: next.game.status },
    });
  }
  const existingQueue = queryClient.getQueryData<OperatorQueuePayload>(operatorQueueQueryKey(gameId));
  queryClient.setQueryData<OperatorQueuePayload>(operatorQueueQueryKey(gameId), {
    status: next.game.status,
    queue: next.queue,
    checkedOut: next.checkedOut ?? [],
    courts: next.courts,
    firstTimerCount: next.firstTimerCount ?? existingQueue?.firstTimerCount ?? 0,
    birthdayThisMonthCount:
      next.birthdayThisMonthCount ?? existingQueue?.birthdayThisMonthCount ?? 0,
  });
  queryClient.setQueryData<OperatorDetailsPayload>(operatorDetailsQueryKey(gameId), {
    leaderboard: next.leaderboard ?? [],
    matches: next.matches ?? [],
    recap: next.recap,
    qr:
      next.game.registerUrl && next.game.publicQrCodeDataUrl
        ? {
            registerUrl: next.game.registerUrl,
            publicQrCodeDataUrl: next.game.publicQrCodeDataUrl,
          }
        : undefined,
  });
}

export function seedLocalGameOperatorCache(queryClient: QueryClient, gameId: string) {
  const payload = readQuickGamePayload(gameId);
  if (!payload) return;

  queryClient.setQueryData<OperatorShellPayload>(operatorShellQueryKey(gameId), {
    game: payload.game,
  });
  queryClient.setQueryData<OperatorQueuePayload>(operatorQueueQueryKey(gameId), {
    status: payload.game.status,
    queue: payload.queue,
    checkedOut: payload.checkedOut ?? [],
    courts: payload.courts,
    firstTimerCount: payload.firstTimerCount ?? 0,
    birthdayThisMonthCount: payload.birthdayThisMonthCount ?? 0,
  });
  queryClient.setQueryData<OperatorDetailsPayload>(operatorDetailsQueryKey(gameId), {
    leaderboard: payload.leaderboard ?? [],
    matches: payload.matches ?? [],
    recap: payload.recap,
  });
}
