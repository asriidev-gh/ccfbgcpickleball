"use client";

import { LayoutGrid, LayoutList } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type CourtsViewLayout = "list" | "tiles";

export const COURTS_VIEW_STORAGE_KEY = "ccf-courts-view";

export function loadCourtsView(): CourtsViewLayout {
  if (typeof window === "undefined") return "tiles";
  const stored = localStorage.getItem(COURTS_VIEW_STORAGE_KEY);
  return stored === "list" || stored === "tiles" ? stored : "tiles";
}

export function saveCourtsView(view: CourtsViewLayout) {
  localStorage.setItem(COURTS_VIEW_STORAGE_KEY, view);
}

type CourtsViewToggleProps = {
  value: CourtsViewLayout;
  onChange: (view: CourtsViewLayout) => void;
};

export function CourtsViewToggle({ value, onChange }: CourtsViewToggleProps) {
  return (
    <div
      className="courts-view-toggle inline-flex rounded-lg border border-border bg-muted/40 p-0.5"
      role="group"
      aria-label="Courts layout"
    >
      <Button
        type="button"
        size="sm"
        variant={value === "list" ? "default" : "ghost"}
        className={cn("courts-view-toggle-btn h-8 gap-1.5 px-2.5 sm:px-3")}
        onClick={() => onChange("list")}
        aria-pressed={value === "list"}
      >
        <LayoutList className="h-4 w-4 shrink-0" aria-hidden />
        <span className="hidden sm:inline">Rows</span>
      </Button>
      <Button
        type="button"
        size="sm"
        variant={value === "tiles" ? "default" : "ghost"}
        className={cn("courts-view-toggle-btn h-8 gap-1.5 px-2.5 sm:px-3")}
        onClick={() => onChange("tiles")}
        aria-pressed={value === "tiles"}
      >
        <LayoutGrid className="h-4 w-4 shrink-0" aria-hidden />
        <span className="hidden sm:inline">Tiles</span>
      </Button>
    </div>
  );
}
