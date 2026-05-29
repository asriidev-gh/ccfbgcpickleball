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
  Swords,
  TrendingUp,
  Trophy,
  Users,
  Zap,
} from "lucide-react";

import type { SessionInsight } from "@/lib/session-insights";
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
};

const SESSION_AWARDS_OPEN_KEY = "ccf-session-awards-open";

function loadSessionAwardsOpen() {
  if (typeof window === "undefined") return true;
  return localStorage.getItem(SESSION_AWARDS_OPEN_KEY) !== "false";
}

function saveSessionAwardsOpen(open: boolean) {
  localStorage.setItem(SESSION_AWARDS_OPEN_KEY, open ? "true" : "false");
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
              Tip: Record match scores in a future update for awards like Ice in Veins (one-point
              wins).
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
                      <p className="mt-2 text-sm font-medium text-foreground">
                        {insight.players.map((p) => p.name).join(" · ")}
                      </p>
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
