import { connectToDatabase } from "@/lib/db";
import { DGROUP_WEEKDAYS, type DgroupWeekday } from "@/lib/dgroup-availability-shared";
import { isDgroupRequestAcknowledgedForOwner } from "@/lib/owner-dgroup-remarks";
import { isOwnerMarkedDgroupJoined } from "@/lib/owner-dgroup-requests";
import { createPrayerRequestFromRegistration, getSpectatePlayerPrayerStatus } from "@/lib/owner-prayer-requests";
import { MAX_PRAYER_REQUEST_LENGTH, MIN_PRAYER_REQUEST_LENGTH } from "@/lib/owner-prayer-requests-shared";
import { assertPlayerRegisteredForGame } from "@/lib/player-profile";
import { getPlayerQueueStatusForGame } from "@/lib/game-registration-limit";
import { assertGameShowsCcfMinistryFeatures, resolveGameShowsCcfMinistryFeatures } from "@/lib/ccf-ministry-features";
import { listPlayerVisibleClubAnnouncements } from "@/lib/club-announcements";
import { buildPlayerVisibleClubAnnouncementFilter, getClubAnnouncementTodayKey } from "@/lib/club-announcement-schedule";
import type {
  SpectatePlayerAnnouncement,
  SpectatePlayerFeatures,
} from "@/lib/spectate-player-features-shared";
import mongoose from "mongoose";
import { ClubAnnouncement } from "@/models/ClubAnnouncement";
import { PickleGame } from "@/models/PickleGame";
import { Player } from "@/models/Player";
import { PlayerAnnouncementRead } from "@/models/PlayerAnnouncementRead";

type AnnouncementDoc = {
  _id: { toString(): string };
  title: string;
  body: string;
  publishedAt: Date;
};

async function getGameOwnerId(gameId: string) {
  await connectToDatabase();
  const game = await PickleGame.findOne({ gameId }).select("ownerId").lean<{ ownerId: { toString(): string } }>();
  if (!game?.ownerId) {
    throw new Error("Game not found.");
  }
  return String(game.ownerId);
}

function normalizeWeekdays(days: string[]): DgroupWeekday[] {
  return days.filter((day): day is DgroupWeekday =>
    DGROUP_WEEKDAYS.includes(day as DgroupWeekday),
  );
}

export async function getSpectatePlayerFeatures(
  gameId: string,
  playerId: string,
): Promise<SpectatePlayerFeatures> {
  await assertPlayerRegisteredForGame(gameId, playerId);

  const [ownerId, showCcfFeatures, player] = await Promise.all([
    getGameOwnerId(gameId),
    resolveGameShowsCcfMinistryFeatures(gameId),
    Player.findById(playerId)
      .select(
        "isPartOfDgroup wantsToJoinDgroup dgroupAvailableDays dgroupAvailableTimeFrom dgroupAvailableTimeTo",
      )
      .lean<{
        isPartOfDgroup?: boolean;
        wantsToJoinDgroup?: boolean | null;
        dgroupAvailableDays?: string[];
        dgroupAvailableTimeFrom?: string;
        dgroupAvailableTimeTo?: string;
      }>(),
  ]);

  if (!player) throw new Error("Player not found.");

  const isDgroupRequestAcknowledged = showCcfFeatures
    ? await isDgroupRequestAcknowledgedForOwner(ownerId, playerId)
    : false;
  const ownerMarkedDgroupJoined = showCcfFeatures
    ? await isOwnerMarkedDgroupJoined(ownerId, playerId)
    : false;

  const published = (await listPlayerVisibleClubAnnouncements(ownerId)) as Array<{
    _id: { toString(): string };
  }>;

  const playerObjectId = new mongoose.Types.ObjectId(playerId);
  const publishedAnnouncementIds = published.map(
    (item) => new mongoose.Types.ObjectId(item._id.toString()),
  );

  const readCount =
    publishedAnnouncementIds.length === 0
      ? 0
      : await PlayerAnnouncementRead.countDocuments({
          playerId: playerObjectId,
          announcementId: { $in: publishedAnnouncementIds },
        });

  const isPartOfDgroup = player.isPartOfDgroup === true;
  const showDgroupJoinMenu =
    showCcfFeatures && !isPartOfDgroup && !ownerMarkedDgroupJoined;

  const prayerStatus = showCcfFeatures
    ? await getSpectatePlayerPrayerStatus(ownerId, playerId)
    : null;

  const queueStatus = await getPlayerQueueStatusForGame(gameId, playerId);

  return {
    communityPostCount: published.length,
    unreadAnnouncementCount: Math.max(0, published.length - readCount),
    showCcfFeatures,
    isPartOfDgroup,
    wantsToJoinDgroup: player.wantsToJoinDgroup ?? null,
    dgroupAvailableDays: normalizeWeekdays(player.dgroupAvailableDays ?? []),
    dgroupAvailableTimeFrom: player.dgroupAvailableTimeFrom?.trim() ?? "",
    dgroupAvailableTimeTo: player.dgroupAvailableTimeTo?.trim() ?? "",
    isDgroupRequestAcknowledged,
    hasSubmittedDgroupRequest: player.wantsToJoinDgroup === true,
    isOwnerMarkedDgroupJoined: ownerMarkedDgroupJoined,
    showDgroupJoinMenu,
    hasSubmittedPrayerRequest: prayerStatus?.hasRequest ?? false,
    isPrayerRequestAcknowledged: prayerStatus?.status === "acknowledged",
    prayerReplyCount: prayerStatus?.replyCount ?? 0,
    showMarketplace: queueStatus === "active",
  };
}

