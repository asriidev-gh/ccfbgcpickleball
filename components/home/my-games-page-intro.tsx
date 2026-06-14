"use client";

import { ArrowLeft, LayoutGrid } from "lucide-react";
import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function MyGamesPageIntro() {
  return (
    <div className="my-games-page-intro flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
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
      </div>
    </div>
  );
}
