"use client";

import { useQuery } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import type { QueueEntryView } from "@/components/game/queue-entry-row";
import { formatRelativeTimeForCard } from "@/lib/format-relative-time";
import {
  loadReadCheckoutNotificationIds,
  saveReadCheckoutNotificationIds,
  SPECTATOR_CHECKOUT_EVENT,
  type SpectatorCheckoutEventDetail,
  type SpectatorCheckoutNotification,
} from "@/lib/spectator-checkout-notifications";
import { formatPlayerDisplayName } from "@/lib/utils";

type SpectateCheckoutPayload = {
  checkedOut?: QueueEntryView[];
};

async function fetchOperatorCheckouts(gameId: string): Promise<SpectateCheckoutPayload> {
  const response = await fetch(`/api/games/${gameId}`);
  const data = await response.json();
  if (!response.ok) throw new Error(data.message ?? "Failed to load game.");
  return data as SpectateCheckoutPayload;
}

function toCheckoutNotification(entry: QueueEntryView): SpectatorCheckoutNotification {
  const checkedOutAt = entry.checkedOutAt ?? entry.updatedAt ?? new Date().toISOString();
  return {
    id: String(entry._id),
    kind: "checkout",
    playerName: formatPlayerDisplayName(entry.playerId.firstName, entry.playerId.lastName),
    checkedOutAt,
  };
}

type OrganizerNotificationsPayload = {
  notifications?: Array<{
    id: string;
    kind: "checkin_attempt";
    playerName: string;
    occurredAt: string;
  }>;
};

async function fetchOrganizerNotifications(gameId: string): Promise<OrganizerNotificationsPayload> {
  const response = await fetch(`/api/games/${gameId}/notifications`);
  const data = await response.json();
  if (!response.ok) throw new Error(data.message ?? "Failed to load notifications.");
  return data as OrganizerNotificationsPayload;
}

function toCheckinAttemptNotification(
  item: NonNullable<OrganizerNotificationsPayload["notifications"]>[number],
): SpectatorCheckoutNotification {
  return {
    id: item.id,
    kind: "checkin_attempt",
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
  const knownCheckoutIdsRef = useRef<Set<string>>(new Set());
  const sessionStartedAtRef = useRef<number>(Date.now());

  const { data } = useQuery({
    queryKey: ["game", gameId, "operator"],
    queryFn: () => fetchOperatorCheckouts(gameId!),
    enabled,
    refetchInterval: 4000,
  });

  const { data: organizerNotificationData } = useQuery({
    queryKey: ["game", gameId, "notifications"],
    queryFn: () => fetchOrganizerNotifications(gameId!),
    enabled,
    refetchInterval: 4000,
  });

  useEffect(() => {
    if (!gameId) return;
    setReadIds(loadReadCheckoutNotificationIds(gameId));
    knownCheckoutIdsRef.current = new Set();
    sessionStartedAtRef.current = Date.now();
  }, [gameId]);

  useEffect(() => {
    if (!gameId) return;

    const handleCheckoutEvent = (event: Event) => {
      const customEvent = event as CustomEvent<SpectatorCheckoutEventDetail>;
      if (customEvent.detail?.gameId !== gameId) return;

      const { notification } = customEvent.detail;
      if (loadReadCheckoutNotificationIds(gameId).has(String(notification.id))) return;

      knownCheckoutIdsRef.current.add(String(notification.id));

      setNotifications((previous) => {
        if (previous.some((item) => item.id === notification.id)) return previous;
        return [...previous, notification];
      });
    };

    window.addEventListener(SPECTATOR_CHECKOUT_EVENT, handleCheckoutEvent);
    return () => window.removeEventListener(SPECTATOR_CHECKOUT_EVENT, handleCheckoutEvent);
  }, [gameId]);

  useEffect(() => {
    if (!enabled || !data?.checkedOut) return;

    const checkoutEntries = data.checkedOut;
    const currentIds = new Set(checkoutEntries.map((entry) => String(entry._id)));
    const sessionStartedAt = sessionStartedAtRef.current - CHECKOUT_NOTIFICATION_GRACE_MS;

    for (const knownId of [...knownCheckoutIdsRef.current]) {
      if (!currentIds.has(knownId)) {
        knownCheckoutIdsRef.current.delete(knownId);
      }
    }

    const readSnapshot = loadReadCheckoutNotificationIds(gameId!);
    const nextNotifications: SpectatorCheckoutNotification[] = [];

    for (const entry of checkoutEntries) {
      const entryId = String(entry._id);
      if (knownCheckoutIdsRef.current.has(entryId)) continue;

      const checkedOutAt = entry.checkedOutAt ?? entry.updatedAt;
      if (!checkedOutAt || new Date(checkedOutAt).getTime() < sessionStartedAt) {
        knownCheckoutIdsRef.current.add(entryId);
        continue;
      }

      knownCheckoutIdsRef.current.add(entryId);
      if (!readSnapshot.has(entryId)) {
        nextNotifications.push(toCheckoutNotification(entry));
      }
    }

    if (nextNotifications.length === 0) return;

    setNotifications((previous) => {
      const byId = new Map(previous.map((item) => [item.id, item]));
      for (const item of nextNotifications) {
        byId.set(item.id, item);
      }
      return [...byId.values()].filter((item) => !readSnapshot.has(item.id));
    });
  }, [data?.checkedOut, enabled, gameId]);

  useEffect(() => {
    if (!enabled || !organizerNotificationData?.notifications) return;

    const sessionStartedAt = sessionStartedAtRef.current - CHECKOUT_NOTIFICATION_GRACE_MS;
    const readSnapshot = loadReadCheckoutNotificationIds(gameId!);
    const nextNotifications: SpectatorCheckoutNotification[] = [];

    for (const item of organizerNotificationData.notifications) {
      if (new Date(item.occurredAt).getTime() < sessionStartedAt) continue;
      if (readSnapshot.has(item.id)) continue;
      nextNotifications.push(toCheckinAttemptNotification(item));
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
