import { LayoutGrid, Loader2 } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export default function OwnerCourtsViewLoading() {
  return (
    <main className="my-games-page min-h-screen px-6 py-6 pb-[calc(4.75rem+env(safe-area-inset-bottom))] lg:px-10 lg:pb-6">
      <div className="mx-auto w-full max-w-7xl space-y-6">
        <div className="my-games-page-intro flex items-start gap-3">
          <span className="my-games-page-intro__icon flex size-11 shrink-0 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-700 dark:text-emerald-300">
            <LayoutGrid className="h-5 w-5" aria-hidden />
          </span>
          <div>
            <h1 className="page-title">Courts View</h1>
            <p className="caption mt-0.5 flex items-center gap-2 text-muted-foreground">
              <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
              Loading courts…
            </p>
          </div>
        </div>
        <Card className="glass-panel">
          <CardContent className="space-y-4 py-6">
            <Skeleton className="h-10 w-full max-w-md rounded-lg" />
            <Skeleton className="h-48 w-full rounded-2xl" />
            <Skeleton className="h-48 w-full rounded-2xl" />
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
