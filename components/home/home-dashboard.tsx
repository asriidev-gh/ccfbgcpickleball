"use client";

import dynamic from "next/dynamic";
import { useQuery } from "@tanstack/react-query";
import { BarChart3, Building2, ChevronDown, LayoutDashboard, LayoutGrid, Store, Users } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuthMe } from "@/hooks/use-auth-me";
import { buildHomeSessionInsightsMap, type HomeSessionInsightPoint } from "@/lib/home-session-insights-shared";
import { fetchGamesSessionInsights, gamesSessionInsightsQueryKey } from "@/lib/fetch-games-session-insights";
import {
  fetchOwnerRegisteredPlayersCount,
  ownerRegisteredPlayersCountQueryKey,
} from "@/lib/fetch-registered-players";
import { ownerHubQueryOptions } from "@/lib/owner-hub-query-options";
import { formatOpenPlayDate } from "@/lib/open-play-time-range";
import { cn } from "@/lib/utils";

import { EmailVerificationBanner } from "./email-verification-banner";

import type { HomeGameSummary } from "./home-game-summary";
import { HomeSessionSummaryCard } from "./home-session-summary-card";

const HomeSessionInsightsCharts = dynamic(
  () =>
    import("./home-session-insights-charts").then((module) => module.HomeSessionInsightsCharts),
  {
    ssr: false,
    loading: () => <Skeleton className="mb-5 h-36 w-full rounded-2xl" aria-hidden />,
  },
);

export type { HomeGameSummary } from "./home-game-summary";

type HomeDashboardProps = {
  activeGames: HomeGameSummary[];
  pastGames: HomeGameSummary[];
  gamesLoading?: boolean;
  onSessionTabChange?: () => void;
};

type SessionTab = "active" | "past";

function groupGamesByDate(games: HomeGameSummary[]) {
  const groups = new Map<string, HomeGameSummary[]>();

  for (const game of games) {
    const label = formatOpenPlayDate(game.openPlayDate) ?? "Unscheduled";
    const existing = groups.get(label);
    if (existing) {
      existing.push(game);
    } else {
      groups.set(label, [game]);
    }
  }

  return Array.from(groups.entries());
}

