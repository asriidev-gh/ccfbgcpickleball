"use client";

import { useQuery } from "@tanstack/react-query";

import type { SystemFeaturesState } from "@/lib/system-features-shared";

export const systemFeaturesQueryKey = ["system-features"] as const;

type SystemFeaturesResponse = {
  features: SystemFeaturesState;
  isSuperAdmin: boolean;
};

async function fetchSystemFeatures() {
  const response = await fetch("/api/system-features");
  if (!response.ok) {
    throw new Error("Failed to load feature settings.");
  }
  return (await response.json()) as SystemFeaturesResponse;
}

export function useSystemFeatures() {
  return useQuery({
    queryKey: systemFeaturesQueryKey,
    queryFn: fetchSystemFeatures,
    staleTime: 60_000,
  });
}

export function useQuickGameFeatureEnabled() {
  const { data, isLoading } = useSystemFeatures();
  return {
    enabled: data?.features.quickGame === true,
    isLoading,
    isSuperAdmin: data?.isSuperAdmin ?? false,
  };
}
