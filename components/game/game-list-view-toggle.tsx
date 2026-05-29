"use client";

import { LayoutGrid, LayoutList } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type GameListViewMode = "list" | "cards";

export const GAME_LIST_VIEW_STORAGE_KEY = "ccf-game-list-view";

export function loadGameListView(): GameListViewMode {
  if (typeof window === "undefined") return "list";
  const stored = localStorage.getItem(GAME_LIST_VIEW_STORAGE_KEY);
  return stored === "list" || stored === "cards" ? stored : "list";
}

export function saveGameListView(view: GameListViewMode) {
  localStorage.setItem(GAME_LIST_VIEW_STORAGE_KEY, view);
}

type GameListViewToggleProps = {
  value: GameListViewMode;
  onChange: (view: GameListViewMode) => void;
};

export function GameListViewToggle({ value, onChange }: GameListViewToggleProps) {
  return (
    <div
      className="game-list-view-toggle inline-flex rounded-lg border border-border bg-muted/40 p-0.5"
      role="group"
      aria-label="Games layout"
    >
      <Button
        type="button"
        size="sm"
        variant={value === "list" ? "default" : "ghost"}
        className={cn("game-list-view-toggle-btn h-8 gap-1.5 px-2.5 sm:px-3")}
        onClick={() => onChange("list")}
        aria-pressed={value === "list"}
      >
        <LayoutList className="h-4 w-4 shrink-0" aria-hidden />
        <span className="hidden sm:inline">List</span>
      </Button>
      <Button
        type="button"
        size="sm"
        variant={value === "cards" ? "default" : "ghost"}
        className={cn("game-list-view-toggle-btn h-8 gap-1.5 px-2.5 sm:px-3")}
        onClick={() => onChange("cards")}
        aria-pressed={value === "cards"}
      >
        <LayoutGrid className="h-4 w-4 shrink-0" aria-hidden />
        <span className="hidden sm:inline">Cards</span>
      </Button>
    </div>
  );
}