export async function listSpectateGameAnnouncements(gameId: string) {
  const ownerId = await getGameOwnerId(gameId);
  const announcements = (await listPlayerVisibleClubAnnouncements(ownerId)) as AnnouncementDoc[];

  const items: SpectatePlayerAnnouncement[] = announcements.map((doc) => ({
    id: doc._id.toString(),
    title: doc.title,
    body: doc.body,
    publishedAt: doc.publishedAt.toISOString(),
    isRead: true,
  }));

  return {
    announcements: items,
    totalCount: items.length,
  };
}

export async function listSpectatePlayerAnnouncements(gameId: string, playerId: string) {
  await assertPlayerRegisteredForGame(gameId, playerId);
  const ownerId = await getGameOwnerId(gameId);

  const [announcements, readRows] = await Promise.all([
    listPlayerVisibleClubAnnouncements(ownerId),
    PlayerAnnouncementRead.find({ playerId: new mongoose.Types.ObjectId(playerId) })
      .select("announcementId")
      .lean(),
  ]);

  const readIds = new Set(
    (readRows as Array<{ announcementId: { toString(): string } }>).map((row) =>
      row.announcementId.toString(),
    ),
  );

  const items: SpectatePlayerAnnouncement[] = (announcements as AnnouncementDoc[])
    .map((doc) => ({
      id: doc._id.toString(),
      title: doc.title,
      body: doc.body,
      publishedAt: doc.publishedAt.toISOString(),
      isRead: readIds.has(doc._id.toString()),
    }))
    .filter((item) => !item.isRead);

  return {
    announcements: items,
    unreadCount: items.length,
  };
}

export async function markSpectatePlayerAnnouncementsRead(
  gameId: string,
  playerId: string,
  announcementIds: string[],
) {
  await assertPlayerRegisteredForGame(gameId, playerId);
  const ownerId = await getGameOwnerId(gameId);

  if (announcementIds.length === 0) return { marked: 0 };

  const validIds = (await ClubAnnouncement.find({
    ownerId,
    ...buildPlayerVisibleClubAnnouncementFilter(getClubAnnouncementTodayKey()),
    _id: { $in: announcementIds.map((id) => new mongoose.Types.ObjectId(id)) },
  })
    .select("_id")
    .lean()) as Array<{ _id: { toString(): string } }>;

  if (validIds.length === 0) return { marked: 0 };

  await PlayerAnnouncementRead.bulkWrite(
    validIds.map((doc) => ({
      updateOne: {
        filter: {
          playerId: new mongoose.Types.ObjectId(playerId),
          announcementId: new mongoose.Types.ObjectId(doc._id.toString()),
        },
        update: { $set: { readAt: new Date() } },
        upsert: true,
      },
    })),
    { ordered: false },
  );

  return { marked: validIds.length };
}

