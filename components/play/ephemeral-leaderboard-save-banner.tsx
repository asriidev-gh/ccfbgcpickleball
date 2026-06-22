"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Cloud, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { beginEphemeralQuickGameSaveToAccount } from "@/lib/ephemeral-quick-game-transfer";
import {
  dismissEphemeralLeaderboardSaveForSession,
  isEphemeralLeaderboardSaveDismissedForSession,
} from "@/lib/ephemeral-leaderboard-save-prompt";
import type { OperatorFullPayload } from "@/lib/operator-payload";
import { WIZARD_OUTLINE_BUTTON_BORDER } from "@/lib/wizard-field-styles";
import { cn } from "@/lib/utils";

type EphemeralLeaderboardSaveBannerProps = {
  gameId: string;
  payload: OperatorFullPayload;
  className?: string;
};

export function EphemeralLeaderboardSaveBanner({
  gameId,
  payload: _payload,
  className,
}: EphemeralLeaderboardSaveBannerProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [visible, setVisible] = useState(false);
  const [saving, setSaving] = useState(false);

  const { data: authData, isLoading: authLoading } = useQuery({
    queryKey: ["auth-me"],
    queryFn: async () => {
      const response = await fetch("/api/auth/me");
      if (!response.ok) return { user: null };
      return (await response.json()) as { user: unknown | null };
    },
    staleTime: 60_000,
  });

  useEffect(() => {
    if (authLoading || authData?.user) {
      setVisible(false);
      return;
    }
    if (isEphemeralLeaderboardSaveDismissedForSession(gameId)) {
      setVisible(false);
      return;
    }
    setVisible(true);
  }, [authData?.user, authLoading, gameId]);

  const handleSignUpNow = async () => {
    setSaving(true);
    try {
      await beginEphemeralQuickGameSaveToAccount({
        gameId,
        queryClient,
        router,
        endAfterSave: true,
      });
    } finally {
      setSaving(false);
    }
  };

  if (!visible) return null;

  return (
    <section
      className={cn(
        "ephemeral-leaderboard-save-banner glass-panel rounded-2xl border border-primary/30 shadow-sm",
        className,
      )}
      aria-label="Save results to the cloud"
    >
      <div className="p-5 sm:p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:gap-5">
        <div
          className="flex size-11 shrink-0 items-center justify-center rounded-xl border border-primary/25 bg-primary/10"
          aria-hidden
        >
          <Cloud className="size-5 text-primary" />
        </div>
        <div className="min-w-0 flex-1 space-y-3">
          <div className="space-y-1">
            <h2 className="text-lg font-semibold text-foreground">Save results to the cloud!</h2>
            <p className="text-sm leading-relaxed text-muted-foreground">
              So stats carry over to future sessions, and players can view their own leaderboard.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" size="lg" disabled={saving} onClick={() => void handleSignUpNow()}>
              {saving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
                  Signing up…
                </>
              ) : (
                "Sign up now!"
              )}
            </Button>
            <Button
              type="button"
              variant="outline"
              size="lg"
              className={WIZARD_OUTLINE_BUTTON_BORDER}
              disabled={saving}
              onClick={() => {
                dismissEphemeralLeaderboardSaveForSession(gameId);
                setVisible(false);
              }}
            >
              Maybe later
            </Button>
          </div>
        </div>
      </div>
      <div className="mt-3 flex justify-end border-t border-border/60 pt-3">
        <button
          type="button"
          className="text-xs text-muted-foreground transition-colors hover:text-foreground"
          disabled={saving}
          onClick={() => {
            dismissEphemeralLeaderboardSaveForSession(gameId);
            setVisible(false);
          }}
        >
          Don&apos;t show again
        </button>
      </div>
      </div>
    </section>
  );
}
