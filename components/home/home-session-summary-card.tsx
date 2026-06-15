"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Gauge, LayoutGrid, MapPin, Sparkles, Users } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";

import { Badge } from "@/components/ui/badge";
import { isDemoOpenPlayTitle } from "@/lib/demo-open-play";
import type { HomeSessionInsightPoint } from "@/lib/home-session-insights-shared";
import {
  buildRegisteredPlayersInsightHref,
  type OwnerSessionInsightFilter,
} from "@/lib/owner-session-insight-filter-shared";
import { prefetchRegisteredPlayersInsight } from "@/lib/fetch-registered-players";
import {
  formatOpenPlayDate,
  formatOpenPlayStartTimeDisplay,
} from "@/lib/open-play-time-range";
import { cn } from "@/lib/utils";

import type { HomeGameSummary } from "./home-game-summary";

function DemoOnlyBadge() {
  return (
    <Badge
      variant="outline"
      className="shrink-0 rounded-full border-amber-500/40 bg-amber-500/10 px-2 py-0 text-[0.625rem] font-semibold tracking-wide text-amber-800 uppercase dark:text-amber-200"
    >
      Demo
    </Badge>
  );
}

function SessionInsightLink({
  gameId,
  insight,
  count,
  label,
  icon,
}: {
  gameId: string;
  insight: OwnerSessionInsightFilter;
  count: number;
  label: string;
  icon?: React.ReactNode;
}) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const href = buildRegisteredPlayersInsightHref(gameId, insight);

  const warmNavigation = useCallback(() => {
    prefetchRegisteredPlayersInsight(queryClient, gameId, insight);
    router.prefetch(href);
  }, [queryClient, gameId, insight, href, router]);

  return (
    <Link
      href={href}
      prefetch
      className="inline-flex items-center gap-1 rounded-md font-medium text-foreground/80 underline-offset-2 transition-colors hover:text-primary hover:underline"
      aria-label={`${label}: ${count}. View in registered players.`}
      onPointerEnter={warmNavigation}
      onFocus={warmNavigation}
      onPointerDown={warmNavigation}
    >
      {icon}
      <span>
        {label}: {count}
      </span>
    </Link>
  );
}

export function HomeSessionSummaryCard({
  game,
  variant,
  insight,
  showCcfInsights = false,
}: {
  game: HomeGameSummary;
  variant: "active" | "past";
  insight?: HomeSessionInsightPoint | null;
  showCcfInsights?: boolean;
}) {
  const timeLabel = formatOpenPlayStartTimeDisplay(game.openPlayTimeRange);
  const dateLabel = formatOpenPlayDate(game.openPlayDate);
  const isDemo = isDemoOpenPlayTitle(game.title);

  return (
    <div className="home-session-summary group rounded-2xl border border-border/70 bg-card/90 p-4 shadow-sm transition-shadow hover:shadow-md">
      <div className="flex items-start gap-3">
        {timeLabel ? (
          <time className="home-session-summary__time shrink-0 pt-0.5 text-sm font-semibold text-foreground">
            {timeLabel}
          </time>
        ) : (
          <span className="home-session-summary__time shrink-0 pt-0.5 text-sm font-semibold text-muted-foreground">
            —
          </span>
        )}
        <div className="min-w-0 flex-1 space-y-2">
          <Link href={`/games/${game.gameId}`} className="block">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-base font-semibold leading-snug text-foreground group-hover:text-primary">
                    {game.title}
                  </h3>
                  {isDemo ? <DemoOnlyBadge /> : null}
                </div>
                <p className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Gauge className="h-3.5 w-3.5 shrink-0" aria-hidden />
                  {game.openPlayType}
                </p>
              </div>
              <Badge
                variant="secondary"
                className="shrink-0 rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-semibold text-primary"
              >
                {game.expectedPlayers}
                {game.strictPlayerCount ? "" : "+"}
              </Badge>
            </div>

            <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-1">
                <LayoutGrid className="h-3.5 w-3.5 shrink-0" aria-hidden />
                {game.courtCount} {game.courtCount === 1 ? "court" : "courts"}
              </span>
              {dateLabel ? (
                <span className="inline-flex items-center gap-1">
                  <MapPin className="h-3.5 w-3.5 shrink-0" aria-hidden />
                  {dateLabel}
                </span>
              ) : null}
            </div>

            <Badge
              variant="outline"
              className={cn(
                "mt-2 rounded-full text-xs font-medium",
                variant === "active"
                  ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                  : "border-border text-muted-foreground",
              )}
            >
              {variant === "active" ? (game.status === "draft" ? "Draft" : "Active") : "Ended"}
            </Badge>
          </Link>

          {insight ? (
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
              <SessionInsightLink
                gameId={game.gameId}
                insight="new"
                count={insight.newPlayerCount}
                label="New players"
                icon={
                  <Sparkles
                    className="h-3.5 w-3.5 shrink-0 text-sky-600 dark:text-sky-400"
                    aria-hidden
                  />
                }
              />
              {showCcfInsights ? (
                <>
                  <SessionInsightLink
                    gameId={game.gameId}
                    insight="ccf-not-yet"
                    count={insight.ccfNotYetCount ?? 0}
                    label="CCF not yet"
                    icon={<Users className="h-3.5 w-3.5 shrink-0" aria-hidden />}
                  />
                  <SessionInsightLink
                    gameId={game.gameId}
                    insight="ccf-attended"
                    count={insight.ccfAttendedCount ?? 0}
                    label="CCF attended"
                  />
                </>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
