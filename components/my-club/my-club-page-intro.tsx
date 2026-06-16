"use client";

import { Building2 } from "lucide-react";

export function MyClubPageIntro() {
  return (
    <div className="my-club-page-intro flex items-start gap-3">
      <span className="my-club-page-intro__icon flex size-11 shrink-0 items-center justify-center rounded-2xl bg-violet-500/10 text-violet-700 dark:text-violet-300">
        <Building2 className="h-5 w-5" aria-hidden />
      </span>
      <div>
        <h1 className="page-title">My Club</h1>
        <p className="caption mt-0.5 max-w-xl">
          Your club hub — profile, community posts, and player follow-ups in one place.
        </p>
      </div>
    </div>
  );
}
