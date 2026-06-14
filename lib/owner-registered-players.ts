import { connectToDatabase } from "@/lib/db";
import { getBlockedEmailsForOrganizer } from "@/lib/organizer-blocked-player";
import {
  getPlayerIdentityKey,
  isCcfOnlySessionInsightFilter,
  type OwnerSessionInsightFilter,
} from "@/lib/owner-session-insight-filter-shared";
import { getSessionInsightIdentityKeys } from "@/lib/owner-session-insight-filter";
import { isCcfUserType } from "@/lib/registration-variant";
import {
  OWNER_REGISTERED_PLAYERS_PAGE_SIZE,
  type OwnerRegisteredPlayerItem,
  type OwnerRegisteredPlayersPage,
} from "@/lib/owner-registered-players-shared";
import type { WelcomeEmailStatus } from "@/lib/welcome-email-status";
import { isUploadedPlayerPhoto } from "@/lib/player-avatar-url";
import { formatPlayerTableName } from "@/lib/utils";
import { PickleGame } from "@/models/PickleGame";
import { Player } from "@/models/Player";
import { QueueEntry } from "@/models/QueueEntry";
import { LeaderboardStats } from "@/models/LeaderboardStats";
import { User } from "@/models/User";

type PlayerEntryAgg = {
  _id: { toString(): string };
  gameIds: string[];
  lastRegisteredAt?: Date;
};

type PlayerDoc = {
  _id: { toString(): string };
  firstName?: string;
  lastName?: string;
  email?: string;
  mobileNumber?: string;
  personalQrCode?: string;
  photoUrl?: string | null;
  photoPublicId?: string | null;
  createdAt?: Date;
  welcomeEmailStatus?: WelcomeEmailStatus | "";
  welcomeEmailError?: string;
  welcomeEmailSentAt?: Date | null;
};

export type OwnerRegisteredPlayersQuery = {
  page?: number;
  pageSize?: number;
  query?: string;
  gameId?: string;
  insight?: OwnerSessionInsightFilter;
  exportAll?: boolean;
};

function matchesOwnerPlayerSearch(
  player: Pick<OwnerRegisteredPlayerItem, "name" | "firstName" | "lastName" | "email" | "mobileNumber">,
  query: string,
) {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return true;
  const haystack = [
    player.name,
    player.firstName,
    player.lastName,
    player.email,
    player.mobileNumber,
  ]
    .join(" ")
    .toLowerCase();
  return haystack.includes(normalized);
}

function mergePlayerEntryAgg(rows: PlayerEntryAgg[]): PlayerEntryAgg[] {
  const merged = new Map<string, PlayerEntryAgg>();

  for (const row of rows) {
    const id = row._id.toString();
    const existing = merged.get(id);
    if (!existing) {
      merged.set(id, {
        _id: row._id,
        gameIds: [...new Set(row.gameIds)],
        lastRegisteredAt: row.lastRegisteredAt,
      });
      continue;
    }

    existing.gameIds = [...new Set([...existing.gameIds, ...row.gameIds])];
    const rowDate = row.lastRegisteredAt ? new Date(row.lastRegisteredAt) : null;
    const existingDate = existing.lastRegisteredAt ? new Date(existing.lastRegisteredAt) : null;
    if (rowDate && (!existingDate || rowDate > existingDate)) {
      existing.lastRegisteredAt = rowDate;
    }
  }

  return [...merged.values()];
}

