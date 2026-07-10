import type { QueueEntryView } from "@/components/game/queue-entry-row";
import { normalizeShuffleGender } from "@/lib/doubles/mixed-doubles-shuffle";

function findEntryByGender(
  entries: QueueEntryView[],
  gender: "male" | "female",
): QueueEntryView | undefined {
  return entries.find((entry) => normalizeShuffleGender(entry.playerId.gender) === gender);
}

/**
 * After a mixed-doubles court ends, order the four returning players so the queue
 * alternates gender. If the queue ends with a man, append: W-F, L-M, W-M, L-F.
 * If it ends with a woman (or is empty), append: W-M, L-F, L-M, W-F.
 */
export function orderMixedDoublesRequeueEntries(
  currentQueue: QueueEntryView[],
  requeueEntries: QueueEntryView[],
): QueueEntryView[] {
  if (requeueEntries.length !== 4) return requeueEntries;

  const winners = requeueEntries.filter((entry) => entry.queueType === "winner");
  const losers = requeueEntries.filter((entry) => entry.queueType === "loser");
  if (winners.length !== 2 || losers.length !== 2) return requeueEntries;

  const winnerF = findEntryByGender(winners, "female");
  const winnerM = findEntryByGender(winners, "male");
  const loserF = findEntryByGender(losers, "female");
  const loserM = findEntryByGender(losers, "male");
  if (!winnerF || !winnerM || !loserF || !loserM) return requeueEntries;

  const lastGender =
    currentQueue.length > 0
      ? normalizeShuffleGender(currentQueue[currentQueue.length - 1]!.playerId.gender)
      : null;

  if (lastGender === "female") {
    return [winnerM, loserF, loserM, winnerF];
  }

  return [winnerF, loserM, winnerM, loserF];
}

export function appendMixedDoublesRequeueEntries(
  queue: QueueEntryView[],
  requeueEntries: QueueEntryView[],
  baseTime: number,
): QueueEntryView[] {
  const requeuePlayerIds = new Set(
    requeueEntries
      .map((entry) => {
        const id = entry.playerId._id;
        if (id == null) return "";
        return typeof id === "string" ? id : id.toString();
      })
      .filter(Boolean),
  );
  const filteredQueue = queue.filter((entry) => {
    const id = entry.playerId._id;
    const playerId = id == null ? "" : typeof id === "string" ? id : id.toString();
    return !playerId || !requeuePlayerIds.has(playerId);
  });
  const ordered = orderMixedDoublesRequeueEntries(filteredQueue, requeueEntries);
  return [
    ...filteredQueue,
    ...ordered.map((entry, index) => ({
      ...entry,
      registeredAt: new Date(baseTime + index).toISOString(),
    })),
  ];
}
