export const MAX_CLUB_ANNOUNCEMENT_TITLE_LENGTH = 120;
export const MAX_CLUB_ANNOUNCEMENT_BODY_LENGTH = 5000;

export type ClubAnnouncementItem = {
  id: string;
  title: string;
  body: string;
  isPublished: boolean;
  isArchived: boolean;
  publishedAt: string;
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
};