export async function submitSpectatePlayerPrayerRequest(
  gameId: string,
  playerId: string,
  requestText: string,
) {
  await assertPlayerRegisteredForGame(gameId, playerId);
  await assertGameShowsCcfMinistryFeatures(gameId);

  const trimmed = requestText.trim();
  if (!trimmed) {
    throw new Error("Please enter your prayer request.");
  }
  if (trimmed.length < MIN_PRAYER_REQUEST_LENGTH) {
    throw new Error(`Prayer request must be at least ${MIN_PRAYER_REQUEST_LENGTH} characters.`);
  }
  if (trimmed.length > MAX_PRAYER_REQUEST_LENGTH) {
    throw new Error(`Prayer request must be ${MAX_PRAYER_REQUEST_LENGTH} characters or less.`);
  }

  const ownerId = await getGameOwnerId(gameId);
  const activePrayer = await getSpectatePlayerPrayerStatus(ownerId, playerId);
  if (activePrayer.hasRequest) {
    throw new Error("You have already submitted a prayer request.");
  }

  const created = await createPrayerRequestFromRegistration(gameId, playerId, trimmed);
  if (!created) {
    throw new Error("Unable to submit prayer request.");
  }

  return { id: created._id.toString() };
}

export async function submitSpectatePlayerDgroupRequest(
  gameId: string,
  playerId: string,
  input: {
    wantsToJoinDgroup: boolean;
    dgroupAvailableDays: DgroupWeekday[];
    dgroupAvailableTimeFrom: string;
    dgroupAvailableTimeTo: string;
  },
) {
  await assertPlayerRegisteredForGame(gameId, playerId);
  await assertGameShowsCcfMinistryFeatures(gameId);

  const player = await Player.findById(playerId);
  if (!player) throw new Error("Player not found.");
  if (player.isPartOfDgroup === true) {
    throw new Error("You are already part of a D-group.");
  }

  const ownerId = await getGameOwnerId(gameId);
  if (await isOwnerMarkedDgroupJoined(ownerId, playerId)) {
    throw new Error("You have already been marked as joined to a D-group.");
  }
  if (player.wantsToJoinDgroup === true) {
    const isAcknowledged = await isDgroupRequestAcknowledgedForOwner(ownerId, playerId);
    throw new Error(
      isAcknowledged
        ? "Your D-group request has already been acknowledged by the club."
        : "You have already submitted a D-group request.",
    );
  }

  if (!input.wantsToJoinDgroup) {
    player.wantsToJoinDgroup = false;
    player.dgroupAvailableDays = [];
    player.dgroupAvailableTimeFrom = "";
    player.dgroupAvailableTimeTo = "";
    await player.save();
    return {
      wantsToJoinDgroup: player.wantsToJoinDgroup ?? null,
      dgroupAvailableDays: normalizeWeekdays(player.dgroupAvailableDays ?? []),
      dgroupAvailableTimeFrom: player.dgroupAvailableTimeFrom?.trim() ?? "",
      dgroupAvailableTimeTo: player.dgroupAvailableTimeTo?.trim() ?? "",
    };
  }

  if (input.wantsToJoinDgroup) {
    player.wantsToJoinDgroup = true;
    player.dgroupAvailableDays = input.dgroupAvailableDays;
    player.dgroupAvailableTimeFrom = input.dgroupAvailableTimeFrom;
    player.dgroupAvailableTimeTo = input.dgroupAvailableTimeTo;
  }

  await player.save();

  return {
    wantsToJoinDgroup: player.wantsToJoinDgroup ?? null,
    dgroupAvailableDays: normalizeWeekdays(player.dgroupAvailableDays ?? []),
    dgroupAvailableTimeFrom: player.dgroupAvailableTimeFrom?.trim() ?? "",
    dgroupAvailableTimeTo: player.dgroupAvailableTimeTo?.trim() ?? "",
  };
}
