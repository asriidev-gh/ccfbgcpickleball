"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, LayoutGrid, Loader2, Users } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import Swal from "sweetalert2";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { useActiveEphemeralSessions } from "@/hooks/use-active-ephemeral-sessions";
import {
  beginEphemeralQuickGameSaveToAccount,
  promptSaveEphemeralQuickGame,
} from "@/lib/ephemeral-quick-game-transfer";
import { applyEndOpenPlayOptimistic } from "@/lib/game-payload-mutations";
import { getQuickGameDashboardPath } from "@/lib/local-game-id";
import { writeOperatorGamePayload } from "@/lib/operator-game-cache";
import { readQuickGamePayload, writeQuickGamePayload } from "@/lib/quick-game-store";
import { swalAlertBaseOptions } from "@/lib/swal-theme";
import { cn } from "@/lib/utils";

export function EphemeralSessionsPanel({ className }: { className?: string }) {
  const queryClient = useQueryClient();
  const router = useRouter();
  const { activeSessions } = useActiveEphemeralSessions();
  const [endingGameId, setEndingGameId] = useState<string | null>(null);

  const endSessionMutation = useMutation({
    mutationFn: async (gameId: string) => {
      const previous = readQuickGamePayload(gameId);
      if (!previous) throw new Error("Session not found.");
      const ended = applyEndOpenPlayOptimistic(previous);
      writeQuickGamePayload(gameId, ended);
      writeOperatorGamePayload(queryClient, gameId, ended);
      return gameId;
    },
    onSuccess: (gameId) => {
      toast.success("Open play ended.");
      router.push(`/leaderboard/${gameId}`);
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Failed to end session.");
    },
    onSettled: () => {
      setEndingGameId(null);
    },
  });

  const handleEndSession = async (gameId: string) => {
    const saveChoice = await promptSaveEphemeralQuickGame();
    if (saveChoice === "dismiss") return;
    if (saveChoice === "save") {
      await beginEphemeralQuickGameSaveToAccount({
        gameId,
        queryClient,
        router,
        endAfterSave: true,
      });
      return;
    }

    const result = await Swal.fire({
      ...swalAlertBaseOptions,
      title: "End Open Play?",
      text: "This will mark this game as ended.",
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Yes, end it",
      cancelButtonText: "Cancel",
    });
    if (!result.isConfirmed) return;
    setEndingGameId(gameId);
    endSessionMutation.mutate(gameId);
  };

  if (activeSessions.length === 0) return null;

  return (
    <div
      className={cn(
        "space-y-3 rounded-xl border border-amber-500/40 bg-amber-500/10 p-4",
        className,
      )}
      role="alert"
    >
      <div className="flex gap-3">
        <AlertTriangle
          className="mt-0.5 h-5 w-5 shrink-0 text-amber-600 dark:text-amber-400"
          aria-hidden
        />
        <div className="min-w-0 space-y-1">
          <h2 className="text-sm font-semibold text-foreground">Active session in this browser</h2>
          <p className="text-xs text-foreground/80">
            End this session before starting a new one. Resume to continue or end it here.
          </p>
        </div>
      </div>
      <ul className="space-y-3">
        {activeSessions.map((game) => {
          const isEnding = endingGameId === game.gameId && endSessionMutation.isPending;

          return (
          <li
            key={game.gameId}
            className="flex flex-col gap-3 rounded-lg border border-amber-500/30 bg-background p-3 sm:flex-row sm:items-center sm:justify-between"
          >
            <div className="min-w-0 space-y-1">
              <p className="truncate font-medium text-foreground">{game.title}</p>
              <p className="text-xs text-foreground/75">{game.openPlayType}</p>
              <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-foreground/75">
                <span className="inline-flex items-center gap-1">
                  <LayoutGrid className="h-3.5 w-3.5 shrink-0" aria-hidden />
                  {game.courtCount} {game.courtCount === 1 ? "court" : "courts"}
                </span>
                <span className="inline-flex items-center gap-1">
                  <Users className="h-3.5 w-3.5 shrink-0" aria-hidden />
                  {game.expectedPlayers} {game.expectedPlayers === 1 ? "player" : "players"}
                </span>
              </div>
              {game.openPlayDate || game.openPlayTimeRange ? (
                <p className="text-xs text-foreground/75">
                  {[game.openPlayDate, game.openPlayTimeRange].filter(Boolean).join(" · ")}
                </p>
              ) : null}
            </div>
            <div className="flex shrink-0 flex-wrap gap-2">
              <Button
                size="sm"
                variant="outline"
                className="border-amber-600/50 bg-background text-foreground hover:bg-amber-500/10 dark:border-amber-400/40"
                nativeButton={false}
                render={<Link href={getQuickGameDashboardPath(game.gameId)} />}
              >
                Resume
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="border-destructive/40 text-destructive hover:bg-destructive/10"
                disabled={isEnding}
                onClick={() => void handleEndSession(game.gameId)}
              >
                {isEnding ? (
                  <>
                    <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" aria-hidden />
                    Ending…
                  </>
                ) : (
                  "End session"
                )}
              </Button>
            </div>
          </li>
          );
        })}
      </ul>
    </div>
  );
}
