// Client-safe insights types and constants (no DB/mongoose imports).

export type UserInsights = {
  generatedAt: string;
  users: {
    total: number;
    ccf: number;
    default: number;
    googleLinked: number;
    passwordOnly: number;
    newLast7Days: number;
    newLast30Days: number;
  };
  signupsByMonth: { key: string; label: string; count: number }[];
  games: {
    total: number;
    active: number;
    ended: number;
  };
  activity: {
    playersRegistered: number;
  };
  topOwners: { name: string; email: string; games: number }[];
};

export type UserListFilter =
  | "all"
  | "ccf"
  | "default"
  | "google"
  | "password"
  | "new7"
  | "new30";

export type RegistrationFeatureSetting = "default" | "qr_id";

export type UserListItem = {
  id: string;
  name: string;
  email: string;
  userType: string;
  registrationFeature: RegistrationFeatureSetting;
  hasGoogle: boolean;
  openPlayCount: number;
  demoOpenPlayCount: number;
  quickGameCount: number;
  createdAt: string | null;
  registeredDevice: string | null;
  lastLoginAt: string | null;
  lastLoginDevice: string | null;
  isBlocked: boolean;
  emailVerified: boolean;
};

export type UserOpenPlay = {
  gameId: string;
  title: string;
  status: string;
  openPlayType: string;
  courtCount: number;
  playerCount: number;
  expectedPlayers: number;
  strictPlayerCount: boolean;
  organizerRegisteredAllPlayers: boolean;
  createdAt: string | null;
};

export type UserOpenPlays = {
  user: { id: string; name: string };
  count: number;
  games: UserOpenPlay[];
};

export type PlayerListItem = {
  id: string;
  name: string;
  firstName: string;
  lastName: string;
  email: string;
  mobileNumber: string;
  photoUrl?: string | null;
  photoPublicId?: string | null;
  personalQrCode?: string;
  gamesPlayed: number;
  createdAt: string | null;
};

export type PlayerGameAward = { id: string; title: string; stat?: string };

export type PlayerGameHistoryEntry = {
  gameId: string;
  title: string;
  status: string;
  ownerName: string;
  joinedAt: string | null;
  gamesPlayed: number;
  wins: number;
  losses: number;
  winRate: number;
  awards: PlayerGameAward[];
};

export type PlayerGameHistory = {
  player: { id: string; name: string };
  totalGamesPlayed: number;
  games: PlayerGameHistoryEntry[];
};

export const USER_FILTERS: { id: UserListFilter; label: string }[] = [
  { id: "all", label: "All users" },
  { id: "ccf", label: "CCF accounts" },
  { id: "default", label: "Default accounts" },
  { id: "google", label: "Google-linked" },
  { id: "password", label: "Password only" },
  { id: "new7", label: "New (7 days)" },
  { id: "new30", label: "New (30 days)" },
];
