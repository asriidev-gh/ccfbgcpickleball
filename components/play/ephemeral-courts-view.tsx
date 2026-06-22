"use client";

import { ArrowLeft, LayoutGrid, Loader2 } from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { CourtsViewCourtThemeSelect } from "@/components/game/courts-view-court-theme-select";
import { OwnerSessionCourtsSection } from "@/components/home/owner-session-courts-section";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  loadCourtsViewCourtTheme,
  saveCourtsViewCourtTheme,
  type CourtsViewCourtTheme,
} from "@/lib/courts-view-court-theme";
import { operatorPayloadToCourtsViewSession } from "@/lib/local-courts-view";
import { getQuickGameDashboardPath, isEphemeralQuickGame } from "@/lib/local-game-id";
import { seedLocalGameOperatorCache } from "@/lib/operator-game-cache";
import { readQuickGamePayload, useQuickGameSession } from "@/lib/quick-game-store";
import { cn } from "@/lib/utils";

export function EphemeralCourtsView() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();
  const gameId = params.id ?? "";
  const quickSession = useQuickGameSession(gameId);
  const [courtTheme, setCourtTheme] = useState<CourtsViewCourtTheme>("classic");

  useEffect(() => {
    setCourtTheme(loadCourtsViewCourtTheme());
  }, []);

  useEffect(() => {
    if (!gameId || isEphemeralQuickGame(gameId)) return;
    router.replace("/play");
  }, [gameId, router]);

  useEffect(() => {
    if (!gameId || quickSession) return;

    const timer = window.setTimeout(() => {
      if (!readQuickGamePayload(gameId)) {
        toast.error("Session not found. Start a new quick play session.");
        router.replace("/play");
      }
    }, 750);

    return () => window.clearTimeout(timer);
  }, [gameId, quickSession, router]);

  useEffect(() => {
    if (!gameId || !quickSession) return;
    seedLocalGameOperatorCache(queryClient, gameId);
  }, [gameId, quickSession, queryClient]);

  const session = useMemo(
    () => (quickSession ? operatorPayloadToCourtsViewSession(quickSession) : null),
    [quickSession],
  );

  const handleCourtThemeChange = (nextTheme: CourtsViewCourtTheme) => {
    setCourtTheme(nextTheme);
    saveCourtsViewCourtTheme(nextTheme);
  };

  if (!isEphemeralQuickGame(gameId)) {
    return null;
  }

  if (!session) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" aria-label="Loading session" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start gap-3">
        <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-700 dark:text-emerald-300">
          <LayoutGrid className="h-5 w-5" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <h1 className="page-title">Court View</h1>
          <p className="caption mt-0.5 max-w-xl text-muted-foreground">
            Courts for your quick play session in this browser.
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <Link
          href={getQuickGameDashboardPath(gameId)}
          className={cn(buttonVariants({ variant: "outline", size: "sm" }), "inline-flex shrink-0")}
        >
          <ArrowLeft className="mr-1.5 h-4 w-4" aria-hidden />
          Game Dashboard
        </Link>
        <CourtsViewCourtThemeSelect value={courtTheme} onChange={handleCourtThemeChange} />
      </div>

      {session.status === "ended" ? (
        <Card className="glass-panel">
          <CardContent className="py-10 text-center text-muted-foreground">
            This session has ended.
          </CardContent>
        </Card>
      ) : (
        <OwnerSessionCourtsSection session={session} courtTheme={courtTheme} />
      )}
    </div>
  );
}
