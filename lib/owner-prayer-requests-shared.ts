export const MIN_PRAYER_REQUEST_LENGTH = 10;
export const MAX_PRAYER_REQUEST_LENGTH = 300;

export type PrayerRequestView = "pending" | "acknowledged";

export type PrayerRequestItem = {
  id: string;
  playerId: string;
  name: string;
  firstName: string;
  lastName: string;
  email: string;
  mobileNumber: string;
  photoUrl?: string | null;
  photoPublicId?: string | null;
  requestText: string;
  gameId: string;
  sessionCount: number;
  submittedAt: string;
  acknowledgedAt: string | null;
  lastRegisteredAt: string | null;
  replyCount: number;
  status: "pending" | "acknowledged" | "dismissed";
};

export type PrayerRequestAction = "acknowledge" | "delete";
