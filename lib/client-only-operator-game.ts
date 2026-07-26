import {
  isAccountQuickGame,
  isEphemeralQuickGame,
  isQuickGame,
} from "@/lib/local-game-id";
import { isOfflineSandboxGame } from "@/lib/offline-sandbox-id";

/**
 * Operator sessions that live only in the browser (quick play + offline sandbox).
 * Live Mongo-backed games are never included.
 */
export function isClientOnlyOperatorGame(gameId: string | null | undefined) {
  return isQuickGame(gameId) || isOfflineSandboxGame(gameId);
}

export {
  isAccountQuickGame,
  isEphemeralQuickGame,
  isOfflineSandboxGame,
  isQuickGame,
};
