"use client";

import { useQueryClient } from "@tanstack/react-query";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { OpenPlayTimeField } from "@/components/game/open-play-time-field";
import { OpenPlayTypePicker } from "@/components/game/open-play-type-picker";
import { NumberStepper } from "@/components/ui/number-stepper";
import { operatorShellQueryKey } from "@/lib/fetch-operator-game";
import type { OperatorShellPayload } from "@/lib/operator-payload";
import {
  formatOpenPlayTimeRange,
  getTodayOpenPlayDateInputValue,
  isOpenPlayTimeComplete,
  openPlayScheduleFieldsFromStored,
  validateOpenPlayTimeOrder,
  type OpenPlayMeridiem,
} from "@/lib/open-play-time-range";
import { defaultOpenPlayTitle, resolveStoredOpenPlayType } from "@/lib/open-play-types";
import {
  MAX_PLAYER_DISPLAY_NAME_LENGTH,
  sanitizePlayerDisplayNameInput,
} from "@/lib/player-profile-shared";

export type EditGameDialogGame = {
  gameId: string;
  title: string;
  openPlayType: string;
  courtCount: number;
  expectedPlayers: number;
  strictPlayerCount?: boolean;
};

type OwnerPlayerRow = {
  playerId?: string;
  displayName: string;
  canRemove: boolean;
};

type Meridiem = OpenPlayMeridiem;

type EditFormState = {
  title: string;
  openPlayType: string;
  openPlayDate: string;
  openPlayFromHour: string;
  openPlayFromMeridiem: Meridiem | "";
  openPlayToHour: string;
  openPlayToMeridiem: Meridiem | "";
  courtCount: number;
  expectedPlayers: number;
  strictPlayerCount: boolean;
  allowQrRegistration: boolean;
  allowManualPlayerAdd: boolean;
  registrationMode: "self" | "owner";
  ownerPlayers: OwnerPlayerRow[];
};

type EditGameDialogProps = {
  game: EditGameDialogGame | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
};

const INITIAL_FORM: EditFormState = {
  title: "",
  openPlayType: "Beginner",
  openPlayDate: getTodayOpenPlayDateInputValue(),
  openPlayFromHour: "7",
  openPlayFromMeridiem: "PM",
  openPlayToHour: "10",
  openPlayToMeridiem: "PM",
  courtCount: 2,
  expectedPlayers: 24,
  strictPlayerCount: false,
  allowQrRegistration: true,
  allowManualPlayerAdd: false,
  registrationMode: "self",
  ownerPlayers: [],
};

