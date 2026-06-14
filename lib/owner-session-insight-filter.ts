import { connectToDatabase } from "@/lib/db";
import {
  getPlayerIdentityKey,
  type OwnerSessionInsightFilter,
} from "@/lib/owner-session-insight-filter-shared";
import {
  isPlayerCcfAttended,
  isPlayerCcfNotYet,
} from "@/lib/player-profile-shared";
import { LeaderboardStats } from "@/models/LeaderboardStats";
import { PickleGame } from "@/models/PickleGame";
import { Player } from "@/models/Player";
import { QueueEntry } from "@/models/QueueEntry";

type OwnerGameDoc = {
  gameId: string;
  status: "draft" | "active" | "ended";
  openPlayDate?: Date | null;
  createdAt?: Date;
};

type PlayerInsightDoc = {
  _id: { toString(): string };
  firstName?: string;
  lastName?: string;
  email?: string;
  attendedEvents?: string[];
};

function compareGamesChronologically(a: OwnerGameDoc, b: OwnerGameDoc) {
  const dateA = a.openPlayDate ? new Date(a.openPlayDate).getTime() : null;
  const dateB = b.openPlayDate ? new Date(b.openPlayDate).getTime() : null;

  if (dateA != null && dateB != null && dateA !== dateB) return dateA - dateB;
  if (dateA != null && dateB == null) return -1;
  if (dateA == null && dateB != null) return 1;

  const createdA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
  const createdB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
  if (createdA !== createdB) return createdA - createdB;

  return a.gameId.localeCompare(b.gameId);
}

function addIdentityToGame(
  identityToGameIds: Map<string, Set<string>>,
  gameIdToIdentities: Map<string, Set<string>>,
  identityKey: string,
  gameId: string,
) {
  if (!identityToGameIds.has(identityKey)) identityToGameIds.set(identityKey, new Set());
  identityToGameIds.get(identityKey)!.add(gameId);

  if (!gameIdToIdentities.has(gameId)) gameIdToIdentities.set(gameId, new Set());
  gameIdToIdentities.get(gameId)!.add(identityKey);
}

function matchesInsightFilter(
  insight: OwnerSessionInsightFilter,
  identityKey: string,
  identityToGameIds: Map<string, Set<string>>,
  identityToAttendedEvents: Map<string, string[]>,
  priorEndedGameIds: Set<string>,
) {
  const playerGameIds = identityToGameIds.get(identityKey) ?? new Set<string>();
  const attendedEvents = identityToAttendedEvents.get(identityKey);

  switch (insight) {
    case "new":
      return ![...playerGameIds].some((sessionGameId) => priorEndedGameIds.has(sessionGameId));
    case "ccf-not-yet":
      return isPlayerCcfNotYet(attendedEvents);
    case "ccf-attended":
      return isPlayerCcfAttended(attendedEvents);
  }
}

export async function getSessionInsightIdentityKeys(
  ownerId: string,
  gameId: string,
  insight: OwnerSessionInsightFilter,
): Promise<Set<string>> {
  await connectToDatabase();

  const ownerGames = (await PickleGame.find({ ownerId })
    .select("gameId status openPlayDate createdAt")
    .lean()) as OwnerGameDoc[];

  if (ownerGames.length === 0) return new Set();

  const ownerGameIds = ownerGames.map((game) => game.gameId);
  const gamesSorted = [...ownerGames].sort(compareGamesChronologically);
  const gameIndex = gamesSorted.findIndex((game) => game.gameId === gameId);
  if (gameIndex < 0) return new Set();

  const [entryRows, statsRows] = await Promise.all([
    QueueEntry.find({ gameId: { $in: ownerGameIds } })
      .select("gameId playerId")
      .lean<Array<{ gameId: string; playerId: { toString(): string } }>>(),
    LeaderboardStats.find({ gameId: { $in: ownerGameIds } })
      .select("gameId playerId")
      .lean<Array<{ gameId: string; playerId: { toString(): string } }>>(),
  ]);

  const playerIds = [
    ...new Set([
      ...entryRows.map((row) => row.playerId.toString()),
      ...statsRows.map((row) => row.playerId.toString()),
    ]),
  ];

  const players =
    playerIds.length === 0
      ? []
      : ((await Player.find({ _id: { $in: playerIds } })
          .select("firstName lastName email attendedEvents")
          .lean()) as PlayerInsightDoc[]);

  const playerById = new Map(players.map((player) => [player._id.toString(), player]));
  const identityToGameIds = new Map<string, Set<string>>();
  const gameIdToIdentities = new Map<string, Set<string>>();
  const identityToAttendedEvents = new Map<string, string[]>();

  const registerPlayerForGame = (playerId: string, sessionGameId: string) => {
    const player = playerById.get(playerId);
    const identityKey = getPlayerIdentityKey(
      player ?? { _id: { toString: () => playerId }, email: "", firstName: "", lastName: "" },
    );
    addIdentityToGame(identityToGameIds, gameIdToIdentities, identityKey, sessionGameId);

    if (player && !identityToAttendedEvents.has(identityKey)) {
      identityToAttendedEvents.set(identityKey, player.attendedEvents ?? []);
    }
  };

  for (const row of entryRows) {
    registerPlayerForGame(row.playerId.toString(), row.gameId);
  }

  for (const row of statsRows) {
    registerPlayerForGame(row.playerId.toString(), row.gameId);
  }

  const priorEndedGameIds = new Set(
    gamesSorted
      .slice(0, gameIndex)
      .filter((session) => session.status === "ended")
      .map((session) => session.gameId),
  );

  const identitiesInGame = gameIdToIdentities.get(gameId) ?? new Set<string>();
  const matching = new Set<string>();

  for (const identityKey of identitiesInGame) {
    if (
      matchesInsightFilter(
        insight,
        identityKey,
        identityToGameIds,
        identityToAttendedEvents,
        priorEndedGameIds,
      )
    ) {
      matching.add(identityKey);
    }
  }

  return matching;
}
