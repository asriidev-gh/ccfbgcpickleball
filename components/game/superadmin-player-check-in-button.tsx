"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import { Loader2, UserRoundCheck } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { buildSuperadminPlayerCheckInUrl } from "@/lib/browser-origin";
import { cn } from "@/lib/utils";

type SuperadminPlayerCheckInButtonProps = {
  gameId: string;
  playerId: string;
  playerName?: string;
  size?: "default" | "sm" | "lg" | "icon";
  variant?: "default" | "outline" | "secondary" | "ghost";
  className?: string;
  compact?: boolean;
};

export function SuperadminPlayerCheckInButton({
  gameId,
  playerId,
  playerName,
  size = "sm",
  variant = "outline",
  className,
  compact = false,
}: SuperadminPlayerCheckInButtonProps) {
  const { data: authData } = useQuery({
    queryKey: ["auth-me"],
    queryFn: async () => {
      const response = await fetch("/api/auth/me");
      const payload = (await response.json()) as {
        user: { isSuperAdmin?: boolean } | null;
      };
      if (!response.ok) return { user: null };
      return payload;
    },
    staleTime: 60_000,
  });

  const checkInMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch(`/api/games/${gameId}/superadmin-player-check-in`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ playerId }),
      });
      const payload = (await response.json()) as { token?: string; message?: string };
      if (!response.ok || !payload.token) {
        throw new Error(payload.message ?? "Failed to open player view.");
      }
      return payload;
    },
    onSuccess: (payload) => {
      window.open(
        buildSuperadminPlayerCheckInUrl(gameId, payload.token!),
        "_blank",
        "noopener,noreferrer",
      );
      toast.success(payload.message ?? "Opening player view in a new tab.");
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Failed to open player view.");
    },
  });

  if (!authData?.user?.isSuperAdmin || !playerId) return null;

  const label = checkInMutation.isPending ? "Opening…" : "Check in as player";
  const ariaLabel = playerName
    ? `${label} — ${playerName}`
    : label;

  return (
    <Button
      type="button"
      size={size}
      variant={variant}
      className={cn(
        compact &&
          "h-7 min-h-7 gap-0.5 px-2 text-[11px] leading-tight xl:h-9 xl:min-h-9 xl:px-3 xl:text-sm",
        className,
      )}
      disabled={checkInMutation.isPending}
      aria-label={ariaLabel}
      onClick={() => checkInMutation.mutate()}
    >
      {checkInMutation.isPending ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin xl:h-4 xl:w-4" aria-hidden />
      ) : (
        <UserRoundCheck className="h-3.5 w-3.5 shrink-0 xl:h-4 xl:w-4" aria-hidden />
      )}
      <span className={cn(compact ? "hidden sm:inline" : undefined, !compact && "ml-2")}>
        {label}
      </span>
    </Button>
  );
}
