"use client";

import { ArrowLeft, Users } from "lucide-react";
import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function RegisteredPlayersPageIntro() {
  return (
    <div className="registered-players-page-intro flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
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
      </div>
    </div>
  );
}
