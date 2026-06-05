import { DEMO_OPEN_PLAY_TITLE } from "@/lib/demo-open-play";
import { connectToDatabase } from "@/lib/db";
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
import { User } from "@/models/User";

export type { PlayerListItem, UserInsights, UserListFilter, UserListItem, UserOpenPlays };
export { USER_FILTERS } from "@/lib/insights-shared";

// Players created for demo open plays use these QR code prefixes.
const DEMO_PLAYER_QR_PREFIX = /^P-(test|demo)-/i;

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
      "name email userType registrationFeature googleId createdAt registeredDevice lastLoginAt lastLoginDevice isBlocked",
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
    createdAt?: Date;
    registeredDevice?: string | null;
    lastLoginAt?: Date | null;
    lastLoginDevice?: string | null;
    isBlocked?: boolean;
  }>;

  const ownerIds = rows.map((doc) => doc._id);
  const [counts, demoCounts] = await Promise.all([
    getOpenPlayCounts(ownerIds, false),
    getOpenPlayCounts(ownerIds, true),
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
    createdAt: doc.createdAt ? new Date(doc.createdAt).toISOString() : null,
    registeredDevice: doc.registeredDevice?.trim() || null,
    lastLoginAt: doc.lastLoginAt ? new Date(doc.lastLoginAt).toISOString() : null,
    lastLoginDevice: doc.lastLoginDevice?.trim() || null,
    isBlocked: Boolean(doc.isBlocked),
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
      "name email userType registrationFeature googleId createdAt registeredDevice lastLoginAt lastLoginDevice isBlocked",
    )
    .lean();

  return mapUserDocs(docs);
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
  const players = await getPlayersList(10_000, true);
  return players.length;
}

export async function getPlayersList(
  limit = 500,
  realPlayersOnly = false,
): Promise<PlayerListItem[]> {
  await connectToDatabase();

  const demoGameIds = realPlayersOnly ? await getDemoGameIds() : new Set<string>();

  // Same real person can have multiple Player docs (one per open play). Fetch
  // all of them, then collapse by name + email so each person is one row.
  const docs = (await Player.find({})
    .sort({ createdAt: -1 })
    .select(
      "firstName lastName email mobileNumber personalQrCode photoUrl photoPublicId createdAt",
    )
    .lean()) as Array<{
    _id: { toString(): string };
    firstName?: string;
    lastName?: string;
    email?: string;
    mobileNumber?: string;
    personalQrCode?: string;
    photoUrl?: string | null;
    photoPublicId?: string | null;
    createdAt?: Date;
  }>;

  // Player.gamesPlayed is not maintained; derive the distinct open plays each
  // Player doc joined from their queue entries.
  const joinedAgg = (await QueueEntry.aggregate([
    { $group: { _id: "$playerId", games: { $addToSet: "$gameId" } } },
  ])) as Array<{ _id: { toString(): string }; games: string[] }>;

  const gamesByPlayer = new Map(
    joinedAgg.map((row) => [row._id?.toString(), row.games ?? []]),
  );

  type Group = {
    id: string;
    name: string;
    firstName: string;
    lastName: string;
    email: string;
    mobileNumber: string;
    photoUrl?: string | null;
    photoPublicId?: string | null;
    personalQrCode?: string;
    createdAt: Date | null;
    games: Set<string>;
    hasNonDemoDoc: boolean;
  };
  const groups = new Map<string, Group>();

  for (const doc of docs) {
    const name = formatPlayerTableName(doc.firstName ?? "", doc.lastName ?? "") || "—";
    const email = doc.email ?? "—";
    const key = `${name.toLowerCase()}|${email.toLowerCase()}`;
    const isDemoPlayer = DEMO_PLAYER_QR_PREFIX.test(doc.personalQrCode ?? "");

    let group = groups.get(key);
    if (!group) {
      group = {
        id: doc._id.toString(),
        name,
        firstName: doc.firstName ?? "",
        lastName: doc.lastName ?? "",
        email,
        mobileNumber: doc.mobileNumber ?? "—",
        photoUrl: doc.photoUrl,
        photoPublicId: doc.photoPublicId,
        personalQrCode: doc.personalQrCode,
        createdAt: doc.createdAt ? new Date(doc.createdAt) : null,
        games: new Set<string>(),
        hasNonDemoDoc: false,
      };
      groups.set(key, group);
    }

    if (!isDemoPlayer) group.hasNonDemoDoc = true;

    if (doc.photoUrl?.trim()) {
      const current = {
        photoUrl: group.photoUrl,
        photoPublicId: group.photoPublicId,
      };
      if (!group.photoUrl || isUploadedPlayerPhoto(doc) && !isUploadedPlayerPhoto(current)) {
        group.photoUrl = doc.photoUrl;
        group.photoPublicId = doc.photoPublicId;
        group.personalQrCode = doc.personalQrCode;
      }
    }

    for (const gameId of gamesByPlayer.get(doc._id.toString()) ?? []) {
      if (realPlayersOnly && demoGameIds.has(gameId)) continue;
      group.games.add(gameId);
    }
    const created = doc.createdAt ? new Date(doc.createdAt) : null;
    if (created && (!group.createdAt || created < group.createdAt)) {
      group.createdAt = created;
    }
  }

  const filtered = realPlayersOnly
    ? [...groups.values()].filter((group) => group.hasNonDemoDoc)
    : [...groups.values()];

  return filtered
    .sort((a, b) => {
      const at = a.createdAt ? a.createdAt.getTime() : 0;
      const bt = b.createdAt ? b.createdAt.getTime() : 0;
      return bt - at;
    })
    .slice(0, limit)
    .map((group) => ({
      id: group.id,
      name: group.name,
      firstName: group.firstName,
      lastName: group.lastName,
      email: group.email,
      mobileNumber: group.mobileNumber,
      photoUrl: group.photoUrl,
      photoPublicId: group.photoPublicId,
      personalQrCode: group.personalQrCode,
      gamesPlayed: group.games.size,
      createdAt: group.createdAt ? group.createdAt.toISOString() : null,
    }));
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
