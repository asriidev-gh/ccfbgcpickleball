export async function trackSpectatorPlayerCardShare(gameId: string, queueEntryId: string) {
  const response = await fetch(`/api/games/${gameId}/spectate/player-card-share`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ queueEntryId }),
  });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.message ?? "Failed to record share.");
  }
  return data as { queueEntryId: string; cardSharedAt: string };
}
