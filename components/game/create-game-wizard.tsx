"use client";

import { Plus, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { OpenPlayTimeField } from "@/components/game/open-play-time-field";
import { OpenPlayTypePicker } from "@/components/game/open-play-type-picker";
import { GoogleMapEmbedDialog } from "@/components/google-map-embed-dialog";
import { useEmailVerified } from "@/components/home/email-verification-banner";
import { NumberStepper } from "@/components/ui/number-stepper";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import {
  getDefaultGameVenueForUserType,
} from "@/lib/default-game-venue";
import { useGamesList } from "@/hooks/use-games-list";
import {
  formatOpenPlayTimeRange,
  getTodayOpenPlayDateInputValue,
  isOpenPlayTimeComplete,
  validateOpenPlayTimeOrder,
  type OpenPlayMeridiem,
} from "@/lib/open-play-time-range";
import { defaultOpenPlayTitle, OPEN_PLAY_TYPES } from "@/lib/open-play-types";
import { createAccountQuickGameId } from "@/lib/local-game-id";
import { createLocalLiveQueueSession } from "@/lib/local-game-session";
import type { GenderOption } from "@/lib/player-profile-shared";
import {
  findFirstPlayerNameTooLongIndex,
  findFirstPlayerNameWithInvalidCharactersIndex,
  MAX_PLAYER_DISPLAY_NAME_LENGTH,
  playerDisplayNameInvalidCharacterMessage,
  playerDisplayNameTooLongMessage,
  sanitizePlayerDisplayNameInput,
} from "@/lib/player-profile-shared";
import { saveQuickGameSession } from "@/lib/quick-game-persistence-client";
import { initializeQuickGameSession } from "@/lib/quick-game-store";
import { WIZARD_PLAYER_FIELD_CLASS, wizardGenderLabel } from "@/lib/wizard-player-fields";
import { useUiStore } from "@/store/ui-store";
import { useQueryClient } from "@tanstack/react-query";
import { cn } from "@/lib/utils";

const types = OPEN_PLAY_TYPES;
const MIN_PRE_REGISTERED_PLAYERS = 4;

type RegistrationMode = "self" | "owner";
type Meridiem = OpenPlayMeridiem;

type CreateGameForm = {
  title: string;
  openPlayType: (typeof types)[number];
  openPlayDate: string;
  openPlayFromHour: string;
  openPlayFromMeridiem: Meridiem | "";
  openPlayToHour: string;
  openPlayToMeridiem: Meridiem | "";
  venueName: string;
  venueAddress: string;
  venueGoogleMapEmbedUrl: string;
  courtCount: number;
  expectedPlayers: number;
  strictPlayerCount: boolean;
};

function createInitialForm(userType?: string | null): CreateGameForm {
  const venueDefaults = getDefaultGameVenueForUserType(userType);

  return {
    title: "",
    openPlayType: "Beginner" as (typeof types)[number],
    openPlayDate: getTodayOpenPlayDateInputValue(),
    openPlayFromHour: "7",
    openPlayFromMeridiem: "PM",
    openPlayToHour: "10",
    openPlayToMeridiem: "PM",
    venueName: venueDefaults.venueName,
    venueAddress: venueDefaults.venueAddress,
    venueGoogleMapEmbedUrl: venueDefaults.venueGoogleMapEmbedUrl,
    courtCount: 2,
    expectedPlayers: 24,
    strictPlayerCount: false,
  };
}

function defaultGameTitle(openPlayType: string) {
  return defaultOpenPlayTitle(openPlayType);
}

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

/** Index of the last field whose trimmed name duplicates an earlier entry. */
function findLastDuplicatePlayerNameIndex(entries: WizardPlayerEntry[]) {
  const seen = new Set<string>();
  let lastDuplicateIndex: number | null = null;

  for (let index = 0; index < entries.length; index += 1) {
    const key = normalizePlayerNameKey(entries[index]?.name ?? "");
    if (!key) continue;

    if (seen.has(key)) {
      lastDuplicateIndex = index;
    } else {
      seen.add(key);
    }
  }

  return lastDuplicateIndex;
}

function findFirstMissingGenderIndex(entries: WizardPlayerEntry[]) {
  for (let index = 0; index < entries.length; index += 1) {
    const name = entries[index]?.name.trim() ?? "";
    const gender = entries[index]?.gender ?? "";
    if (name && gender !== "male" && gender !== "female") {
      return index;
    }
  }
  return null;
}

function getTotalSteps(mode: RegistrationMode | "") {
  if (mode === "owner") return 4;
  if (mode === "self") return 3;
  return 1;
}

function getStepKind(step: number, mode: RegistrationMode | "") {
  if (step === 1) return "registrationMode";
  if (mode === "owner") {
    if (step === 2) return "playerNames";
    if (step === 3) return "sessionBasics";
    if (step === 4) return "openPlayType";
  }
  if (mode === "self") {
    if (step === 2) return "sessionBasics";
    if (step === 3) return "openPlayType";
  }
  return "unknown";
}

export function CreateGameWizard() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { createGameWizardOpen, createGameWizardPreset, setCreateGameWizardOpen } = useUiStore();
  const { data: gamesData } = useGamesList();
  const { emailVerified, isLoading: emailVerifiedLoading } = useEmailVerified();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [registrationMode, setRegistrationMode] = useState<RegistrationMode | "">("self");
  const [playerEntries, setPlayerEntries] = useState<WizardPlayerEntry[]>([EMPTY_WIZARD_PLAYER]);
  const [allowQrRegistration, setAllowQrRegistration] = useState(false);
  const [allowManualPlayerAdd, setAllowManualPlayerAdd] = useState(false);
  const [defaultCheckInAllPlayers, setDefaultCheckInAllPlayers] = useState(true);
  const [liveQueue, setLiveQueue] = useState(true);
  const [form, setForm] = useState<CreateGameForm>(createInitialForm);
  const [timeRangeError, setTimeRangeError] = useState("");
  const [venueMapDialogOpen, setVenueMapDialogOpen] = useState(false);

  const totalSteps = getTotalSteps(registrationMode);
  const stepKind = getStepKind(step, registrationMode);

  const filledPlayers = useMemo(
    () =>
      playerEntries
        .map((entry) => ({
          displayName: entry.name.trim(),
          gender: entry.gender,
        }))
        .filter(
          (entry): entry is { displayName: string; gender: "male" | "female" | "" } =>
            entry.displayName.length > 0,
        ),
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
  const isQuickGamePreset = createGameWizardPreset?.liveQueue === false;

  useEffect(() => {
    if (!createGameWizardOpen) return;
    const preset = createGameWizardPreset ?? { liveQueue: true };
    setStep(1);
    setRegistrationMode(preset.liveQueue === false ? "owner" : (preset.registrationMode ?? "self"));
    setPlayerEntries([EMPTY_WIZARD_PLAYER]);
    setAllowQrRegistration(false);
    setAllowManualPlayerAdd(false);
    setDefaultCheckInAllPlayers(true);
    setLiveQueue(preset.liveQueue);
    setForm(createInitialForm(gamesData?.userType));
    setTimeRangeError("");
    setVenueMapDialogOpen(false);
    setLoading(false);
  }, [createGameWizardOpen, createGameWizardPreset, gamesData?.userType]);

  useEffect(() => {
    if (stepKind !== "openPlayType" || !isOpenPlayTimeComplete(form)) {
      setTimeRangeError("");
      return;
    }

    const validation = validateOpenPlayTimeOrder(
      form.openPlayFromHour,
      form.openPlayFromMeridiem,
      form.openPlayToHour,
      form.openPlayToMeridiem,
    );
    setTimeRangeError(validation.ok ? "" : validation.message);
  }, [
    stepKind,
    form.openPlayFromHour,
    form.openPlayFromMeridiem,
    form.openPlayToHour,
    form.openPlayToMeridiem,
  ]);

  const getOpenPlayTimeValidation = () => {
    if (!isOpenPlayTimeComplete(form)) return null;
    return validateOpenPlayTimeOrder(
      form.openPlayFromHour,
      form.openPlayFromMeridiem,
      form.openPlayToHour,
      form.openPlayToMeridiem,
    );
  };

  const canGoNext = () => {
    if (stepKind === "openPlayType") {
      if (!form.venueName.trim() || !form.venueAddress.trim()) return false;
      if (!isOpenPlayTimeComplete(form)) return false;
      return getOpenPlayTimeValidation()?.ok ?? false;
    }
    if (stepKind === "registrationMode") return registrationMode !== "";
    if (stepKind === "playerNames") {
      return (
        filledPlayers.length >= MIN_PRE_REGISTERED_PLAYERS &&
        !hasDuplicatePlayerNames &&
        !hasMissingPlayerGender &&
        !hasPlayerNameTooLong &&
        !hasInvalidPlayerName &&
        filledPlayers.every((player) => player.gender === "male" || player.gender === "female")
      );
    }
    return true;
  };

  const goNext = () => {
    if (!canGoNext()) {
      if (stepKind === "openPlayType") {
        if (!form.venueName.trim() || !form.venueAddress.trim()) {
          toast.error("Enter a venue name and address.");
        } else if (!isOpenPlayTimeComplete(form)) {
          toast.error("Select from and to times.");
        } else {
          const validation = getOpenPlayTimeValidation();
          const message =
            validation && !validation.ok
              ? validation.message
              : "Select from and to times.";
          setTimeRangeError(validation && !validation.ok ? validation.message : "");
          toast.error(message);
        }
      } else if (stepKind === "registrationMode") {
        toast.error("Choose how players will be registered.");
      } else if (stepKind === "playerNames") {
        if (hasPlayerNameTooLong) {
          toast.error(playerDisplayNameTooLongMessage());
        } else if (hasInvalidPlayerName) {
          toast.error(playerDisplayNameInvalidCharacterMessage());
        } else if (hasDuplicatePlayerNames) {
          toast.error("Each player name must be unique.");
        } else if (hasMissingPlayerGender) {
          toast.error("Select a gender for each player.");
        } else if (filledPlayers.length < MIN_PRE_REGISTERED_PLAYERS) {
          toast.error(`Enter at least ${MIN_PRE_REGISTERED_PLAYERS} players.`);
        } else {
          toast.error("Enter at least one player name.");
        }
      }
      return;
    }
    if (stepKind === "openPlayType") {
      setTimeRangeError("");
    }
    setStep((prev) => Math.min(totalSteps, prev + 1));
  };

  const goBack = () => {
    setStep((prev) => Math.max(1, prev - 1));
  };

  const submit = async () => {
    if (!emailVerifiedLoading && !emailVerified) {
      toast.error("Verify your email before creating a game.");
      return;
    }

    const timeValidation = getOpenPlayTimeValidation();
    if (!timeValidation?.ok) {
      const message = timeValidation?.message ?? "Select from and to times.";
      setTimeRangeError(message);
      toast.error(message);
      return;
    }

    try {
      setLoading(true);
      const {
        openPlayFromHour,
        openPlayFromMeridiem,
        openPlayToHour,
        openPlayToMeridiem,
        ...formRest
      } = form;

      const title = form.title.trim() || defaultGameTitle(form.openPlayType);
      const openPlayTimeRange = formatOpenPlayTimeRange(
        openPlayFromHour,
        openPlayFromMeridiem as Meridiem,
        openPlayToHour,
        openPlayToMeridiem as Meridiem,
      );

      if (registrationMode === "owner" && !liveQueue) {
        const gameId = createAccountQuickGameId();
        const players = filledPlayers.filter(
          (player): player is { displayName: string; gender: "male" | "female" } =>
            player.gender === "male" || player.gender === "female",
        );
        const session = createLocalLiveQueueSession({
          gameId,
          title,
          openPlayType: form.openPlayType,
          openPlayDate: form.openPlayDate,
          openPlayTimeRange,
          venueName: form.venueName,
          venueAddress: form.venueAddress,
          venueGoogleMapEmbedUrl: form.venueGoogleMapEmbedUrl,
          courtCount: form.courtCount,
          expectedPlayers: players.length,
          allowQrRegistration: false,
          allowManualPlayerAdd,
          players,
          checkInAllPlayers: defaultCheckInAllPlayers,
        });
        initializeQuickGameSession(gameId, session);
        try {
          await saveQuickGameSession(gameId, session, "create", "active");
          void queryClient.invalidateQueries({ queryKey: ["saved-quick-games"] });
        } catch {
          toast.message("Session created in this browser. Cloud save failed — you can keep playing.");
        }
        toast.success(
          `Session created.${players.length > 0 ? ` ${players.length} players added to the queue.` : ""}`,
        );
        setCreateGameWizardOpen(false);
        router.push(`/games/${gameId}`);
        return;
      }

      const body: Record<string, unknown> = {
        ...formRest,
        openPlayTimeRange,
        title,
        registrationMode: registrationMode || undefined,
        liveQueue: registrationMode === "owner" ? liveQueue : true,
      };

      if (registrationMode === "owner") {
        body.preRegisteredPlayers = filledPlayers.filter(
          (player): player is { displayName: string; gender: "male" | "female" } =>
            player.gender === "male" || player.gender === "female",
        );
        body.expectedPlayers = filledPlayers.length;
        body.allowQrRegistration = liveQueue ? allowQrRegistration : false;
        body.allowManualPlayerAdd = allowManualPlayerAdd;
        body.defaultCheckInAllPlayers = defaultCheckInAllPlayers;
        body.strictPlayerCount = !allowQrRegistration;
      }

      const response = await fetch("/api/games/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message);

      const extra =
        registrationMode === "owner" && data.preRegisteredCount > 0
          ? ` ${data.preRegisteredCount} players added to the queue.`
          : "";
      toast.success(`Game created.${extra}`);
      setCreateGameWizardOpen(false);
      router.push(`/games/${data.game.gameId}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to create game.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Dialog open={createGameWizardOpen} onOpenChange={setCreateGameWizardOpen}>
      <DialogContent className="flex max-h-[min(92dvh,52rem)] w-[calc(100%-1.5rem)] max-w-3xl flex-col gap-0 overflow-hidden p-0 sm:max-w-xl md:max-w-2xl lg:max-w-3xl">
        <DialogHeader className="border-b px-4 py-5">
          <DialogTitle className="text-xl">Create Open Play Session</DialogTitle>
          <p className="text-sm text-muted-foreground">
            Step {step} of {totalSteps}
          </p>
        </DialogHeader>

        <div className="min-h-[280px] flex-1 overflow-y-auto px-4 py-6">
          {stepKind === "registrationMode" ? (
            <div className="space-y-4">
              <Label className="text-base">Player registration type?</Label>
              <div className="grid grid-cols-1 gap-3">
                <Button
                  type="button"
                  variant={registrationMode === "self" ? "default" : "outline"}
                  className="h-auto min-h-14 w-full flex-col items-start justify-center gap-1 px-4 py-3 text-left whitespace-normal"
                  disabled={isQuickGamePreset}
                  onClick={() => setRegistrationMode("self")}
                >
                  <span className="text-sm font-semibold leading-snug">Players will register</span>
                  <span className="text-[11px] font-normal leading-snug opacity-80">
                    Share the QR link so each player signs up on their own.
                  </span>
                </Button>
                <Button
                  type="button"
                  variant={registrationMode === "owner" ? "default" : "outline"}
                  className="h-auto min-h-14 w-full flex-col items-start justify-center gap-1 px-4 py-3 text-left whitespace-normal"
                  onClick={() => setRegistrationMode("owner")}
                >
                  <span className="text-sm font-semibold leading-snug">I&apos;ll register all players</span>
                  <span className="text-[11px] font-normal leading-snug opacity-80">
                    Enter player names now.
                    <br />
                    Avatars are assigned automatically.
                  </span>
                </Button>
              </div>
            </div>
          ) : null}

          {stepKind === "sessionBasics" ? (
            <div className="space-y-6">
              <OpenPlayTypePicker
                value={form.openPlayType}
                onChange={(openPlayType) => setForm((prev) => ({ ...prev, openPlayType }))}
                description="What skill level is this session for?"
              />
              <Separator />
              <div className="space-y-3">
                <Label htmlFor="title" className="text-base">
                  Game title
                </Label>
                <Input
                  id="title"
                  className="h-11 text-base"
                  placeholder={defaultGameTitle(form.openPlayType)}
                  value={form.title}
                  onChange={(event) => setForm((prev) => ({ ...prev, title: event.target.value }))}
                />
              </div>
              <Separator />
              <div className="space-y-3">
                <Label htmlFor="courtCount" className="text-base">
                  How many courts?
                </Label>
                <NumberStepper
                  id="courtCount"
                  min={1}
                  max={20}
                  value={form.courtCount}
                  onChange={(courtCount) => setForm((prev) => ({ ...prev, courtCount }))}
                />
              </div>
              {registrationMode === "self" ? (
                <>
                  <Separator />
                  <div className="space-y-4">
                    <div className="space-y-3">
                      <Label htmlFor="expectedPlayers" className="text-base">
                        How many players do you expect?
                      </Label>
                      <NumberStepper
                        id="expectedPlayers"
                        min={4}
                        max={300}
                        value={form.expectedPlayers}
                        onChange={(expectedPlayers) =>
                          setForm((prev) => ({ ...prev, expectedPlayers }))
                        }
                      />
                    </div>
                    <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-border bg-muted/30 px-4 py-3">
                      <Checkbox
                        id="strictPlayerCount"
                        checked={form.strictPlayerCount}
                        onCheckedChange={(checked) =>
                          setForm((prev) => ({
                            ...prev,
                            strictPlayerCount: checked === true,
                          }))
                        }
                      />
                      <span className="space-y-1 leading-snug">
                        <span className="block text-base font-medium">Strict Player Count</span>
                        <span className="block text-sm text-muted-foreground">
                          When enabled, registration stops at {form.expectedPlayers} players. When
                          disabled, more players can still register.
                        </span>
                      </span>
                    </label>
                  </div>
                </>
              ) : null}
            </div>
          ) : null}

          {stepKind === "openPlayType" ? (
            <div className="w-full space-y-8">
              <section className="space-y-4">
                <div className="space-y-1">
                  <h3 className="text-base font-medium text-foreground">Schedule</h3>
                  <p className="text-sm text-muted-foreground">When does this open play happen?</p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="openPlayDate" className="text-base">
                    Open play date
                  </Label>
                  <Input
                    id="openPlayDate"
                    type="date"
                    className="h-11 text-base"
                    value={form.openPlayDate}
                    onChange={(event) =>
                      setForm((prev) => ({ ...prev, openPlayDate: event.target.value }))
                    }
                  />
                </div>
                <OpenPlayTimeField
                  idPrefix="openPlayFrom"
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
                  idPrefix="openPlayTo"
                  label="To time"
                  hour={form.openPlayToHour}
                  meridiem={form.openPlayToMeridiem}
                  onHourChange={(openPlayToHour) =>
                    setForm((prev) => ({ ...prev, openPlayToHour }))
                  }
                  onMeridiemChange={(openPlayToMeridiem) =>
                    setForm((prev) => ({ ...prev, openPlayToMeridiem }))
                  }
                />
                {timeRangeError ? (
                  <p className="text-sm text-destructive" role="alert">
                    {timeRangeError}
                  </p>
                ) : null}
              </section>

              <Separator />

              <section className="space-y-4">
                <div className="space-y-1">
                  <h3 className="text-base font-medium text-foreground">Venue</h3>
                  <p className="text-sm text-muted-foreground">
                    Where players will meet for this open play.
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="venueName" className="text-base">
                    Venue name
                  </Label>
                  <Input
                    id="venueName"
                    className="h-11 text-base"
                    placeholder="e.g. Dragonsmash Taguig Branch"
                    maxLength={120}
                    value={form.venueName}
                    onChange={(event) =>
                      setForm((prev) => ({ ...prev, venueName: event.target.value }))
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="venueAddress" className="text-base">
                    Address
                  </Label>
                  <Textarea
                    id="venueAddress"
                    className="min-h-[5.5rem] resize-y border-input bg-transparent text-base dark:bg-input/30"
                    placeholder="Street, city, or directions to the courts"
                    maxLength={240}
                    rows={3}
                    value={form.venueAddress}
                    onChange={(event) =>
                      setForm((prev) => ({ ...prev, venueAddress: event.target.value }))
                    }
                  />
                </div>
                <div className="space-y-3">
                  <Label className="text-base">Google Map</Label>
                  {form.venueGoogleMapEmbedUrl ? (
                    <div className="space-y-3">
                      <div className="aspect-video overflow-hidden rounded-xl border border-border/70 bg-muted/20">
                        <iframe
                          src={form.venueGoogleMapEmbedUrl}
                          title="Venue location map"
                          className="h-full w-full border-0"
                          loading="lazy"
                          referrerPolicy="no-referrer-when-downgrade"
                          allowFullScreen
                        />
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => setVenueMapDialogOpen(true)}
                        >
                          Change map
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="border-destructive/40 text-destructive hover:bg-destructive/10"
                          onClick={() =>
                            setForm((prev) => ({ ...prev, venueGoogleMapEmbedUrl: "" }))
                          }
                        >
                          <Trash2 className="mr-1.5 h-4 w-4" aria-hidden />
                          Remove map
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <Button
                      type="button"
                      variant="outline"
                      className="h-11 w-full border-dashed sm:w-auto"
                      onClick={() => setVenueMapDialogOpen(true)}
                    >
                      <Plus className="mr-2 h-4 w-4" aria-hidden />
                      Add Google Map
                    </Button>
                  )}
                  <p className="text-xs text-muted-foreground">
                    Optional. Embed a map from Google Maps so players can see where to go.
                  </p>
                </div>
              </section>
            </div>
          ) : null}

          {stepKind === "playerNames" ? (
            <div className="w-full space-y-4">
              <label
                className={cn(
                  "flex items-start gap-3 rounded-lg border border-border bg-muted/30 px-4 py-3",
                  isQuickGamePreset ? "cursor-not-allowed opacity-80" : "cursor-pointer",
                )}
              >
                <Checkbox
                  id="liveQueue"
                  checked={liveQueue}
                  disabled={isQuickGamePreset}
                  onCheckedChange={(checked) => {
                    if (isQuickGamePreset) return;
                    const enabled = checked === true;
                    setLiveQueue(enabled);
                    if (!enabled) setAllowQrRegistration(false);
                  }}
                />
                <span className="space-y-1 leading-snug">
                  <span className="block text-sm font-medium">Live queue</span>
                  <span className="block text-xs text-muted-foreground">
                    When enabled, players and queue changes are saved to the database. When off,
                    gameplay runs in this browser and syncs to your account (not the main players
                    collection) when you create, leave, or end the session.
                  </span>
                </span>
              </label>
              <div className="space-y-1">
                <Label className="text-base">Enter player names</Label>
                <p className="text-sm text-muted-foreground">
                  One row per player with name and gender (minimum {MIN_PRE_REGISTERED_PLAYERS}{" "}
                  players). Each player gets an auto-generated avatar when the session is created.
                  {liveQueue
                    ? allowQrRegistration
                      ? " Additional players may register via QR after your list is added."
                      : " Only these players will be in the queue (no extra QR sign-ups)."
                    : " Additional players can be added manually from the dashboard if enabled below."}
                </p>
              </div>
              <div
                className={cn(
                  "grid items-center gap-2 px-0.5 text-xs font-medium text-muted-foreground",
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
                  id="defaultCheckInAllPlayers"
                  checked={defaultCheckInAllPlayers}
                  onCheckedChange={(checked) => setDefaultCheckInAllPlayers(checked === true)}
                />
                <span className="space-y-1 leading-snug">
                  <span className="block text-sm font-medium">Default check in all players</span>
                  <span className="block text-xs text-muted-foreground">
                    When checked, every player you enter starts in the active queue. When unchecked,
                    they start on the checkout list and can be checked in later.
                  </span>
                </span>
              </label>
              {liveQueue ? (
                <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-border bg-muted/30 px-4 py-3">
                  <Checkbox
                    id="allowQrRegistration"
                    checked={allowQrRegistration}
                    onCheckedChange={(checked) => setAllowQrRegistration(checked === true)}
                  />
                  <span className="space-y-1 leading-snug">
                    <span className="block text-sm font-medium">
                      Allow new users to join via QR code
                    </span>
                    <span className="block text-xs text-muted-foreground">
                      When enabled, others can scan the registration QR and join the queue after your
                      list is added. When off, the QR opens the spectator view instead.
                    </span>
                  </span>
                </label>
              ) : null}
              <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-border bg-muted/30 px-4 py-3">
                <Checkbox
                  id="allowManualPlayerAdd"
                  checked={allowManualPlayerAdd}
                  onCheckedChange={(checked) => setAllowManualPlayerAdd(checked === true)}
                />
                <span className="space-y-1 leading-snug">
                  <span className="block text-sm font-medium">
                    Allow new users to be added manually
                  </span>
                  <span className="block text-xs text-muted-foreground">
                    When enabled, you can add player names from the game dashboard and they will join
                    the queue automatically.
                    {!liveQueue ? " In browser-only mode, new players are kept in session state only." : ""}
                  </span>
                </span>
              </label>
            </div>
          ) : null}
        </div>

        <div className="flex justify-between gap-3 border-t bg-muted/40 px-4 py-4">
          <Button variant="outline" size="lg" disabled={step === 1} onClick={goBack}>
            Back
          </Button>
          {step < totalSteps ? (
            <Button size="lg" onClick={goNext} disabled={!canGoNext()}>
              Next
            </Button>
          ) : (
            <Button size="lg" onClick={submit} disabled={loading}>
              {loading ? "Creating..." : "Create Game"}
            </Button>
          )}
        </div>
      </DialogContent>
      </Dialog>
      <GoogleMapEmbedDialog
        open={venueMapDialogOpen}
        onOpenChange={setVenueMapDialogOpen}
        initialValue={form.venueGoogleMapEmbedUrl}
        textareaId="venue-google-map-embed"
        onSave={(embedUrl) =>
          setForm((prev) => ({ ...prev, venueGoogleMapEmbedUrl: embedUrl }))
        }
      />
    </>
  );
}
