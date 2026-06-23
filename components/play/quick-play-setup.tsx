"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import {
  QuickPlayFormatStep,
  QuickPlayPlayersStep,
  QuickPlayPreviewStep,
  QuickPlayWizardHeader,
} from "@/components/play/quick-play-wizard-steps";
import { EphemeralSessionsPanel } from "@/components/play/ephemeral-sessions-panel";
import { Button } from "@/components/ui/button";
import { useActiveEphemeralSessions } from "@/hooks/use-active-ephemeral-sessions";
import { createEphemeralQuickGameId, getQuickGameDashboardPath } from "@/lib/local-game-id";
import { createLocalLiveQueueSession } from "@/lib/local-game-session";
import { seedLocalGameOperatorCache } from "@/lib/operator-game-cache";
import {
  formatOpenPlayTimeRange,
  getTodayOpenPlayDateInputValue,
  type OpenPlayMeridiem,
} from "@/lib/open-play-time-range";
import {
  defaultOpenPlayTitle,
  isFixedOpenPlayType,
  isMixedOpenPlayType,
  type PlayerOpenPlayLevel,
} from "@/lib/open-play-types";
import {
  findFirstPlayerNameTooLongIndex,
  findFirstPlayerNameWithInvalidCharactersIndex,
  playerDisplayNameInvalidCharacterMessage,
  playerDisplayNameTooLongMessage,
} from "@/lib/player-profile-shared";
import {
  clearEphemeralQuickGameSessions,
  initializeQuickGameSession,
  writeQuickGamePayload,
} from "@/lib/quick-game-store";
import {
  DEFAULT_PLAYER_OPEN_PLAY_LEVEL,
  MAX_QUICK_PLAY_PLAYERS,
  MIN_EXPECTED_PLAYERS,
  QUICK_PLAY_TOTAL_STEPS,
  createQuickPlayWizardPlayerEntry,
  findFirstMissingQuickPlayPlayerGenderIndex,
  findLastDuplicateQuickPlayPlayerNameIndex,
  getMinExpectedPlayersForGameMode,
  resolvePlayerOpenPlayLevel,
  syncQuickPlayWizardPlayerEntryCount,
  type QuickPlayWizardFormFields,
  type QuickPlayWizardPlayerEntry,
} from "@/lib/quick-play-wizard-shared";
import { WIZARD_OUTLINE_BUTTON_BORDER, WIZARD_PRIMARY_FIELDS_SCOPE } from "@/lib/wizard-field-styles";
import { cn } from "@/lib/utils";

const BROWSER_ONLY_PREVIEW_NOTE =
  "This session stays in this browser only. Sign in from My Games if you want sessions saved to your account.";

function createInitialForm(): QuickPlayWizardFormFields {
  return {
    title: "",
    openPlayType: "Beginner",
    courtCount: 2,
    expectedPlayers: MIN_EXPECTED_PLAYERS,
    gameMode: "doubles",
    matchingType: "auto-balanced",
  };
}

function getDefaultOpenPlayTimeRange() {
  return formatOpenPlayTimeRange("7", "PM" as OpenPlayMeridiem, "10", "PM" as OpenPlayMeridiem);
}

