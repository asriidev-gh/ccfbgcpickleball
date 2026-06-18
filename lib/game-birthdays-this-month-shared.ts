import type { PlayerPhotoRef } from "@/components/game/player-avatar";

export type GameBirthdayPlayer = PlayerPhotoRef & {
  playerId: string;
  birthdayLabel: string;
};

export type GameBirthdaysThisMonth = {
  count: number;
  players: GameBirthdayPlayer[];
};

export function formatBirthdayMonthDayLabel(birthdate: Date) {
  return birthdate.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  });
}
