"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { refetchOperatorQueueData } from "@/lib/fetch-operator-game";
import { addLocalManualPlayer } from "@/lib/local-game-session";
import {
  getSessionPlayerOpenPlayLevels,
  isFixedOpenPlayType,
  type OpenPlayType,
  type PlayerOpenPlayLevel,
} from "@/lib/open-play-types";
import {
  readOperatorGamePayload,
  writeOperatorGamePayload,
} from "@/lib/operator-game-cache";
import {
  isValidPlayerDisplayName,
  MAX_PLAYER_DISPLAY_NAME_LENGTH,
  playerDisplayNameInvalidCharacterMessage,
  playerDisplayNameTooLongMessage,
  sanitizePlayerDisplayNameInput,
  type GenderOption,
} from "@/lib/player-profile-shared";
import {
  DEFAULT_PLAYER_OPEN_PLAY_LEVEL,
  WIZARD_PLAYER_LEVEL_OPTIONS,
} from "@/lib/quick-play-wizard-shared";
import { useQuickGameSession } from "@/lib/quick-game-store";
import {
  collectSessionPlayerDisplayNameKeys,
  isDuplicateSessionPlayerName,
  normalizePlayerDisplayNameKey,
} from "@/lib/session-player-display-names";
import { WIZARD_PRIMARY_FIELD_BORDER } from "@/lib/wizard-field-styles";
import { cn } from "@/lib/utils";

const MANUAL_ADD_GENDER_OPTIONS = [
  { value: "male", label: "Male" },
  { value: "female", label: "Female" },
] as const satisfies ReadonlyArray<{ value: GenderOption; label: string }>;

type AddManualPlayerDialogProps = {
  gameId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onPlayerAdded?: () => void | Promise<void>;
  /** When true, append to browser-only session state instead of the API. */
  localMode?: boolean;
  sessionOpenPlayType?: OpenPlayType | string;
};

type AddManualPlayerPayload = {
  displayName: string;
  gender: GenderOption;
  openPlayLevel: PlayerOpenPlayLevel;
};

