"use client";

import { ArrowLeft, ClipboardList } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";

import { PlayerMarketplaceOrdersView } from "@/components/marketplace/player-marketplace-orders-view";
import { Button } from "@/components/ui/button";

export default function PlayerMarketplaceOrdersPage() {
  const params = useParams<{ id: string }>();
  const gameId = params.id;

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-4 sm:px-6 sm:py-6">
      <div className="mb-5">
        <div className="mb-6">
          <Link href={`/games/${gameId}/spectate/marketplace`}>
            <Button variant="outline" size="sm" className="inline-flex">
              <ArrowLeft className="mr-2 h-4 w-4" aria-hidden />
              Back to marketplace
            </Button>
          </Link>
        </div>
        <div className="flex items-center gap-3">
          <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-amber-500/10 text-amber-700 dark:text-amber-300">
            <ClipboardList className="h-5 w-5" aria-hidden />
          </span>
          <div>
            <h1 className="page-title">My orders</h1>
            <p className="caption mt-0.5 max-w-xl">
              Track marketplace orders for this open play. Cancel pending orders before the seller acknowledges them.
            </p>
          </div>
        </div>
      </div>

      <PlayerMarketplaceOrdersView gameId={gameId} />
    </main>
  );
}
