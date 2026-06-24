import type { ClubSettings } from "@/lib/club-settings-shared";
import type { ClubAnnouncementItem } from "@/lib/club-announcements-shared";
import { ownerHubQueryOptions } from "@/lib/owner-hub-query-options";

export const MY_CLUB_STALE_TIME_MS = 10 * 60_000;

export const myClubQueryOptions = ownerHubQueryOptions;

export const clubSettingsQueryKey = ["club-settings"] as const;

export type ClubSettingsResponse = ClubSettings & {
  defaultClubName: string;
  logoUploadConfigured: boolean;
  userType?: string;
  message?: string;
};

export async function fetchClubSettings(): Promise<ClubSettingsResponse> {
  const response = await fetch("/api/settings/club");
  const payload = (await response.json()) as ClubSettingsResponse;
  if (!response.ok) {
    throw new Error(payload.message ?? "Failed to load club settings.");
  }
  return payload;
}

export const myClubAnnouncementsQueryKey = ["my-club-announcements"] as const;

export type MyClubAnnouncementsResponse = {
  announcements: ClubAnnouncementItem[];
  imageUploadConfigured?: boolean;
  message?: string;
};

export async function fetchMyClubAnnouncements(): Promise<MyClubAnnouncementsResponse> {
  const response = await fetch("/api/my-club/announcements");
  const payload = (await response.json()) as MyClubAnnouncementsResponse;
  if (!response.ok) {
    throw new Error(payload.message ?? "Failed to load community posts.");
  }
  return payload;
}

export const myClubDgroupCountQueryKey = ["my-club-dgroup-count"] as const;

export async function fetchMyClubDgroupCount(): Promise<{ total: number }> {
  const response = await fetch("/api/my-club/dgroup-requests");
  const payload = (await response.json()) as { total?: number };
  if (!response.ok) return { total: 0 };
  return { total: payload.total ?? 0 };
}

export const myClubPrayerCountQueryKey = ["my-club-prayer-count"] as const;

export async function fetchMyClubPrayerCount(): Promise<{ total: number }> {
  const response = await fetch("/api/my-club/prayer-requests");
  const payload = (await response.json()) as { total?: number };
  if (!response.ok) return { total: 0 };
  return { total: payload.total ?? 0 };
}

export const myClubDgroupRequestsQueryKey = "my-club-dgroup-requests" as const;

export const myClubPrayerRequestsQueryKey = "my-club-prayer-requests" as const;
