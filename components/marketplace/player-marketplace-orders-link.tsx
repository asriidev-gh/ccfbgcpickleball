"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  spectateMarketplaceOrdersQueryKey,
  type MarketplaceOrderItem,
} from "@/lib/marketplace-orders-shared";
import { getLinkedPlayerIdForGame } from "@/lib/player-session";

export function PlayerMarketplaceOrdersLink({ gameId }: { gameId: string }) {
  const [playerId, setPlayerId] = useState<string | null>(null);

  useEffect(() => {
    const readSession = () => setPlayerId(getLinkedPlayerIdForGame(gameId));
    readSession();
    window.addEventListener("focus", readSession);
    return () => window.removeEventListener("focus", readSession);
  }, [gameId]);

  const { data: orders = [] } = useQuery({
    queryKey: playerId ? spectateMarketplaceOrdersQueryKey(gameId, playerId) : ["spectate-marketplace-orders"],
    enabled: Boolean(playerId),
    queryFn: async () => {
      const response = await fetch(
        `/api/games/${gameId}/spectate/player/marketplace/orders?playerId=${encodeURIComponent(playerId!)}`,
      );
      const payload = (await response.json()) as {
        orders: MarketplaceOrderItem[];
        message?: string;
      };
      if (!response.ok) throw new Error(payload.message ?? "Failed to load orders.");
      return payload.orders;
    },
  });

  if (!playerId || orders.length === 0) return null;

  return (
    <Link href={`/games/${gameId}/spectate/marketplace/orders`}>
      <Button variant="outline" size="sm">
        My orders ({orders.length})
      </Button>
    </Link>
  );
}
