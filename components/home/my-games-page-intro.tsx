"use client";

import { LayoutGrid } from "lucide-react";

export function MyGamesPageIntro() {
  return (
    <div className="my-games-page-intro flex items-start gap-3">
      <span className="my-games-page-intro__icon flex size-11 shrink-0 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-700 dark:text-emerald-300">
        <LayoutGrid className="h-5 w-5" aria-hidden />
      </span>
      <div>
        <h1 className="page-title">My Games</h1>
        <p className="caption mt-0.5 max-w-xl">
          Your open play sessions — create sessions, run the queue, and review past games in one place.
        </p>
      </div>
    </div>
  );
}
