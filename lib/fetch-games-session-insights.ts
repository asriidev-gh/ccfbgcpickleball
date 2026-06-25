import type { HomeSessionInsights } from "@/lib/home-session-insights-shared";

export const gamesSessionInsightsQueryKey = ["games-session-insights"] as const;

export async function fetchGamesSessionInsights(): Promise<HomeSessionInsights | null> {
  const response = await fetch("/api/games?view=session-insights");
  const payload = (await response.json()) as HomeSessionInsights & { message?: string };
  if (response.status === 401) return null;
  if (!response.ok) throw new Error(payload.message ?? "Failed to load session insights.");
  return payload;
}
