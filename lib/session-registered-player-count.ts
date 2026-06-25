import type { CourtView } from "@/components/game/court-card";
import type { QueueEntryView } from "@/components/game/queue-entry-row";

function resolvePlayerRefId(player: { _id?: string | null } | null | undefined) {
  if (player?._id == null) return null;
  return String(player._id);
}

/** Distinct players with a queue record in this session (queued, on court, or checked out). */
export function countSessionRegisteredPlayers(input: {
  queue: QueueEntryView[];
  checkedOut: QueueEntryView[];
  courts: CourtView[];
}): number {
  const ids = new Set<string>();

  for (const entry of [...input.queue, ...input.checkedOut]) {
    const id = resolvePlayerRefId(entry.playerId);
    if (id) ids.add(id);
  }

  for (const court of input.courts) {
    for (const player of [...(court.teamA?.playerIds ?? []), ...(court.teamB?.playerIds ?? [])]) {
      const id = resolvePlayerRefId(player);
      if (id) ids.add(id);
    }
  }

  return ids.size;
}
