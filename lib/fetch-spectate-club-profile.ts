import type { SpectateClubProfile } from "@/lib/spectate-club-profile-shared";

export function spectateClubProfileQueryKey(gameId: string) {
  return ["spectate-club-profile", gameId] as const;
}

export async function fetchSpectateClubProfile(gameId: string) {
  const response = await fetch(`/api/games/${gameId}/spectate?scope=club-profile`);
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) {
    throw new Error("Failed to load club profile.");
  }

  const payload = (await response.json()) as { profile?: SpectateClubProfile; message?: string };
  if (!response.ok) {
    throw new Error(payload.message ?? "Failed to load club profile.");
  }

  if (!payload.profile) {
    throw new Error("Club profile not found.");
  }

  return payload.profile;
}
