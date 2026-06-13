import type { DgroupWeekday } from "@/lib/dgroup-availability-shared";

export type SpectatePlayerAnnouncement = {
  id: string;
  title: string;
  body: string;
  publishedAt: string;
  isRead: boolean;
};

export type SpectatePlayerFeatures = {
  unreadAnnouncementCount: number;
  showCcfFeatures: boolean;
  isPartOfDgroup: boolean;
  wantsToJoinDgroup: boolean | null;
  dgroupAvailableDays: DgroupWeekday[];
  dgroupAvailableTimeFrom: string;
  dgroupAvailableTimeTo: string;
  isDgroupRequestAcknowledged: boolean;
  hasSubmittedDgroupRequest: boolean;
  isOwnerMarkedDgroupJoined: boolean;
  showDgroupJoinMenu: boolean;
  hasSubmittedPrayerRequest: boolean;
  isPrayerRequestAcknowledged: boolean;
  prayerReplyCount: number;
};
