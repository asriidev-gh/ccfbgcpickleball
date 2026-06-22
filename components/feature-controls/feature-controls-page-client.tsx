"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, Loader2, ToggleLeft } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { toast } from "sonner";

import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { systemFeaturesQueryKey } from "@/hooks/use-system-features";
import type { SystemFeatureDefinition, SystemFeaturesState } from "@/lib/system-features-shared";
import { cn } from "@/lib/utils";

type FeatureControlsResponse = {
  features: SystemFeaturesState;
  definitions: SystemFeatureDefinition[];
};

export function FeatureControlsPageClient() {
  const router = useRouter();
  const queryClient = useQueryClient();

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["feature-controls"],
    queryFn: async () => {
      const response = await fetch("/api/insights/system-features");
      if (response.status === 403) {
        throw new Error("forbidden");
      }
      if (!response.ok) {
        const payload = (await response.json()) as { message?: string };
        throw new Error(payload.message ?? "Failed to load feature controls.");
      }
      return (await response.json()) as FeatureControlsResponse;
    },
    retry: false,
  });

  const updateMutation = useMutation({
    mutationFn: async ({ key, enabled }: { key: keyof SystemFeaturesState; enabled: boolean }) => {
      const response = await fetch("/api/insights/system-features", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key, enabled }),
      });
      const payload = (await response.json()) as FeatureControlsResponse & { message?: string };
      if (!response.ok) throw new Error(payload.message ?? "Failed to update feature.");
      return payload;
    },
    onSuccess: (payload) => {
      queryClient.setQueryData(["feature-controls"], payload);
      void queryClient.invalidateQueries({ queryKey: systemFeaturesQueryKey });
      toast.success("Feature setting updated.");
    },
    onError: (mutationError) => {
      toast.error(mutationError instanceof Error ? mutationError.message : "Update failed.");
    },
  });

  useEffect(() => {
    if (isError && error instanceof Error && error.message === "forbidden") {
      router.replace("/");
    }
  }, [error, isError, router]);

  if (isLoading) {
    return (
      <main className="min-h-screen px-6 py-6 lg:px-10">
        <section className="mx-auto flex max-w-3xl flex-col gap-4">
          <p className="flex items-center gap-2 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            Loading feature controls…
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
        <section className="mx-auto flex max-w-3xl flex-col gap-4">
          <p className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="h-4 w-4" aria-hidden />
            Failed to load feature controls.
          </p>
        </section>
      </main>
    );
  }

  return (
    <main className="min-h-screen px-6 py-6 lg:px-10">
      <section className="mx-auto flex max-w-3xl flex-col gap-6">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <ToggleLeft className="h-6 w-6 text-primary" aria-hidden />
            <h1 className="section-title text-3xl">Feature Controls</h1>
          </div>
          <p className="text-sm text-muted-foreground">
            Turn product features on or off for all users. Superadmins always keep access while a
            feature is off.
          </p>
          <Link href="/" className={cn(buttonVariants({ variant: "outline", size: "sm" }))}>
            Back to dashboard
          </Link>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="section-title text-xl">System features</CardTitle>
            <CardDescription>
              Changes apply immediately for signed-in users on their next page load or refresh.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {data.definitions.map((definition) => {
              const enabled = data.features[definition.key];
              const pending =
                updateMutation.isPending && updateMutation.variables?.key === definition.key;

              return (
                <label
                  key={definition.key}
                  className={cn(
                    "flex cursor-pointer items-start gap-3 rounded-xl border border-border/70 bg-muted/10 p-4",
                    pending && "opacity-70",
                  )}
                >
                  <Checkbox
                    checked={enabled}
                    disabled={pending}
                    onCheckedChange={(checked) =>
                      updateMutation.mutate({
                        key: definition.key,
                        enabled: checked === true,
                      })
                    }
                  />
                  <span className="space-y-1">
                    <span className="block text-sm font-semibold text-foreground">
                      {definition.label}
                    </span>
                    <span className="block text-sm text-muted-foreground">
                      {definition.description}
                    </span>
                    <span className="block text-xs font-medium text-muted-foreground">
                      {enabled ? "On for all users" : "Off for users (superadmins still on)"}
                    </span>
                  </span>
                </label>
              );
            })}
          </CardContent>
        </Card>
      </section>
    </main>
  );
}
