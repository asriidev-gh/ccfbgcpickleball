"use client";

import { AlertTriangle, LayoutGrid, Users } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { useActiveEphemeralSessions } from "@/hooks/use-active-ephemeral-sessions";
import { getQuickGameDashboardPath } from "@/lib/local-game-id";
import { cn } from "@/lib/utils";

export function EphemeralSessionsPanel({ className }: { className?: string }) {
  const { activeSessions } = useActiveEphemeralSessions();

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
            End this session before starting a new one. Resume it to continue or end it from the
            dashboard.
          </p>
        </div>
      </div>
      <ul className="space-y-3">
        {activeSessions.map((game) => (
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
            <Button
              size="sm"
              variant="outline"
              className="shrink-0 border-amber-600/50 bg-background text-foreground hover:bg-amber-500/10 dark:border-amber-400/40"
              nativeButton={false}
              render={<Link href={getQuickGameDashboardPath(game.gameId)} />}
            >
              Resume
            </Button>
          </li>
        ))}
      </ul>
    </div>
  );
}
