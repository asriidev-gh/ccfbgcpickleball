import { DEMO_OPEN_PLAY_TITLE } from "@/lib/demo-open-play";
import { connectToDatabase } from "@/lib/db";
import { isUserEmailVerified } from "@/lib/user-email-verification";
import { isOwnerPreRegisteredPlayer } from "@/lib/owner-pre-registered-players";
import { formatPlayerTableName } from "@/lib/utils";
import { isUploadedPlayerPhoto } from "@/lib/player-avatar-url";
import type {
  PlayerListItem,
  UserInsights,
  UserListFilter,
  UserListItem,
  UserOpenPlays,
} from "@/lib/insights-shared";
import { PickleGame } from "@/models/PickleGame";
import { Player } from "@/models/Player";
import { QueueEntry } from "@/models/QueueEntry";
import { QuickGameSession } from "@/models/QuickGameSession";
import { User } from "@/models/User";
import type { PipelineStage } from "mongoose";
import type { OperatorFullPayload } from "@/lib/operator-payload";
import { quickGamePayloadToListItem } from "@/lib/quick-game-persistence-server";

export type { PlayerListItem, UserInsights, UserListFilter, UserListItem, UserOpenPlays };
export { USER_FILTERS } from "@/lib/insights-shared";

// Players created for demo open plays use these QR code prefixes.
const DEMO_PLAYER_QR_PREFIX = /^P-(test|demo)-/i;

type PlayerGroupRow = {
  _id: string;
  id: { toString(): string };
  firstName?: string;
  lastName?: string;
  email?: string;
  mobileNumber?: string;
  personalQrCode?: string;
  createdAt?: Date;
  hasNonDemoDoc: number;
  playerIds: Array<{ toString(): string }>;
  docs: Array<{
    photoUrl?: string | null;
    photoPublicId?: string | null;
    personalQrCode?: string;
  }>;
};

/** Collapse duplicate Player docs by name + email without loading every document. */
function buildPlayerGroupPipelineStages(realPlayersOnly: boolean, limit?: number): PipelineStage[] {
  const stages: PipelineStage[] = [
    {
      $addFields: {
        groupKey: {
          $concat: [
            {
              $toLower: {
                $trim: {
                  input: {
                    $cond: [
                      {
                        $eq: [
                          {
                            $trim: {
                              input: {
                                $concat: [
                                  { $ifNull: ["$firstName", ""] },
                                  " ",
                                  { $ifNull: ["$lastName", ""] },
                                ],
                              },
                            },
                          },
                          "",
                        ],
                      },
                      "—",
                      {
                        $trim: {
                          input: {
                            $concat: [
                              { $ifNull: ["$firstName", ""] },
                              " ",
                              { $ifNull: ["$lastName", ""] },
                            ],
                          },
                        },
                      },
                    ],
                  },
                },
              },
            },
            "|",
            { $toLower: { $ifNull: ["$email", "—"] } },
          ],
        },
        isDemoDoc: {
          $regexMatch: {
            input: { $ifNull: ["$personalQrCode", ""] },
            regex: DEMO_PLAYER_QR_PREFIX.source,
            options: "i",
          },
        },
      },
    },
    {
      $group: {
        _id: "$groupKey",
        id: { $first: "$_id" },
        firstName: { $first: "$firstName" },
        lastName: { $first: "$lastName" },
        email: { $first: "$email" },
        mobileNumber: { $first: "$mobileNumber" },
        personalQrCode: { $first: "$personalQrCode" },
        createdAt: { $min: "$createdAt" },
        hasNonDemoDoc: { $max: { $cond: ["$isDemoDoc", 0, 1] } },
        playerIds: { $addToSet: "$_id" },
        docs: {
          $push: {
            photoUrl: "$photoUrl",
            photoPublicId: "$photoPublicId",
            personalQrCode: "$personalQrCode",
          },
        },
      },
    },
  ];

  if (realPlayersOnly) {
    stages.push({ $match: { hasNonDemoDoc: 1 } });
  }

  stages.push({ $sort: { createdAt: -1 } });

  if (limit !== undefined) {
    stages.push({ $limit: limit });
  }

  return stages;
}

