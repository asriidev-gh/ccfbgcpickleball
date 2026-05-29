"use client";

import { Columns2, Rows3 } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  defaultLeaderboardLayout,
  type LeaderboardPageLayout,
} from "@/lib/leaderboard-viewport";
import { cn } from "@/lib/utils";

export type { LeaderboardPageLayout };

export const LEADERBOARD_LAYOUT_STORAGE_KEY = "ccf-leaderboard-layout";

export function loadLeaderboardLayout(): LeaderboardPageLayout {
  if (typeof window === "undefined") return defaultLeaderboardLayout();
  const stored = localStorage.getItem(LEADERBOARD_LAYOUT_STORAGE_KEY);
  if (stored === "split" || stored === "stacked") return stored;
  return defaultLeaderboardLayout();
}

export function saveLeaderboardLayout(layout: LeaderboardPageLayout) {
  localStorage.setItem(LEADERBOARD_LAYOUT_STORAGE_KEY, layout);
}

type LeaderboardLayoutToggleProps = {
  value: LeaderboardPageLayout;
  onChange: (layout: LeaderboardPageLayout) => void;
};

export function LeaderboardLayoutToggle({ value, onChange }: LeaderboardLayoutToggleProps) {
  return (
    <div
      className="leaderboard-layout-toggle inline-flex rounded-lg border border-border bg-muted/40 p-0.5"
      role="group"
      aria-label="Page layout"
    >
      <Button
        type="button"
        size="sm"
        variant={value === "stacked" ? "default" : "ghost"}
        className={cn("h-8 gap-1.5 px-2.5 sm:px-3")}
        onClick={() => onChange("stacked")}
        aria-pressed={value === "stacked"}
      >
        <Rows3 className="h-4 w-4 shrink-0" aria-hidden />
        <span className="hidden sm:inline">Stacked</span>
      </Button>
      <Button
        type="button"
        size="sm"
        variant={value === "split" ? "default" : "ghost"}
        className={cn("h-8 gap-1.5 px-2.5 sm:px-3")}
        onClick={() => onChange("split")}
        aria-pressed={value === "split"}
      >
        <Columns2 className="h-4 w-4 shrink-0" aria-hidden />
        <span className="hidden sm:inline">Side by side</span>
      </Button>
    </div>
  );
}
