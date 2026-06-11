export type OrganizerNotificationItem = {
  id: string;
  kind: "checkin_attempt" | "player_registered" | "player_checkout";
  playerName: string;
  occurredAt: string;
};

export async function fetchOrganizerNotifications(gameId: string) {
  const response = await fetch(`/api/games/${gameId}/notifications`);
  const data = await response.json();
  if (!response.ok) throw new Error(data.message ?? "Failed to load notifications.");
  return data as { notifications?: OrganizerNotificationItem[] };
}
