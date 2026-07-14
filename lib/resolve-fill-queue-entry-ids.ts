import type { QueueEntryView } from "@/components/game/queue-entry-row";
import { resolvePlayerId } from "@/lib/resolve-player-id";

export function isOptimisticQueueEntryId(id: string) {
  return id.startsWith("optimistic-");
}

/**
 * After cancel/end clears, optimistic queue rows use temporary ids. Remap a
 * selected foursome/pair to real queue entry ids from a fresh server queue by
 * player id — without writing that queue into React Query (keeps fill UI intact).
 */
export function resolveQueueEntryIdsAgainstFreshQueue(
  selectedEntries: QueueEntryView[],
  freshQueue: QueueEntryView[],
): string[] {
  const freshIdByPlayerId = new Map<string, string>();
  for (const entry of freshQueue) {
    const playerId = resolvePlayerId(entry.playerId);
    if (!playerId || freshIdByPlayerId.has(playerId)) continue;
    freshIdByPlayerId.set(playerId, String(entry._id));
  }

  return selectedEntries.map((entry) => {
    const entryId = String(entry._id);
    if (!isOptimisticQueueEntryId(entryId)) return entryId;

    const playerId = resolvePlayerId(entry.playerId);
    const freshId = playerId ? freshIdByPlayerId.get(playerId) : undefined;
    if (!freshId) {
      throw new Error("One or more selected queue entries are no longer available.");
    }
    return freshId;
  });
}
