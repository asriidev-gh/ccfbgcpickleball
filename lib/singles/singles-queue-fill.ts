import type { QueueEntryView } from "@/components/game/queue-entry-row";
import type { QuickPlayMatchingType } from "@/lib/quick-play-wizard-shared";

export type SinglesQueueSegments = {
  normals: QueueEntryView[];
  winners: QueueEntryView[];
  losers: QueueEntryView[];
};

export function isSinglesWinnerLoserRotation(matchingType?: QuickPlayMatchingType | null) {
  return matchingType === "winner-loser-groups";
}

export function segmentSinglesQueue(queue: QueueEntryView[]): SinglesQueueSegments {
  const normals: QueueEntryView[] = [];
  const winners: QueueEntryView[] = [];
  const losers: QueueEntryView[] = [];

  for (const entry of queue) {
    if (entry.queueType === "winner") winners.push(entry);
    else if (entry.queueType === "loser") losers.push(entry);
    else normals.push(entry);
  }

  return { normals, winners, losers };
}

function toNormalQueueEntry(entry: QueueEntryView): QueueEntryView {
  return { ...entry, queueType: "normal" };
}

/**
 * FIFO normals first. When two winners or two losers are available, merge that pair
 * into the main line (as normals) at the end — e.g. 5,6 + Win 1,3 + Lose 2,4 → 5,6,1,3,2,4.
 * Unpaired singles stay in the winner/loser tail until a partner arrives.
 */
export function rebuildSinglesQueueOrder(queue: QueueEntryView[]): QueueEntryView[] {
  const { normals, winners, losers } = segmentSinglesQueue(queue);
  const mergedNormals = [...normals];

  while (winners.length >= 2) {
    const pair = winners.splice(0, 2);
    mergedNormals.push(...pair.map(toNormalQueueEntry));
  }

  while (losers.length >= 2) {
    const pair = losers.splice(0, 2);
    mergedNormals.push(...pair.map(toNormalQueueEntry));
  }

  return [...mergedNormals, ...winners, ...losers];
}

function pickTwoQueueEntriesByType(
  queue: QueueEntryView[],
  queueType: QueueEntryView["queueType"],
): QueueEntryView[] | null {
  const picked: QueueEntryView[] = [];
  for (const entry of queue) {
    if (entry.queueType !== queueType) continue;
    picked.push(entry);
    if (picked.length === 2) return picked;
  }
  return null;
}

/** Pick the next two singles players based on matching type. */
export function pickSinglesCourtPair(
  queue: QueueEntryView[],
  matchingType?: QuickPlayMatchingType | null,
): QueueEntryView[] | null {
  if (queue.length < 2) return null;

  if (!isSinglesWinnerLoserRotation(matchingType)) {
    return queue.slice(0, 2);
  }

  return (
    pickTwoQueueEntriesByType(queue, "normal") ??
    pickTwoQueueEntriesByType(queue, "winner") ??
    pickTwoQueueEntriesByType(queue, "loser")
  );
}

export function canPickSinglesCourtPair(
  queue: QueueEntryView[],
  matchingType?: QuickPlayMatchingType | null,
) {
  return pickSinglesCourtPair(queue, matchingType) != null;
}

export function removeQueueEntriesById(
  queue: QueueEntryView[],
  entryIds: Set<string>,
): QueueEntryView[] {
  return queue.filter((entry) => !entryIds.has(entry._id));
}