function mapPlayerGroupRow(
  group: PlayerGroupRow,
  gamesByPlayer: Map<string, string[]>,
  demoGameIds: Set<string>,
  realPlayersOnly: boolean,
): PlayerListItem {
  const gameSet = new Set<string>();
  for (const playerId of group.playerIds) {
    for (const gameId of gamesByPlayer.get(playerId.toString()) ?? []) {
      if (realPlayersOnly && demoGameIds.has(gameId)) continue;
      gameSet.add(gameId);
    }
  }

  let photoUrl = group.docs[0]?.photoUrl;
  let photoPublicId = group.docs[0]?.photoPublicId;
  let personalQrCode = group.personalQrCode;
  for (const doc of group.docs) {
    if (!doc.photoUrl?.trim()) continue;
    const current = { photoUrl, photoPublicId };
    if (!photoUrl || (isUploadedPlayerPhoto(doc) && !isUploadedPlayerPhoto(current))) {
      photoUrl = doc.photoUrl;
      photoPublicId = doc.photoPublicId;
      personalQrCode = doc.personalQrCode;
    }
  }

  const firstName = group.firstName ?? "";
  const lastName = group.lastName ?? "";
  return {
    id: group.id.toString(),
    name: formatPlayerTableName(firstName, lastName) || "—",
    firstName,
    lastName,
    email: group.email ?? "—",
    mobileNumber: group.mobileNumber ?? "—",
    photoUrl,
    photoPublicId,
    personalQrCode,
    gamesPlayed: gameSet.size,
    createdAt: group.createdAt ? new Date(group.createdAt).toISOString() : null,
  };
}

async function getDemoGameIds(): Promise<Set<string>> {
  const games = await PickleGame.find({ title: { $regex: DEMO_OPEN_PLAY_TITLE } })
    .select("gameId")
    .lean<Array<{ gameId: string }>>();
  return new Set(games.map((g) => g.gameId));
}

async function getOpenPlayCounts(
  ownerIds: Array<{ toString(): string }>,
  demoOnly: boolean,
): Promise<Map<string, number>> {
  if (ownerIds.length === 0) return new Map();
  const titleMatch = demoOnly
    ? { title: { $regex: DEMO_OPEN_PLAY_TITLE } }
    : { title: { $not: { $regex: DEMO_OPEN_PLAY_TITLE } } };
  const agg = (await PickleGame.aggregate([
    {
      $match: {
        ownerId: { $in: ownerIds },
        ...titleMatch,
      },
    },
    { $group: { _id: "$ownerId", count: { $sum: 1 } } },
  ])) as Array<{ _id: { toString(): string }; count: number }>;
  return new Map(agg.map((row) => [row._id.toString(), row.count]));
}

async function getQuickGameCounts(
  ownerIds: Array<{ toString(): string }>,
): Promise<Map<string, number>> {
  if (ownerIds.length === 0) return new Map();
  const agg = (await QuickGameSession.aggregate([
    { $match: { ownerId: { $in: ownerIds } } },
    { $group: { _id: "$ownerId", count: { $sum: 1 } } },
  ])) as Array<{ _id: { toString(): string }; count: number }>;
  return new Map(agg.map((row) => [row._id.toString(), row.count]));
}

function startOfDayDaysAgo(days: number): Date {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() - days);
  return date;
}

function buildLastSixMonths(): { key: string; label: string }[] {
  const months: { key: string; label: string }[] = [];
  const now = new Date();
  for (let i = 5; i >= 0; i -= 1) {
    const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
    const label = date.toLocaleString("en-US", { month: "short", year: "2-digit" });
    months.push({ key, label });
  }
  return months;
}

function buildUserFilterQuery(filter: UserListFilter): Record<string, unknown> {
  switch (filter) {
    case "ccf":
      return { userType: "ccf" };
    case "default":
      return { userType: "default" };
    case "google":
      return { googleId: { $exists: true, $ne: null } };
    case "password":
      return {
        passwordHash: { $exists: true, $ne: null },
        $or: [{ googleId: { $exists: false } }, { googleId: null }],
      };
    case "new7":
      return { createdAt: { $gte: startOfDayDaysAgo(7) } };
    case "new30":
      return { createdAt: { $gte: startOfDayDaysAgo(30) } };
    case "all":
    default:
      return {};
  }
}

