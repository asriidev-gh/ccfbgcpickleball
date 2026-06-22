"use client";

import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import { useEffect, useRef } from "react";

import { fetchOrganizerNotifications } from "@/lib/fetch-organizer-notifications";
import { ORGANIZER_NOTIFICATIONS_POLL_MS } from "@/lib/spectator-polling";

type QueueQuery = Pick<UseQueryResult<unknown>, "refetch">;
type DetailsQuery = Pick<UseQueryResult<unknown>, "refetch">;

/** Poll lightweight registration notifications and refresh queue when someone joins via QR. */
export function useOperatorQueueRegistrationSync(input: {
  gameId: string;
  enabled: boolean;
  queueQuery: QueueQuery;
  detailsQuery?: DetailsQuery;
  refreshDetails?: boolean;
}) {
  const knownRegistrationIdsRef = useRef<Set<string>>(new Set());
  const initializedRef = useRef(false);

  const notificationsQuery = useQuery({
    queryKey: ["game", input.gameId, "notifications"],
    queryFn: () => fetchOrganizerNotifications(input.gameId),
    enabled: input.enabled && Boolean(input.gameId),
    refetchInterval: ORGANIZER_NOTIFICATIONS_POLL_MS,
    refetchOnWindowFocus: false,
  });

  useEffect(() => {
    if (!input.enabled || !notificationsQuery.data?.notifications) return;

    const queueRefreshEvents = notificationsQuery.data.notifications.filter(
      (item) =>
        item.kind === "player_registered" ||
        item.kind === "player_checkout" ||
        item.kind === "player_card_shared",
    );

    if (!initializedRef.current) {
      for (const item of queueRefreshEvents) {
        knownRegistrationIdsRef.current.add(item.id);
      }
      initializedRef.current = true;
      return;
    }

    let hasQueueChange = false;
    for (const item of queueRefreshEvents) {
      if (knownRegistrationIdsRef.current.has(item.id)) continue;
      knownRegistrationIdsRef.current.add(item.id);
      hasQueueChange = true;
    }

    if (!hasQueueChange) return;

    void input.queueQuery.refetch();
    if (input.refreshDetails) {
      void input.detailsQuery?.refetch();
    }
  }, [
    input.enabled,
    input.refreshDetails,
    input.queueQuery,
    input.detailsQuery,
    notificationsQuery.data?.notifications,
  ]);

  return notificationsQuery;
}
