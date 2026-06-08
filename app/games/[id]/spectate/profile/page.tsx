"use client";

import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";

import { PlayerProfileForm } from "@/components/player/player-profile-form";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { getLinkedPlayerIdForGame } from "@/lib/player-session";
import { cn } from "@/lib/utils";

function BackToGameDashboardLink({ gameId }: { gameId: string }) {
  return (
    <Link href={`/games/${gameId}/spectate`}>
      <Button variant="outline" size="sm" className="inline-flex">
        <ArrowLeft className="mr-2 h-4 w-4" aria-hidden />
        Back to game dashboard
      </Button>
    </Link>
  );
}

export default function PlayerProfilePage() {
  const params = useParams<{ id: string }>();
  const gameId = params.id;
  const [playerId, setPlayerId] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setPlayerId(getLinkedPlayerIdForGame(gameId));
    setHydrated(true);
  }, [gameId]);

  if (!hydrated) {
    return (
      <main className="mx-auto w-full max-w-2xl px-4 py-4 sm:px-6 sm:py-6">
        <p className="text-muted-foreground">Loading…</p>
      </main>
    );
  }

  if (!playerId) {
    return (
      <main className="mx-auto w-full max-w-2xl px-4 py-4 sm:px-6 sm:py-6">
        <div className="mb-4">
          <BackToGameDashboardLink gameId={gameId} />
        </div>
        <Card className="glass-panel">
          <CardContent className="space-y-4 py-8">
            <p className="text-foreground">
              Register for this open play first to update your player profile.
            </p>
            <div className="flex flex-wrap gap-3">
              <Link
                href={`/register/${gameId}`}
                className={cn(buttonVariants({ variant: "default" }), "inline-flex")}
              >
                Register
              </Link>
            </div>
          </CardContent>
        </Card>
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-4 sm:px-6 sm:py-6">
      <div className="mb-4">
        <BackToGameDashboardLink gameId={gameId} />
      </div>
      <PlayerProfileForm gameId={gameId} playerId={playerId} compact />
    </main>
  );
}
