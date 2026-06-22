import type { PlayerPhotoRef } from "@/components/game/player-avatar";
import type { GamePayload } from "@/lib/game-payload-mutations";
import { formatPlayerDisplayName } from "@/lib/utils";

export function normalizePlayerDisplayNameKey(name: string) {
  return name.trim().toLowerCase();
}

function addPlayerDisplayNameKey(keys: Set<string>, player: PlayerPhotoRef) {
  const key = normalizePlayerDisplayNameKey(
    formatPlayerDisplayName(player.firstName, player.lastName ?? ""),
  );
  if (key) keys.add(key);
}

export function collectSessionPlayerDisplayNameKeys(payload: GamePayload) {
  const keys = new Set<string>();

  for (const entry of [...payload.queue, ...payload.checkedOut]) {
    addPlayerDisplayNameKey(keys, entry.playerId);
  }

  for (const court of payload.courts) {
    for (const player of [...court.teamA.playerIds, ...court.teamB.playerIds]) {
      addPlayerDisplayNameKey(keys, player);
    }
  }

  return keys;
}

export function playerRecordDisplayNameKey(player: {
  firstName: string;
  lastName?: string | null;
}) {
  return normalizePlayerDisplayNameKey(
    formatPlayerDisplayName(player.firstName, player.lastName ?? ""),
  );
}

export function isDuplicateSessionPlayerName(payload: GamePayload, displayName: string) {
  const key = normalizePlayerDisplayNameKey(displayName);
  if (!key) return false;
  return collectSessionPlayerDisplayNameKeys(payload).has(key);
}
