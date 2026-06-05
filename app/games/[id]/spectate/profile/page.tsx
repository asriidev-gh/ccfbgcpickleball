"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";

import { PlayerProfileForm } from "@/components/player/player-profile-form";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { getLinkedPlayerIdForGame } from "@/lib/player-session";
import { cn } from "@/lib/utils";

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
      <main className="mx-auto w-full max-w-2xl px-6 py-8">
        <p className="text-muted-foreground">Loading…</p>
      </main>
    );
  }

  if (!playerId) {
    return (
      <main className="mx-auto w-full max-w-2xl px-6 py-8">
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
              <Link
                href={`/games/${gameId}/spectate`}
                className={cn(buttonVariants({ variant: "outline" }), "inline-flex")}
              >
                Back to open play
              </Link>
            </div>
          </CardContent>
        </Card>
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-2xl px-6 py-8">
      <PlayerProfileForm gameId={gameId} playerId={playerId} />
    </main>
  );
}
