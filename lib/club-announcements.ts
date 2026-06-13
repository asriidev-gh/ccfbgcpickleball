import { connectToDatabase } from "@/lib/db";
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
    createdAt: doc.createdAt.toISOString(),
    updatedAt: doc.updatedAt.toISOString(),
  };
}

export async function listClubAnnouncements(ownerId: string) {
  await connectToDatabase();
  const docs = (await ClubAnnouncement.find({ ownerId })
    .sort({ isArchived: 1, publishedAt: -1, createdAt: -1 })
    .lean()) as AnnouncementDoc[];
  return docs.map(serializeAnnouncement);
}

export async function createClubAnnouncement(
  ownerId: string,
  input: { title: string; body: string; isPublished: boolean },
) {
  await connectToDatabase();
  const publishedAt = new Date();
  const doc = await ClubAnnouncement.create({
    ownerId,
    title: input.title,
    body: input.body,
    isPublished: input.isPublished,
    publishedAt: input.isPublished ? publishedAt : publishedAt,
    isArchived: false,
    archivedAt: null,
  });
  return serializeAnnouncement(doc.toObject() as AnnouncementDoc);
}

export async function updateClubAnnouncement(
  ownerId: string,
  announcementId: string,
  input: Partial<{ title: string; body: string; isPublished: boolean; isArchived: boolean }>,
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
      input.isPublished === undefined;
    if (!isUnarchiveOnly) return null;
  }

  const update: Record<string, unknown> = {};
  if (input.title !== undefined) update.title = input.title;
  if (input.body !== undefined) update.body = input.body;
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
