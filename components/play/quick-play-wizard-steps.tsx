"use client";

import type { Dispatch, ReactNode, SetStateAction } from "react";
import { Gauge, LayoutGrid, Plus, Shuffle, Timer, Trash2, UserCheck, UserPlus, Users } from "lucide-react";

import { OpenPlayTypePicker } from "@/components/game/open-play-type-picker";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NumberStepper } from "@/components/ui/number-stepper";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  DEFAULT_PLAYER_OPEN_PLAY_LEVEL,
  MAX_QUICK_PLAY_PLAYERS,
  MIN_EXPECTED_PLAYERS,
  QUICK_PLAY_GAME_MODE_OPTIONS,
  QUICK_PLAY_MATCHING_TYPE_OPTIONS,
  QUICK_PLAY_STEP_HEADINGS,
  QUICK_PLAY_TOTAL_STEPS,
  QUICK_PLAY_WIZARD_STEPS,
  WIZARD_PLAYER_GENDER_OPTIONS,
  WIZARD_PLAYER_LEVEL_OPTIONS,
  createQuickPlayWizardPlayerEntry,
  defaultQuickPlayPlayerName,
  getQuickPlayGameModeLabel,
  getQuickPlayMatchingTypeDescription,
  getQuickPlayMatchingTypeLabel,
  playerPreviewInitial,
  quickPlayPlayerRowGridCols,
  resolvePlayerOpenPlayLevel,
  type QuickPlayWizardFormFields,
  type QuickPlayWizardPlayerEntry,
} from "@/lib/quick-play-wizard-shared";
import {
  defaultOpenPlayTitle,
  getSessionPlayerOpenPlayLevels,
  isAnyLevelOpenPlayType,
  isFixedOpenPlayType,
  isMixedOpenPlayType,
  type PlayerOpenPlayLevel,
} from "@/lib/open-play-types";
import {
  MAX_PLAYER_DISPLAY_NAME_LENGTH,
  sanitizePlayerDisplayNameInput,
} from "@/lib/player-profile-shared";
import {
  WIZARD_OPTION_SELECTED,
  WIZARD_OPTION_UNSELECTED,
  WIZARD_OUTLINE_BUTTON_BORDER,
  WIZARD_PANEL_BORDER,
  WIZARD_PRIMARY_FIELD_BORDER,
} from "@/lib/wizard-field-styles";
import { wizardGenderLabel } from "@/lib/wizard-player-fields";
import { cn } from "@/lib/utils";

export function QuickPlayWizardHeader({
  step,
  title = "Run open play in few seconds",
  subtitle,
}: {
  step: number;
  title?: string;
  subtitle?: string;
}) {
  const heading = QUICK_PLAY_STEP_HEADINGS[Math.max(0, step - 1)] ?? QUICK_PLAY_STEP_HEADINGS[0];

  return (
    <header
      className={cn(
        "quick-play-wizard-header rounded-2xl border border-primary/30 bg-card p-4 shadow-sm sm:p-5",
        WIZARD_PANEL_BORDER,
      )}
      aria-labelledby="quick-play-wizard-title"
    >
      <div className="flex items-start gap-4">
        <div
          className="flex size-14 shrink-0 items-center justify-center rounded-xl border border-primary/25 bg-primary/10"
          aria-hidden
        >
          <Timer className="size-7 text-primary" strokeWidth={2.25} />
        </div>
        <div className="min-w-0 flex-1 space-y-3 pt-0.5">
          <div className="space-y-1">
            <p className="text-xs font-medium text-muted-foreground">
              Step {step} of {QUICK_PLAY_TOTAL_STEPS} · {heading}
            </p>
            <h1 id="quick-play-wizard-title" className="text-lg font-semibold leading-snug text-foreground sm:text-xl">
              {title}
            </h1>
            {subtitle ? <p className="text-sm text-muted-foreground">{subtitle}</p> : null}
          </div>
          <ol className="m-0 flex list-none flex-wrap gap-2 p-0" aria-label="Quick play setup progress">
            {QUICK_PLAY_WIZARD_STEPS.map((wizardStep) => {
              const isActive = step === wizardStep.number;
              const isComplete = step > wizardStep.number;

              return (
                <li key={wizardStep.number}>
                  <span
                    className={cn(
                      "inline-flex rounded-full px-2.5 py-1 text-[11px] font-medium sm:text-xs",
                      isActive && "bg-primary/15 text-primary",
                      isComplete && "bg-primary/10 text-primary/80",
                      !isActive && !isComplete && "bg-muted text-muted-foreground",
                    )}
                    aria-current={isActive ? "step" : undefined}
                  >
                    {wizardStep.number}. {wizardStep.label}
                  </span>
                </li>
              );
            })}
          </ol>
        </div>
      </div>
    </header>
  );
}