export function AddManualPlayerDialog({
  gameId,
  open,
  onOpenChange,
  onPlayerAdded,
  localMode = false,
  sessionOpenPlayType,
}: AddManualPlayerDialogProps) {
  const queryClient = useQueryClient();
  const [displayName, setDisplayName] = useState("");
  const [gender, setGender] = useState<GenderOption | "">("");
  const [openPlayLevel, setOpenPlayLevel] = useState<PlayerOpenPlayLevel>(
    DEFAULT_PLAYER_OPEN_PLAY_LEVEL,
  );

  const localPayload = useQuickGameSession(localMode && open ? gameId : "");

  const resolvedSessionOpenPlayType = useMemo(() => {
    if (sessionOpenPlayType) return sessionOpenPlayType;
    const payload = localMode ? localPayload : readOperatorGamePayload(queryClient, gameId);
    return payload?.game.openPlayType ?? "Beginner";
  }, [gameId, localMode, localPayload, queryClient, sessionOpenPlayType]);

  const sessionLockedPlayerLevel = isFixedOpenPlayType(resolvedSessionOpenPlayType)
    ? resolvedSessionOpenPlayType
    : null;
  const sessionLevelOptions = getSessionPlayerOpenPlayLevels(resolvedSessionOpenPlayType);
  const playerLevelOptions =
    sessionLevelOptions === null
      ? WIZARD_PLAYER_LEVEL_OPTIONS
      : WIZARD_PLAYER_LEVEL_OPTIONS.filter((option) => sessionLevelOptions.includes(option.value));
  const playerLevel = sessionLockedPlayerLevel ?? openPlayLevel;

  const existingNameKeys = useMemo(() => {
    if (!open) return new Set<string>();
    const payload = localMode ? localPayload : readOperatorGamePayload(queryClient, gameId);
    if (!payload) return new Set<string>();
    return collectSessionPlayerDisplayNameKeys(payload);
  }, [gameId, localMode, localPayload, open, queryClient]);

  const trimmedDisplayName = displayName.trim();
  const isDuplicateName =
    trimmedDisplayName.length > 0 &&
    existingNameKeys.has(normalizePlayerDisplayNameKey(trimmedDisplayName));

  useEffect(() => {
    if (!open) {
      setDisplayName("");
      setGender("");
      setOpenPlayLevel(DEFAULT_PLAYER_OPEN_PLAY_LEVEL);
      return;
    }
    if (sessionLockedPlayerLevel) {
      setOpenPlayLevel(sessionLockedPlayerLevel);
      return;
    }
    if (sessionLevelOptions?.[0]) {
      setOpenPlayLevel(sessionLevelOptions[0]);
    }
  }, [open, sessionLockedPlayerLevel, sessionLevelOptions]);

  const addPlayerMutation = useMutation({
    mutationFn: async (payload: AddManualPlayerPayload) => {
      if (localMode) {
        const current = readOperatorGamePayload(queryClient, gameId);
        if (!current) throw new Error("Session not found.");
        const next = addLocalManualPlayer(
          current,
          payload.displayName,
          payload.gender,
          payload.openPlayLevel,
        );
        if (!next) {
          throw new Error(
            isDuplicateSessionPlayerName(current, payload.displayName)
              ? "This name is already in the game."
              : "Enter a player name.",
          );
        }
        writeOperatorGamePayload(queryClient, gameId, next);
        return `${payload.displayName.trim()} added to the queue.`;
      }

      const response = await fetch(`/api/games/${gameId}/add-player`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = (await response.json()) as { message?: string };
      if (!response.ok) throw new Error(data.message ?? "Failed to add player.");
      return data.message ?? "Player added to the queue.";
    },
    onSuccess: async (message) => {
      if (!localMode) {
        await refetchOperatorQueueData(queryClient, gameId);
      }
      await onPlayerAdded?.();
      toast.success(message);
      setDisplayName("");
      setGender("");
      setOpenPlayLevel(DEFAULT_PLAYER_OPEN_PLAY_LEVEL);
      onOpenChange(false);
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Failed to add player.");
    },
  });

  const canSubmit =
    trimmedDisplayName.length > 0 &&
    trimmedDisplayName.length <= MAX_PLAYER_DISPLAY_NAME_LENGTH &&
    isValidPlayerDisplayName(trimmedDisplayName) &&
    Boolean(gender) &&
    Boolean(playerLevel) &&
    !isDuplicateName &&
    !addPlayerMutation.isPending;

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    const trimmed = displayName.trim();
    if (!trimmed) {
      toast.error("Enter a player name.");
      return;
    }
    if (trimmed.length > MAX_PLAYER_DISPLAY_NAME_LENGTH) {
      toast.error(playerDisplayNameTooLongMessage());
      return;
    }
    if (!isValidPlayerDisplayName(trimmed)) {
      toast.error(playerDisplayNameInvalidCharacterMessage());
      return;
    }
    if (isDuplicateName) {
      toast.error("This name is already in the game.");
      return;
    }
    if (!gender) {
      toast.error("Select a gender.");
      return;
    }
    if (!playerLevel) {
      toast.error("Select a player level.");
      return;
    }
    addPlayerMutation.mutate({ displayName: trimmed, gender, openPlayLevel: playerLevel });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add player manually</DialogTitle>
          <DialogDescription>
            Enter a name, gender, and player level. The player will be added to the end of the queue.
            {localMode ? " This session is browser-only — the player is not saved to the database." : ""}
          </DialogDescription>
        </DialogHeader>
        <form className="space-y-4" onSubmit={handleSubmit}>
          <div className="space-y-2">
            <Label htmlFor="manual-player-name">Player name</Label>
            <Input
              id="manual-player-name"
              value={displayName}
              maxLength={MAX_PLAYER_DISPLAY_NAME_LENGTH}
              onChange={(event) => setDisplayName(sanitizePlayerDisplayNameInput(event.target.value))}
              placeholder="e.g. Juan Dela Cruz"
              autoFocus
              disabled={addPlayerMutation.isPending}
              aria-invalid={isDuplicateName}
              className={cn(
                WIZARD_PRIMARY_FIELD_BORDER,
                isDuplicateName && "border-destructive focus-visible:ring-destructive/30",
              )}
            />
            {isDuplicateName ? (
              <p className="text-sm text-destructive" role="alert">
                This name is already in the game.
              </p>
            ) : null}
          </div>
          <fieldset className="space-y-3">
            <legend className="text-sm font-medium leading-none">Gender</legend>
            <RadioGroup
              value={gender}
              onValueChange={(value) => {
                if (value === "male" || value === "female") {
                  setGender(value);
                }
              }}
              className="gap-2"
              disabled={addPlayerMutation.isPending}
            >
              {MANUAL_ADD_GENDER_OPTIONS.map((option) => (
                <label
                  key={option.value}
                  className="flex cursor-pointer items-center gap-3 rounded-lg border border-border/70 px-3 py-2.5 transition-colors has-[[data-checked]]:border-primary/50 has-[[data-checked]]:bg-primary/5"
                >
                  <RadioGroupItem value={option.value} />
                  <span className="text-sm font-medium">{option.label}</span>
                </label>
              ))}
            </RadioGroup>
          </fieldset>
          <div className="space-y-2">
            <Label htmlFor="manual-player-level">Player level</Label>
            {sessionLockedPlayerLevel ? (
              <p className="text-sm text-muted-foreground">
                Matches this session ({sessionLockedPlayerLevel}).
              </p>
            ) : null}
            <Select
              value={playerLevel}
              disabled={Boolean(sessionLockedPlayerLevel) || addPlayerMutation.isPending}
              onValueChange={(value) => {
                if (WIZARD_PLAYER_LEVEL_OPTIONS.some((option) => option.value === value)) {
                  setOpenPlayLevel(value as PlayerOpenPlayLevel);
                }
              }}
            >
              <SelectTrigger
                id="manual-player-level"
                className={cn(
                  "h-11 w-full text-base",
                  WIZARD_PRIMARY_FIELD_BORDER,
                  sessionLockedPlayerLevel && "cursor-not-allowed opacity-80",
                )}
              >
                <SelectValue />
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
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={addPlayerMutation.isPending}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={!canSubmit}>
              {addPlayerMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
                  Adding…
                </>
              ) : (
                "Add player manually"
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
