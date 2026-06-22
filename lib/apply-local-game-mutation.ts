import type { QueryClient } from "@tanstack/react-query";

import type { GamePayload } from "@/lib/game-payload-mutations";
import {
  readOperatorGamePayload,
  writeOperatorGamePayload,
} from "@/lib/operator-game-cache";

export function applyLocalGameMutation(
  queryClient: QueryClient,
  gameId: string,
  updater: (payload: GamePayload) => GamePayload | null,
  errorMessage = "Unable to update session.",
) {
  const current = readOperatorGamePayload(queryClient, gameId);
  if (!current) throw new Error("Session not found.");
  const next = updater(current);
  if (!next) throw new Error(errorMessage);
  writeOperatorGamePayload(queryClient, gameId, next);
}
