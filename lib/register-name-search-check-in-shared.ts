export type NameSearchQueueStatus =
  | "queued"
  | "on_court"
  | "done"
  | "checked_out"
  | null;

export type NameSearchPlayerItem = {
  id: string;
  name: string;
  firstName: string;
  lastName: string;
  photoUrl?: string | null;
  photoPublicId?: string | null;
  queueStatus: NameSearchQueueStatus;
  canCheckIn: boolean;
};

export type NameSearchPlayersPage = {
  players: NameSearchPlayerItem[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
};

export const NAME_SEARCH_MIN_QUERY_LENGTH = 2;