export function QuickPlayFormatOptionButton({
  selected,
  disabled,
  label,
  description,
  onClick,
}: {
  selected: boolean;
  disabled?: boolean;
  label: string;
  description: string;
  onClick: () => void;
}) {
  return (
    <Button
      type="button"
      variant="ghost"
      disabled={disabled}
      className={cn(
        "h-auto min-h-14 w-full flex-col items-start justify-center gap-1 px-4 py-3 text-left whitespace-normal",
        selected ? WIZARD_OPTION_SELECTED : WIZARD_OPTION_UNSELECTED,
        disabled && "cursor-not-allowed opacity-50 hover:bg-background hover:border-primary/45",
      )}
      onClick={onClick}
    >
      <span className="text-sm font-semibold leading-snug">{label}</span>
      <span
        className={cn(
          "text-[11px] font-normal leading-snug",
          selected ? "text-primary-foreground/85" : "text-muted-foreground",
        )}
      >
        {description}
      </span>
    </Button>
  );
}

export function QuickPlayFormatStep({
  idPrefix,
  form,
  onFormChange,
  onOpenPlayTypeChange,
}: {
  idPrefix: string;
  form: QuickPlayWizardFormFields;
  onFormChange: (patch: Partial<QuickPlayWizardFormFields>) => void;
  onOpenPlayTypeChange: (openPlayType: string) => void;
}) {
  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <Label htmlFor={`${idPrefix}-title`} className="text-base">
          Session name
        </Label>
        <Input
          id={`${idPrefix}-title`}
          className={cn("h-11 text-base", WIZARD_PRIMARY_FIELD_BORDER)}
          placeholder={defaultOpenPlayTitle(form.openPlayType)}
          value={form.title}
          onChange={(event) => onFormChange({ title: event.target.value })}
        />
      </div>

      <div className={cn("rounded-xl border p-4", WIZARD_PANEL_BORDER)}>
        <OpenPlayTypePicker
          key={`${idPrefix}-open-play-type`}
          value={form.openPlayType}
          onChange={(openPlayType) => {
            onFormChange({ openPlayType });
            onOpenPlayTypeChange(openPlayType);
          }}
          label="Player level"
        />
      </div>

      <div className={cn("space-y-3 rounded-xl border p-4", WIZARD_PANEL_BORDER)}>
        <Label className="text-base">Game mode</Label>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {QUICK_PLAY_GAME_MODE_OPTIONS.map((option) => (
            <QuickPlayFormatOptionButton
              key={option.value}
              selected={form.gameMode === option.value}
              disabled={option.disabled}
              label={option.label}
              description={option.description}
              onClick={() => onFormChange({ gameMode: option.value })}
            />
          ))}
        </div>
      </div>

      <div className={cn("space-y-3 rounded-xl border p-4", WIZARD_PANEL_BORDER)}>
        <Label className="text-base">Matching type</Label>
        <div className="grid grid-cols-1 gap-3">
          {QUICK_PLAY_MATCHING_TYPE_OPTIONS.map((option) => (
            <QuickPlayFormatOptionButton
              key={option.value}
              selected={form.matchingType === option.value}
              disabled={option.disabled}
              label={option.label}
              description={option.description}
              onClick={() => onFormChange({ matchingType: option.value })}
            />
          ))}
        </div>
      </div>

      <div className={cn("space-y-3 rounded-xl border p-4", WIZARD_PANEL_BORDER)}>
        <Label htmlFor={`${idPrefix}-courts`} className="text-base">
          How many courts?
        </Label>
        <NumberStepper
          id={`${idPrefix}-courts`}
          min={1}
          max={20}
          value={form.courtCount}
          inputClassName={WIZARD_PRIMARY_FIELD_BORDER}
          buttonClassName={WIZARD_OUTLINE_BUTTON_BORDER}
          onChange={(courtCount) => onFormChange({ courtCount })}
        />
      </div>

      <div className={cn("space-y-3 rounded-xl border p-4", WIZARD_PANEL_BORDER)}>
        <Label htmlFor={`${idPrefix}-expected-players`} className="text-base">
          Expected number of players
        </Label>
        <p className="text-sm text-muted-foreground">
          Step 2 will show this many player rows. Minimum {MIN_EXPECTED_PLAYERS} for doubles open play.
        </p>
        <NumberStepper
          id={`${idPrefix}-expected-players`}
          min={MIN_EXPECTED_PLAYERS}
          max={MAX_QUICK_PLAY_PLAYERS}
          value={form.expectedPlayers}
          inputClassName={WIZARD_PRIMARY_FIELD_BORDER}
          buttonClassName={WIZARD_OUTLINE_BUTTON_BORDER}
          onChange={(expectedPlayers) => onFormChange({ expectedPlayers })}
        />
      </div>
    </div>
  );
}

