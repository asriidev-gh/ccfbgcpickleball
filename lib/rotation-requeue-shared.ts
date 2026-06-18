/** When every active session player fits in groups of 4, use cross-pair rotation instead of winner/loser decks. */
export function shouldUseRotationRequeue(activePlayerCount: number) {
  return activePlayerCount > 0 && activePlayerCount % 4 === 0;
}

export type RotationCourtPlayers<T = string> = {
  teamAPlayerIds: T[];
  teamBPlayerIds: T[];
};

/**
 * Build queue order after a court ends:
 * - Team A (slots 1 & 3) swaps into the positions of the last 2 queued players.
 * - Tail becomes: swapped-in pair vs Team B (slots 2 & 4) for the next FIFO court.
 */
export function buildRotationRequeuePlayerOrder<T>(input: {
  queuedPlayerIds: T[];
  court: RotationCourtPlayers<T>;
}): T[] | null {
  const { queuedPlayerIds, court } = input;
  const pairA = court.teamAPlayerIds;
  const pairB = court.teamBPlayerIds;

  if (pairA.length !== 2 || pairB.length !== 2) return null;
  if (queuedPlayerIds.length < 2) return null;

  const withoutLastTwo = queuedPlayerIds.slice(0, -2);
  const lastTwo = queuedPlayerIds.slice(-2);

  return [...withoutLastTwo, ...pairA, ...lastTwo, ...pairB];
}

export function isRotationQueueState(entries: Array<{ queueType: string }>) {
  return entries.length > 0 && entries.every((entry) => entry.queueType === "normal");
}
