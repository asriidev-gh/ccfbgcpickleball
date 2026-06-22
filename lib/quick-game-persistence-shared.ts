import { z } from "zod";

import { isAccountQuickGame } from "@/lib/local-game-id";
import type { OperatorFullPayload } from "@/lib/operator-payload";

export const quickGameSaveReasonSchema = z.enum(["create", "checkpoint", "end", "exit"]);

export const saveQuickGameSessionSchema = z.object({
  gameId: z.string().min(1),
  payload: z.custom<OperatorFullPayload>(),
  status: z.enum(["active", "ended"]).optional(),
  saveReason: quickGameSaveReasonSchema,
});

export function assertAccountQuickGameId(gameId: string) {
  if (!isAccountQuickGame(gameId)) {
    throw new Error("Only account quick games can be saved.");
  }
}
