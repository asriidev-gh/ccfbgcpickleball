"use client";

import { useQuery } from "@tanstack/react-query";
import { BarChart3, Building2, ChevronDown, LayoutGrid, TrendingUp, Users } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { formatOpenPlayDate } from "@/lib/open-play-time-range";
import { cn } from "@/lib/utils";

import type { HomeGameSummary } from "./home-game-summary";
import { HomeSessionSummaryCard } from "./home-session-summary-card";

export type { HomeGameSummary } from "./home-game-summary";

type HomeDashboardProps = {
  activeGames: HomeGameSummary[];
  pastGames: HomeGameSummary[];
  onSessionTabChange?: () => void;
};

type SessionTab = "active" | "past";
type DashboardPanel = "sessions" | "statistics";

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
}: {
  games: HomeGameSummary[];
  variant: "active" | "past";
  emptyMessage: string;
}) {
  const grouped = useMemo(() => groupGamesByDate(games), [games]);

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
              <HomeSessionSummaryCard key={game._id} game={game} variant={variant} />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

function StatisticsPanel({
  activeGames,
  pastGames,
}: {
  activeGames: HomeGameSummary[];
  pastGames: HomeGameSummary[];
}) {
  const activeCourts = activeGames.reduce((sum, game) => sum + game.courtCount, 0);
  const activeCapacity = activeGames.reduce((sum, game) => sum + game.expectedPlayers, 0);

  const stats = [
    {
      label: "Active sessions",
      value: activeGames.length,
      icon: LayoutGrid,
    },
    {
      label: "Past sessions",
      value: pastGames.length,
      icon: TrendingUp,
    },
    {
      label: "Courts in play",
      value: activeCourts,
      icon: BarChart3,
    },
    {
      label: "Expected players",
      value: activeCapacity,
      icon: Users,
    },
  ];

  return (
    <div className="space-y-4">
      <div className="home-stats-grid grid grid-cols-2 gap-3">
        {stats.map(({ label, value, icon: Icon }) => (
          <div
            key={label}
            className="home-stats-card rounded-2xl border border-border/70 bg-card/90 p-4 shadow-sm"
          >
            <Icon className="mb-2 h-5 w-5 text-primary/80" aria-hidden />
            <p className="text-2xl font-bold tabular-nums text-foreground">{value}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">{label}</p>
          </div>
        ))}
      </div>
      <Link href="/insights">
        <Button variant="outline" className="w-full">
          <BarChart3 className="mr-2 h-4 w-4" aria-hidden />
          Open full insights
        </Button>
      </Link>
    </div>
  );
}

export function HomeDashboard({
  activeGames,
  pastGames,
  onSessionTabChange,
}: HomeDashboardProps) {
  const [sessionTab, setSessionTab] = useState<SessionTab>("active");

  const handleSessionTabChange = (tab: SessionTab) => {
    setSessionTab(tab);
    onSessionTabChange?.();
  };
  const [panel, setPanel] = useState<DashboardPanel>("sessions");

  const { data: authData } = useQuery({
    queryKey: ["auth-me"],
    queryFn: async () => {
      const response = await fetch("/api/auth/me");
      if (!response.ok) return null;
      const payload = await response.json();
      return payload as {
        user: { name: string; isSuperAdmin?: boolean } | null;
      };
    },
    staleTime: 60_000,
  });

  const userName = authData?.user?.name?.trim();
  const isSuperAdmin = Boolean(authData?.user?.isSuperAdmin);
  const showRegisteredPlayers = Boolean(authData?.user);
  const sessionGames = sessionTab === "active" ? activeGames : pastGames;
  const dashboardTileCount =
    1 + (showRegisteredPlayers ? 2 : 0) + (isSuperAdmin ? 1 : 0);

  return (
    <div className="home-dashboard space-y-5">
      {userName ? (
        <p className="home-dashboard__greeting text-lg font-semibold text-foreground">
          Hi, {userName}
        </p>
      ) : null}

      <div
        className={cn(
          "home-dashboard-tiles grid gap-2 sm:gap-3",
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

        {showRegisteredPlayers ? (
          <Link
            href="/users"
            className="home-dashboard-tile flex min-h-[5.5rem] flex-col items-start justify-between rounded-2xl border border-border/70 bg-sky-500/8 p-4 text-left transition-colors hover:bg-sky-500/12 dark:bg-sky-400/10 dark:hover:bg-sky-400/15"
          >
            <Users className="h-6 w-6 text-primary" aria-hidden />
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

        {isSuperAdmin ? (
          <button
            type="button"
            className={cn(
              "home-dashboard-tile flex min-h-[5.5rem] flex-col items-start justify-between rounded-2xl border p-4 text-left transition-colors",
              panel === "statistics"
                ? "border-primary/50 bg-primary/10 shadow-sm"
                : "border-border/70 bg-sky-500/8 hover:bg-sky-500/12 dark:bg-sky-400/10 dark:hover:bg-sky-400/15",
            )}
            onClick={() => setPanel(panel === "statistics" ? "sessions" : "statistics")}
          >
            <BarChart3 className="h-6 w-6 text-primary" aria-hidden />
            <span className="text-sm font-semibold text-foreground">Statistics</span>
          </button>
        ) : null}
      </div>

      {isSuperAdmin && panel === "statistics" ? (
        <Card className="home-dashboard-sessions glass-panel border-border/70">
          <CardContent className="p-4 sm:p-5">
            <h3 className="mb-4 text-base font-semibold text-foreground">Overview</h3>
            <StatisticsPanel activeGames={activeGames} pastGames={pastGames} />
          </CardContent>
        </Card>
      ) : (
        <Card className="home-dashboard-sessions glass-panel border-border/70">
          <CardContent className="p-4 sm:p-5">
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
              emptyMessage={
                sessionTab === "active"
                  ? "No active open play sessions. Create one to get started."
                  : "No past sessions yet. Ended open play sessions will appear here."
              }
            />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