export async function getUsersList(
  filter: UserListFilter = "all",
  limit = 500,
): Promise<UserListItem[]> {
  await connectToDatabase();

  const docs = await User.find(buildUserFilterQuery(filter))
    .sort({ createdAt: -1 })
    .limit(limit)
    .select(
      "name email userType registrationFeature googleId emailVerified createdAt registeredDevice lastLoginAt lastLoginDevice isBlocked",
    )
    .lean();

  return mapUserDocs(docs);
}

/** Maps Mongo user docs to the client-safe shape, including open play counts. */
async function mapUserDocs(docs: unknown): Promise<UserListItem[]> {
  const rows = docs as Array<{
    _id: { toString(): string };
    name: string;
    email: string;
    userType?: string;
    registrationFeature?: string;
    googleId?: string | null;
    emailVerified?: boolean;
    createdAt?: Date;
    registeredDevice?: string | null;
    lastLoginAt?: Date | null;
    lastLoginDevice?: string | null;
    isBlocked?: boolean;
  }>;

  const ownerIds = rows.map((doc) => doc._id);
  const [counts, demoCounts, quickCounts] = await Promise.all([
    getOpenPlayCounts(ownerIds, false),
    getOpenPlayCounts(ownerIds, true),
    getQuickGameCounts(ownerIds),
  ]);

  return rows.map((doc) => ({
    id: doc._id.toString(),
    name: doc.name,
    email: doc.email,
    userType: doc.userType ?? "default",
    registrationFeature:
      doc.registrationFeature === "qr_id" ? "qr_id" : ("default" as const),
    hasGoogle: Boolean(doc.googleId),
    openPlayCount: counts.get(doc._id.toString()) ?? 0,
    demoOpenPlayCount: demoCounts.get(doc._id.toString()) ?? 0,
    quickGameCount: quickCounts.get(doc._id.toString()) ?? 0,
    createdAt: doc.createdAt ? new Date(doc.createdAt).toISOString() : null,
    registeredDevice: doc.registeredDevice?.trim() || null,
    lastLoginAt: doc.lastLoginAt ? new Date(doc.lastLoginAt).toISOString() : null,
    lastLoginDevice: doc.lastLoginDevice?.trim() || null,
    isBlocked: Boolean(doc.isBlocked),
    emailVerified: isUserEmailVerified({
      emailVerified: doc.emailVerified,
      googleId: doc.googleId,
    }),
  }));
}

/** Returns users created within the given month (key formatted as YYYY-MM). */
export async function getUsersByMonth(monthKey: string, limit = 500): Promise<UserListItem[]> {
  await connectToDatabase();

  const match = /^(\d{4})-(\d{2})$/.exec(monthKey);
  if (!match) return [];
  const year = Number(match[1]);
  const month = Number(match[2]) - 1;
  const start = new Date(year, month, 1, 0, 0, 0, 0);
  const end = new Date(year, month + 1, 1, 0, 0, 0, 0);

  const docs = await User.find({ createdAt: { $gte: start, $lt: end } })
    .sort({ createdAt: -1 })
    .limit(limit)
    .select(
      "name email userType registrationFeature googleId emailVerified createdAt registeredDevice lastLoginAt lastLoginDevice isBlocked",
    )
    .lean();

  return mapUserDocs(docs);
}

/** Lists saved account quick games (live queuing off) for a user. */
export async function getUserQuickGameOpenPlays(userId: string): Promise<UserOpenPlays | null> {
  await connectToDatabase();

  const user = await User.findById(userId).select("name").lean<{ name?: string } | null>();
  if (!user) return null;

  const docs = await QuickGameSession.find({ ownerId: userId })
    .sort({ createdAt: -1 })
    .select("gameId status payload createdAt updatedAt")
    .lean();

  return {
    user: { id: userId, name: user.name ?? "Unknown" },
    count: docs.length,
    games: docs.map((doc) => {
      const payload = doc.payload as OperatorFullPayload;
      const listItem = quickGamePayloadToListItem(
        doc.gameId,
        payload,
        doc.status as "active" | "ended",
        doc.updatedAt ?? doc.createdAt,
      );
      const playerCount = listItem.expectedPlayers;

      return {
        gameId: listItem.gameId,
        title: listItem.title,
        status: listItem.status,
        openPlayType: listItem.openPlayType,
        courtCount: listItem.courtCount,
        playerCount,
        expectedPlayers: playerCount,
        strictPlayerCount: false,
        organizerRegisteredAllPlayers: true,
        createdAt: doc.createdAt ? new Date(doc.createdAt).toISOString() : null,
      };
    }),
  };
}

