export type DgroupRequestItem = {
  id: string;
  name: string;
  firstName: string;
  lastName: string;
  email: string;
  mobileNumber: string;
  photoUrl?: string | null;
  photoPublicId?: string | null;
  personalQrCode?: string;
  sessionCount: number;
  lastRegisteredAt: string | null;
  requestedAt: string | null;
  dgroupAvailableDays: string[];
  dgroupAvailableTimeFrom: string;
  dgroupAvailableTimeTo: string;
  joinedSource?: "owner_marked" | "registration";
  isAcknowledged?: boolean;
  acknowledgedAt?: string | null;
  remarkCount?: number;
};

export type DgroupRequestView = "pending" | "joined";

export type DgroupRequestAction = "mark_joined" | "acknowledge" | "unmark_joined";
