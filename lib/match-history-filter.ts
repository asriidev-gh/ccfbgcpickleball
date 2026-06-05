import { formatPlayerDisplayName } from "@/lib/utils";

type MatchHistoryPlayerRef = {
  _id?: string | { toString(): string };
  firstName?: string;
  lastName?: string;
};

type MatchWithPlayers = {
  teamAPlayerIds: MatchHistoryPlayerRef[];
  teamBPlayerIds: MatchHistoryPlayerRef[];
};

function normalizeNameQuery(query: string) {
  return query.trim().toLowerCase();
}

export function playerMatchesNameQuery(
  player: Pick<MatchHistoryPlayerRef, "firstName" | "lastName">,
  query: string,
): boolean {
  const normalized = normalizeNameQuery(query);
  if (!normalized) return true;

  const firstName = player.firstName ?? "";
  const lastName = player.lastName ?? "";
  const fullName = formatPlayerDisplayName(firstName, lastName).toLowerCase();
  const first = firstName.trim().toLowerCase();
  const last = lastName.trim().toLowerCase();

  return (
    fullName.includes(normalized) ||
    first.includes(normalized) ||
    last.includes(normalized)
  );
}

export function matchIncludesPlayerName(match: MatchWithPlayers, query: string): boolean {
  const normalized = normalizeNameQuery(query);
  if (!normalized) return true;

  return [...match.teamAPlayerIds, ...match.teamBPlayerIds].some((player) =>
    playerMatchesNameQuery(player, normalized),
  );
}

export function filterMatchesByPlayerName<T extends MatchWithPlayers>(
  matches: T[],
  query: string,
): T[] {
  const normalized = normalizeNameQuery(query);
  if (!normalized) return matches;
  return matches.filter((match) => matchIncludesPlayerName(match, normalized));
}

export function matchHistoryPlayerId(player: MatchHistoryPlayerRef): string {
  const id = player._id;
  if (id == null) return "";
  return typeof id === "string" ? id : id.toString();
}

export function matchIncludesAnyPlayer(
  match: MatchWithPlayers,
  playerIds: readonly string[],
): boolean {
  if (playerIds.length === 0) return false;
  const idSet = new Set(playerIds);
  return [...match.teamAPlayerIds, ...match.teamBPlayerIds].some((player) => {
    const id = matchHistoryPlayerId(player);
    return id !== "" && idSet.has(id);
  });
}

export function filterMatchesForViewer<T extends MatchWithPlayers>(
  matches: T[],
  playerIds: readonly string[],
): T[] {
  if (playerIds.length === 0) return [];
  return matches.filter((match) => matchIncludesAnyPlayer(match, playerIds));
}
