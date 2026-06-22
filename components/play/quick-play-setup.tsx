"use client";

import { Plus, Trash2 } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { OpenPlayTimeField } from "@/components/game/open-play-time-field";
import { EphemeralSessionsPanel } from "@/components/play/ephemeral-sessions-panel";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NumberStepper } from "@/components/ui/number-stepper";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { useActiveEphemeralSessions } from "@/hooks/use-active-ephemeral-sessions";
import { createEphemeralQuickGameId, getQuickGameDashboardPath } from "@/lib/local-game-id";
import { createLocalLiveQueueSession } from "@/lib/local-game-session";
import { seedLocalGameOperatorCache } from "@/lib/operator-game-cache";
import {
  formatOpenPlayTimeRange,
  getTodayOpenPlayDateInputValue,
  isOpenPlayTimeComplete,
  validateOpenPlayTimeOrder,
  type OpenPlayMeridiem,
} from "@/lib/open-play-time-range";
import { defaultOpenPlayTitle, OPEN_PLAY_TYPES } from "@/lib/open-play-types";
import type { GenderOption } from "@/lib/player-profile-shared";
import {
  findFirstPlayerNameTooLongIndex,
  findFirstPlayerNameWithInvalidCharactersIndex,
  MAX_PLAYER_DISPLAY_NAME_LENGTH,
  playerDisplayNameInvalidCharacterMessage,
  playerDisplayNameTooLongMessage,
  sanitizePlayerDisplayNameInput,
} from "@/lib/player-profile-shared";
import { initializeQuickGameSession, writeQuickGamePayload, clearEphemeralQuickGameSessions } from "@/lib/quick-game-store";
import { WIZARD_PLAYER_FIELD_CLASS, wizardGenderLabel } from "@/lib/wizard-player-fields";
import { cn } from "@/lib/utils";

const types = OPEN_PLAY_TYPES;
const TOTAL_STEPS = 3;

type Meridiem = OpenPlayMeridiem;

type WizardPlayerEntry = {
  name: string;
  gender: "male" | "female" | "";
};

const EMPTY_WIZARD_PLAYER: WizardPlayerEntry = { name: "", gender: "male" };

const WIZARD_PLAYER_GENDER_OPTIONS = [
  { value: "male", label: "Male" },
  { value: "female", label: "Female" },
] as const satisfies ReadonlyArray<{ value: GenderOption; label: string }>;

function normalizePlayerNameKey(name: string) {
  return name.trim().toLowerCase();
}

function findLastDuplicatePlayerNameIndex(entries: WizardPlayerEntry[]) {
  const seen = new Set<string>();
  let lastDuplicateIndex: number | null = null;

  for (let index = 0; index < entries.length; index += 1) {
    const key = normalizePlayerNameKey(entries[index]?.name ?? "");
    if (!key) continue;
    if (seen.has(key)) lastDuplicateIndex = index;
    else seen.add(key);
  }

  return lastDuplicateIndex;
}

function findFirstMissingGenderIndex(entries: WizardPlayerEntry[]) {
  for (let index = 0; index < entries.length; index += 1) {
    const name = entries[index]?.name.trim() ?? "";
    const gender = entries[index]?.gender ?? "";
    if (name && gender !== "male" && gender !== "female") return index;
  }
  return null;
}

type QuickPlayForm = {
  title: string;
  openPlayType: (typeof types)[number];
  openPlayDate: string;
  openPlayFromHour: string;
  openPlayFromMeridiem: Meridiem | "";
  openPlayToHour: string;
  openPlayToMeridiem: Meridiem | "";
  courtCount: number;
};

function createInitialForm(): QuickPlayForm {
  return {
    title: "",
    openPlayType: "Beginner",
    openPlayDate: "",
    openPlayFromHour: "7",
    openPlayFromMeridiem: "PM",
    openPlayToHour: "10",
    openPlayToMeridiem: "PM",
    courtCount: 2,
  };
}

