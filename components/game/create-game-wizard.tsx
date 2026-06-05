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
import { OpenPlayTimeField } from "@/components/game/open-play-time-field";
import { NumberStepper } from "@/components/ui/number-stepper";
import {
  formatOpenPlayTimeRange,
  getTodayOpenPlayDateInputValue,
  isOpenPlayTimeComplete,
  validateOpenPlayTimeOrder,
  type OpenPlayMeridiem,
} from "@/lib/open-play-time-range";
import { defaultOpenPlayTitle, OPEN_PLAY_TYPES } from "@/lib/open-play-types";
import { useUiStore } from "@/store/ui-store";

const types = OPEN_PLAY_TYPES;

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
  courtCount: number;
  expectedPlayers: number;
  strictPlayerCount: boolean;
};

function createInitialForm(): CreateGameForm {
  return {
    title: "",
    openPlayType: "Beginner" as (typeof types)[number],
    openPlayDate: getTodayOpenPlayDateInputValue(),
    openPlayFromHour: "7",
    openPlayFromMeridiem: "PM",
    openPlayToHour: "10",
    openPlayToMeridiem: "PM",
    courtCount: 2,
    expectedPlayers: 24,
    strictPlayerCount: false,
  };
}

function defaultGameTitle(openPlayType: string) {
  return defaultOpenPlayTitle(openPlayType);
}

function getTotalSteps(mode: RegistrationMode | "") {
  return mode === "owner" || mode === "self" ? 5 : 2;
}

function getStepKind(step: number, mode: RegistrationMode | "") {
  if (step === 1) return "openPlayType";
  if (step === 2) return "registrationMode";
  if (mode === "owner") {
    if (step === 3) return "playerNames";
    if (step === 4) return "courtCount";
    if (step === 5) return "title";
  }
  if (mode === "self") {
    if (step === 3) return "courtCount";
    if (step === 4) return "expectedPlayers";
    if (step === 5) return "title";
  }
  return "unknown";
}

