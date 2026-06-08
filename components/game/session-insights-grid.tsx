"use client";

import { useEffect, useState } from "react";
import type { LucideIcon } from "lucide-react";
import {
  Award,
  ChevronDown,
  ChevronUp,
  Flame,
  HandMetal,
  Heart,
  Mountain,
  Repeat,
  Shield,
  Snowflake,
  Swords,
  Target,
  TrendingUp,
  Trophy,
  Users,
  Zap,
  BarChart3,
  Skull,
} from "lucide-react";

import type { InsightPlayer, SessionInsight } from "@/lib/session-insights";
import { PlayerAvatar, PlayerProfileTrigger } from "@/components/game/player-avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

const INSIGHT_ICONS: Record<string, LucideIcon> = {
  mvp: Trophy,
  "hot-hand": HandMetal,
  "hot-streak": Flame,
  "dream-team": Users,
  "most-improved": TrendingUp,
  "iron-player": Shield,
  "social-butterfly": Heart,
  "comeback-kid": Zap,
  undefeated: Award,
  "longest-battle": Mountain,
  rivalry: Swords,
  "court-hopper": Repeat,
  "nail-biter": Target,
  "ice-in-veins": Snowflake,
  blowout: TrendingUp,
  shutout: Skull,
  "high-water-mark": BarChart3,
};

const SESSION_AWARDS_OPEN_KEY = "ccf-session-awards-open";

function loadSessionAwardsOpen() {
  if (typeof window === "undefined") return true;
  return localStorage.getItem(SESSION_AWARDS_OPEN_KEY) !== "false";
}

function saveSessionAwardsOpen(open: boolean) {
  localStorage.setItem(SESSION_AWARDS_OPEN_KEY, open ? "true" : "false");
}

function AwardPlayers({ players }: { players: InsightPlayer[] }) {
  return (
    <ul className="mt-2 flex flex-col gap-2">
      {players.map((player) => {
        const photoRef = {
          _id: player.playerId,
          firstName: player.firstName,
          lastName: player.lastName,
          photoUrl: player.photoUrl,
          photoPublicId: player.photoPublicId,
          personalQrCode: player.personalQrCode,
        };

        return (
          <li key={player.playerId} className="flex w-full items-center gap-2 rounded-md">
            <PlayerAvatar player={photoRef} size="sm" className="!size-8 shrink-0 sm:!size-8" />
            <PlayerProfileTrigger player={photoRef} className="min-w-0 flex-1">
              <span className="min-w-0 truncate text-sm font-medium">{player.name}</span>
            </PlayerProfileTrigger>
          </li>
        );
      })}
    </ul>
  );
}

type SessionInsightsGridProps = {
  insights: SessionInsight[];
  compact?: boolean;
};

export function SessionInsightsGrid({ insights, compact = false }: SessionInsightsGridProps) {
  const [open, setOpen] = useState(true);

  useEffect(() => {
    setOpen(loadSessionAwardsOpen());
  }, []);

  const toggle = () => {
    const next = !open;
    setOpen(next);
    saveSessionAwardsOpen(next);
  };

  const summary =
    insights.length === 0
      ? "No awards yet"
      : `${insights.length} ${insights.length === 1 ? "award" : "awards"}`;

  return (
    <Card className={cn("glass-panel session-insights-panel min-w-0", compact && "h-full")}>
      <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3 space-y-0">
        <div className="min-w-0 flex-1">
          <CardTitle>Session Awards</CardTitle>
          <p className="caption">
            {open
              ? insights.length > 0
                ? "Highlights from this open play session"
                : "Play and end court matches to unlock awards"
              : summary}
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="session-awards-toggle shrink-0"
          onClick={toggle}
          aria-expanded={open}
          aria-controls="session-awards-content"
        >
          {open ? (
            <>
              <ChevronUp className="mr-1.5 h-4 w-4" aria-hidden />
              Collapse
            </>
          ) : (
            <>
              <ChevronDown className="mr-1.5 h-4 w-4" aria-hidden />
              Expand
            </>
          )}
        </Button>
      </CardHeader>
      <CardContent
        id="session-awards-content"
        className={cn(!open && "hidden")}
      >
        {insights.length === 0 ? (
          <p className="text-muted-foreground">
            Play and end court matches to unlock MVP, streaks, dream teams, and more.
            <span className="caption mt-2 block">
              Tip: Record scores when ending a court to unlock Nail Biter, Blowout, Shutout, and
              more.
            </span>
          </p>
        ) : (
          <ul
            className={cn(
              "session-insights-grid grid gap-3",
              compact ? "grid-cols-1 sm:grid-cols-2" : "sm:grid-cols-2 lg:grid-cols-3",
            )}
          >
            {insights.map((insight) => {
              const Icon = INSIGHT_ICONS[insight.id] ?? Award;
              return (
                <li
                  key={insight.id}
                  className="session-insight-card surface-muted rounded-xl border p-4"
                >
                  <div className="flex items-start gap-3">
                    <span
                      className="session-insight-icon flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/15 text-primary"
                      aria-hidden
                    >
                      <Icon className="h-5 w-5" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="body-lg font-semibold leading-tight">{insight.title}</p>
                      {insight.stat ? (
                        <p className="stat-num mt-0.5 text-sm font-semibold text-primary">
                          {insight.stat}
                        </p>
                      ) : null}
                      <p className="caption mt-1 leading-snug">{insight.description}</p>
                      <AwardPlayers players={insight.players} />
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