export function QuickPlayPlayersStep({
  idPrefix,
  openPlayType,
  sessionLockedPlayerLevel,
  playerEntries,
  setPlayerEntries,
  duplicatePlayerNameIndex,
  missingGenderIndex,
  tooLongPlayerNameIndex,
  invalidPlayerNameIndex,
  defaultCheckInAllPlayers,
  setDefaultCheckInAllPlayers,
  allowManualPlayerAdd,
  setAllowManualPlayerAdd,
  canAddMorePlayers,
}: {
  idPrefix: string;
  openPlayType: string;
  sessionLockedPlayerLevel: PlayerOpenPlayLevel | null;
  playerEntries: QuickPlayWizardPlayerEntry[];
  setPlayerEntries: Dispatch<SetStateAction<QuickPlayWizardPlayerEntry[]>>;
  duplicatePlayerNameIndex: number | null;
  missingGenderIndex: number | null;
  tooLongPlayerNameIndex: number | null;
  invalidPlayerNameIndex: number | null;
  defaultCheckInAllPlayers: boolean;
  setDefaultCheckInAllPlayers: (checked: boolean) => void;
  allowManualPlayerAdd: boolean;
  setAllowManualPlayerAdd: (checked: boolean) => void;
  canAddMorePlayers: boolean;
}) {
  const fixedOpenPlayLevel = isFixedOpenPlayType(openPlayType) ? openPlayType : null;
  const lockedLevel = sessionLockedPlayerLevel ?? fixedOpenPlayLevel;
  const isAnyLevelOpenPlay = isAnyLevelOpenPlayType(openPlayType);
  const isMixedLevelOpenPlay = isMixedOpenPlayType(openPlayType);
  const sessionLevelOptions = getSessionPlayerOpenPlayLevels(openPlayType);
  const playerLevelOptions =
    sessionLevelOptions === null
      ? WIZARD_PLAYER_LEVEL_OPTIONS
      : WIZARD_PLAYER_LEVEL_OPTIONS.filter((option) => sessionLevelOptions.includes(option.value));

  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <Label className="text-base">Enter player names</Label>
        <p className="text-sm text-muted-foreground">
          {isAnyLevelOpenPlay
            ? "One row per player with name, gender, and player level."
            : isMixedLevelOpenPlay
              ? `One row per player with name, gender, and level (${openPlayType.replace(/^Mix of /, "").replace(/ Open Play$/, "")}).`
              : `One row per player with name and gender. Player level is ${openPlayType} for everyone.`}
        </p>
      </div>

      <div
        className={cn(
          "grid items-center gap-2 text-xs font-medium text-muted-foreground",
          quickPlayPlayerRowGridCols(true, playerEntries.length > 1),
        )}
      >
        <span>Name</span>
        <span>Gender</span>
        <span>Player level</span>
        {playerEntries.length > 1 ? <span className="sr-only">Remove</span> : null}
      </div>

      <ul className="m-0 list-none space-y-3 p-0">
        {playerEntries.map((entry, index) => {
          const isDuplicateField = duplicatePlayerNameIndex === index;
          const isMissingGenderField = missingGenderIndex === index;
          const isNameTooLongField = tooLongPlayerNameIndex === index;
          const isInvalidNameField = invalidPlayerNameIndex === index;
          const showRemoveColumn = playerEntries.length > 1;
          const playerLevel = lockedLevel ?? resolvePlayerOpenPlayLevel(entry.openPlayLevel);
          const isPlayerLevelLocked = lockedLevel !== null;
          const rowInputId = `${idPrefix}-player-${index + 1}`;
          const rowGenderId = `${rowInputId}-gender`;
          const rowLevelId = `${rowInputId}-level`;

          return (
            <li key={index} className="space-y-1">
              <div className={cn("grid items-center gap-2", quickPlayPlayerRowGridCols(true, showRemoveColumn))}>
                <div className="min-w-0">
                  <Input
                    id={rowInputId}
                    className={cn(
                      "h-11 min-h-11 w-full text-base",
                      WIZARD_PRIMARY_FIELD_BORDER,
                      (isDuplicateField || isNameTooLongField || isInvalidNameField) &&
                        "border-destructive focus-visible:ring-destructive/30",
                    )}
                    placeholder={defaultQuickPlayPlayerName(index + 1)}
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
                      id={rowGenderId}
                      className={cn(
                        "h-11 min-h-11 w-full max-w-none px-2.5 py-1 text-base data-[size=default]:h-11",
                        WIZARD_PRIMARY_FIELD_BORDER,
                        isMissingGenderField && "border-destructive focus-visible:ring-destructive/30",
                      )}
                      aria-invalid={isMissingGenderField}
                    >
                      {entry.gender === "male" || entry.gender === "female" ? (
                        <span className="flex flex-1 truncate text-left">{wizardGenderLabel(entry.gender)}</span>
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

                <div className="min-w-0">
                  <Select
                    value={playerLevel}
                    disabled={isPlayerLevelLocked}
                    onValueChange={(value) => {
                      if (isPlayerLevelLocked) return;
                      if (!WIZARD_PLAYER_LEVEL_OPTIONS.some((option) => option.value === value)) return;
                      const next = [...playerEntries];
                      next[index] = {
                        ...next[index],
                        openPlayLevel: value as PlayerOpenPlayLevel,
                      };
                      setPlayerEntries(next);
                    }}
                  >
                    <SelectTrigger
                      id={rowLevelId}
                      className={cn(
                        "h-11 min-h-11 w-full max-w-none px-2.5 py-1 text-base data-[size=default]:h-11",
                        WIZARD_PRIMARY_FIELD_BORDER,
                        isPlayerLevelLocked && "cursor-not-allowed opacity-80",
                      )}
                      disabled={isPlayerLevelLocked}
                      aria-readonly={isPlayerLevelLocked}
                    >
                      <span className="flex flex-1 truncate text-left">{playerLevel}</span>
                    </SelectTrigger>
                    <SelectContent>
                      {playerLevelOptions.map((option) => (
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
              ) : isNameTooLongField ? (
                <p className="text-sm text-destructive" role="alert">
                  Player name is too long.
                </p>
              ) : isInvalidNameField ? (
                <p className="text-sm text-destructive" role="alert">
                  Player name can only contain letters and spaces.
                </p>
              ) : null}
            </li>
          );
        })}
      </ul>

      <Button
        type="button"
        variant="outline"
        className={cn("mt-4 w-full", WIZARD_OUTLINE_BUTTON_BORDER)}
        disabled={!canAddMorePlayers}
        onClick={() => {
          if (!canAddMorePlayers) return;
          setPlayerEntries((prev) => [
            ...prev,
            createQuickPlayWizardPlayerEntry(
              prev.length + 1,
              lockedLevel ?? DEFAULT_PLAYER_OPEN_PLAY_LEVEL,
            ),
          ]);
        }}
      >
        <Plus className="mr-2 h-4 w-4" aria-hidden />
        Add more player
      </Button>

      {!canAddMorePlayers ? (
        <p className="text-xs text-muted-foreground">Maximum of {MAX_QUICK_PLAY_PLAYERS} players reached.</p>
      ) : null}

      <label
        className={cn(
          "flex cursor-pointer items-start gap-3 rounded-lg border px-4 py-3 transition-colors",
          WIZARD_PANEL_BORDER,
        )}
      >
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

      <label
        className={cn(
          "flex cursor-pointer items-start gap-3 rounded-lg border px-4 py-3 transition-colors",
          WIZARD_PANEL_BORDER,
        )}
      >
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
  );
}

function QuickPlayPreviewStatCard({
  icon,
  value,
  label,
}: {
  icon: ReactNode;
  value: string | number;
  label: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-1 rounded-xl border px-3 py-3 text-center",
        WIZARD_PANEL_BORDER,
      )}
    >
      <span className="text-primary" aria-hidden>
        {icon}
      </span>
      <span className="text-xl font-semibold tabular-nums text-foreground">{value}</span>
      <span className="text-[11px] font-medium text-muted-foreground">{label}</span>
    </div>
  );
}

function QuickPlayPreviewDetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-3 border-b border-border/50 py-2.5 last:border-b-0 last:pb-0">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="max-w-[58%] text-right text-sm font-medium text-foreground">{value}</span>
    </div>
  );
}

function QuickPlayPreviewSection({
  title,
  onEdit,
  children,
}: {
  title: string;
  onEdit: () => void;
  children: ReactNode;
}) {
  return (
    <section className={cn("rounded-xl border p-4", WIZARD_PANEL_BORDER)}>
      <div className="mb-3 flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-foreground">{title}</h3>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-8 shrink-0 px-2 text-primary hover:text-primary"
          onClick={onEdit}
        >
          Edit
        </Button>
      </div>
      {children}
    </section>
  );
}

export function QuickPlayPreviewStep({
  sessionTitle,
  form,
  filledPlayers,
  defaultCheckInAllPlayers,
  allowManualPlayerAdd,
  onEditStep,
  footerNote,
}: {
  sessionTitle: string;
  form: QuickPlayWizardFormFields;
  filledPlayers: Array<{
    displayName: string;
    gender: "male" | "female";
    openPlayLevel: PlayerOpenPlayLevel;
  }>;
  defaultCheckInAllPlayers: boolean;
  allowManualPlayerAdd: boolean;
  onEditStep: (step: number) => void;
  footerNote: string;
}) {
  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <h2 className="text-base font-semibold text-foreground">Review your session</h2>
        <p className="text-sm text-muted-foreground">
          Confirm everything looks right before you start open play.
        </p>
      </div>

      <div className={cn("glass-panel rounded-2xl border border-primary/30 shadow-sm", WIZARD_PANEL_BORDER)}>
        <div className="p-5 sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0 space-y-1">
              <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Session</p>
              <h3 className="text-xl font-semibold leading-snug text-foreground">{sessionTitle}</h3>
              <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
                <Gauge className="size-3.5 shrink-0 text-primary" aria-hidden />
                {form.openPlayType}
              </p>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className={WIZARD_OUTLINE_BUTTON_BORDER}
              onClick={() => onEditStep(1)}
            >
              Edit details
            </Button>
          </div>

          <div className="mt-5 grid grid-cols-3 gap-2 sm:gap-3">
            <QuickPlayPreviewStatCard
              icon={<LayoutGrid className="size-4" />}
              value={form.courtCount}
              label={form.courtCount === 1 ? "Court" : "Courts"}
            />
            <QuickPlayPreviewStatCard
              icon={<Users className="size-4" />}
              value={filledPlayers.length}
              label={filledPlayers.length === 1 ? "Player" : "Players"}
            />
            <QuickPlayPreviewStatCard
              icon={<Shuffle className="size-4" />}
              value={getQuickPlayGameModeLabel(form.gameMode)}
              label="Game mode"
            />
          </div>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <QuickPlayPreviewSection title="Format" onEdit={() => onEditStep(1)}>
          <QuickPlayPreviewDetailRow
            label="Matching type"
            value={getQuickPlayMatchingTypeLabel(form.matchingType)}
          />
          <p className="pt-1 text-xs leading-relaxed text-muted-foreground">
            {getQuickPlayMatchingTypeDescription(form.matchingType)}
          </p>
        </QuickPlayPreviewSection>

        <QuickPlayPreviewSection title="Queue options" onEdit={() => onEditStep(2)}>
          <QuickPlayPreviewDetailRow
            label="Check in all players"
            value={defaultCheckInAllPlayers ? "Yes — start in queue" : "No — add manually"}
          />
          <QuickPlayPreviewDetailRow
            label="Manual player add"
            value={allowManualPlayerAdd ? "Allowed from dashboard" : "Not allowed"}
          />
        </QuickPlayPreviewSection>
      </div>

      <QuickPlayPreviewSection title="Players" onEdit={() => onEditStep(2)}>
        <ul className="m-0 flex list-none flex-wrap gap-2 p-0">
          {filledPlayers.map((player) => (
            <li key={player.displayName}>
              <span
                className={cn(
                  "inline-flex max-w-full items-center gap-2 rounded-full border px-2.5 py-1.5 text-sm",
                  WIZARD_PRIMARY_FIELD_BORDER,
                )}
              >
                <span
                  className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary"
                  aria-hidden
                >
                  {playerPreviewInitial(player.displayName)}
                </span>
                <span className="min-w-0 truncate font-medium text-foreground">{player.displayName}</span>
                <span className="shrink-0 text-[11px] text-muted-foreground">
                  {wizardGenderLabel(player.gender)} · {player.openPlayLevel}
                </span>
              </span>
            </li>
          ))}
        </ul>

        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            <UserCheck className="size-3.5 text-primary" aria-hidden />
            {defaultCheckInAllPlayers ? "Everyone starts checked in" : "Players start off the queue"}
          </span>
          {allowManualPlayerAdd ? (
            <span className="inline-flex items-center gap-1">
              <UserPlus className="size-3.5 text-primary" aria-hidden />
              More players can be added later
            </span>
          ) : null}
        </div>
      </QuickPlayPreviewSection>

      <p className="rounded-lg border border-primary/20 bg-primary/5 px-3 py-2.5 text-xs leading-relaxed text-muted-foreground">
        {footerNote}
      </p>
    </div>
  );
}
