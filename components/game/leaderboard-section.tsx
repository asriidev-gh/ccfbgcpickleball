"use client";

import { useEffect, useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";

import { LeaderboardStandings, type LeaderboardRow } from "@/components/game/leaderboard-standings";
import { LeaderboardTable } from "@/components/game/leaderboard-table";
import {
  LEADERBOARD_VIEW_STORAGE_KEY,
  LeaderboardViewToggle,
  loadLeaderboardView,
  saveLeaderboardView,
  type LeaderboardViewMode,
} from "@/components/game/leaderboard-view-toggle";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  LEADERBOARD_DESKTOP_MEDIA,
  defaultLeaderboardView,
} from "@/lib/leaderboard-viewport";
import { cn } from "@/lib/utils";

export const LEADERBOARD_PANEL_STORAGE_KEY = "ccf-leaderboard-visible";

export function loadLeaderboardPanelVisible() {
  if (typeof window === "undefined") return false;
  return localStorage.getItem(LEADERBOARD_PANEL_STORAGE_KEY) === "true";
}

export function saveLeaderboardPanelVisible(visible: boolean) {
  localStorage.setItem(LEADERBOARD_PANEL_STORAGE_KEY, visible ? "true" : "false");
}

type LeaderboardSectionProps = {
  rows: LeaderboardRow[];
  compact?: boolean;
  collapsible?: boolean;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
};

export function LeaderboardSection({
  rows,
  compact = false,
  collapsible = false,
  open: openProp,
  onOpenChange,
}: LeaderboardSectionProps) {
  const [view, setView] = useState<LeaderboardViewMode>("cards");
  const [internalOpen, setInternalOpen] = useState(false);

  const isControlled = openProp !== undefined;
  const open = isControlled ? openProp : internalOpen;

  useEffect(() => {
    if (!collapsible || isControlled) return;
    setInternalOpen(loadLeaderboardPanelVisible());
  }, [collapsible, isControlled]);

  useEffect(() => {
    setView(loadLeaderboardView());

    const mq = window.matchMedia(LEADERBOARD_DESKTOP_MEDIA);
    const onViewportChange = () => {
      if (!localStorage.getItem(LEADERBOARD_VIEW_STORAGE_KEY)) {
        setView(defaultLeaderboardView());
      }
    };
    mq.addEventListener("change", onViewportChange);
    return () => mq.removeEventListener("change", onViewportChange);
  }, []);

  const handleViewChange = (next: LeaderboardViewMode) => {
    setView(next);
    saveLeaderboardView(next);
  };

  const setOpen = (next: boolean) => {
    if (!isControlled) {
      setInternalOpen(next);
      if (collapsible) saveLeaderboardPanelVisible(next);
    }
    onOpenChange?.(next);
  };

  const panelOpen = !collapsible || open;
  const standingsSummary = `${rows.length} ${rows.length === 1 ? "player" : "players"} · sorted by wins`;

  return (
    <Card className={cn("glass-panel leaderboard-panel min-w-0", compact && "h-full")}>
      <CardHeader className="flex flex-col gap-3 space-y-0">
        <div className="flex w-full flex-nowrap items-center justify-between gap-3">
          <div className="min-w-0 flex-1">
            <CardTitle>Standings</CardTitle>
            <p className="caption">{standingsSummary}</p>
          </div>
          <div className="flex shrink-0 items-center gap-2 self-center">
            {panelOpen ? (
              <LeaderboardViewToggle value={view} onChange={handleViewChange} />
            ) : null}
            {collapsible ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="leaderboard-panel-toggle"
                onClick={() => setOpen(!open)}
                aria-expanded={open}
                aria-controls="leaderboard-panel-content"
              >
                {open ? (
                  <>
                    <ChevronUp className="mr-1.5 h-4 w-4" aria-hidden />
                    Hide standings
                  </>
                ) : (
                  <>
                    <ChevronDown className="mr-1.5 h-4 w-4" aria-hidden />
                    Show standings
                  </>
                )}
              </Button>
            ) : null}
          </div>
        </div>
      </CardHeader>
      {panelOpen ? (
        <CardContent id="leaderboard-panel-content">
          {view === "table" ? (
            <LeaderboardTable rows={rows} />
          ) : (
            <LeaderboardStandings rows={rows} compact={compact} />
          )}
        </CardContent>
      ) : null}
    </Card>
  );
}
