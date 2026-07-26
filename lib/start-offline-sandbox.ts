import {
  createOfflineSandboxGameId,
  getOfflineSandboxDashboardPath,
} from "@/lib/offline-sandbox-id";
import { cloneOperatorPayloadForOfflineSandbox } from "@/lib/offline-sandbox-snapshot";
import type { OperatorFullPayload } from "@/lib/operator-payload";
import { useOfflineSandboxStore } from "@/store/offline-sandbox-store";

export type StartOfflineSandboxResult = {
  offlineGameId: string;
  sourceLiveGameId: string;
  path: string;
};

/**
 * Snapshot a live operator payload into an in-memory offline sandbox session.
 * Does not read or write MongoDB.
 */
export function startOfflineSandboxFromLivePayload(
  livePayload: OperatorFullPayload,
): StartOfflineSandboxResult {
  const sourceLiveGameId = livePayload.game.gameId;
  const offlineGameId = createOfflineSandboxGameId();
  const snapshot = cloneOperatorPayloadForOfflineSandbox(livePayload, offlineGameId);

  useOfflineSandboxStore
    .getState()
    .initializeSession(offlineGameId, snapshot, sourceLiveGameId);

  return {
    offlineGameId,
    sourceLiveGameId,
    path: getOfflineSandboxDashboardPath(offlineGameId),
  };
}

export function getOfflineSandboxSourceLiveGameId(offlineGameId: string) {
  return useOfflineSandboxStore.getState().getSourceLiveGameId(offlineGameId);
}

export function endOfflineSandboxSession(offlineGameId: string) {
  useOfflineSandboxStore.getState().removeSession(offlineGameId);
}