export async function getOwnerRegisteredPlayers(
  ownerId: string,
  options: OwnerRegisteredPlayersQuery = {},
): Promise<OwnerRegisteredPlayersPage> {
  const page = Math.max(1, options.page ?? 1);
  const pageSize = Math.min(
    100,
    Math.max(1, options.pageSize ?? OWNER_REGISTERED_PLAYERS_PAGE_SIZE),
  );
  const searchQuery = options.query?.trim() ?? "";
  const sessionGameId = options.gameId?.trim() ?? "";
  let insightFilter = sessionGameId ? options.insight : undefined;
  await connectToDatabase();

  if (insightFilter && isCcfOnlySessionInsightFilter(insightFilter)) {
    const ownerUser = await User.findById(ownerId).select("userType").lean();
    const ownerUserType =
      ownerUser && typeof ownerUser === "object" && typeof ownerUser.userType === "string"
        ? ownerUser.userType
        : undefined;
    if (!isCcfUserType(ownerUserType)) {
      insightFilter = undefined;
    }
  }

  const insightIdentityKeys =
    insightFilter && sessionGameId
      ? await getSessionInsightIdentityKeys(ownerId, sessionGameId, insightFilter)
      : null;

  const ownerGames = await PickleGame.find({ ownerId }).select("gameId").lean<Array<{ gameId: string }>>();
  if (ownerGames.length === 0) {
    return { players: [], total: 0, page, pageSize, totalPages: 0 };
  }

  const blockedEmails = await getBlockedEmailsForOrganizer(ownerId);
  const ownerGameIds = ownerGames.map((game) => game.gameId);

  const queueAgg = (await QueueEntry.aggregate([
    { $match: { gameId: { $in: ownerGameIds } } },
    {
      $group: {
        _id: "$playerId",
        gameIds: { $addToSet: "$gameId" },
        lastRegisteredAt: { $max: "$registeredAt" },
      },
    },
  ])) as PlayerEntryAgg[];

  const entryAgg = sessionGameId
    ? mergePlayerEntryAgg([
        ...queueAgg,
        ...((await LeaderboardStats.aggregate([
          { $match: { gameId: { $in: ownerGameIds } } },
          {
            $group: {
              _id: "$playerId",
              gameIds: { $addToSet: "$gameId" },
              lastRegisteredAt: { $max: "$updatedAt" },
            },
          },
        ])) as PlayerEntryAgg[]),
      ])
    : queueAgg;

  if (entryAgg.length === 0) {
    return { players: [], total: 0, page, pageSize, totalPages: 0 };
  }

  const entryByPlayerId = new Map(
    entryAgg.map((row) => [row._id.toString(), row]),
  );

  const playerIds = entryAgg.map((row) => row._id);
  const playerDocs = (await Player.find({ _id: { $in: playerIds } })
    .select(
      "firstName lastName email mobileNumber personalQrCode photoUrl photoPublicId createdAt welcomeEmailStatus welcomeEmailError welcomeEmailSentAt",
    )
    .lean()) as PlayerDoc[];

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
    sessions: Set<string>;
    lastRegisteredAt: Date | null;
    welcomeEmailStatus: WelcomeEmailStatus | "";
    welcomeEmailError: string;
    welcomeEmailSentAt: Date | null;
  };

  const groups = new Map<string, Group>();

  for (const doc of playerDocs) {
    const entry = entryByPlayerId.get(doc._id.toString());
    if (!entry) continue;

    const name = formatPlayerTableName(doc.firstName ?? "", doc.lastName ?? "") || "—";
    const email = doc.email ?? "—";
    const key = `${name.toLowerCase()}|${email.toLowerCase()}`;

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
        sessions: new Set<string>(),
        lastRegisteredAt: null,
        welcomeEmailStatus: doc.welcomeEmailStatus ?? "",
        welcomeEmailError: doc.welcomeEmailError?.trim() ?? "",
        welcomeEmailSentAt: doc.welcomeEmailSentAt ? new Date(doc.welcomeEmailSentAt) : null,
      };
      groups.set(key, group);
    }

    if (doc.photoUrl?.trim()) {
      const current = {
        photoUrl: group.photoUrl,
        photoPublicId: group.photoPublicId,
      };
      if (!group.photoUrl || (isUploadedPlayerPhoto(doc) && !isUploadedPlayerPhoto(current))) {
        group.photoUrl = doc.photoUrl;
        group.photoPublicId = doc.photoPublicId;
        group.personalQrCode = doc.personalQrCode;
      }
    }

    for (const gameId of entry.gameIds ?? []) {
      group.sessions.add(gameId);
    }

    const lastRegistered = entry.lastRegisteredAt ? new Date(entry.lastRegisteredAt) : null;
    if (
      lastRegistered &&
      (!group.lastRegisteredAt || lastRegistered > group.lastRegisteredAt)
    ) {
      group.lastRegisteredAt = lastRegistered;
    }
  }

  let groupList = [...groups.values()];
  if (sessionGameId) {
    groupList = groupList.filter((group) => group.sessions.has(sessionGameId));
  }
  if (insightIdentityKeys) {
    groupList = groupList.filter((group) => {
      const identityKey = getPlayerIdentityKey({
        _id: { toString: () => group.id },
        email: group.email === "—" ? "" : group.email,
        firstName: group.firstName,
        lastName: group.lastName,
      });
      return insightIdentityKeys.has(identityKey);
    });
  }

  const allPlayers = groupList
    .sort((a, b) => {
      const at = a.lastRegisteredAt ? a.lastRegisteredAt.getTime() : 0;
      const bt = b.lastRegisteredAt ? b.lastRegisteredAt.getTime() : 0;
      return bt - at;
    })
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
      sessionsCount: group.sessions.size,
      lastRegisteredAt: group.lastRegisteredAt ? group.lastRegisteredAt.toISOString() : null,
      isBlocked: blockedEmails.has(group.email.trim().toLowerCase()),
      welcomeEmailStatus: group.welcomeEmailStatus,
      welcomeEmailError: group.welcomeEmailError,
      welcomeEmailSentAt: group.welcomeEmailSentAt
        ? group.welcomeEmailSentAt.toISOString()
        : null,
    }));

  const filtered = searchQuery
    ? allPlayers.filter((player) => matchesOwnerPlayerSearch(player, searchQuery))
    : allPlayers;

  const total = filtered.length;
  const totalPages = total === 0 ? 0 : Math.ceil(total / pageSize);
  const safePage = totalPages === 0 ? 1 : Math.min(page, totalPages);
  const start = (safePage - 1) * pageSize;

  if (options.exportAll) {
    return {
      players: filtered,
      total,
      page: 1,
      pageSize: total || 1,
      totalPages: total > 0 ? 1 : 0,
    };
  }

  return {
    players: filtered.slice(start, start + pageSize),
    total,
    page: safePage,
    pageSize,
    totalPages,
  };
}