export function CreateGameWizard() {
  const router = useRouter();
  const { createGameWizardOpen, setCreateGameWizardOpen } = useUiStore();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [registrationMode, setRegistrationMode] = useState<RegistrationMode | "">("self");
  const [playerNames, setPlayerNames] = useState<string[]>([""]);
  const [allowQrRegistration, setAllowQrRegistration] = useState(false);
  const [form, setForm] = useState<CreateGameForm>(createInitialForm);
  const [timeRangeError, setTimeRangeError] = useState("");

  const totalSteps = getTotalSteps(registrationMode);
  const stepKind = getStepKind(step, registrationMode);

  const trimmedPlayerNames = useMemo(
    () => playerNames.map((name) => name.trim()).filter(Boolean),
    [playerNames],
  );

  useEffect(() => {
    if (!createGameWizardOpen) return;
    setStep(1);
    setRegistrationMode("self");
    setPlayerNames([""]);
    setAllowQrRegistration(false);
    setForm(createInitialForm());
    setTimeRangeError("");
    setLoading(false);
  }, [createGameWizardOpen]);

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
      if (!isOpenPlayTimeComplete(form)) return false;
      return getOpenPlayTimeValidation()?.ok ?? false;
    }
    if (stepKind === "registrationMode") return registrationMode !== "";
    if (stepKind === "playerNames") return trimmedPlayerNames.length > 0;
    return true;
  };

  const goNext = () => {
    if (!canGoNext()) {
      if (stepKind === "openPlayType") {
        if (!isOpenPlayTimeComplete(form)) {
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
        toast.error("Enter at least one player name.");
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

      const body: Record<string, unknown> = {
        ...formRest,
        openPlayTimeRange: formatOpenPlayTimeRange(
          openPlayFromHour,
          openPlayFromMeridiem as Meridiem,
          openPlayToHour,
          openPlayToMeridiem as Meridiem,
        ),
        title: form.title.trim() || defaultGameTitle(form.openPlayType),
        registrationMode: registrationMode || undefined,
      };

      if (registrationMode === "owner") {
        body.preRegisteredPlayerNames = trimmedPlayerNames;
        body.expectedPlayers = trimmedPlayerNames.length;
        body.allowQrRegistration = allowQrRegistration;
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
    <Dialog open={createGameWizardOpen} onOpenChange={setCreateGameWizardOpen}>
      <DialogContent className="flex max-h-[min(92dvh,52rem)] w-[calc(100%-1.5rem)] max-w-3xl flex-col gap-0 overflow-hidden p-0 sm:max-w-xl md:max-w-2xl lg:max-w-3xl">
        <DialogHeader className="border-b px-6 py-5">
          <DialogTitle className="text-xl">Create Open Play Session</DialogTitle>
          <p className="text-sm text-muted-foreground">
            Step {step} of {totalSteps}
          </p>
        </DialogHeader>

        <div className="min-h-[280px] flex-1 overflow-y-auto px-6 py-6">
          {stepKind === "openPlayType" ? (
            <div className="space-y-6">
              <div className="space-y-4">
                <Label className="text-base">Players Level</Label>
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
              <div className="mx-auto w-full max-w-md space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="openPlayDate" className="text-base">
                    Open Play Date
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
                  label="From Time"
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
                  label="To Time"
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
              </div>
            </div>
          ) : null}

          {stepKind === "registrationMode" ? (
            <div className="space-y-4">
              <Label className="text-base">Player registration type?</Label>
              <div className="grid grid-cols-1 gap-3">
                <Button
                  type="button"
                  variant={registrationMode === "self" ? "default" : "outline"}
                  className="h-auto min-h-14 w-full flex-col items-start justify-center gap-1 px-4 py-3 text-left whitespace-normal"
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

          {stepKind === "playerNames" ? (
            <div className="mx-auto w-full max-w-md space-y-4">
              <div className="space-y-1">
                <Label className="text-base">Enter player names</Label>
                <p className="text-sm text-muted-foreground">
                  One name per field (e.g. &quot;Maria Santos&quot;). Each player gets an auto-generated
                  avatar when the session is created.
                  {allowQrRegistration
                    ? " Additional players may register via QR after your list is added."
                    : " Only these players will be in the queue (no extra QR sign-ups)."}
                </p>
              </div>
              <ul className="space-y-3">
                {playerNames.map((name, index) => (
                  <li key={index} className="flex items-center gap-2">
                    <Input
                      className="h-11 flex-1 text-base"
                      placeholder={`Player ${index + 1} name`}
                      value={name}
                      onChange={(event) => {
                        const next = [...playerNames];
                        next[index] = event.target.value;
                        setPlayerNames(next);
                      }}
                    />
                    {playerNames.length > 1 ? (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="size-11 shrink-0 text-muted-foreground hover:text-destructive"
                        aria-label={`Remove player ${index + 1}`}
                        onClick={() =>
                          setPlayerNames((prev) => prev.filter((_, rowIndex) => rowIndex !== index))
                        }
                      >
                        <Trash2 className="h-4 w-4" aria-hidden />
                      </Button>
                    ) : null}
                  </li>
                ))}
              </ul>
              <Button
                type="button"
                variant="outline"
                className="w-full"
                onClick={() => setPlayerNames((prev) => [...prev, ""])}
              >
                <Plus className="mr-2 h-4 w-4" aria-hidden />
                Add more player
              </Button>
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
            </div>
          ) : null}

          {stepKind === "courtCount" ? (
            <div className="mx-auto w-full max-w-md space-y-3">
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
          ) : null}

          {stepKind === "expectedPlayers" && registrationMode === "self" ? (
            <div className="mx-auto w-full max-w-md space-y-4">
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
          ) : null}

          {stepKind === "title" ? (
            <div className="mx-auto w-full max-w-md space-y-3">
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
          ) : null}
        </div>

        <div className="flex justify-between gap-3 border-t bg-muted/40 px-6 py-4">
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
  );
}
