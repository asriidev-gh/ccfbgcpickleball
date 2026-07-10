import type { QueueEntryView } from "@/components/game/queue-entry-row";
import { resolvePlayerId, type PlayerPhotoRef } from "@/components/game/player-avatar";
import { queueEntryPlayerId } from "@/lib/queue-highlight";

/** Keep the first queue row per player (queue is sorted by registeredAt). */
export function dedupeQueueEntriesByPlayerId(queue: QueueEntryView[]): QueueEntryView[] {
  const seen = new Set<string>();
  const result: QueueEntryView[] = [];

  for (const entry of queue) {
    const playerId = queueEntryPlayerId(entry);
    if (!playerId) {
      result.push(entry);
      continue;
    }
    if (seen.has(playerId)) continue;
    seen.add(playerId);
    result.push(entry);
  }

  return result;
}

export function removeQueueEntriesForPlayerIds(
  queue: QueueEntryView[],
  playerIds: Iterable<string>,
): QueueEntryView[] {
  const exclude = new Set(playerIds);
  return queue.filter((entry) => {
    const playerId = queueEntryPlayerId(entry);
    return !playerId || !exclude.has(playerId);
  });
}

export function playerIdsFromQueueEntries(entries: QueueEntryView[]): string[] {
  return [...new Set(entries.map(queueEntryPlayerId).filter(Boolean))];
}

export function playerIdsFromCourtPlayers(...groups: PlayerPhotoRef[][]): string[] {
  const ids = new Set<string>();
  for (const group of groups) {
    for (const player of group) {
      const playerId = resolvePlayerId(player);
      if (playerId) ids.add(playerId);
    }
  }
  return [...ids];
}

export function appendRequeueEntriesWithoutDuplicates(
  queue: QueueEntryView[],
  requeueEntries: QueueEntryView[],
): QueueEntryView[] {
  const requeuePlayerIds = playerIdsFromQueueEntries(requeueEntries);
  const base = removeQueueEntriesForPlayerIds(queue, requeuePlayerIds);
  return dedupeQueueEntriesByPlayerId([...base, ...requeueEntries]);
}

export function prependRequeueEntriesWithoutDuplicates(
  queue: QueueEntryView[],
  requeueEntries: QueueEntryView[],
): QueueEntryView[] {
  const requeuePlayerIds = playerIdsFromQueueEntries(requeueEntries);
  const base = removeQueueEntriesForPlayerIds(queue, requeuePlayerIds);
  return dedupeQueueEntriesByPlayerId([...requeueEntries, ...base]);
}
