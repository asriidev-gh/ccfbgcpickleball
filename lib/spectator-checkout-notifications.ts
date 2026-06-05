const readNotificationsKey = (gameId: string) =>
  `ccf-spectator-checkout-read:${gameId}`;

export type OrganizerNotificationKind = "checkout" | "checkin_attempt";

export type SpectatorCheckoutNotification = {
  id: string;
  kind: OrganizerNotificationKind;
  playerName: string;
  checkedOutAt: string;
};

export function loadReadCheckoutNotificationIds(gameId: string): Set<string> {
  if (typeof window === "undefined") return new Set();
  const raw = sessionStorage.getItem(readNotificationsKey(gameId));
  if (!raw) return new Set();
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return new Set();
    return new Set(parsed.filter((value): value is string => typeof value === "string"));
  } catch {
    return new Set();
  }
}

export function saveReadCheckoutNotificationIds(gameId: string, ids: Set<string>) {
  if (typeof window === "undefined") return;
  sessionStorage.setItem(readNotificationsKey(gameId), JSON.stringify([...ids]));
}

export function getSpectateGameIdFromPath(pathname: string): string | null {
  const match = pathname.match(/^\/games\/([^/]+)\/spectate\/?$/);
  return match?.[1] ?? null;
}

export const SPECTATOR_CHECKOUT_EVENT = "ccf-spectator-checkout";

export type SpectatorCheckoutEventDetail = {
  gameId: string;
  notification: SpectatorCheckoutNotification;
};

export function dispatchSpectatorCheckoutNotification(
  gameId: string,
  notification: SpectatorCheckoutNotification,
) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent<SpectatorCheckoutEventDetail>(SPECTATOR_CHECKOUT_EVENT, {
      detail: { gameId, notification },
    }),
  );
}
