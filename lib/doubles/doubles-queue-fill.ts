import type { QueueEntryView } from "@/components/game/queue-entry-row";
import { queueEntryPlayerId } from "@/lib/queue-highlight";
import { removeQueueEntriesForPlayerIds } from "@/lib/queue-dedupe";
import type { PlayerPhotoRef } from "@/components/game/player-avatar";
import type { QuickPlayMatchingType } from "@/lib/quick-play-wizard-shared";

export const DOUBLES_PLAYERS_PER_COURT = 4;

export function formatDoublesNextOnCourtSubtitle(
  nextUpCount: number,
  options?: { canReorder?: boolean },
): string {
  const target = DOUBLES_PLAYERS_PER_COURT;
  const count = Math.min(target, Math.max(0, nextUpCount));
  const reorderSuffix = options?.canReorder ? " · drag to reorder" : "";

  if (count >= target) {
    return `Next ${target} players ready to play${reorderSuffix}`;
  }

  const remaining = target - count;
  const remainingLabel = remaining === 1 ? "1 more player" : `${remaining} more players`;
  return `${remainingLabel} needed to complete the four${reorderSuffix}`;
}

export type DoublesQueueSegments = {
  normals: QueueEntryView[];
  winners: QueueEntryView[];
  losers: QueueEntryView[];
};

export type DoublesQueueDisplaySegments = {
  normalWaiting: QueueEntryView[];
  winners: QueueEntryView[];
  losers: QueueEntryView[];
};

export function isDoublesWinnerLoserRotation(matchingType?: QuickPlayMatchingType | null) {
  return matchingType === "winner-loser-groups";
}

export function segmentDoublesQueue(queue: QueueEntryView[]): DoublesQueueSegments {
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
 * Winner/loser rotation queue order:
 * 1. The next four players (main line, then winners, then losers) form the on-deck court.
 * 2. On-deck bracket picks become part of the main line (normal type).
 * 3. Remaining bracket foursomes (4+) promote to the end of the main line.
 * 4. Incomplete brackets (1–3) stay at the tail.
 */
export function rebuildDoublesQueueOrder(queue: QueueEntryView[]): QueueEntryView[] {
  const { normals, winners, losers } = segmentDoublesQueue(queue);
  const playOrder = [...normals, ...winners, ...losers];

  const onDeck = playOrder.slice(0, DOUBLES_PLAYERS_PER_COURT).map(toNormalQueueEntry);
  const onDeckIds = new Set(onDeck.map((entry) => entry._id));

  let remainingNormals = normals.filter((entry) => !onDeckIds.has(entry._id));
  let remainingWinners = winners.filter((entry) => !onDeckIds.has(entry._id));
  let remainingLosers = losers.filter((entry) => !onDeckIds.has(entry._id));

  const promotedToMain: QueueEntryView[] = [];

  while (remainingLosers.length >= DOUBLES_PLAYERS_PER_COURT) {
    const foursome = remainingLosers.splice(0, DOUBLES_PLAYERS_PER_COURT);
    promotedToMain.push(...foursome.map(toNormalQueueEntry));
  }

  while (remainingWinners.length >= DOUBLES_PLAYERS_PER_COURT) {
    const foursome = remainingWinners.splice(0, DOUBLES_PLAYERS_PER_COURT);
    promotedToMain.push(...foursome.map(toNormalQueueEntry));
  }

  return [
    ...onDeck,
    ...remainingNormals,
    ...promotedToMain,
    ...remainingWinners,
    ...remainingLosers,
  ];
}

/** Append finished-court players into the correct bracket tails (not interleaved). */
export function appendDoublesRequeueEntries(
  queue: QueueEntryView[],
  requeueEntries: QueueEntryView[],
): QueueEntryView[] {
  const filteredQueue = removeQueueEntriesForPlayerIds(
    queue,
    requeueEntries.map(queueEntryPlayerId).filter(Boolean),
  );
  const { normals, winners, losers } = segmentDoublesQueue(filteredQueue);
  const addedWinners = requeueEntries.filter((entry) => entry.queueType === "winner");
  const addedLosers = requeueEntries.filter((entry) => entry.queueType === "loser");

  return rebuildDoublesQueueOrder([
    ...normals,
    ...winners,
    ...addedWinners,
    ...losers,
    ...addedLosers,
  ]);
}

export function resolveDoublesRotationQueue(
  queue: QueueEntryView[],
  matchingType?: QuickPlayMatchingType | null,
): QueueEntryView[] {
  if (!isDoublesWinnerLoserRotation(matchingType)) return queue;
  return rebuildDoublesQueueOrder(queue);
}

/** Next court is always the first four entries after rotation queue rules are applied. */
export function pickDoublesCourtFoursome(
  queue: QueueEntryView[],
  matchingType?: QuickPlayMatchingType | null,
): QueueEntryView[] | null {
  const ordered = resolveDoublesRotationQueue(queue, matchingType);
  if (ordered.length < DOUBLES_PLAYERS_PER_COURT) return null;
  return ordered.slice(0, DOUBLES_PLAYERS_PER_COURT);
}

export function canPickDoublesCourtFoursome(
  queue: QueueEntryView[],
  matchingType?: QuickPlayMatchingType | null,
) {
  return pickDoublesCourtFoursome(queue, matchingType) != null;
}

/** UI segments for queue entries after the next court foursome (physical queue order). */
export function segmentDoublesQueueDisplay(
  queue: QueueEntryView[],
  excludeIds: Set<string>,
): DoublesQueueDisplaySegments {
  const rest = queue.filter((entry) => !excludeIds.has(entry._id));
  const normalWaiting: QueueEntryView[] = [];
  const winners: QueueEntryView[] = [];
  const losers: QueueEntryView[] = [];

  for (const entry of rest) {
    if (entry.queueType === "winner") {
      winners.push(entry);
    } else if (entry.queueType === "loser") {
      losers.push(entry);
    } else {
      normalWaiting.push(entry);
    }
  }

  return { normalWaiting, winners, losers };
}

export function removeQueueEntriesById(
  queue: QueueEntryView[],
  entryIds: Set<string>,
): QueueEntryView[] {
  return queue.filter((entry) => !entryIds.has(entry._id));
}

export function buildDoublesWinnerLoserRequeueEntries(
  teamA: PlayerPhotoRef[],
  teamB: PlayerPhotoRef[],
  winnerTeam: "A" | "B",
  baseTime: number,
): QueueEntryView[] {
  const slots = [
    ...teamA.map((player) => ({ player, team: "A" as const })),
    ...teamB.map((player) => ({ player, team: "B" as const })),
  ].filter((slot): slot is { player: PlayerPhotoRef; team: "A" | "B" } => Boolean(slot.player));

  return slots.map((slot, index) => {
    const isWinner = slot.team === winnerTeam;
    return {
      _id: `optimistic-doubles-requeue-${baseTime}-${index}`,
      queueType: isWinner ? "winner" : "loser",
      playerId: slot.player,
      registeredAt: new Date(baseTime + index).toISOString(),
      lastMatchResult: isWinner ? "win" : "loss",
    };
  });
}
