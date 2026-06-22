import {
  getQuickGamePersistence,
  isAccountQuickGame,
  isEphemeralQuickGame,
  isQuickGame,
} from "@/lib/local-game-id";
import type { OperatorFullPayload } from "@/lib/operator-payload";
import { useEphemeralQuickGameStore } from "@/store/ephemeral-quick-game-store";
import { useLocalGameStore } from "@/store/local-game-store";

export { isQuickGame, isAccountQuickGame, isEphemeralQuickGame };

export function readQuickGamePayload(gameId: string) {
  if (isAccountQuickGame(gameId)) {
    return useLocalGameStore.getState().getSession(gameId);
  }
  if (isEphemeralQuickGame(gameId)) {
    return useEphemeralQuickGameStore.getState().getSession(gameId);
  }
  return undefined;
}

export function writeQuickGamePayload(gameId: string, payload: OperatorFullPayload) {
  if (isAccountQuickGame(gameId)) {
    useLocalGameStore.getState().setSession(gameId, payload);
    return;
  }
  if (isEphemeralQuickGame(gameId)) {
    useEphemeralQuickGameStore.getState().setSession(gameId, payload);
  }
}

export function initializeQuickGameSession(gameId: string, payload: OperatorFullPayload) {
  if (isAccountQuickGame(gameId)) {
    useLocalGameStore.getState().initializeSession(gameId, payload);
    return;
  }
  if (isEphemeralQuickGame(gameId)) {
    useEphemeralQuickGameStore.getState().initializeSession(gameId, payload);
  }
}

export function removeQuickGameSession(gameId: string) {
  if (isAccountQuickGame(gameId)) {
    useLocalGameStore.getState().removeSession(gameId);
    return;
  }
  if (isEphemeralQuickGame(gameId)) {
    useEphemeralQuickGameStore.getState().removeSession(gameId);
  }
}

export function clearEphemeralQuickGameSessions() {
  const sessions = useEphemeralQuickGameStore.getState().sessions;
  for (const gameId of Object.keys(sessions)) {
    if (isEphemeralQuickGame(gameId)) {
      removeQuickGameSession(gameId);
    }
  }
}

export function clearAllQuickGameSessions() {
  useLocalGameStore.getState().clearAllSessions();
  useEphemeralQuickGameStore.getState().clearAllSessions();
}

export function updateQuickGamePayload(
  gameId: string,
  updater: (current: OperatorFullPayload) => OperatorFullPayload | null,
) {
  const current = readQuickGamePayload(gameId);
  if (!current) return null;
  const next = updater(current);
  if (!next) return null;
  writeQuickGamePayload(gameId, next);
  return next;
}

export function useQuickGameSession(gameId: string) {
  const accountSession = useLocalGameStore((state) =>
    isAccountQuickGame(gameId) ? state.sessions[gameId] : undefined,
  );
  const ephemeralSession = useEphemeralQuickGameStore((state) =>
    isEphemeralQuickGame(gameId) ? state.sessions[gameId] : undefined,
  );
  return accountSession ?? ephemeralSession;
}

export function listAllQuickGameSessions(): Record<string, OperatorFullPayload> {
  const account = useLocalGameStore.getState().sessions;
  const ephemeral = useEphemeralQuickGameStore.getState().sessions;
  return { ...account, ...ephemeral };
}

export function quickGamePersistenceForPayload(
  payload: OperatorFullPayload,
): "account" | "ephemeral" | null {
  return (
    payload.game.quickGamePersistence ??
    getQuickGamePersistence(payload.game.gameId)
  );
}
