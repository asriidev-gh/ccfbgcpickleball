"use client";

import { ChevronLeft, ChevronRight, Loader2, Search } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { PlayerAvatar } from "@/components/game/player-avatar";
import { QrUploadProfileSection } from "@/components/register/qr-upload-profile-section";
import type {
  QrUploadProfileField,
  QrUploadProfileFormValues,
} from "@/lib/qr-upload-profile-shared";
import { useNavigateToSpectate } from "@/components/register/use-navigate-to-spectate";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getPublicErrorMessage, shouldSuppressUserNotification } from "@/lib/infrastructure-error";
import {
  persistActiveQueueHighlight,
  setQueueHighlightPlayerId,
} from "@/lib/queue-highlight";
import {
  NAME_SEARCH_MIN_QUERY_LENGTH,
  type NameSearchPlayerItem,
  type NameSearchPlayersPage,
} from "@/lib/register-name-search-check-in-shared";
import {
  ALREADY_REGISTERED_MESSAGE,
  CHECKED_OUT_RE_REGISTER_MESSAGE,
} from "@/lib/registration-messages";
import { toastOperationError } from "@/lib/toast-error";
import { cn } from "@/lib/utils";

const PAGE_SIZE = 10;

const emptyProfileForm = (): QrUploadProfileFormValues => ({
  gender: "",
  birthdate: "",
  pickleballLevel: "",
});

function queueStatusLabel(status: NameSearchPlayerItem["queueStatus"]) {
  switch (status) {
    case "queued":
      return "In queue";
    case "on_court":
      return "On court";
    case "done":
      return "Played";
    case "checked_out":
      return "Checked out";
    default:
      return null;
  }
}

async function fetchNameSearchPlayers(gameId: string, page: number, search: string) {
  const params = new URLSearchParams({
    gameId,
    page: String(page),
    pageSize: String(PAGE_SIZE),
  });
  if (search) params.set("q", search);

  const response = await fetch(`/api/register/name-search?${params.toString()}`);
  const payload = (await response.json()) as NameSearchPlayersPage & { message?: string };
  if (!response.ok) throw new Error(payload.message ?? "Failed to search players.");
  return payload;
}

type NameSearchCheckInFlowProps = {
  gameId: string;
  onBack: () => void;
};