function SessionList({
  games,
  variant,
  emptyMessage,
  insightsByGameId,
  showCcfInsights,
  loading = false,
}: {
  games: HomeGameSummary[];
  variant: "active" | "past";
  emptyMessage: string;
  insightsByGameId: Map<string, HomeSessionInsightPoint>;
  showCcfInsights: boolean;
  loading?: boolean;
}) {
  const grouped = useMemo(() => groupGamesByDate(games), [games]);

  if (loading) {
    return (
      <div className="space-y-3" aria-busy="true" aria-label="Loading sessions">
        {Array.from({ length: 3 }, (_, index) => (
          <Skeleton key={index} className="h-28 w-full rounded-2xl" />
        ))}
      </div>
    );
  }

  if (games.length === 0) {
    return <p className="px-1 py-6 text-center text-sm text-muted-foreground">{emptyMessage}</p>;
  }

  return (
    <div className="home-session-list space-y-5">
      {grouped.map(([dateLabel, dateGames]) => (
        <section key={dateLabel} className="space-y-3">
          <header className="home-session-list__day-header flex items-center gap-2 border-b border-dashed border-border/70 pb-2">
            <h4 className="text-sm font-semibold text-foreground">{dateLabel}</h4>
            <ChevronDown className="h-4 w-4 text-muted-foreground" aria-hidden />
          </header>
          <div className="space-y-3">
            {dateGames.map((game) => (
              <HomeSessionSummaryCard
                key={game._id}
                game={game}
                variant={variant}
                insight={insightsByGameId.get(game.gameId)}
                showCcfInsights={showCcfInsights}
              />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

export function HomeDashboard({
  activeGames,
  pastGames,
  gamesLoading = false,
  onSessionTabChange,
}: HomeDashboardProps) {
  const [sessionTab, setSessionTab] = useState<SessionTab>("active");

  const handleSessionTabChange = (tab: SessionTab) => {
    setSessionTab(tab);
    onSessionTabChange?.();
  };

  const { data: authData, isLoading: isAuthLoading } = useAuthMe();

  const { data: sessionInsightsData } = useQuery({
    queryKey: gamesSessionInsightsQueryKey,
    queryFn: fetchGamesSessionInsights,
    retry: 1,
    ...ownerHubQueryOptions,
  });

  const showRegisteredPlayers = Boolean(authData?.user);

  const { data: registeredPlayersTotal, isLoading: registeredPlayersCountLoading } = useQuery({
    queryKey: ownerRegisteredPlayersCountQueryKey(),
    queryFn: fetchOwnerRegisteredPlayersCount,
    enabled: showRegisteredPlayers,
    ...ownerHubQueryOptions,
  });

  const insightsByGameId = useMemo(
    () => buildHomeSessionInsightsMap(sessionInsightsData?.sessions ?? []),
    [sessionInsightsData?.sessions],
  );
  const showCcfInsights = sessionInsightsData?.showCcfInsights ?? false;
  const chartSessions = sessionInsightsData?.sessions ?? [];

  const isSuperAdmin = Boolean(authData?.user?.isSuperAdmin);
  const sessionGames = sessionTab === "active" ? activeGames : pastGames;
  const dashboardTileCount = isAuthLoading
    ? 4
    : 1 + (showRegisteredPlayers ? 3 : 0) + (isSuperAdmin ? 1 : 0);

  return (
    <div className="home-dashboard space-y-5">
      <div className="home-dashboard__title flex items-center gap-2">
        <LayoutDashboard className="h-6 w-6 text-primary" aria-hidden />
        <h1 className="text-lg font-semibold text-foreground sm:text-xl">Dashboard</h1>
      </div>

      <EmailVerificationBanner />

      <div
        className={cn(
          "home-dashboard-tiles grid gap-2 sm:gap-3",
          dashboardTileCount >= 5 && "grid-cols-2 sm:grid-cols-3 lg:grid-cols-5",
          dashboardTileCount === 4 && "grid-cols-2 sm:grid-cols-4",
          dashboardTileCount === 3 && "grid-cols-3",
          dashboardTileCount === 2 && "grid-cols-2 sm:max-w-xl",
          dashboardTileCount === 1 && "grid-cols-1 sm:max-w-xs",
        )}
      >
        <Link
          href="/my-games"
          className="home-dashboard-tile flex min-h-[5.5rem] flex-col items-start justify-between rounded-2xl border border-border/70 bg-sky-500/8 p-4 text-left transition-colors hover:bg-sky-500/12 dark:bg-sky-400/10 dark:hover:bg-sky-400/15"
        >
          <LayoutGrid className="h-6 w-6 text-primary" aria-hidden />
          <span className="text-sm font-semibold text-foreground">My Games</span>
        </Link>

        {isAuthLoading ? (
          <>
            {Array.from({ length: 3 }, (_, index) => (
              <Skeleton key={index} className="min-h-[5.5rem] rounded-2xl" aria-hidden />
            ))}
          </>
        ) : (
          <>
            {showRegisteredPlayers ? (
              <Link
                href="/users"
                className="home-dashboard-tile flex min-h-[5.5rem] flex-col items-start justify-between rounded-2xl border border-border/70 bg-sky-500/8 p-4 text-left transition-colors hover:bg-sky-500/12 dark:bg-sky-400/10 dark:hover:bg-sky-400/15"
                aria-label={
                  registeredPlayersTotal != null
                    ? `Registered players: ${registeredPlayersTotal.toLocaleString()} total`
                    : "Registered players"
                }
              >
                <div className="flex h-6 items-center gap-2">
                  <Users className="size-6 shrink-0 text-primary" aria-hidden />
                  {registeredPlayersCountLoading ? (
                    <Skeleton className="h-6 w-12" aria-hidden />
                  ) : registeredPlayersTotal != null ? (
                    <span className="text-[1.5rem] font-bold leading-none tabular-nums text-primary">
                      {registeredPlayersTotal.toLocaleString()}
                    </span>
                  ) : null}
                </div>
                <span className="text-sm font-semibold text-foreground">Registered players</span>
              </Link>
            ) : null}

            {showRegisteredPlayers ? (
              <Link
                href="/my-club"
                className="home-dashboard-tile flex min-h-[5.5rem] flex-col items-start justify-between rounded-2xl border border-border/70 bg-sky-500/8 p-4 text-left transition-colors hover:bg-sky-500/12 dark:bg-sky-400/10 dark:hover:bg-sky-400/15"
              >
                <Building2 className="h-6 w-6 text-primary" aria-hidden />
                <span className="text-sm font-semibold text-foreground">My Club</span>
              </Link>
            ) : null}

            {showRegisteredPlayers ? (
              <Link
                href="/marketplace"
                className="home-dashboard-tile flex min-h-[5.5rem] flex-col items-start justify-between rounded-2xl border border-border/70 bg-sky-500/8 p-4 text-left transition-colors hover:bg-sky-500/12 dark:bg-sky-400/10 dark:hover:bg-sky-400/15"
              >
                <Store className="h-6 w-6 text-primary" aria-hidden />
                <span className="text-sm font-semibold text-foreground">Marketplace</span>
              </Link>
            ) : null}

            {isSuperAdmin ? (
              <Link
                href="/insights"
                className="home-dashboard-tile flex min-h-[5.5rem] flex-col items-start justify-between rounded-2xl border border-border/70 bg-sky-500/8 p-4 text-left transition-colors hover:bg-sky-500/12 dark:bg-sky-400/10 dark:hover:bg-sky-400/15"
              >
                <BarChart3 className="h-6 w-6 text-primary" aria-hidden />
                <span className="text-sm font-semibold text-foreground">Statistics</span>
              </Link>
            ) : null}
          </>
        )}
      </div>

      <Card className="home-dashboard-sessions glass-panel border-border/70">
        <CardContent className="p-4 sm:p-5">
          <HomeSessionInsightsCharts
            sessions={chartSessions}
            showCcfInsights={showCcfInsights}
            className="mb-5"
          />

          <div
            className="home-session-tabs mb-4 flex flex-wrap gap-2"
            role="tablist"
            aria-label="Session filters"
          >
            <button
              type="button"
              role="tab"
              aria-selected={sessionTab === "active"}
              className={cn(
                "home-session-tab cursor-pointer rounded-full px-4 py-1.5 text-sm font-medium transition-colors",
                sessionTab === "active"
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "bg-muted/60 text-muted-foreground hover:text-foreground",
              )}
              onClick={() => handleSessionTabChange("active")}
            >
              Active
              {activeGames.length > 0 ? (
                <Badge
                  variant="secondary"
                  className={cn(
                    "ml-1.5 px-1.5 py-0 text-xs",
                    sessionTab === "active" ? "bg-primary-foreground/20 text-primary-foreground" : "",
                  )}
                >
                  {activeGames.length}
                </Badge>
              ) : null}
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={sessionTab === "past"}
              className={cn(
                "home-session-tab cursor-pointer rounded-full px-4 py-1.5 text-sm font-medium transition-colors",
                sessionTab === "past"
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "bg-muted/60 text-muted-foreground hover:text-foreground",
              )}
              onClick={() => handleSessionTabChange("past")}
            >
              Past
              {pastGames.length > 0 ? (
                <Badge
                  variant="secondary"
                  className={cn(
                    "ml-1.5 px-1.5 py-0 text-xs",
                    sessionTab === "past" ? "bg-primary-foreground/20 text-primary-foreground" : "",
                  )}
                >
                  {pastGames.length}
                </Badge>
              ) : null}
            </button>
          </div>

          <SessionList
            games={sessionGames}
            variant={sessionTab}
            insightsByGameId={insightsByGameId}
            showCcfInsights={showCcfInsights}
            loading={gamesLoading && sessionGames.length === 0}
            emptyMessage={
              sessionTab === "active"
                ? "No active open play sessions. Create one to get started."
                : "No past sessions yet. Ended open play sessions will appear here."
            }
          />
        </CardContent>
      </Card>
    </div>
  );
}
