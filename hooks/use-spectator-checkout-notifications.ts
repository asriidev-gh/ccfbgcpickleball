"use client";

import { useQuery } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { fetchOrganizerNotifications, type OrganizerNotificationItem } from "@/lib/fetch-organizer-notifications";
import { formatRelativeTimeForCard } from "@/lib/format-relative-time";
import { ORGANIZER_NOTIFICATIONS_POLL_MS } from "@/lib/spectator-polling";
import {
  loadReadCheckoutNotificationIds,
  saveReadCheckoutNotificationIds,
  SPECTATOR_CHECKOUT_EVENT,
  type SpectatorCheckoutEventDetail,
  type SpectatorCheckoutNotification,
} from "@/lib/spectator-checkout-notifications";

function toCheckinAttemptNotification(item: OrganizerNotificationItem): SpectatorCheckoutNotification {
  return {
    id: item.id,
    kind: "checkin_attempt",
    playerName: item.playerName,
    checkedOutAt: item.occurredAt,
  };
}

function toCheckoutNotification(item: {
  id: string;
  playerName: string;
  occurredAt: string;
}): SpectatorCheckoutNotification {
  return {
    id: item.id,
    kind: "checkout",
    playerName: item.playerName,
    checkedOutAt: item.occurredAt,
  };
}

const CHECKOUT_NOTIFICATION_GRACE_MS = 5000;

export type NotificationDisplayParts = {
  playerName: string;
  detail: string;
  relativeTime: string;
  kind: SpectatorCheckoutNotification["kind"];
};

export function getNotificationDisplayParts(
  notification: SpectatorCheckoutNotification,
): NotificationDisplayParts {
  const relativeTime = formatRelativeTimeForCard(notification.checkedOutAt, { addSuffix: true });

  if (notification.kind === "checkin_attempt") {
    return {
      playerName: notification.playerName,
      detail: "Trying to check in — on checkout list",
      relativeTime,
      kind: "checkin_attempt",
    };
  }

  return {
    playerName: notification.playerName,
    detail: "Checked out",
    relativeTime,
    kind: "checkout",
  };
}

export function formatCheckoutNotificationLabel(notification: SpectatorCheckoutNotification) {
  const parts = getNotificationDisplayParts(notification);
  if (parts.kind === "checkin_attempt") {
    return `${parts.playerName} is trying to check in but is in the checkout list!`;
  }
  return `${parts.playerName} checkout ${parts.relativeTime}`;
}

export function useSpectatorCheckoutNotifications(gameId: string | null) {
  const enabled = Boolean(gameId);
  const [readIds, setReadIds] = useState<Set<string>>(() =>
    gameId ? loadReadCheckoutNotificationIds(gameId) : new Set(),
  );
  const [notifications, setNotifications] = useState<SpectatorCheckoutNotification[]>([]);
  const knownNotificationIdsRef = useRef<Set<string>>(new Set());
  const sessionStartedAtRef = useRef<number>(Date.now());

  const { data: organizerNotificationData } = useQuery({
    queryKey: ["game", gameId, "notifications"],
    queryFn: () => fetchOrganizerNotifications(gameId!),
    enabled,
    refetchInterval: ORGANIZER_NOTIFICATIONS_POLL_MS,
    refetchOnWindowFocus: false,
  });

  useEffect(() => {
    if (!gameId) return;
    setReadIds(loadReadCheckoutNotificationIds(gameId));
    knownNotificationIdsRef.current = new Set();
    sessionStartedAtRef.current = Date.now();
  }, [gameId]);

  useEffect(() => {
    if (!gameId) return;

    const handleCheckoutEvent = (event: Event) => {
      const customEvent = event as CustomEvent<SpectatorCheckoutEventDetail>;
      if (customEvent.detail?.gameId !== gameId) return;

      const { notification } = customEvent.detail;
      if (loadReadCheckoutNotificationIds(gameId).has(String(notification.id))) return;

      knownNotificationIdsRef.current.add(String(notification.id));

      setNotifications((previous) => {
        if (previous.some((item) => item.id === notification.id)) return previous;
        return [...previous, notification];
      });
    };

    window.addEventListener(SPECTATOR_CHECKOUT_EVENT, handleCheckoutEvent);
    return () => window.removeEventListener(SPECTATOR_CHECKOUT_EVENT, handleCheckoutEvent);
  }, [gameId]);

  useEffect(() => {
    if (!enabled || !organizerNotificationData?.notifications) return;

    const sessionStartedAt = sessionStartedAtRef.current - CHECKOUT_NOTIFICATION_GRACE_MS;
    const readSnapshot = loadReadCheckoutNotificationIds(gameId!);
    const nextNotifications: SpectatorCheckoutNotification[] = [];

    for (const item of organizerNotificationData.notifications) {
      if (new Date(item.occurredAt).getTime() < sessionStartedAt) continue;
      if (readSnapshot.has(item.id) || knownNotificationIdsRef.current.has(item.id)) continue;

      if (item.kind === "checkin_attempt") {
        knownNotificationIdsRef.current.add(item.id);
        nextNotifications.push(toCheckinAttemptNotification(item));
        continue;
      }

      if (item.kind === "player_card_shared" || item.kind === "player_registered") {
        continue;
      }

      if (item.kind === "player_checkout") {
        knownNotificationIdsRef.current.add(item.id);
        nextNotifications.push(toCheckoutNotification(item));
      }
    }

    if (nextNotifications.length === 0) return;

    setNotifications((previous) => {
      const byId = new Map(previous.map((entry) => [entry.id, entry]));
      for (const item of nextNotifications) {
        byId.set(item.id, item);
      }
      return [...byId.values()].filter((item) => !readSnapshot.has(item.id));
    });
  }, [enabled, gameId, organizerNotificationData?.notifications]);

  const unreadNotifications = useMemo(
    () => notifications.filter((item) => !readIds.has(item.id)),
    [notifications, readIds],
  );

  const markAsRead = useCallback(
    (notificationId: string) => {
      if (!gameId) return;
      const normalizedId = String(notificationId);
      setReadIds((previous) => {
        const next = new Set(previous);
        next.add(normalizedId);
        saveReadCheckoutNotificationIds(gameId, next);
        return next;
      });
      setNotifications((previous) => previous.filter((item) => item.id !== normalizedId));
    },
    [gameId],
  );

  const markAllAsRead = useCallback(() => {
    if (!gameId) return;
    setReadIds((previous) => {
      const next = new Set(previous);
      for (const item of notifications) {
        next.add(String(item.id));
      }
      saveReadCheckoutNotificationIds(gameId, next);
      return next;
    });
    setNotifications([]);
  }, [gameId, notifications]);

  return {
    unreadNotifications,
    hasUnread: unreadNotifications.length > 0,
    markAsRead,
    markAllAsRead,
  };
}
