import { getSessionInsightIdentityKeys } from "@/lib/owner-session-insight-filter";
import { getPlayerIdentityKey } from "@/lib/owner-session-insight-filter-shared";

type PopulatedPlayer = {
  _id?: { toString(): string } | string;
  firstName?: string;
  lastName?: string;
  email?: string;
};

function resolvePopulatedPlayer(player: unknown): PopulatedPlayer | null {
  if (!player || typeof player !== "object") return null;
  return player as PopulatedPlayer;
}

function playerIsFirstTimer(
  player: PopulatedPlayer | null,
  firstTimerIdentityKeys: Set<string>,
): boolean {
  if (!player?._id) return false;

  const id =
    typeof player._id === "object" && player._id !== null
      ? player._id.toString()
      : String(player._id);

  const identityKey = getPlayerIdentityKey({
    _id: { toString: () => id },
    email: player.email,
    firstName: player.firstName,
    lastName: player.lastName,
  });

  return firstTimerIdentityKeys.has(identityKey);
}

export async function loadFirstTimerIdentityKeysForGame(
  ownerId: string,
  gameId: string,
): Promise<Set<string>> {
  return getSessionInsightIdentityKeys(ownerId, gameId, "new");
}

export function annotateQueueEntryFirstTimer<T extends { playerId?: unknown }>(
  entry: T,
  firstTimerIdentityKeys: Set<string>,
): T & { isFirstTimer: boolean } {
  return {
    ...entry,
    isFirstTimer: playerIsFirstTimer(resolvePopulatedPlayer(entry.playerId), firstTimerIdentityKeys),
  };
}

export function annotateQueueEntriesFirstTimer<T extends { playerId?: unknown }>(
  entries: T[],
  firstTimerIdentityKeys: Set<string>,
): Array<T & { isFirstTimer: boolean }> {
  return entries.map((entry) => annotateQueueEntryFirstTimer(entry, firstTimerIdentityKeys));
}

type QueueEntryDoc = {
  toObject?: () => Record<string, unknown>;
  playerId?: unknown;
};

export function serializeQueueEntriesForPayload<T extends QueueEntryDoc>(
  entries: T[],
  firstTimerIdentityKeys: Set<string>,
) {
  return entries.map((entry) => {
    const plain = (entry.toObject?.() ?? entry) as T;
    return annotateQueueEntryFirstTimer(plain, firstTimerIdentityKeys);
  });
}
