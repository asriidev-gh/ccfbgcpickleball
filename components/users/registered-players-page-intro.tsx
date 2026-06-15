"use client";

import { Users } from "lucide-react";

export function RegisteredPlayersPageIntro() {
  return (
    <div className="registered-players-page-intro flex items-start gap-3">
      <span className="registered-players-page-intro__icon flex size-11 shrink-0 items-center justify-center rounded-2xl bg-sky-500/10 text-sky-700 dark:text-sky-300">
        <Users className="h-5 w-5" aria-hidden />
      </span>
      <div>
        <h1 className="page-title">Registered Players</h1>
        <p className="caption mt-0.5 max-w-xl">
          Your player roster — search, filter by session, and manage profiles in one place.
        </p>
      </div>
    </div>
  );
}
