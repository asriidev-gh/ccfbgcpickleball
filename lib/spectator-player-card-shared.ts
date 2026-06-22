import type { PlayerPhotoRef } from "@/components/game/player-avatar";
import { GENDER_OPTIONS, PICKLEBALL_LEVELS } from "@/lib/player-profile-shared";

export type SpectatorPlayerCardPlayer = PlayerPhotoRef & {
  pickleballLevel?: string | null;
};

export function formatSpectatorPlayerGender(player: SpectatorPlayerCardPlayer): string {
  const gender = player.gender?.trim();
  if (!gender) return "—";
  return GENDER_OPTIONS.find((option) => option.value === gender)?.label ?? gender;
}

export function formatSpectatorPlayerSkillLevel(player: SpectatorPlayerCardPlayer): string {
  const sessionLevel = player.openPlayLevel?.trim();
  if (sessionLevel) return sessionLevel;

  const profileLevel = player.pickleballLevel?.trim();
  if (!profileLevel) return "—";

  return (
    PICKLEBALL_LEVELS.find((option) => option.value === profileLevel)?.label ?? profileLevel
  );
}

export function formatSpectatorPlayerRank(rank: number | null | undefined): string {
  if (rank == null || rank < 1) return "—";
  return `#${rank}`;
}
