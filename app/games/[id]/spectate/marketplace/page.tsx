"use client";

import { ArrowLeft, Store } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";

import { PlayerMarketplaceListingsView } from "@/components/marketplace/player-marketplace-listings-view";
import { PlayerMarketplaceOrdersLink } from "@/components/marketplace/player-marketplace-orders-link";
import { SpectateMarketplaceGate } from "@/components/player/spectate-marketplace-gate";
import { Button } from "@/components/ui/button";

export default function PlayerMarketplacePage() {
  const params = useParams<{ id: string }>();
  const gameId = params.id;

  return (
    <SpectateMarketplaceGate gameId={gameId}>
      <main className="mx-auto w-full max-w-3xl px-4 py-4 sm:px-6 sm:py-6">
      <div className="mb-5">
        <div className="mb-6">
          <Link href={`/games/${gameId}/spectate`}>
            <Button variant="outline" size="sm" className="inline-flex">
              <ArrowLeft className="mr-2 h-4 w-4" aria-hidden />
              Back to game dashboard
            </Button>
          </Link>
        </div>
        <div className="flex items-center gap-3">
          <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-amber-500/10 text-amber-700 dark:text-amber-300">
            <Store className="h-5 w-5" aria-hidden />
          </span>
          <div className="min-w-0 flex-1">
            <h1 className="page-title">Marketplace</h1>
            <p className="caption mt-0.5 max-w-xl">
              Browse pickleball gear and equipment listed by your club.
            </p>
          </div>
          <PlayerMarketplaceOrdersLink gameId={gameId} />
        </div>
      </div>

      <PlayerMarketplaceListingsView gameId={gameId} />
      </main>
    </SpectateMarketplaceGate>
  );
}