export function QuickPlaySetup() {
  const router = useRouter();
  const pathname = usePathname();
  const queryClient = useQueryClient();
  const { hasActiveSession } = useActiveEphemeralSessions();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [playerEntries, setPlayerEntries] = useState<QuickPlayWizardPlayerEntry[]>(() => [
    createQuickPlayWizardPlayerEntry(1),
  ]);
  const [defaultCheckInAllPlayers, setDefaultCheckInAllPlayers] = useState(true);
  const [allowManualPlayerAdd, setAllowManualPlayerAdd] = useState(false);
  const [allowManualCourtAdd, setAllowManualCourtAdd] = useState(false);
  const [form, setForm] = useState<QuickPlayWizardFormFields>(createInitialForm);

  useEffect(() => {
    if (pathname !== "/play") return;
    setStep(1);
    setLoading(false);
    setPlayerEntries([createQuickPlayWizardPlayerEntry(1, DEFAULT_PLAYER_OPEN_PLAY_LEVEL)]);
    setDefaultCheckInAllPlayers(true);
    setAllowManualPlayerAdd(false);
    setAllowManualCourtAdd(false);
    setForm(createInitialForm());
  }, [pathname]);

  const sessionLockedPlayerLevel = isFixedOpenPlayType(form.openPlayType) ? form.openPlayType : null;

  const filledPlayers = useMemo(
    () =>
      playerEntries
        .map((entry) => ({
          displayName: entry.name.trim(),
          gender: entry.gender,
          openPlayLevel: sessionLockedPlayerLevel ?? resolvePlayerOpenPlayLevel(entry.openPlayLevel),
        }))
        .filter((entry) => entry.displayName.length > 0),
    [playerEntries, sessionLockedPlayerLevel],
  );
  const playersForSubmit = useMemo(
    () =>
      filledPlayers.filter(
        (player): player is {
          displayName: string;
          gender: "male" | "female";
          openPlayLevel: PlayerOpenPlayLevel;
        } => player.gender === "male" || player.gender === "female",
      ),
    [filledPlayers],
  );
  const duplicatePlayerNameIndex = useMemo(
    () => findLastDuplicateQuickPlayPlayerNameIndex(playerEntries),
    [playerEntries],
  );
  const missingGenderIndex = useMemo(
    () => findFirstMissingQuickPlayPlayerGenderIndex(playerEntries),
    [playerEntries],
  );
  const tooLongPlayerNameIndex = useMemo(
    () => findFirstPlayerNameTooLongIndex(playerEntries),
    [playerEntries],
  );
  const invalidPlayerNameIndex = useMemo(
    () => findFirstPlayerNameWithInvalidCharactersIndex(playerEntries),
    [playerEntries],
  );
  const hasDuplicatePlayerNames = duplicatePlayerNameIndex !== null;
  const hasMissingPlayerGender = missingGenderIndex !== null;
  const hasPlayerNameTooLong = tooLongPlayerNameIndex !== null;
  const hasInvalidPlayerName = invalidPlayerNameIndex !== null;
  const canAddMorePlayers = playerEntries.length < MAX_QUICK_PLAY_PLAYERS;
  const sessionTitle = form.title.trim() || defaultOpenPlayTitle(form.openPlayType);

  const minExpectedPlayers = getMinExpectedPlayersForGameMode(form.gameMode);

  const canGoNext = () => {
    if (step === 1) {
      if (hasActiveSession) return false;
      return (
        form.courtCount >= 1 &&
        form.expectedPlayers >= minExpectedPlayers &&
        form.expectedPlayers <= MAX_QUICK_PLAY_PLAYERS
      );
    }
    if (step === 2) {
      return (
        filledPlayers.length >= minExpectedPlayers &&
        filledPlayers.length <= MAX_QUICK_PLAY_PLAYERS &&
        !hasDuplicatePlayerNames &&
        !hasMissingPlayerGender &&
        !hasPlayerNameTooLong &&
        !hasInvalidPlayerName &&
        playersForSubmit.length === filledPlayers.length
      );
    }
    return true;
  };

  const goNext = () => {
    if (!canGoNext()) {
      if (step === 1 && hasActiveSession) {
        toast.error("End your active session before starting a new one.");
      } else if (step === 1) {
        if (form.expectedPlayers < minExpectedPlayers) {
          toast.error(`Expected players must be at least ${minExpectedPlayers}.`);
        } else if (form.expectedPlayers > MAX_QUICK_PLAY_PLAYERS) {
          toast.error(`You can add up to ${MAX_QUICK_PLAY_PLAYERS} players.`);
        }
      } else if (step === 2) {
        if (hasPlayerNameTooLong) toast.error(playerDisplayNameTooLongMessage());
        else if (hasInvalidPlayerName) toast.error(playerDisplayNameInvalidCharacterMessage());
        else if (hasDuplicatePlayerNames) toast.error("Each player name must be unique.");
        else if (hasMissingPlayerGender) toast.error("Select a gender for each player.");
        else if (filledPlayers.length < minExpectedPlayers) {
          toast.error(`Enter at least ${minExpectedPlayers} players for ${form.gameMode} play.`);
        } else if (filledPlayers.length > MAX_QUICK_PLAY_PLAYERS) {
          toast.error(`You can add up to ${MAX_QUICK_PLAY_PLAYERS} players.`);
        } else toast.error("Enter at least one player name.");
      }
      return;
    }

    if (step === 1) {
      const openPlayLevel = sessionLockedPlayerLevel ?? DEFAULT_PLAYER_OPEN_PLAY_LEVEL;
      setPlayerEntries((prev) =>
        syncQuickPlayWizardPlayerEntryCount(prev, form.expectedPlayers, openPlayLevel),
      );
    }
    setStep((prev) => Math.min(QUICK_PLAY_TOTAL_STEPS, prev + 1));
  };

  const submit = async () => {
    if (hasActiveSession) {
      toast.error("End your active session before starting a new one.");
      setStep(1);
      return;
    }

    if (playersForSubmit.length < minExpectedPlayers) {
      toast.error(`Enter at least ${minExpectedPlayers} players for ${form.gameMode} play.`);
      setStep(2);
      return;
    }

    try {
      setLoading(true);
      clearEphemeralQuickGameSessions();
      const gameId = createEphemeralQuickGameId();
      const session = createLocalLiveQueueSession({
        gameId,
        title: sessionTitle,
        openPlayType: form.openPlayType,
        openPlayDate: getTodayOpenPlayDateInputValue(),
        openPlayTimeRange: getDefaultOpenPlayTimeRange(),
        venueName: "",
        venueAddress: "",
        venueGoogleMapEmbedUrl: "",
        courtCount: form.courtCount,
        expectedPlayers: playersForSubmit.length,
        allowQrRegistration: false,
        allowManualPlayerAdd,
        allowManualCourtAdd,
        players: playersForSubmit,
        checkInAllPlayers: defaultCheckInAllPlayers,
        gameMode: form.gameMode,
        matchingType: form.matchingType,
      });

      initializeQuickGameSession(gameId, session);
      writeQuickGamePayload(gameId, session);
      seedLocalGameOperatorCache(queryClient, gameId);
      toast.success(
        `Session started.${playersForSubmit.length > 0 ? ` ${playersForSubmit.length} players added.` : ""}`,
      );
      router.push(getQuickGameDashboardPath(gameId));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to start session.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className={cn(
        "quick-play-setup mx-auto flex w-full max-w-2xl flex-col gap-6",
        WIZARD_PRIMARY_FIELDS_SCOPE,
      )}
    >
      {step === 1 ? <EphemeralSessionsPanel /> : null}

      <div className="space-y-3">
        <QuickPlayWizardHeader step={step} />
        <p className="text-sm text-muted-foreground">
          Run open play in your browser — no account required. Nothing is saved to our servers; data
          disappears when you close this browser tab.
        </p>
      </div>

      {step === 1 ? (
        <QuickPlayFormatStep
          idPrefix="quick-play"
          form={form}
          onFormChange={(patch) =>
            setForm((prev) => {
              const next = { ...prev, ...patch };
              if (patch.gameMode) {
                const minPlayers = getMinExpectedPlayersForGameMode(patch.gameMode);
                if (next.expectedPlayers < minPlayers) {
                  next.expectedPlayers = minPlayers;
                }
              }
              return next;
            })
          }
          onOpenPlayTypeChange={(openPlayType) => {
            setForm((prev) => ({ ...prev, openPlayType }));
            if (isFixedOpenPlayType(openPlayType)) {
              setPlayerEntries((prev) =>
                prev.map((entry) => ({ ...entry, openPlayLevel: openPlayType })),
              );
              return;
            }
            if (openPlayType === "Any Level Open Play" || isMixedOpenPlayType(openPlayType)) {
              setPlayerEntries((prev) =>
                prev.map((entry) => ({
                  ...entry,
                  openPlayLevel: resolvePlayerOpenPlayLevel(entry.openPlayLevel),
                })),
              );
            }
          }}
        />
      ) : null}

      {step === 2 ? (
        <QuickPlayPlayersStep
          idPrefix="quick-play"
          openPlayType={form.openPlayType}
          sessionLockedPlayerLevel={sessionLockedPlayerLevel}
          playerEntries={playerEntries}
          setPlayerEntries={setPlayerEntries}
          duplicatePlayerNameIndex={duplicatePlayerNameIndex}
          missingGenderIndex={missingGenderIndex}
          tooLongPlayerNameIndex={tooLongPlayerNameIndex}
          invalidPlayerNameIndex={invalidPlayerNameIndex}
          defaultCheckInAllPlayers={defaultCheckInAllPlayers}
          setDefaultCheckInAllPlayers={setDefaultCheckInAllPlayers}
          allowManualPlayerAdd={allowManualPlayerAdd}
          setAllowManualPlayerAdd={setAllowManualPlayerAdd}
          allowManualCourtAdd={allowManualCourtAdd}
          setAllowManualCourtAdd={setAllowManualCourtAdd}
          canAddMorePlayers={canAddMorePlayers}
        />
      ) : null}

      {step === 3 ? (
        <QuickPlayPreviewStep
          sessionTitle={sessionTitle}
          form={form}
          filledPlayers={playersForSubmit}
          defaultCheckInAllPlayers={defaultCheckInAllPlayers}
          allowManualPlayerAdd={allowManualPlayerAdd}
          allowManualCourtAdd={allowManualCourtAdd}
          onEditStep={setStep}
          footerNote={BROWSER_ONLY_PREVIEW_NOTE}
        />
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
        <div className="flex gap-2">
          {step > 1 ? (
            <Button
              type="button"
              variant="outline"
              className={WIZARD_OUTLINE_BUTTON_BORDER}
              onClick={() => setStep((prev) => prev - 1)}
            >
              Back
            </Button>
          ) : (
            <Button variant="ghost" nativeButton={false} render={<Link href="/login" />}>
              Sign in to save sessions
            </Button>
          )}
        </div>
        <div className="flex gap-2">
          {step < QUICK_PLAY_TOTAL_STEPS ? (
            <Button type="button" disabled={step === 1 && hasActiveSession} onClick={goNext}>
              Next
            </Button>
          ) : (
            <Button type="button" disabled={loading || hasActiveSession} onClick={() => void submit()}>
              {loading ? "Starting…" : "Start session"}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
