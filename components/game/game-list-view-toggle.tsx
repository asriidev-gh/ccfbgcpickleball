"use client";

import { LayoutGrid, LayoutList, QrCode } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type GameListViewMode = "list" | "cards" | "qr";

export const GAME_LIST_VIEW_STORAGE_KEY = "ccf-game-list-view";

/** Matches Tailwind `md` — list row layout uses this breakpoint. */
export const GAME_LIST_DESKTOP_MEDIA = "(min-width: 768px)";

export function isGameListDesktopViewport(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia(GAME_LIST_DESKTOP_MEDIA).matches;
}

export function defaultGameListView(): GameListViewMode {
  return "list";
}

export function loadGameListView(): GameListViewMode {
  if (typeof window === "undefined") return "list";
  if (!isGameListDesktopViewport()) return "list";

  const stored = localStorage.getItem(GAME_LIST_VIEW_STORAGE_KEY);
  if (!stored) return defaultGameListView();
  if (stored === "cards" || stored === "qr" || stored === "list") return stored;
  return "list";
}

export function saveGameListView(view: GameListViewMode) {
  localStorage.setItem(GAME_LIST_VIEW_STORAGE_KEY, view);
}

type GameListViewToggleProps = {
  value: GameListViewMode;
  onChange: (view: GameListViewMode) => void;
  hideQrMode?: boolean;
};

export function GameListViewToggle({ value, onChange, hideQrMode = false }: GameListViewToggleProps) {
  return (
    <div
      className="game-list-view-toggle hidden rounded-lg border border-border bg-muted/40 p-0.5 md:inline-flex"
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
      {hideQrMode ? null : (
      <Button
        type="button"
        size="sm"
        variant={value === "qr" ? "default" : "ghost"}
        className={cn("game-list-view-toggle-btn h-8 gap-1.5 px-2.5 sm:px-3")}
        onClick={() => onChange("qr")}
        aria-pressed={value === "qr"}
      >
        <QrCode className="h-4 w-4 shrink-0" aria-hidden />
        <span className="hidden sm:inline">QR Mode</span>
      </Button>
      )}
    </div>
  );
}
