// Client-safe types for organizer registered-player list.

import type { GenderOption, PickleballLevel } from "@/lib/player-profile-shared";

export const OWNER_REGISTERED_PLAYERS_PAGE_SIZE = 10;

export type OwnerRegisteredPlayersPage = {
  players: OwnerRegisteredPlayerItem[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
};

export type OwnerRegisteredPlayerItem = {
  id: string;
  name: string;
  firstName: string;
  lastName: string;
  email: string;
  mobileNumber: string;
  photoUrl?: string | null;
  photoPublicId?: string | null;
  personalQrCode?: string;
  /** Distinct open play sessions you created that this player joined. */
  sessionsCount: number;
  lastRegisteredAt: string | null;
  isBlocked: boolean;
};

export type OwnerPlayerSessionEntry = {
  gameId: string;
  title: string;
  status: string;
  openPlayType: string;
  courtCount: number;
  queueStatus: string | null;
  registeredAt: string | null;
  gamesPlayed: number;
  wins: number;
  losses: number;
  winRate: number;
};

export type OwnerPlayerSessions = {
  player: { id: string; name: string; email: string };
  sessions: OwnerPlayerSessionEntry[];
};

export type OwnerPlayerProfile = {
  playerId: string;
  email: string;
  showCcfQuestionnaire: boolean;
  isBlocked: boolean;
  firstName: string;
  lastName: string;
  mobileNumber: string;
  photoUrl: string;
  gender: GenderOption | "";
  birthdate: string;
  biography: string;
  pickleballLevel: PickleballLevel | "";
  isPartOfDgroup: boolean | null;
  wantsToJoinDgroup: boolean | null;
  attendedEvents: string[];
  attendedEventsOther: string;
  ccfEventsBefore: "yes" | "not_yet" | null;
};
