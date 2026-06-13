export const MAX_PRAYER_REPLY_LENGTH = 1000;

export const PRAYER_ACKNOWLEDGE_REPLY_TEXT = "Prayed for you..";

export type PrayerReplyItem = {
  id: string;
  text: string;
  createdAt: string;
  updatedAt: string;
};
