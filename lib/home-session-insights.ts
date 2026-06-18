import type { HomeSessionInsightPoint, HomeSessionInsights } from "@/lib/home-session-insights-shared";

import { enrichSessionChartLabels } from "@/lib/home-session-insights-shared";

import { connectToDatabase } from "@/lib/db";
import { isCcfUserType } from "@/lib/registration-variant";

import {

  isPlayerCcfAttended,

  isPlayerCcfNotYet,

} from "@/lib/player-profile-shared";

import {

  formatOpenPlayDate,

  formatOpenPlayStartTimeDisplay,

} from "@/lib/open-play-time-range";

import { LeaderboardStats } from "@/models/LeaderboardStats";

import { PickleGame } from "@/models/PickleGame";

import { Player } from "@/models/Player";

import { QueueEntry } from "@/models/QueueEntry";

import { User } from "@/models/User";



type OwnerGameDoc = {

  gameId: string;

  title: string;

  openPlayType: string;

  openPlayTimeRange?: string | null;

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



function getPlayerIdentityKey(player: {

  _id: { toString(): string };

  email?: string;

  firstName?: string;

  lastName?: string;

}) {

  const email = player.email?.trim().toLowerCase();

  if (email) return `email:${email}`;



  const nameKey = `${player.firstName ?? ""}|${player.lastName ?? ""}`.trim().toLowerCase();

  if (nameKey && nameKey !== "|") return `name:${nameKey}`;



  return `id:${player._id.toString()}`;

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



export async function getHomeSessionInsights(ownerId: string): Promise<HomeSessionInsights> {

  await connectToDatabase();



  const ownerUser = await User.findById(ownerId).select("userType").lean();

  const showCcfInsights = isCcfUserType(
    ownerUser && typeof ownerUser === "object" && typeof ownerUser.userType === "string"
      ? ownerUser.userType
      : undefined,
  );



  const ownerGames = (await PickleGame.find({ ownerId })

    .select("gameId title openPlayType openPlayTimeRange status openPlayDate createdAt")

    .lean()) as OwnerGameDoc[];



  if (ownerGames.length === 0) {

    return { showCcfInsights, sessions: [] };

  }



  const ownerGameIds = ownerGames.map((game) => game.gameId);

  const gamesById = new Map(ownerGames.map((game) => [game.gameId, game]));

  const gamesSorted = [...ownerGames].sort(compareGamesChronologically);



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



  const registerPlayerForGame = (playerId: string, gameId: string) => {

    const player = playerById.get(playerId);

    const identityKey = getPlayerIdentityKey(

      player ?? { _id: { toString: () => playerId }, email: "", firstName: "", lastName: "" },

    );

    addIdentityToGame(identityToGameIds, gameIdToIdentities, identityKey, gameId);



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



  const sessionRows = gamesSorted.map((game, gameIndex) => {

    const identitiesInGame = gameIdToIdentities.get(game.gameId) ?? new Set<string>();

    const priorEndedGameIds = new Set(

      gamesSorted

        .slice(0, gameIndex)

        .filter((session) => session.status === "ended")

        .map((session) => session.gameId),

    );



    let newPlayerCount = 0;

    let ccfNotYetCount = 0;

    let ccfAttendedCount = 0;



    for (const identityKey of identitiesInGame) {

      const playerGameIds = identityToGameIds.get(identityKey) ?? new Set<string>();

      const hasPriorEndedSession = [...playerGameIds].some((sessionGameId) =>

        priorEndedGameIds.has(sessionGameId),

      );

      if (!hasPriorEndedSession) newPlayerCount += 1;



      if (showCcfInsights) {

        const attendedEvents = identityToAttendedEvents.get(identityKey);

        if (isPlayerCcfNotYet(attendedEvents)) ccfNotYetCount += 1;

        if (isPlayerCcfAttended(attendedEvents)) ccfAttendedCount += 1;

      }

    }



    const openPlayDate = game.openPlayDate

      ? new Date(game.openPlayDate).toISOString()

      : null;



    return {

      gameId: game.gameId,

      title: gamesById.get(game.gameId)?.title ?? game.title,

      createdAt: game.createdAt ? new Date(game.createdAt).toISOString() : null,

      openPlayDate,

      openPlayTimeRange: game.openPlayTimeRange?.trim() ?? null,

      openPlayType: game.openPlayType,

      status: game.status,

      registeredCount: identitiesInGame.size,

      newPlayerCount,

      ccfNotYetCount: showCcfInsights ? ccfNotYetCount : undefined,

      ccfAttendedCount: showCcfInsights ? ccfAttendedCount : undefined,

    };

  });



  const sessions = enrichSessionChartLabels(

    sessionRows,

    (value) => formatOpenPlayDate(value),

    (timeRange) => formatOpenPlayStartTimeDisplay(timeRange),

  );



  return { showCcfInsights, sessions };

}


