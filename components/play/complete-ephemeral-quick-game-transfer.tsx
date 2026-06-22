"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";
import { toast } from "sonner";

import {
  completePendingEphemeralQuickGameTransfer,
  readPendingEphemeralQuickGameTransfer,
} from "@/lib/ephemeral-quick-game-transfer";
import { getQuickGameDashboardPath } from "@/lib/local-game-id";

export function CompleteEphemeralQuickGameTransfer() {
  const queryClient = useQueryClient();
  const router = useRouter();
  const runningRef = useRef(false);

  const { data: authData } = useQuery({
    queryKey: ["auth-me"],
    queryFn: async () => {
      const response = await fetch("/api/auth/me");
      return (await response.json()) as { user: unknown | null };
    },
    staleTime: 60_000,
  });

  useEffect(() => {
    if (!authData?.user) return;
    if (!readPendingEphemeralQuickGameTransfer()) return;
    if (runningRef.current) return;

    runningRef.current = true;
    void (async () => {
      try {
        const newGameId = await completePendingEphemeralQuickGameTransfer(queryClient);
        if (newGameId) {
          toast.success("Your public session has been saved in your account.");
          router.replace(getQuickGameDashboardPath(newGameId));
        }
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Failed to save your session.");
      } finally {
        runningRef.current = false;
      }
    })();
  }, [authData?.user, queryClient, router]);

  return null;
}
