"use client";

import { Grid2x2, Grid3x3, LayoutList } from "lucide-react";

import { Button } from "@/components/ui/button";
import { isCourtsViewDesktopViewport } from "@/lib/courts-view-viewport";
import { cn } from "@/lib/utils";

export type CourtsViewLayout = "list" | "tiles-2" | "tiles-3";

export const COURTS_VIEW_LAYOUT_STORAGE_KEY = "ccf-courts-view-layout";

export function defaultCourtsViewLayout(): CourtsViewLayout {
  return "list";
}

export function loadCourtsViewLayout(): CourtsViewLayout {
  if (typeof window === "undefined") return defaultCourtsViewLayout();
  if (!isCourtsViewDesktopViewport()) return defaultCourtsViewLayout();

  const stored = localStorage.getItem(COURTS_VIEW_LAYOUT_STORAGE_KEY);
  if (stored === "list" || stored === "tiles-2" || stored === "tiles-3") return stored;
  return defaultCourtsViewLayout();
}

export function saveCourtsViewLayout(layout: CourtsViewLayout) {
  localStorage.setItem(COURTS_VIEW_LAYOUT_STORAGE_KEY, layout);
}

type CourtsViewLayoutToggleProps = {
  value: CourtsViewLayout;
  onChange: (layout: CourtsViewLayout) => void;
  className?: string;
};

export function CourtsViewLayoutToggle({
  value,
  onChange,
  className,
}: CourtsViewLayoutToggleProps) {
  return (
    <div
      className={cn(
        "courts-view-layout-toggle inline-flex rounded-lg border border-border bg-muted/40 p-0.5",
        className,
      )}
      role="group"
      aria-label="Courts layout"
    >
      <Button
        type="button"
        size="sm"
        variant={value === "list" ? "default" : "ghost"}
        className="courts-view-layout-toggle-btn h-8 gap-1.5 px-2.5 sm:px-3"
        onClick={() => onChange("list")}
        aria-pressed={value === "list"}
      >
        <LayoutList className="h-4 w-4 shrink-0" aria-hidden />
        <span className="hidden sm:inline">List</span>
      </Button>
      <Button
        type="button"
        size="sm"
        variant={value === "tiles-2" ? "default" : "ghost"}
        className="courts-view-layout-toggle-btn h-8 gap-1.5 px-2.5 sm:px-3"
        onClick={() => onChange("tiles-2")}
        aria-pressed={value === "tiles-2"}
      >
        <Grid2x2 className="h-4 w-4 shrink-0" aria-hidden />
        <span className="hidden sm:inline">2×2</span>
      </Button>
      <Button
        type="button"
        size="sm"
        variant={value === "tiles-3" ? "default" : "ghost"}
        className="courts-view-layout-toggle-btn h-8 gap-1.5 px-2.5 sm:px-3"
        onClick={() => onChange("tiles-3")}
        aria-pressed={value === "tiles-3"}
      >
        <Grid3x3 className="h-4 w-4 shrink-0" aria-hidden />
        <span className="hidden sm:inline">3×3</span>
      </Button>
    </div>
  );
}

export function courtsViewLayoutGridClassName(layout: CourtsViewLayout): string {
  const base = "court-grid grid gap-3";

  switch (layout) {
    case "list":
      return cn(base, "court-grid--list grid-cols-1");
    case "tiles-2":
      return cn(base, "court-grid--tiles court-grid--tiles-2");
    case "tiles-3":
      return cn(base, "court-grid--tiles court-grid--tiles-3");
  }
}
