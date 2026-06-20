"use client";

import { Image, ImageOff } from "lucide-react";

import { Button } from "@/components/ui/button";
import { isCourtsViewDesktopViewport } from "@/lib/courts-view-viewport";
import { cn } from "@/lib/utils";

export const COURTS_VIEW_PHOTOS_STORAGE_KEY = "ccf-courts-view-photos";

export function defaultCourtsViewShowPhotos(): boolean {
  return true;
}

export function loadCourtsViewShowPhotos(): boolean {
  if (typeof window === "undefined") return defaultCourtsViewShowPhotos();
  if (!isCourtsViewDesktopViewport()) return true;

  const stored = localStorage.getItem(COURTS_VIEW_PHOTOS_STORAGE_KEY);
  if (stored === "false") return false;
  if (stored === "true") return true;
  return defaultCourtsViewShowPhotos();
}

export function saveCourtsViewShowPhotos(showPhotos: boolean) {
  localStorage.setItem(COURTS_VIEW_PHOTOS_STORAGE_KEY, showPhotos ? "true" : "false");
}

export function courtsViewPhotosGridClassName(showPhotos: boolean): string {
  return showPhotos ? "court-grid--show-photos" : "court-grid--hide-photos";
}

type CourtsViewPhotosToggleProps = {
  value: boolean;
  onChange: (showPhotos: boolean) => void;
  className?: string;
};

export function CourtsViewPhotosToggle({
  value,
  onChange,
  className,
}: CourtsViewPhotosToggleProps) {
  return (
    <div
      className={cn(
        "courts-view-photos-toggle inline-flex rounded-lg border border-border bg-muted/40 p-0.5",
        className,
      )}
    >
      <Button
        type="button"
        size="sm"
        variant={value ? "default" : "ghost"}
        className="courts-view-photos-toggle-btn h-8 gap-1.5 px-2.5 sm:px-3"
        onClick={() => onChange(true)}
        aria-pressed={value}
      >
        <Image className="h-4 w-4 shrink-0" aria-hidden />
        <span className="hidden sm:inline">Photos</span>
      </Button>
      <Button
        type="button"
        size="sm"
        variant={!value ? "default" : "ghost"}
        className="courts-view-photos-toggle-btn h-8 gap-1.5 px-2.5 sm:px-3"
        onClick={() => onChange(false)}
        aria-pressed={!value}
      >
        <ImageOff className="h-4 w-4 shrink-0" aria-hidden />
        <span className="hidden sm:inline">Hide</span>
      </Button>
    </div>
  );
}
