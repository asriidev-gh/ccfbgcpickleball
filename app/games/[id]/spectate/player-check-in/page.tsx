"use client";

import { Loader2 } from "lucide-react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import {
  persistActiveQueueHighlight,
  setQueueHighlightPlayerId,
} from "@/lib/queue-highlight";

export default function PlayerCheckInPage() {
  const params = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const router = useRouter();
  const gameId = params.id;
  const token = searchParams.get("token")?.trim() ?? "";
  const startedRef = useRef(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!gameId || !token || startedRef.current) return;
    startedRef.current = true;

    const completeCheckIn = async () => {
      try {
        const response = await fetch(`/api/games/${gameId}/spectate/player-check-in`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token }),
        });
        const payload = (await response.json()) as {
          playerId?: string;
          message?: string;
        };
        if (!response.ok || !payload.playerId) {
          throw new Error(payload.message ?? "Failed to check in as player.");
        }

        setQueueHighlightPlayerId(gameId, payload.playerId);
        persistActiveQueueHighlight(gameId, payload.playerId);
        toast.success(payload.message ?? "Checked in as player.");
        router.replace(`/games/${gameId}/spectate`);
      } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to check in as player.";
        setErrorMessage(message);
        toast.error(message);
      }
    };

    void completeCheckIn();
  }, [gameId, router, token]);

  if (errorMessage) {
    return (
      <main className="flex min-h-[50vh] items-center justify-center px-6 py-12 text-center">
        <div className="space-y-2">
          <p className="font-medium text-foreground">Could not open player view</p>
          <p className="text-sm text-muted-foreground">{errorMessage}</p>
        </div>
      </main>
    );
  }

  return (
    <main className="flex min-h-[50vh] flex-col items-center justify-center gap-3 px-6 py-12 text-center">
      <Loader2 className="h-8 w-8 animate-spin text-primary" aria-hidden />
      <p className="text-sm text-muted-foreground">Opening player view…</p>
    </main>
  );
}
