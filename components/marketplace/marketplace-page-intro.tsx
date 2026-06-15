"use client";

import { ArrowLeft, Store } from "lucide-react";
import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function MarketplacePageIntro() {
  return (
    <div className="marketplace-page-intro flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
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
          <span className="marketplace-page-intro__icon flex size-11 shrink-0 items-center justify-center rounded-2xl bg-amber-500/10 text-amber-700 dark:text-amber-300">
            <Store className="h-5 w-5" aria-hidden />
          </span>
          <div>
            <h1 className="page-title">Marketplace</h1>
            <p className="caption mt-0.5 max-w-xl">
              List pickleball gear and equipment for sale — create, update, and manage your listings.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