export function NameSearchCheckInFlow({ gameId, onBack }: NameSearchCheckInFlowProps) {
  const { navigateToSpectate, navigating } = useNavigateToSpectate(gameId);
  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [data, setData] = useState<NameSearchPlayersPage | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [checkingInPlayerId, setCheckingInPlayerId] = useState<string | null>(null);
  const [profilePrompt, setProfilePrompt] = useState<{
    player: NameSearchPlayerItem;
    missingFields: QrUploadProfileField[];
  } | null>(null);
  const [profileForm, setProfileForm] = useState<QrUploadProfileFormValues>(emptyProfileForm);
  const [profileErrors, setProfileErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setSearchQuery(searchInput.trim());
      setPage(1);
    }, 300);
    return () => window.clearTimeout(timer);
  }, [searchInput]);

  useEffect(() => {
    let cancelled = false;

    if (searchQuery.length < NAME_SEARCH_MIN_QUERY_LENGTH) {
      setData(null);
      setError(null);
      setLoading(false);
      return;
    }

    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const result = await fetchNameSearchPlayers(gameId, page, searchQuery);
        if (!cancelled) setData(result);
      } catch (loadError) {
        if (cancelled) return;
        setData(null);
        if (!shouldSuppressUserNotification(loadError)) {
          setError(getPublicErrorMessage(loadError, "Failed to search players."));
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, [gameId, page, searchQuery]);

  const goToSpectatorView = async (playerId: string) => {
    setQueueHighlightPlayerId(gameId, playerId);
    persistActiveQueueHighlight(gameId, playerId);
    await navigateToSpectate({ applyQueueHighlight: false });
  };

  const handleReenter = async (playerId: string) => {
    if (checkingInPlayerId || navigating) return;
    setCheckingInPlayerId(playerId);
    try {
      await goToSpectatorView(playerId);
    } finally {
      setCheckingInPlayerId(null);
    }
  };

  const handleCheckIn = async (player: NameSearchPlayerItem, withProfile = false) => {
    if (!player.canCheckIn || checkingInPlayerId || navigating) return;

    if (withProfile) {
      const errors: Record<string, string> = {};
      if (profilePrompt?.missingFields.includes("gender") && !profileForm.gender) {
        errors.gender = "Select your gender.";
      }
      if (profilePrompt?.missingFields.includes("birthdate") && !profileForm.birthdate) {
        errors.birthdate = "Enter your birthdate.";
      }
      if (profilePrompt?.missingFields.includes("pickleballLevel") && !profileForm.pickleballLevel) {
        errors.pickleballLevel = "Select your self-rate level.";
      }
      setProfileErrors(errors);
      const firstError = Object.values(errors)[0];
      if (firstError) {
        toast.error(firstError);
        return;
      }
    }

    setCheckingInPlayerId(player.id);
    try {
      const response = await fetch("/api/register/name-search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          gameId,
          playerId: player.id,
          ...(withProfile ? { profile: profileForm } : {}),
        }),
      });
      const payload = (await response.json()) as {
        message?: string;
        playerId?: string;
        alreadyRegistered?: boolean;
        checkedOut?: boolean;
        needsProfileCompletion?: boolean;
        missingFields?: QrUploadProfileField[];
        player?: { _id?: string };
      };

      if (!response.ok) {
        if (payload.needsProfileCompletion && payload.missingFields?.length) {
          setProfileForm(emptyProfileForm());
          setProfileErrors({});
          setProfilePrompt({ player, missingFields: payload.missingFields });
          return;
        }
        if (payload.checkedOut) {
          toast.error(payload.message ?? CHECKED_OUT_RE_REGISTER_MESSAGE);
          return;
        }
        if (payload.alreadyRegistered) {
          toast.info(payload.message ?? ALREADY_REGISTERED_MESSAGE);
          const existingId = payload.player?._id ?? player.id;
          await goToSpectatorView(existingId);
          return;
        }
        throw new Error(payload.message ?? "Failed to check in player.");
      }

      toast.success(payload.message ?? "Welcome back! Added to queue.");
      await goToSpectatorView(payload.playerId ?? player.id);
    } catch (checkInError) {
      toastOperationError(checkInError, "Failed to check in player.");
    } finally {
      setCheckingInPlayerId(null);
    }
  };

  const totalPages = data?.totalPages ?? 0;
  const total = data?.total ?? 0;
  const queryTooShort = searchQuery.length < NAME_SEARCH_MIN_QUERY_LENGTH;
  const showInitialLoading = loading && !data;
  const busy = checkingInPlayerId !== null || navigating;

  if (profilePrompt) {
    const { player: promptPlayer, missingFields } = profilePrompt;
    const canSubmit = missingFields.every((field) => Boolean(profileForm[field]));

    return (
      <div className="space-y-4">
        <Button
          type="button"
          variant="outline"
          className="register-back"
          onClick={() => setProfilePrompt(null)}
          disabled={busy}
        >
          ← Back
        </Button>

        <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm">
          Welcome back, <span className="font-medium">{promptPlayer.name}</span>!
        </div>

        <QrUploadProfileSection
          values={profileForm}
          fieldErrors={profileErrors}
          disabled={busy}
          fields={missingFields}
          onChange={(patch) => setProfileForm((current) => ({ ...current, ...patch }))}
        />

        <div className="register-submit-bar">
          <Button
            type="button"
            size="lg"
            className="register-submit w-full"
            disabled={!canSubmit || busy}
            onClick={() => void handleCheckIn(promptPlayer, true)}
          >
            {busy ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
                Please wait..
              </>
            ) : (
              "Save & check in"
            )}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Button
        type="button"
        variant="outline"
        className="register-back"
        onClick={onBack}
        disabled={busy}
      >
        ← Back
      </Button>

      <div className="register-block space-y-3">
        <Label className="register-label" htmlFor="name-search-input">
          Search by name
        </Label>
        <div className="relative">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <Input
            id="name-search-input"
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
            placeholder="Enter first or last name"
            className="pl-9"
            autoComplete="off"
            autoFocus
            aria-busy={loading}
          />
          {loading ? (
            <Loader2
              className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground"
              aria-hidden
            />
          ) : null}
        </div>
        <p className="caption text-muted-foreground">
          Type at least {NAME_SEARCH_MIN_QUERY_LENGTH} characters to find your profile, then check
          in.
        </p>
      </div>

      <div
        className={cn(
          "min-h-[10rem] rounded-lg border border-border bg-muted/10 p-3 transition-opacity",
          loading && data && "opacity-70",
        )}
      >
        {queryTooShort ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            Start typing your name to search.
          </p>
        ) : showInitialLoading ? (
          <div className="flex items-center justify-center gap-2 py-12 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            Searching…
          </div>
        ) : error ? (
          <p className="py-8 text-center text-sm text-destructive">{error}</p>
        ) : data?.players.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            No players match “{searchQuery}”.
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {data?.players.map((player) => {
              const statusLabel = queueStatusLabel(player.queueStatus);
              const isCheckingIn = checkingInPlayerId === player.id;
              const canReenter = !player.canCheckIn && player.queueStatus !== "checked_out";

              return (
                <li
                  key={player.id}
                  className="flex items-center gap-4 rounded-lg border border-border bg-card p-3.5"
                >
                  <PlayerAvatar
                    player={{
                      _id: player.id,
                      firstName: player.firstName,
                      lastName: player.lastName,
                      photoUrl: player.photoUrl,
                      photoPublicId: player.photoPublicId,
                    }}
                    size="lg"
                    className="size-16 sm:size-[4.5rem]"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-lg font-semibold leading-snug sm:text-xl">
                      {player.name}
                    </p>
                    {statusLabel ? (
                      <div className="mt-1.5">
                        <Badge variant="secondary" className="text-xs">
                          {statusLabel}
                        </Badge>
                      </div>
                    ) : null}
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    variant={player.canCheckIn || canReenter ? "default" : "outline"}
                    className={cn(
                      "shrink-0",
                      !player.canCheckIn && !canReenter && "pointer-events-none opacity-60",
                    )}
                    disabled={(!player.canCheckIn && !canReenter) || busy}
                    onClick={() =>
                      canReenter
                        ? void handleReenter(player.id)
                        : void handleCheckIn(player)
                    }
                  >
                    {isCheckingIn || (navigating && checkingInPlayerId === player.id) ? (
                      <>
                        <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" aria-hidden />
                        {canReenter ? "Opening…" : "Checking in…"}
                      </>
                    ) : player.canCheckIn ? (
                      "Check in"
                    ) : canReenter ? (
                      "Go to game"
                    ) : (
                      "Already in"
                    )}
                  </Button>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {totalPages > 1 ? (
        <div className="flex items-center justify-between">
          <p className="text-xs text-muted-foreground">
            Page {page} of {totalPages} · {total} players
          </p>
          <div className="flex items-center gap-1">
            <Button
              type="button"
              size="icon"
              variant="outline"
              className="h-8 w-8"
              disabled={page <= 1 || loading || busy}
              onClick={() => setPage((current) => Math.max(1, current - 1))}
              aria-label="Previous page"
            >
              <ChevronLeft className="h-4 w-4" aria-hidden />
            </Button>
            <Button
              type="button"
              size="icon"
              variant="outline"
              className="h-8 w-8"
              disabled={page >= totalPages || loading || busy}
              onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
              aria-label="Next page"
            >
              <ChevronRight className="h-4 w-4" aria-hidden />
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
