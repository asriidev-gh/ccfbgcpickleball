"use client";

import { ArrowLeft, Building2 } from "lucide-react";
import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function MyClubPageIntro() {
  return (
    <div className="my-club-page-intro flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
      <div className="space-y-2">
        <Link
          href="/"
          className={cn(
            buttonVariants({ variant: "ghost" }),
            "h-9 gap-2 px-2 text-muted-foreground hover:text-foreground",
          )}
        >
          <ArrowLeft className="h-4 w-4" aria-hidden />
          Back to dashboard
        </Link>
        <div className="flex items-center gap-3">
          <span className="my-club-page-intro__icon flex size-11 shrink-0 items-center justify-center rounded-2xl bg-violet-500/10 text-violet-700 dark:text-violet-300">
            <Building2 className="h-5 w-5" aria-hidden />
          </span>
          <div>
            <h1 className="page-title">My Club</h1>
            <p className="caption mt-0.5 max-w-xl">
              Your club hub — profile, announcements, D-group follow-ups, and prayer requests in one place.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
