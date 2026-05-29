"use client";

import { LayoutGrid, Table2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  defaultLeaderboardView,
  type LeaderboardViewMode,
} from "@/lib/leaderboard-viewport";
import { cn } from "@/lib/utils";

export type { LeaderboardViewMode };

export const LEADERBOARD_VIEW_STORAGE_KEY = "ccf-leaderboard-view";

export function loadLeaderboardView(): LeaderboardViewMode {
  if (typeof window === "undefined") return defaultLeaderboardView();
  const stored = localStorage.getItem(LEADERBOARD_VIEW_STORAGE_KEY);
  if (stored === "table" || stored === "cards") return stored;
  return defaultLeaderboardView();
}

export function saveLeaderboardView(view: LeaderboardViewMode) {
  localStorage.setItem(LEADERBOARD_VIEW_STORAGE_KEY, view);
}

type LeaderboardViewToggleProps = {
  value: LeaderboardViewMode;
  onChange: (view: LeaderboardViewMode) => void;
};

export function LeaderboardViewToggle({ value, onChange }: LeaderboardViewToggleProps) {
  return (
    <div
      className="leaderboard-view-toggle inline-flex rounded-lg border border-border bg-muted/40 p-0.5"
      role="group"
      aria-label="Leaderboard layout"
    >
      <Button
        type="button"
        size="sm"
        variant={value === "cards" ? "default" : "ghost"}
        className={cn("leaderboard-view-toggle-btn h-8 gap-1.5 px-2.5 sm:px-3")}
        onClick={() => onChange("cards")}
        aria-pressed={value === "cards"}
      >
        <LayoutGrid className="h-4 w-4 shrink-0" aria-hidden />
        <span className="hidden sm:inline">Cards</span>
      </Button>
      <Button
        type="button"
        size="sm"
        variant={value === "table" ? "default" : "ghost"}
        className={cn("leaderboard-view-toggle-btn h-8 gap-1.5 px-2.5 sm:px-3")}
        onClick={() => onChange("table")}
        aria-pressed={value === "table"}
      >
        <Table2 className="h-4 w-4 shrink-0" aria-hidden />
        <span className="hidden sm:inline">Table</span>
      </Button>
    </div>
  );
}
