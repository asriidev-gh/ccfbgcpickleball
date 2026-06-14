"use client";

import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

import { InsightsPageLoading } from "@/components/insights/insights-page-loading";
import { InsightsView } from "@/components/insights/insights-view";
import type { UserInsights } from "@/lib/insights-shared";

export function InsightsPageClient() {
  const router = useRouter();
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["insights-overview"],
    queryFn: async () => {
      const response = await fetch("/api/insights");
      const payload = (await response.json()) as { insights?: UserInsights; message?: string };
      if (response.status === 403) {
        throw new Error("forbidden");
      }
      if (!response.ok) {
        throw new Error(payload.message ?? "Failed to load insights.");
      }
      return payload.insights as UserInsights;
    },
    retry: false,
  });

  useEffect(() => {
    if (isError && error instanceof Error && error.message === "forbidden") {
      router.replace("/");
    }
  }, [error, isError, router]);

  if (isLoading) {
    return <InsightsPageLoading />;
  }

  if (isError || !data) {
    return (
      <main className="min-h-screen px-6 py-6 lg:px-10">
        <section className="mx-auto flex max-w-7xl flex-col gap-4">
          <p className="text-sm text-destructive">
            {error instanceof Error ? error.message : "Failed to load insights."}
          </p>
        </section>
      </main>
    );
  }

  return <InsightsView insights={data} />;
}
