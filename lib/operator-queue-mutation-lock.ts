import type { QueryClient } from "@tanstack/react-query";
import type { MutableRefObject } from "react";

import {
  operatorMatchHistoryQueryKey,
  operatorQueueQueryKey,
} from "@/lib/fetch-operator-game";

/** Pause operator queue polling while queue mutations are in flight. */
export function acquireQueueMutationLock(lockRef: MutableRefObject<number>) {
  lockRef.current += 1;
}

export function releaseQueueMutationLock(lockRef: MutableRefObject<number>) {
  lockRef.current = Math.max(0, lockRef.current - 1);
}

export function isQueueMutationLocked(lockRef: MutableRefObject<number>) {
  return lockRef.current > 0;
}

/** Pause polling and cancel in-flight game queries so optimistic UI is not overwritten. */
export function beginOperatorQueueMutation(
  queryClient: QueryClient,
  gameId: string,
  lockRef: MutableRefObject<number>,
) {
  acquireQueueMutationLock(lockRef);
  // Do not await — optimistic updates should apply immediately. Cancellation still
  // prevents late poll/refetch results from overwriting that UI.
  void queryClient.cancelQueries({ queryKey: ["game", gameId] });
}

type EndOperatorQueueMutationOptions = {
  refetchHistory?: boolean;
  skipRefetch?: boolean;
};

/** Run sync only when this is the last in-flight queue mutation. */
export async function endQueuedMutationLock(
  lockRef: MutableRefObject<number>,
  onLastSettled?: () => void | Promise<void>,
) {
  try {
    if (lockRef.current === 1 && onLastSettled) {
      await onLastSettled();
    }
  } finally {
    releaseQueueMutationLock(lockRef);
  }
}

/** Refetch authoritative queue state, then resume live polling. */
export async function endOperatorQueueMutation(
  queryClient: QueryClient,
  gameId: string,
  lockRef: MutableRefObject<number>,
  options?: EndOperatorQueueMutationOptions,
) {
  await endQueuedMutationLock(lockRef, async () => {
    if (options?.skipRefetch) return;
    await queryClient.refetchQueries({ queryKey: operatorQueueQueryKey(gameId) });
    if (options?.refetchHistory) {
      await queryClient.refetchQueries({ queryKey: operatorMatchHistoryQueryKey(gameId) });
    }
  });
}

type MutationHandler<TArgs extends unknown[], TResult> = (...args: TArgs) => TResult;

export function withQueueMutationLockHandlers<
  TMutateArgs extends unknown[],
  TMutateResult,
  TSettledArgs extends unknown[],
  TSettledResult,
>(lockRef: MutableRefObject<number>, handlers: {
  onMutate?: MutationHandler<TMutateArgs, TMutateResult>;
  onSettled?: MutationHandler<TSettledArgs, TSettledResult>;
}) {
  return {
    onMutate: handlers.onMutate
      ? (...args: TMutateArgs) => {
          acquireQueueMutationLock(lockRef);
          return handlers.onMutate!(...args);
        }
      : () => {
          acquireQueueMutationLock(lockRef);
        },
    onSettled: handlers.onSettled
      ? (...args: TSettledArgs) => {
          releaseQueueMutationLock(lockRef);
          return handlers.onSettled!(...args);
        }
      : () => {
          releaseQueueMutationLock(lockRef);
        },
  };
}