export function EditGameDialog({ game, open, onOpenChange, onSaved }: EditGameDialogProps) {
  const queryClient = useQueryClient();
  const [loading, setLoading] = useState(false);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [removedPlayerIds, setRemovedPlayerIds] = useState<string[]>([]);
  const [form, setForm] = useState<EditFormState>(INITIAL_FORM);
  const [timeRangeError, setTimeRangeError] = useState("");

  const isOwnerRegistration = form.registrationMode === "owner";

  useEffect(() => {
    if (!isOpenPlayTimeComplete(form)) {
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
    form.openPlayFromHour,
    form.openPlayFromMeridiem,
    form.openPlayToHour,
    form.openPlayToMeridiem,
  ]);

  const canSaveSchedule = () => {
    if (!form.openPlayDate.trim()) return false;
    if (!isOpenPlayTimeComplete(form)) return false;
    return validateOpenPlayTimeOrder(
      form.openPlayFromHour,
      form.openPlayFromMeridiem,
      form.openPlayToHour,
      form.openPlayToMeridiem,
    ).ok;
  };

  useEffect(() => {
    if (!game || !open) return;

    let cancelled = false;

    const load = async () => {
      setLoadingDetails(true);
      setRemovedPlayerIds([]);
      try {
        const response = await fetch(`/api/games/${game.gameId}/edit`);
        const data = await response.json();
        if (!response.ok) throw new Error(data.message);

        if (cancelled) return;

        const schedule = openPlayScheduleFieldsFromStored(
          data.game.openPlayDate,
          data.game.openPlayTimeRange,
        );

        setForm({
          title: data.game.title,
          openPlayType: resolveStoredOpenPlayType(data.game.openPlayType),
          ...schedule,
          courtCount: data.game.courtCount,
          expectedPlayers: data.game.expectedPlayers,
          strictPlayerCount: data.game.strictPlayerCount === true,
          allowQrRegistration: data.game.allowQrRegistration !== false,
          allowManualPlayerAdd: data.game.allowManualPlayerAdd === true,
          registrationMode: data.game.registrationMode === "owner" ? "owner" : "self",
          ownerPlayers: (data.ownerPlayers ?? []).map(
            (player: {
              playerId: string;
              displayName: string;
              canRemove: boolean;
            }) => ({
              playerId: player.playerId,
              displayName: player.displayName,
              canRemove: player.canRemove,
            }),
          ),
        });
      } catch (error) {
        if (!cancelled) {
          toast.error(error instanceof Error ? error.message : "Failed to load game details.");
          setForm({
            ...INITIAL_FORM,
            title: game.title,
            openPlayType: resolveStoredOpenPlayType(game.openPlayType),
            courtCount: game.courtCount,
            expectedPlayers: game.expectedPlayers,
            strictPlayerCount: game.strictPlayerCount === true,
          });
        }
      } finally {
        if (!cancelled) setLoadingDetails(false);
      }
    };

    void load();

    return () => {
      cancelled = true;
    };
  }, [game, open]);

  const activeOwnerPlayerCount = useMemo(
    () => form.ownerPlayers.filter((player) => player.displayName.trim().length > 0).length,
    [form.ownerPlayers],
  );

  const submit = async () => {
    if (!game) return;

    if (!canSaveSchedule()) {
      toast.error(timeRangeError || "Select a valid open play date and time range.");
      return;
    }

    if (isOwnerRegistration && activeOwnerPlayerCount < 1) {
      toast.error("Enter at least one player name.");
      return;
    }

    try {
      setLoading(true);

      const body: Record<string, unknown> = {
        title: form.title.trim(),
        openPlayType: form.openPlayType,
        openPlayDate: form.openPlayDate,
        openPlayTimeRange: formatOpenPlayTimeRange(
          form.openPlayFromHour,
          form.openPlayFromMeridiem as Meridiem,
          form.openPlayToHour,
          form.openPlayToMeridiem as Meridiem,
        ),
        courtCount: form.courtCount,
      };

      if (isOwnerRegistration) {
        body.allowQrRegistration = form.allowQrRegistration;
        body.allowManualPlayerAdd = form.allowManualPlayerAdd;
        body.ownerPlayers = [
          ...form.ownerPlayers
            .filter((player) => player.displayName.trim().length > 0)
            .map((player) => ({
              playerId: player.playerId,
              displayName: player.displayName.trim(),
            })),
          ...removedPlayerIds.map((playerId) => ({
            playerId,
            displayName: "Removed",
            remove: true,
          })),
        ];
      } else {
        body.expectedPlayers = form.expectedPlayers;
        body.strictPlayerCount = form.strictPlayerCount;
      }

      const response = await fetch(`/api/games/${game.gameId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message);

      queryClient.setQueryData<OperatorShellPayload>(
        operatorShellQueryKey(game.gameId),
        (current) => {
          if (!current) return current;
          return {
            ...current,
            game: {
              ...current.game,
              title: form.title.trim(),
              openPlayType: form.openPlayType,
              courtCount: form.courtCount,
              allowQrRegistration: form.allowQrRegistration,
              allowManualPlayerAdd: isOwnerRegistration ? form.allowManualPlayerAdd : false,
              registrationMode: isOwnerRegistration ? "owner" : current.game.registrationMode,
            },
          };
        },
      );
      await queryClient.invalidateQueries({ queryKey: operatorShellQueryKey(game.gameId) });

      toast.success("Game updated.");
      onOpenChange(false);
      onSaved();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update game.");
    } finally {
      setLoading(false);
    }
  };

  const removeOwnerPlayer = (index: number) => {
    const row = form.ownerPlayers[index];
    if (row?.playerId && row.canRemove === false) {
      toast.error("Players on court or who have finished a match cannot be removed here.");
      return;
    }
    if (row?.playerId) {
      setRemovedPlayerIds((prev) => [...prev, row.playerId!]);
    }
    setForm((prev) => ({
      ...prev,
      ownerPlayers: prev.ownerPlayers.filter((_, rowIndex) => rowIndex !== index),
    }));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[min(92dvh,52rem)] w-full max-w-[calc(100%-2rem)] flex-col gap-0 overflow-hidden p-0 sm:max-w-xl md:max-w-2xl lg:max-w-3xl">
        <DialogHeader className="border-b px-6 py-5">
          <DialogTitle className="text-xl">Edit game</DialogTitle>
          {game ? (
            <p className="text-sm text-muted-foreground">{game.title}</p>
          ) : null}
        </DialogHeader>

        <div className="flex-1 space-y-5 overflow-y-auto px-6 py-6">
          {loadingDetails ? (
            <div className="flex min-h-40 items-center justify-center text-muted-foreground">
              <Loader2 className="mr-2 h-5 w-5 animate-spin" aria-hidden />
              Loading game details…
            </div>
          ) : (
            <>
              <div className="space-y-3">
                <Label htmlFor="edit-game-title" className="text-base">
                  Game title
                </Label>
                <Input
                  id="edit-game-title"
                  className="h-11 text-base"
                  placeholder={defaultOpenPlayTitle(form.openPlayType)}
                  value={form.title}
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, title: event.target.value }))
                  }
                />
              </div>

              <OpenPlayTypePicker
                key={game?.gameId ?? "edit-game"}
                label="Open play type"
                value={form.openPlayType}
                onChange={(openPlayType) => setForm((prev) => ({ ...prev, openPlayType }))}
                className="space-y-3"
              />

              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="edit-open-play-date" className="text-base">
                    Open Play Date
                  </Label>
                  <Input
                    id="edit-open-play-date"
                    type="date"
                    className="h-11 text-base"
                    value={form.openPlayDate}
                    onChange={(event) =>
                      setForm((prev) => ({ ...prev, openPlayDate: event.target.value }))
                    }
                  />
                </div>
                <OpenPlayTimeField
                  idPrefix="edit-open-play-from"
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
                  idPrefix="edit-open-play-to"
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
                  <p className="text-sm text-destructive">{timeRangeError}</p>
                ) : null}
              </div>

              <div className="space-y-3">
                <Label htmlFor="edit-court-count" className="text-base">
                  How many courts?
                </Label>
                <NumberStepper
                  id="edit-court-count"
                  min={1}
                  max={20}
                  value={form.courtCount}
                  onChange={(courtCount) => setForm((prev) => ({ ...prev, courtCount }))}
                />
              </div>

              {isOwnerRegistration ? (
                <div className="space-y-4">
                  <div className="space-y-1">
                    <Label className="text-base">Registered players</Label>
                    <p className="text-sm text-muted-foreground">
                      Rename players or remove anyone still waiting in the queue. Players on court
                      cannot be removed until their match ends.
                    </p>
                  </div>
                  <ul className="space-y-3">
                    {form.ownerPlayers.map((player, index) => (
                      <li key={player.playerId ?? `new-${index}`} className="flex items-center gap-2">
                        <Input
                          className="h-11 flex-1 text-base"
                          placeholder={`Player ${index + 1} name`}
                          value={player.displayName}
                          maxLength={MAX_PLAYER_DISPLAY_NAME_LENGTH}
                          onChange={(event) => {
                            const next = [...form.ownerPlayers];
                            next[index] = {
                              ...next[index],
                              displayName: sanitizePlayerDisplayNameInput(event.target.value),
                            };
                            setForm((prev) => ({ ...prev, ownerPlayers: next }));
                          }}
                        />
                        {form.ownerPlayers.length > 1 ? (
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="size-11 shrink-0 text-muted-foreground hover:text-destructive"
                            aria-label={`Remove player ${index + 1}`}
                            onClick={() => removeOwnerPlayer(index)}
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
                    onClick={() =>
                      setForm((prev) => ({
                        ...prev,
                        ownerPlayers: [
                          ...prev.ownerPlayers,
                          { displayName: "", canRemove: true },
                        ],
                      }))
                    }
                  >
                    <Plus className="mr-2 h-4 w-4" aria-hidden />
                    Add more player
                  </Button>
                  <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-border bg-muted/30 px-4 py-3">
                    <Checkbox
                      id="edit-allow-qr-registration"
                      checked={form.allowQrRegistration}
                      onCheckedChange={(checked) =>
                        setForm((prev) => ({
                          ...prev,
                          allowQrRegistration: checked === true,
                        }))
                      }
                    />
                    <span className="space-y-1 leading-snug">
                      <span className="block text-sm font-medium">
                        Allow new users to join via QR code
                      </span>
                      <span className="block text-xs text-muted-foreground">
                        When off, the QR opens the spectator view instead.
                      </span>
                    </span>
                  </label>
                  <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-border bg-muted/30 px-4 py-3">
                    <Checkbox
                      id="edit-allow-manual-player-add"
                      checked={form.allowManualPlayerAdd}
                      onCheckedChange={(checked) =>
                        setForm((prev) => ({
                          ...prev,
                          allowManualPlayerAdd: checked === true,
                        }))
                      }
                    />
                    <span className="space-y-1 leading-snug">
                      <span className="block text-sm font-medium">
                        Allow new users to be added manually
                      </span>
                      <span className="block text-xs text-muted-foreground">
                        When enabled, you can add player names from the game dashboard and they will
                        join the queue automatically.
                      </span>
                    </span>
                  </label>
                </div>
              ) : (
                <>
                  <div className="space-y-3">
                    <Label htmlFor="edit-expected-players" className="text-base">
                      Expected players
                    </Label>
                    <NumberStepper
                      id="edit-expected-players"
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
                      id="edit-strict-player-count"
                      checked={form.strictPlayerCount}
                      onCheckedChange={(checked) =>
                        setForm((prev) => ({
                          ...prev,
                          strictPlayerCount: checked === true,
                        }))
                      }
                    />
                    <span className="space-y-1 leading-snug">
                      <span className="block text-base font-medium">Strict player count</span>
                      <span className="block text-sm text-muted-foreground">
                        When enabled, registration stops at {form.expectedPlayers} players.
                      </span>
                    </span>
                  </label>
                </>
              )}
            </>
          )}
        </div>

        <div className="flex justify-end gap-3 border-t bg-muted/40 px-6 py-4">
          <Button variant="outline" size="lg" onClick={() => onOpenChange(false)} disabled={loading}>
            Cancel
          </Button>
          <Button
            size="lg"
            onClick={submit}
            disabled={loading || loadingDetails || !game || !canSaveSchedule()}
          >
            {loading ? "Saving…" : "Save changes"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
