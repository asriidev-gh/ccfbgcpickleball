import { connectToDatabase } from "@/lib/db";
import {
  buildPlayerVisibleClubAnnouncementFilter,
  getClubAnnouncementTodayKey,
  normalizeClubAnnouncementDateInput,
} from "@/lib/club-announcement-schedule";
import type { ClubAnnouncementItem } from "@/lib/club-announcements-shared";
import { ClubAnnouncement } from "@/models/ClubAnnouncement";

type AnnouncementDoc = {
  _id: { toString(): string };
  title: string;
  body: string;
  isPublished: boolean;
  isArchived?: boolean;
  publishedAt: Date;
  archivedAt?: Date | null;
  postingDate?: string | null;
  expirationDate?: string | null;
  createdAt: Date;
  updatedAt: Date;
};

function serializeAnnouncement(doc: AnnouncementDoc): ClubAnnouncementItem {
  return {
    id: doc._id.toString(),
    title: doc.title,
    body: doc.body,
    isPublished: doc.isPublished,
    isArchived: doc.isArchived === true,
    publishedAt: doc.publishedAt.toISOString(),
    archivedAt: doc.archivedAt ? doc.archivedAt.toISOString() : null,
    postingDate: doc.postingDate?.trim() || null,
    expirationDate: doc.expirationDate?.trim() || null,
    createdAt: doc.createdAt.toISOString(),
    updatedAt: doc.updatedAt.toISOString(),
  };
}

export async function archiveExpiredClubAnnouncements(ownerId: string) {
  await connectToDatabase();
  const today = getClubAnnouncementTodayKey();
  const result = await ClubAnnouncement.updateMany(
    {
      ownerId,
      isArchived: { $ne: true },
      expirationDate: { $nin: [null, ""], $lte: today },
    },
    { $set: { isArchived: true, archivedAt: new Date() } },
  );
  return result.modifiedCount;
}

export async function listClubAnnouncements(ownerId: string) {
  await connectToDatabase();
  await archiveExpiredClubAnnouncements(ownerId);
  const docs = (await ClubAnnouncement.find({ ownerId })
    .sort({ isArchived: 1, publishedAt: -1, createdAt: -1 })
    .lean()) as AnnouncementDoc[];
  return docs.map(serializeAnnouncement);
}

export type ClubAnnouncementWriteInput = {
  title: string;
  body: string;
  isPublished: boolean;
  postingDate?: string | null;
  expirationDate?: string | null;
};

export async function createClubAnnouncement(ownerId: string, input: ClubAnnouncementWriteInput) {
  await connectToDatabase();
  const publishedAt = new Date();
  const doc = await ClubAnnouncement.create({
    ownerId,
    title: input.title,
    body: input.body,
    isPublished: input.isPublished,
    publishedAt,
    isArchived: false,
    archivedAt: null,
    postingDate: normalizeClubAnnouncementDateInput(input.postingDate),
    expirationDate: normalizeClubAnnouncementDateInput(input.expirationDate),
  });
  return serializeAnnouncement(doc.toObject() as AnnouncementDoc);
}

export async function updateClubAnnouncement(
  ownerId: string,
  announcementId: string,
  input: Partial<
    ClubAnnouncementWriteInput & {
      isArchived: boolean;
    }
  >,
) {
  await connectToDatabase();
  const existing = (await ClubAnnouncement.findOne({ _id: announcementId, ownerId }).lean()) as
    | AnnouncementDoc
    | null;
  if (!existing) return null;

  if (existing.isArchived === true) {
    const isUnarchiveOnly =
      input.isArchived === false &&
      input.title === undefined &&
      input.body === undefined &&
      input.isPublished === undefined &&
      input.postingDate === undefined &&
      input.expirationDate === undefined;
    if (!isUnarchiveOnly) return null;
  }

  const update: Record<string, unknown> = {};
  if (input.title !== undefined) update.title = input.title;
  if (input.body !== undefined) update.body = input.body;
  if (input.postingDate !== undefined) {
    update.postingDate = normalizeClubAnnouncementDateInput(input.postingDate);
  }
  if (input.expirationDate !== undefined) {
    update.expirationDate = normalizeClubAnnouncementDateInput(input.expirationDate);
  }
  if (input.isPublished !== undefined) {
    update.isPublished = input.isPublished;
    if (input.isPublished && !existing.isPublished) {
      update.publishedAt = new Date();
    }
  }
  if (input.isArchived !== undefined) {
    update.isArchived = input.isArchived;
    update.archivedAt = input.isArchived ? new Date() : null;
  }

  const doc = await ClubAnnouncement.findOneAndUpdate(
    { _id: announcementId, ownerId },
    { $set: update },
    { returnDocument: "after" },
  ).lean();

  if (!doc) return null;
  return serializeAnnouncement(doc as AnnouncementDoc);
}

export async function deleteClubAnnouncement(ownerId: string, announcementId: string) {
  await connectToDatabase();
  const result = await ClubAnnouncement.deleteOne({ _id: announcementId, ownerId });
  return result.deletedCount > 0;
}

export async function listPlayerVisibleClubAnnouncements(ownerId: string) {
  await connectToDatabase();
  await archiveExpiredClubAnnouncements(ownerId);
  const today = getClubAnnouncementTodayKey();
  return ClubAnnouncement.find({ ownerId, ...buildPlayerVisibleClubAnnouncementFilter(today) })
    .sort({ publishedAt: -1, createdAt: -1 })
    .lean();
}