async function buildUserOpenPlaysList(
  userId: string,
  userName: string,
  demoOnly: boolean,
): Promise<UserOpenPlays> {
  const titleFilter = demoOnly
    ? { title: { $regex: DEMO_OPEN_PLAY_TITLE } }
    : { title: { $not: DEMO_OPEN_PLAY_TITLE } };

  const games = (await PickleGame.find({ ownerId: userId, ...titleFilter })
    .sort({ createdAt: -1 })
    .select(
      "gameId title status openPlayType courtCount expectedPlayers strictPlayerCount registrationMode createdAt",
    )
    .lean()) as Array<{
    gameId: string;
    title: string;
    status?: string;
    openPlayType?: string;
    courtCount?: number;
    expectedPlayers?: number;
    strictPlayerCount?: boolean;
    registrationMode?: string;
    createdAt?: Date;
  }>;

  const gameIds = games.map((g) => g.gameId);
  const playerAgg =
    gameIds.length === 0
      ? []
      : ((await QueueEntry.aggregate([
          { $match: { gameId: { $in: gameIds } } },
          { $group: { _id: "$gameId", players: { $addToSet: "$playerId" } } },
        ])) as Array<{ _id: string; players: unknown[] }>);
  const playersByGame = new Map(playerAgg.map((row) => [row._id, row.players.length]));

  const organizerRegisteredByGame = new Set<string>();
  if (gameIds.length > 0) {
    const queueEntries = await QueueEntry.find({ gameId: { $in: gameIds } })
      .select("gameId")
      .populate("playerId", "email personalQrCode")
      .lean<
        Array<{
          gameId: string;
          playerId?: { email?: string; personalQrCode?: string } | null;
        }>
      >();

    for (const entry of queueEntries) {
      if (
        entry.playerId &&
        isOwnerPreRegisteredPlayer(entry.playerId, entry.gameId)
      ) {
        organizerRegisteredByGame.add(entry.gameId);
      }
    }
  }

  return {
    user: { id: userId, name: userName },
    count: games.length,
    games: games.map((g) => ({
      gameId: g.gameId,
      title: g.title,
      status: g.status ?? "unknown",
      openPlayType: g.openPlayType ?? "—",
      courtCount: g.courtCount ?? 0,
      playerCount: playersByGame.get(g.gameId) ?? 0,
      expectedPlayers: g.expectedPlayers ?? 0,
      strictPlayerCount: g.strictPlayerCount === true,
      organizerRegisteredAllPlayers:
        g.registrationMode === "owner" || organizerRegisteredByGame.has(g.gameId),
      createdAt: g.createdAt ? new Date(g.createdAt).toISOString() : null,
    })),
  };
}

/** Lists the real (non-demo) open plays a user created, with player counts. */
export async function getUserOpenPlays(userId: string): Promise<UserOpenPlays | null> {
  await connectToDatabase();

  const user = await User.findById(userId).select("name").lean<{ name?: string } | null>();
  if (!user) return null;

  return buildUserOpenPlaysList(userId, user.name ?? "Unknown", false);
}

/** Lists demo/test open plays a user created, with player counts. */
export async function getUserDemoOpenPlays(userId: string): Promise<UserOpenPlays | null> {
  await connectToDatabase();

  const user = await User.findById(userId).select("name").lean<{ name?: string } | null>();
  if (!user) return null;

  return buildUserOpenPlaysList(userId, user.name ?? "Unknown", true);
}

/** Distinct real players (grouped by name + email), excluding demo-generated records. */
export async function countRealPlayersRegistered(): Promise<number> {
  await connectToDatabase();

  const result = await Player.aggregate<{ total?: number }>([
    ...buildPlayerGroupPipelineStages(true),
    { $count: "total" },
  ]);

  return result[0]?.total ?? 0;
}

