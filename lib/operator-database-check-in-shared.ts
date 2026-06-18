import type { OwnerRegisteredPlayerItem } from "@/lib/owner-registered-players-shared";

export type DatabaseCheckInQueueStatus =
  | "queued"
  | "on_court"
  | "done"
  | "checked_out"
  | null;

export type DatabaseCheckInPlayerItem = OwnerRegisteredPlayerItem & {
  queueStatus: DatabaseCheckInQueueStatus;
  queueEntryId: string | null;
  canCheckIn: boolean;
};

export type DatabaseCheckInPlayersPage = {
  players: DatabaseCheckInPlayerItem[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
};
