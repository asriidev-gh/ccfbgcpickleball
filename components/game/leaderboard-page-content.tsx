"use client";

import { Loader2 } from "lucide-react";
import { useEffect, useState } from "react";

import {
  LEADERBOARD_LAYOUT_STORAGE_KEY,
  LeaderboardLayoutToggle,
  loadLeaderboardLayout,
  saveLeaderboardLayout,
  type LeaderboardPageLayout,
} from "@/components/game/leaderboard-layout-toggle";
import { LeaderboardSection } from "@/components/game/leaderboard-section";
import type { LeaderboardRow } from "@/components/game/leaderboard-standings";
import { SessionInsightsGrid } from "@/components/game/session-insights-grid";
import {
  LEADERBOARD_DESKTOP_MEDIA,
  defaultLeaderboardLayout,
} from "@/lib/leaderboard-viewport";
import type { SessionInsight } from "@/lib/session-insights";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type LeaderboardPageContentProps = {
  insights: SessionInsight[];
  rows: LeaderboardRow[];
  loading?: boolean;
};

function LeaderboardPanelLoading({ label }: { label: string }) {
  return (
    <Card className="glass-panel min-w-0">
      <CardContent
        className="flex flex-col items-center justify-center gap-3 py-12 text-sm text-muted-foreground"
        role="status"
        aria-live="polite"
        aria-busy="true"
      >
        <Loader2 className="h-8 w-8 animate-spin text-primary" aria-hidden />
        <p>{label}</p>
      </CardContent>
    </Card>
  );
}

export function LeaderboardPageContent({
  insights,
  rows,
  loading = false,
}: LeaderboardPageContentProps) {
  const [layout, setLayout] = useState<LeaderboardPageLayout>("stacked");
  const [isDesktop, setIsDesktop] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia(LEADERBOARD_DESKTOP_MEDIA);
    const syncLayout = () => {
      setIsDesktop(mq.matches);
      setLayout(loadLeaderboardLayout());
    };
    syncLayout();

    const onViewportChange = () => {
      setIsDesktop(mq.matches);
      if (!localStorage.getItem(LEADERBOARD_LAYOUT_STORAGE_KEY)) {
        setLayout(defaultLeaderboardLayout());
      }
    };
    mq.addEventListener("change", onViewportChange);
    return () => mq.removeEventListener("change", onViewportChange);
  }, []);

  const handleLayoutChange = (next: LeaderboardPageLayout) => {
    setLayout(next);
    saveLeaderboardLayout(next);
  };

  const isSplit = isDesktop && layout === "split";

  return (
    <div className="leaderboard-page-content space-y-4">
      <div className="hidden flex-wrap items-center justify-end gap-2 xl:flex">
        <LeaderboardLayoutToggle value={layout} onChange={handleLayoutChange} />
      </div>

      <div
        className={cn(
          "leaderboard-page-sections gap-6",
          isSplit
            ? "grid grid-cols-1 items-start xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]"
            : "flex flex-col",
        )}
      >
        {loading ? (
          <LeaderboardPanelLoading label="Loading session awards…" />
        ) : (
          <SessionInsightsGrid insights={insights} compact={isSplit} />
        )}

        {loading ? (
          <LeaderboardPanelLoading label="Loading standings…" />
        ) : rows.length === 0 ? (
          <Card className="glass-panel min-w-0">
            <CardContent className="p-6 text-muted-foreground">No leaderboard data yet.</CardContent>
          </Card>
        ) : (
          <LeaderboardSection rows={rows} compact={isSplit} />
        )}
      </div>
    </div>
  );
}
