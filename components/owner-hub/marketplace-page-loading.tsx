import { Store } from "lucide-react";

import { OwnerHubNav } from "@/components/owner-hub-nav";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export function MarketplacePageLoading() {
  return (
    <main className="marketplace-page min-h-screen px-6 py-6 pb-[calc(4.75rem+env(safe-area-inset-bottom))] lg:px-10 lg:pb-6">
      <section className="mx-auto flex max-w-7xl flex-col gap-6">
        <div className="marketplace-page-intro flex flex-col gap-4">
          <Skeleton className="h-9 w-40" />
          <div className="flex items-center gap-3">
            <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-amber-500/10 text-amber-700 dark:text-amber-300">
              <Store className="h-5 w-5" aria-hidden />
            </span>
            <div className="space-y-2">
              <h1 className="page-title">Marketplace</h1>
              <Skeleton className="h-4 w-72 max-w-full" />
            </div>
          </div>
        </div>
        <OwnerHubNav />
        <Card className="glass-panel">
          <CardContent className="space-y-4 p-4 sm:p-5">
            <Skeleton className="h-10 w-32" />
            <Skeleton className="h-40 w-full rounded-2xl" />
            <Skeleton className="h-40 w-full rounded-2xl" />
          </CardContent>
        </Card>
      </section>
    </main>
  );
}