export function QuickPlaySetup() {
  const router = useRouter();
  const pathname = usePathname();
  const queryClient = useQueryClient();
  const { hasActiveSession } = useActiveEphemeralSessions();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [playerEntries, setPlayerEntries] = useState<WizardPlayerEntry[]>([EMPTY_WIZARD_PLAYER]);
  const [defaultCheckInAllPlayers, setDefaultCheckInAllPlayers] = useState(true);
  const [allowManualPlayerAdd, setAllowManualPlayerAdd] = useState(false);
  const [form, setForm] = useState<QuickPlayForm>(createInitialForm);
  const [timeRangeError, setTimeRangeError] = useState("");

  useEffect(() => {
    if (pathname !== "/play") return;
    setStep(1);
    setLoading(false);
    setPlayerEntries([EMPTY_WIZARD_PLAYER]);
    setDefaultCheckInAllPlayers(true);
    setAllowManualPlayerAdd(false);
    setForm({
      ...createInitialForm(),
      openPlayDate: getTodayOpenPlayDateInputValue(),
    });
    setTimeRangeError("");
  }, [pathname]);

  const filledPlayers = useMemo(
    () =>
      playerEntries
        .map((entry) => ({ displayName: entry.name.trim(), gender: entry.gender }))
        .filter((entry) => entry.displayName.length > 0),
    [playerEntries],
  );
  const duplicatePlayerNameIndex = useMemo(
    () => findLastDuplicatePlayerNameIndex(playerEntries),
    [playerEntries],
  );
  const missingGenderIndex = useMemo(
    () => findFirstMissingGenderIndex(playerEntries),
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

  const getOpenPlayTimeValidation = () => {
    if (!isOpenPlayTimeComplete(form)) return null;
    return validateOpenPlayTimeOrder(
      form.openPlayFromHour,
      form.openPlayFromMeridiem as Meridiem,
      form.openPlayToHour,
      form.openPlayToMeridiem as Meridiem,
    );
  };

  const canGoNext = () => {
    if (step === 1) {
      if (hasActiveSession) return false;
      return (
        filledPlayers.length > 0 &&
        !hasDuplicatePlayerNames &&
        !hasMissingPlayerGender &&
        !hasPlayerNameTooLong &&
        !hasInvalidPlayerName &&
        filledPlayers.every((player) => player.gender === "male" || player.gender === "female")
      );
    }
    if (step === 2) {
      const validation = getOpenPlayTimeValidation();
      return Boolean(validation?.ok);
    }
    return true;
  };

  const goNext = () => {
    if (!canGoNext()) {
      if (step === 1) {
        if (hasActiveSession) {
          toast.error("End your active session before starting a new one.");
        } else if (hasPlayerNameTooLong) toast.error(playerDisplayNameTooLongMessage());
        else if (hasInvalidPlayerName) toast.error(playerDisplayNameInvalidCharacterMessage());
        else if (hasDuplicatePlayerNames) toast.error("Each player name must be unique.");
        else if (hasMissingPlayerGender) toast.error("Select a gender for each player.");
        else toast.error("Enter at least one player name.");
      } else if (step === 2) {
        const validation = getOpenPlayTimeValidation();
        const message =
          validation && !validation.ok ? validation.message : "Select from and to times.";
        setTimeRangeError(validation && !validation.ok ? validation.message : "");
        toast.error(message);
      }
      return;
    }
    if (step === 2) setTimeRangeError("");
    setStep((prev) => Math.min(TOTAL_STEPS, prev + 1));
  };

  const submit = async () => {
    if (hasActiveSession) {
      toast.error("End your active session before starting a new one.");
      setStep(1);
      return;
    }

    if (filledPlayers.length < 1) {
      toast.error("Enter at least one player name.");
      setStep(1);
      return;
    }

    if (!isOpenPlayTimeComplete(form)) {
      const message = "Select from and to times.";
      setTimeRangeError(message);
      toast.error(message);
      setStep(2);
      return;
    }

    const timeValidation = validateOpenPlayTimeOrder(
      form.openPlayFromHour,
      form.openPlayFromMeridiem as Meridiem,
      form.openPlayToHour,
      form.openPlayToMeridiem as Meridiem,
    );
    if (!timeValidation.ok) {
      setTimeRangeError(timeValidation.message);
      toast.error(timeValidation.message);
      setStep(2);
      return;
    }

    try {
      setLoading(true);
      clearEphemeralQuickGameSessions();
      const gameId = createEphemeralQuickGameId();
      const title = form.title.trim() || defaultOpenPlayTitle(form.openPlayType);
      const openPlayDate = form.openPlayDate.trim() || getTodayOpenPlayDateInputValue();
      const openPlayTimeRange = formatOpenPlayTimeRange(
        form.openPlayFromHour,
        form.openPlayFromMeridiem as Meridiem,
        form.openPlayToHour,
        form.openPlayToMeridiem as Meridiem,
      );
      const players = filledPlayers.filter(
        (player): player is { displayName: string; gender: "male" | "female" } =>
          player.gender === "male" || player.gender === "female",
      );

      const session = createLocalLiveQueueSession({
        gameId,
        title,
        openPlayType: form.openPlayType,
        openPlayDate,
        openPlayTimeRange,
        venueName: "",
        venueAddress: "",
        venueGoogleMapEmbedUrl: "",
        courtCount: form.courtCount,
        expectedPlayers: players.length,
        allowQrRegistration: false,
        allowManualPlayerAdd,
        players,
        checkInAllPlayers: defaultCheckInAllPlayers,
      });

      initializeQuickGameSession(gameId, session);
      writeQuickGamePayload(gameId, session);
      seedLocalGameOperatorCache(queryClient, gameId);
      toast.success(
        `Session started.${players.length > 0 ? ` ${players.length} players added.` : ""}`,
      );
      router.push(getQuickGameDashboardPath(gameId));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to start session.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6">
      {step === 1 ? <EphemeralSessionsPanel /> : null}

      <div className="space-y-2">
        <p className="text-sm font-medium text-muted-foreground">
          Step {step} of {TOTAL_STEPS}
        </p>
        <h1 className="page-title">Quick Play</h1>
        <p className="text-sm text-muted-foreground">
          Run open play in your browser — no account required. Nothing is saved to our servers; data
          disappears when you close this browser tab.
        </p>
      </div>

      {step === 1 ? (
        <div className="space-y-4">
          <div className="space-y-1">
            <Label className="text-base">Enter player names</Label>
            <p className="text-sm text-muted-foreground">
              One row per player with name and gender.
            </p>
          </div>
          <div
            className={cn(
              "grid items-center gap-2 text-xs font-medium text-muted-foreground",
              playerEntries.length > 1
                ? "grid-cols-[minmax(0,1fr)_minmax(0,1fr)_2.75rem]"
                : "grid-cols-[minmax(0,1fr)_minmax(0,1fr)]",
            )}
          >
            <span>Name</span>
            <span>Gender</span>
            {playerEntries.length > 1 ? <span className="sr-only">Remove</span> : null}
          </div>
          <ul className="m-0 list-none space-y-3 p-0">
            {playerEntries.map((entry, index) => {
              const isDuplicateField = duplicatePlayerNameIndex === index;
              const isMissingGenderField = missingGenderIndex === index;
              const isNameTooLongField = tooLongPlayerNameIndex === index;
              const isInvalidNameField = invalidPlayerNameIndex === index;
              const showRemoveColumn = playerEntries.length > 1;

              return (
                <li key={index} className="space-y-1">
                  <div
                    className={cn(
                      "grid items-center gap-2",
                      showRemoveColumn
                        ? "grid-cols-[minmax(0,1fr)_minmax(0,1fr)_2.75rem]"
                        : "grid-cols-[minmax(0,1fr)_minmax(0,1fr)]",
                    )}
                  >
                    <div className="min-w-0">
                      <Input
                        className={cn(
                          "h-11 min-h-11 w-full text-base",
                          WIZARD_PLAYER_FIELD_CLASS,
                          (isDuplicateField || isNameTooLongField || isInvalidNameField) &&
                            "border-destructive focus-visible:ring-destructive/30",
                        )}
                        placeholder={`Player ${index + 1} name`}
                        value={entry.name}
                        maxLength={MAX_PLAYER_DISPLAY_NAME_LENGTH}
                        aria-invalid={isDuplicateField || isNameTooLongField || isInvalidNameField}
                        onChange={(event) => {
                          const next = [...playerEntries];
                          next[index] = {
                            ...next[index],
                            name: sanitizePlayerDisplayNameInput(event.target.value),
                          };
                          setPlayerEntries(next);
                        }}
                      />
                    </div>
                    <div className="min-w-0">
                      <Select
                        value={entry.gender || null}
                        onValueChange={(value) => {
                          if (value !== "male" && value !== "female") return;
                          const next = [...playerEntries];
                          next[index] = { ...next[index], gender: value };
                          setPlayerEntries(next);
                        }}
                      >
                        <SelectTrigger
                          className={cn(
                            "h-11 min-h-11 w-full max-w-none px-2.5 py-1 text-base data-[size=default]:h-11",
                            WIZARD_PLAYER_FIELD_CLASS,
                            isMissingGenderField &&
                              "border-destructive focus-visible:ring-destructive/30",
                          )}
                          aria-invalid={isMissingGenderField}
                        >
                          {entry.gender === "male" || entry.gender === "female" ? (
                            <span className="flex flex-1 truncate text-left">
                              {wizardGenderLabel(entry.gender)}
                            </span>
                          ) : (
                            <SelectValue placeholder="Gender" />
                          )}
                        </SelectTrigger>
                        <SelectContent>
                          {WIZARD_PLAYER_GENDER_OPTIONS.map((option) => (
                            <SelectItem key={option.value} value={option.value}>
                              {option.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    {showRemoveColumn ? (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="size-11 shrink-0 text-muted-foreground hover:text-destructive"
                        aria-label={`Remove player ${index + 1}`}
                        onClick={() =>
                          setPlayerEntries((prev) => prev.filter((_, rowIndex) => rowIndex !== index))
                        }
                      >
                        <Trash2 className="h-4 w-4" aria-hidden />
                      </Button>
                    ) : null}
                  </div>
                  {isDuplicateField ? (
                    <p className="text-sm text-destructive" role="alert">
                      This name is already in the list.
                    </p>
                  ) : isMissingGenderField ? (
                    <p className="text-sm text-destructive" role="alert">
                      Select a gender for this player.
                    </p>
                  ) : null}
                </li>
              );
            })}
          </ul>
          <Button
            type="button"
            variant="outline"
            className="mt-4 w-full"
            onClick={() => setPlayerEntries((prev) => [...prev, EMPTY_WIZARD_PLAYER])}
          >
            <Plus className="mr-2 h-4 w-4" aria-hidden />
            Add more player
          </Button>
          <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-border bg-muted/30 px-4 py-3">
            <Checkbox
              checked={defaultCheckInAllPlayers}
              onCheckedChange={(checked) => setDefaultCheckInAllPlayers(checked === true)}
            />
            <span className="space-y-1 leading-snug">
              <span className="block text-sm font-medium">Default check in all players</span>
              <span className="block text-xs text-muted-foreground">
                When checked, every player starts in the active queue.
              </span>
            </span>
          </label>
          <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-border bg-muted/30 px-4 py-3">
            <Checkbox
              checked={allowManualPlayerAdd}
              onCheckedChange={(checked) => setAllowManualPlayerAdd(checked === true)}
            />
            <span className="space-y-1 leading-snug">
              <span className="block text-sm font-medium">Allow manual player add</span>
              <span className="block text-xs text-muted-foreground">
                Add more players from the game dashboard later.
              </span>
            </span>
          </label>
        </div>
      ) : null}

      {step === 2 ? (
        <div className="space-y-6">
          <div className="space-y-4">
            <Label className="text-base">Players level</Label>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {types.map((type) => (
                <Button
                  key={type}
                  variant={form.openPlayType === type ? "default" : "outline"}
                  size="sm"
                  className="min-h-12 w-full px-2 py-2.5 text-center text-sm leading-snug"
                  onClick={() => setForm((prev) => ({ ...prev, openPlayType: type }))}
                >
                  {type}
                </Button>
              ))}
            </div>
          </div>
          <Separator />
          <div className="space-y-3">
            <Label htmlFor="quick-play-title" className="text-base">
              Session title
            </Label>
            <Input
              id="quick-play-title"
              className="h-11 text-base"
              placeholder={defaultOpenPlayTitle(form.openPlayType)}
              value={form.title}
              onChange={(event) => setForm((prev) => ({ ...prev, title: event.target.value }))}
            />
          </div>
          <Separator />
          <div className="space-y-3">
            <Label htmlFor="quick-play-courts" className="text-base">
              How many courts?
            </Label>
            <NumberStepper
              id="quick-play-courts"
              min={1}
              max={20}
              value={form.courtCount}
              onChange={(courtCount) => setForm((prev) => ({ ...prev, courtCount }))}
            />
          </div>
          <Separator />
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="quick-play-date" className="text-base">
                Open play date
              </Label>
              <Input
                id="quick-play-date"
                type="date"
                className="h-11 text-base"
                value={form.openPlayDate}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, openPlayDate: event.target.value }))
                }
              />
            </div>
            <OpenPlayTimeField
              idPrefix="quickPlayFrom"
              label="From time"
              hour={form.openPlayFromHour}
              meridiem={form.openPlayFromMeridiem}
              onHourChange={(openPlayFromHour) =>
                setForm((prev) => ({ ...prev, openPlayFromHour }))
              }
              onMeridiemChange={(openPlayFromMeridiem) =>
                setForm((prev) => ({ ...prev, openPlayFromMeridiem }))
              }
            />
            <OpenPlayTimeField
              idPrefix="quickPlayTo"
              label="To time"
              hour={form.openPlayToHour}
              meridiem={form.openPlayToMeridiem}
              onHourChange={(openPlayToHour) => setForm((prev) => ({ ...prev, openPlayToHour }))}
              onMeridiemChange={(openPlayToMeridiem) =>
                setForm((prev) => ({ ...prev, openPlayToMeridiem }))
              }
            />
            {timeRangeError ? (
              <p className="text-sm text-destructive" role="alert">
                {timeRangeError}
              </p>
            ) : null}
          </div>
        </div>
      ) : null}

      {step === 3 ? (
        <div className="space-y-4 rounded-xl border border-border/70 bg-muted/20 p-4">
          <h2 className="text-base font-semibold">Ready to start</h2>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li>
              <span className="font-medium text-foreground">Players:</span> {filledPlayers.length}
            </li>
            <li>
              <span className="font-medium text-foreground">Level:</span> {form.openPlayType}
            </li>
            <li>
              <span className="font-medium text-foreground">Courts:</span> {form.courtCount}
            </li>
          </ul>
          <p className="text-xs text-muted-foreground">
            This session stays in this browser only. Sign in from My Games if you want sessions saved
            to your account.
          </p>
        </div>
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
        <div className="flex gap-2">
          {step > 1 ? (
            <Button type="button" variant="outline" onClick={() => setStep((prev) => prev - 1)}>
              Back
            </Button>
          ) : (
            <Button variant="ghost" nativeButton={false} render={<Link href="/login" />}>
              Sign in to save sessions
            </Button>
          )}
        </div>
        <div className="flex gap-2">
          {step < TOTAL_STEPS ? (
            <Button type="button" disabled={step === 1 && hasActiveSession} onClick={goNext}>
              Next
            </Button>
          ) : (
            <Button
              type="button"
              disabled={loading || hasActiveSession}
              onClick={() => void submit()}
            >
              {loading ? "Starting…" : "Start session"}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
