import type { OperatorFullPayload } from "@/lib/operator-payload";
import { isAccountQuickGame } from "@/lib/local-game-id";
import {
  localPayloadToGameCard,
  type LocalGameListCard,
} from "@/lib/local-game-list";

export type EphemeralGameListCard = LocalGameListCard;

export function listEphemeralGameCards(
  sessions: Record<string, OperatorFullPayload>,
): EphemeralGameListCard[] {
  return Object.values(sessions)
    .filter((payload) => isAccountQuickGame(payload.game.gameId) === false)
    .filter((payload) => payload.game.gameId.startsWith("qp_"))
    .map(localPayloadToGameCard)
    .sort((left, right) => {
      if (left.status !== right.status) {
        if (left.status === "ended") return 1;
        if (right.status === "ended") return -1;
      }
      return left.title.localeCompare(right.title);
    });
}

export function listActiveEphemeralGameCards(
  sessions: Record<string, OperatorFullPayload>,
): EphemeralGameListCard[] {
  return listEphemeralGameCards(sessions).filter((game) => game.status !== "ended");
}
