"use client";

import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, Loader2, ScrollText } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

import { SystemLogsPanel } from "@/components/insights/system-logs-panel";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function ErrorLogsPageClient() {
  const router = useRouter();
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["error-logs-access"],
    queryFn: async () => {
      const response = await fetch("/api/insights/system-logs?limit=1");
      if (response.status === 403) {
        throw new Error("forbidden");
      }
      if (!response.ok) {
        const payload = (await response.json()) as { message?: string };
        throw new Error(payload.message ?? "Failed to load error logs.");
      }
      return true;
    },
    retry: false,
  });

  useEffect(() => {
    if (isError && error instanceof Error && error.message === "forbidden") {
      router.replace("/");
    }
  }, [error, isError, router]);

  if (isLoading) {
    return (
      <main className="min-h-screen px-6 py-6 lg:px-10">
        <section className="mx-auto flex max-w-7xl flex-col gap-4">
          <p className="flex items-center gap-2 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            Loading error logs…
          </p>
        </section>
      </main>
    );
  }

  if (isError && error instanceof Error && error.message === "forbidden") {
    return null;
  }

  if (isError || !data) {
    return (
      <main className="min-h-screen px-6 py-6 lg:px-10">
        <section className="mx-auto flex max-w-7xl flex-col gap-4">
          <p className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="h-4 w-4" aria-hidden />
            Failed to load error logs.
          </p>
        </section>
      </main>
    );
  }

  return (
    <main className="min-h-screen px-6 py-6 lg:px-10">
      <section className="mx-auto flex max-w-7xl flex-col gap-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <ScrollText className="h-6 w-6 text-primary" aria-hidden />
              <h1 className="section-title text-3xl">Error Logs</h1>
            </div>
            <p className="max-w-3xl text-sm text-muted-foreground">
              Production errors from the browser and server with developer analysis (priority,
              summary, and fix suggestions). Only superadmins can view this page. Logs are retained
              for about 30 days.
            </p>
          </div>
          <Link href="/insights" className={cn(buttonVariants({ variant: "outline", size: "sm" }))}>
            Back to Insights
          </Link>
        </div>

        <SystemLogsPanel
          title="Recent errors"
          description="Production errors with developer triage: priority, summary, and suggested next steps."
          queryKey="error-logs"
          defaultLevelFilter="error"
        />
      </section>
    </main>
  );
}