export async function getPlayersList(
  limit = 500,
  realPlayersOnly = false,
): Promise<PlayerListItem[]> {
  await connectToDatabase();

  const [demoGameIds, groups] = await Promise.all([
    realPlayersOnly ? getDemoGameIds() : Promise.resolve(new Set<string>()),
    Player.aggregate<PlayerGroupRow>(buildPlayerGroupPipelineStages(realPlayersOnly, limit)),
  ]);

  const allPlayerIds = groups.flatMap((group) => group.playerIds);
  const joinedAgg =
    allPlayerIds.length === 0
      ? []
      : ((await QueueEntry.aggregate([
          { $match: { playerId: { $in: allPlayerIds } } },
          { $group: { _id: "$playerId", games: { $addToSet: "$gameId" } } },
        ])) as Array<{ _id: { toString(): string }; games: string[] }>);

  const gamesByPlayer = new Map(
    joinedAgg.map((row) => [row._id.toString(), row.games ?? []]),
  );

  return groups.map((group) =>
    mapPlayerGroupRow(group, gamesByPlayer, demoGameIds, realPlayersOnly),
  );
}

export async function getUserInsights(): Promise<UserInsights> {
  await connectToDatabase();

  const last7 = startOfDayDaysAgo(7);
  const last30 = startOfDayDaysAgo(30);
  const sixMonthsAgo = new Date();
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 5);
  sixMonthsAgo.setDate(1);
  sixMonthsAgo.setHours(0, 0, 0, 0);

  const [
    totalUsers,
    ccfUsers,
    defaultUsers,
    googleLinked,
    passwordOnly,
    newLast7Days,
    newLast30Days,
    totalGames,
    activeGames,
    endedGames,
    playersRegistered,
    signupAgg,
    topOwnersAgg,
  ] = await Promise.all([
    User.countDocuments({}),
    User.countDocuments({ userType: "ccf" }),
    User.countDocuments({ userType: "default" }),
    User.countDocuments({ googleId: { $exists: true, $ne: null } }),
    User.countDocuments({
      passwordHash: { $exists: true, $ne: null },
      $or: [{ googleId: { $exists: false } }, { googleId: null }],
    }),
    User.countDocuments({ createdAt: { $gte: last7 } }),
    User.countDocuments({ createdAt: { $gte: last30 } }),
    PickleGame.countDocuments({}),
    PickleGame.countDocuments({ status: { $ne: "ended" } }),
    PickleGame.countDocuments({ status: "ended" }),
    countRealPlayersRegistered(),
    User.aggregate([
      { $match: { createdAt: { $gte: sixMonthsAgo } } },
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m", date: "$createdAt" } },
          count: { $sum: 1 },
        },
      },
    ]),
    PickleGame.aggregate([
      { $group: { _id: "$ownerId", games: { $sum: 1 } } },
      { $sort: { games: -1 } },
      { $limit: 5 },
      {
        $lookup: {
          from: "users",
          localField: "_id",
          foreignField: "_id",
          as: "owner",
        },
      },
      { $unwind: { path: "$owner", preserveNullAndEmptyArrays: true } },
      {
        $project: {
          _id: 0,
          games: 1,
          name: { $ifNull: ["$owner.name", "Unknown"] },
          email: { $ifNull: ["$owner.email", "—"] },
        },
      },
    ]),
  ]);

  const signupCounts = new Map<string, number>(
    (signupAgg as { _id: string; count: number }[]).map((row) => [row._id, row.count]),
  );
  const signupsByMonth = buildLastSixMonths().map((month) => ({
    key: month.key,
    label: month.label,
    count: signupCounts.get(month.key) ?? 0,
  }));

  return {
    generatedAt: new Date().toISOString(),
    users: {
      total: totalUsers,
      ccf: ccfUsers,
      default: defaultUsers,
      googleLinked,
      passwordOnly,
      newLast7Days,
      newLast30Days,
    },
    signupsByMonth,
    games: { total: totalGames, active: activeGames, ended: endedGames },
    activity: { playersRegistered },
    topOwners: topOwnersAgg as { name: string; email: string; games: number }[],
  };
}
