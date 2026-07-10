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

/** Stop live polls and wait for in-flight game queries before applying optimistic queue UI. */
export async function beginOperatorQueueMutation(
  queryClient: QueryClient,
  gameId: string,
  lockRef: MutableRefObject<number>,
) {
  acquireQueueMutationLock(lockRef);
  await queryClient.cancelQueries({ queryKey: ["game", gameId] });
}

type EndOperatorQueueMutationOptions = {
  refetchHistory?: boolean;
  skipRefetch?: boolean;
};

/** Refetch authoritative queue state, then resume live polling. */
export async function endOperatorQueueMutation(
  queryClient: QueryClient,
  gameId: string,
  lockRef: MutableRefObject<number>,
  options?: EndOperatorQueueMutationOptions,
) {
  try {
    if (!options?.skipRefetch) {
      await queryClient.refetchQueries({ queryKey: operatorQueueQueryKey(gameId) });
      if (options?.refetchHistory) {
        await queryClient.refetchQueries({ queryKey: operatorMatchHistoryQueryKey(gameId) });
      }
    }
  } finally {
    releaseQueueMutationLock(lockRef);
  }
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
