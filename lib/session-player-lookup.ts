import type { CourtView } from "@/components/game/court-card";
import { resolvePlayerId, type PlayerPhotoRef } from "@/components/game/player-avatar";
import type { QueueEntryView } from "@/components/game/queue-entry-row";

export function buildSessionPlayerLookup(input: {
  queue?: QueueEntryView[];
  checkedOut?: QueueEntryView[];
  courts?: CourtView[];
}): Map<string, PlayerPhotoRef> {
  const map = new Map<string, PlayerPhotoRef>();

  const add = (player: PlayerPhotoRef) => {
    const id = resolvePlayerId(player);
    if (!id) return;

    const existing = map.get(id);
    if (!existing) {
      map.set(id, player);
      return;
    }

    map.set(id, {
      ...existing,
      ...player,
      gender: player.gender ?? existing.gender,
      birthdate: player.birthdate ?? existing.birthdate,
    });
  };

  for (const entry of [...(input.queue ?? []), ...(input.checkedOut ?? [])]) {
    add(entry.playerId);
  }

  for (const court of input.courts ?? []) {
    for (const player of [...court.teamA.playerIds, ...court.teamB.playerIds]) {
      add(player);
    }
  }

  return map;
}

export function resolveSessionPlayer(
  player: PlayerPhotoRef,
  lookup?: Map<string, PlayerPhotoRef>,
): PlayerPhotoRef {
  if (!lookup) return player;

  const id = resolvePlayerId(player);
  if (!id) return player;

  const resolved = lookup.get(id);
  if (!resolved) return player;

  return {
    ...resolved,
    ...player,
    gender: player.gender ?? resolved.gender,
    birthdate: player.birthdate ?? resolved.birthdate,
  };
}

export function resolveSessionPlayers(
  players: PlayerPhotoRef[],
  lookup?: Map<string, PlayerPhotoRef>,
): PlayerPhotoRef[] {
  return players.map((player) => resolveSessionPlayer(player, lookup));
}
