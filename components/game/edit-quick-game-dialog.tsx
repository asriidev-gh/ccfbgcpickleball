"use client";

import { useQueryClient } from "@tanstack/react-query";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { GoogleMapEmbedDialog } from "@/components/google-map-embed-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { OpenPlayTimeField } from "@/components/game/open-play-time-field";
import { OpenPlayTypePicker } from "@/components/game/open-play-type-picker";
import { NumberStepper } from "@/components/ui/number-stepper";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  canEditQuickGameRoster,
  extractQuickGamePlayerRoster,
  patchQuickGameMetadata,
  rebuildQuickGameSetup,
  type LocalPreRegisteredPlayer,
} from "@/lib/local-game-session";
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
  GENDER_OPTIONS,
  findFirstPlayerNameTooLongIndex,
  findFirstPlayerNameWithInvalidCharactersIndex,
  MAX_PLAYER_DISPLAY_NAME_LENGTH,
  playerDisplayNameInvalidCharacterMessage,
  playerDisplayNameTooLongMessage,
  sanitizePlayerDisplayNameInput,
} from "@/lib/player-profile-shared";
import type { OperatorFullPayload } from "@/lib/operator-payload";
import {
  ensureAccountQuickGameHydrated,
  saveQuickGameSession,
} from "@/lib/quick-game-persistence-client";
import { writeQuickGamePayload } from "@/lib/quick-game-store";
import { seedLocalGameOperatorCache } from "@/lib/operator-game-cache";

const MIN_PRE_REGISTERED_PLAYERS = 4;

type WizardPlayerEntry = {
  name: string;
  gender: "male" | "female" | "";
};

const EMPTY_PLAYER: WizardPlayerEntry = { name: "", gender: "" };

type Meridiem = OpenPlayMeridiem;

type EditQuickGameDialogProps = {
  gameId: string | null;
  title: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
};

export function EditQuickGameDialog({
  gameId,
  title,
  open,
  onOpenChange,
  onSaved,
}: EditQuickGameDialogProps) {
  const queryClient = useQueryClient();
  const [loading, setLoading] = useState(false);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [payload, setPayload] = useState<OperatorFullPayload | null>(null);
  const [sessionTitle, setSessionTitle] = useState("");
  const [openPlayType, setOpenPlayType] = useState("Beginner");
  const [openPlayDate, setOpenPlayDate] = useState(getTodayOpenPlayDateInputValue());
  const [openPlayFromHour, setOpenPlayFromHour] = useState("7");
  const [openPlayFromMeridiem, setOpenPlayFromMeridiem] = useState<Meridiem | "">("PM");
  const [openPlayToHour, setOpenPlayToHour] = useState("10");
  const [openPlayToMeridiem, setOpenPlayToMeridiem] = useState<Meridiem | "">("PM");
  const [venueName, setVenueName] = useState("");
  const [venueAddress, setVenueAddress] = useState("");
  const [venueGoogleMapEmbedUrl, setVenueGoogleMapEmbedUrl] = useState("");
  const [venueMapDialogOpen, setVenueMapDialogOpen] = useState(false);
  const [courtCount, setCourtCount] = useState(2);
  const [allowManualPlayerAdd, setAllowManualPlayerAdd] = useState(false);
  const [checkInAllPlayers, setCheckInAllPlayers] = useState(true);
  const [playerEntries, setPlayerEntries] = useState<WizardPlayerEntry[]>([EMPTY_PLAYER]);
  const [timeRangeError, setTimeRangeError] = useState("");

  const rosterEditable = payload ? canEditQuickGameRoster(payload) : false;

  useEffect(() => {
    if (!isOpenPlayTimeComplete({
      openPlayFromHour,
      openPlayFromMeridiem,
      openPlayToHour,
      openPlayToMeridiem,
    })) {
      setTimeRangeError("");
      return;
    }

    const validation = validateOpenPlayTimeOrder(
      openPlayFromHour,
      openPlayFromMeridiem as Meridiem,
      openPlayToHour,
      openPlayToMeridiem as Meridiem,
    );
    setTimeRangeError(validation.ok ? "" : validation.message);
  }, [openPlayFromHour, openPlayFromMeridiem, openPlayToHour, openPlayToMeridiem]);

  useEffect(() => {
    if (!gameId || !open) return;

    let cancelled = false;

    const load = async () => {
      setLoadingDetails(true);
      try {
        const loaded = await ensureAccountQuickGameHydrated(gameId);
        if (cancelled) return;

        setPayload(loaded);
        const schedule = openPlayScheduleFieldsFromStored(
          loaded.game.openPlayDate,
          loaded.game.openPlayTimeRange,
        );

        setSessionTitle(loaded.game.title);
        setOpenPlayType(resolveStoredOpenPlayType(loaded.game.openPlayType));
        setOpenPlayDate(schedule.openPlayDate);
        setOpenPlayFromHour(schedule.openPlayFromHour);
        setOpenPlayFromMeridiem(schedule.openPlayFromMeridiem);
        setOpenPlayToHour(schedule.openPlayToHour);
        setOpenPlayToMeridiem(schedule.openPlayToMeridiem);
        setVenueName(loaded.game.venueName ?? "");
        setVenueAddress(loaded.game.venueAddress ?? "");
        setVenueGoogleMapEmbedUrl(loaded.game.venueGoogleMapEmbedUrl ?? "");
        setCourtCount(loaded.game.courtCount);
        setAllowManualPlayerAdd(loaded.game.allowManualPlayerAdd === true);
        setCheckInAllPlayers((loaded.checkedOut?.length ?? 0) === 0);

        const roster = extractQuickGamePlayerRoster(loaded);
        setPlayerEntries(
          roster.length > 0
            ? roster.map((player) => ({
                name: player.displayName,
                gender:
                  player.gender === "male" || player.gender === "female" ? player.gender : "",
              }))
            : [EMPTY_PLAYER],
        );
      } catch (error) {
        if (!cancelled) {
          toast.error(error instanceof Error ? error.message : "Failed to load quick game.");
        }
      } finally {
        if (!cancelled) setLoadingDetails(false);
      }
    };

    void load();

    return () => {
      cancelled = true;
    };
  }, [gameId, open]);

  const filledPlayers = useMemo(
    () =>
      playerEntries
        .map((entry) => ({
          displayName: entry.name.trim(),
          gender: entry.gender,
        }))
        .filter((entry) => entry.displayName.length > 0),
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

  const canSave = () => {
    if (!sessionTitle.trim()) return false;
    if (!openPlayDate.trim()) return false;
    if (
      !isOpenPlayTimeComplete({
        openPlayFromHour,
        openPlayFromMeridiem,
        openPlayToHour,
        openPlayToMeridiem,
      })
    ) {
      return false;
    }
    if (
      !validateOpenPlayTimeOrder(
        openPlayFromHour,
        openPlayFromMeridiem as Meridiem,
        openPlayToHour,
        openPlayToMeridiem as Meridiem,
      ).ok
    ) {
      return false;
    }
    if (rosterEditable) {
      if (filledPlayers.length < MIN_PRE_REGISTERED_PLAYERS) return false;
      if (tooLongPlayerNameIndex !== null) return false;
      if (invalidPlayerNameIndex !== null) return false;
      if (!filledPlayers.every((player) => player.gender === "male" || player.gender === "female")) {
        return false;
      }
    }
    return true;
  };

  const submit = async () => {
    if (!gameId || !payload) return;
    if (!canSave()) {
      if (tooLongPlayerNameIndex !== null) {
        toast.error(playerDisplayNameTooLongMessage());
      } else if (invalidPlayerNameIndex !== null) {
        toast.error(playerDisplayNameInvalidCharacterMessage());
      } else {
        toast.error(timeRangeError || "Complete all required fields.");
      }
      return;
    }

    const openPlayTimeRange = formatOpenPlayTimeRange(
      openPlayFromHour,
      openPlayFromMeridiem as Meridiem,
      openPlayToHour,
      openPlayToMeridiem as Meridiem,
    );

    const players: LocalPreRegisteredPlayer[] = filledPlayers.map((player) => ({
      displayName: player.displayName,
      gender: player.gender as "male" | "female",
    }));

    const trimmedVenueName = venueName.trim();
    const trimmedVenueAddress = venueAddress.trim();
    const trimmedVenueMapEmbedUrl = venueGoogleMapEmbedUrl.trim();

    try {
      setLoading(true);

      const nextPayload = rosterEditable
        ? rebuildQuickGameSetup(payload, {
            title: sessionTitle.trim(),
            openPlayType,
            openPlayDate,
            openPlayTimeRange,
            venueName: trimmedVenueName,
            venueAddress: trimmedVenueAddress,
            venueGoogleMapEmbedUrl: trimmedVenueMapEmbedUrl,
            courtCount,
            allowQrRegistration: false,
            allowManualPlayerAdd,
            players,
            checkInAllPlayers,
          })
        : patchQuickGameMetadata(payload, {
            title: sessionTitle.trim(),
            openPlayType,
            openPlayDate,
            openPlayTimeRange,
            venueName: trimmedVenueName,
            venueAddress: trimmedVenueAddress,
            venueGoogleMapEmbedUrl: trimmedVenueMapEmbedUrl,
            courtCount: payload.game.courtCount,
            allowManualPlayerAdd,
          });

      writeQuickGamePayload(gameId, nextPayload);
      seedLocalGameOperatorCache(queryClient, gameId);
      await saveQuickGameSession(
        gameId,
        nextPayload,
        "checkpoint",
        nextPayload.game.status === "ended" ? "ended" : "active",
      );

      toast.success("Quick game updated.");
      onOpenChange(false);
      onSaved();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update quick game.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[min(92dvh,52rem)] w-[calc(100%-1.5rem)] max-w-3xl flex-col gap-0 overflow-hidden p-0 sm:max-w-xl md:max-w-2xl">
        <DialogHeader className="border-b px-4 py-5">
          <DialogTitle className="text-xl">Edit Quick Game</DialogTitle>
          <p className="text-sm text-muted-foreground">{title}</p>
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-5">
          {loadingDetails ? (
            <div className="flex items-center justify-center py-16 text-muted-foreground">
              <Loader2 className="mr-2 h-5 w-5 animate-spin" aria-hidden />
              Loading…
            </div>
          ) : (
            <div className="space-y-5">
              {!rosterEditable ? (
                <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-900 dark:text-amber-100">
                  Play is in progress, so only session details can be edited. Player roster changes
                  are disabled until courts are empty and there are no completed matches.
                </p>
              ) : null}

              <div className="space-y-2">
                <Label htmlFor="quick-edit-title">Session title</Label>
                <Input
                  id="quick-edit-title"
                  placeholder={defaultOpenPlayTitle(openPlayType)}
                  value={sessionTitle}
                  onChange={(event) => setSessionTitle(event.target.value)}
                />
              </div>

              <OpenPlayTypePicker
                key={gameId ?? "edit-quick-game"}
                label="Open play type"
                value={openPlayType}
                onChange={setOpenPlayType}
                className="space-y-2"
              />

              <div className="space-y-4">
                <div className="space-y-1">
                  <h3 className="text-base font-medium text-foreground">Venue</h3>
                  <p className="text-sm text-muted-foreground">
                    Where players will meet for this open play.
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="quick-edit-venue-name">Venue name</Label>
                  <Input
                    id="quick-edit-venue-name"
                    placeholder="e.g. Dragonsmash Taguig Branch"
                    maxLength={120}
                    value={venueName}
                    onChange={(event) => setVenueName(event.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="quick-edit-venue-address">Address</Label>
                  <Textarea
                    id="quick-edit-venue-address"
                    className="min-h-[5.5rem] resize-y"
                    placeholder="Street, city, or directions to the courts"
                    maxLength={240}
                    rows={3}
                    value={venueAddress}
                    onChange={(event) => setVenueAddress(event.target.value)}
                  />
                </div>
                <div className="space-y-3">
                  <Label>Google Map</Label>
                  {venueGoogleMapEmbedUrl ? (
                    <div className="space-y-3">
                      <div className="aspect-video overflow-hidden rounded-xl border border-border/70 bg-muted/20">
                        <iframe
                          src={venueGoogleMapEmbedUrl}
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
                          onClick={() => setVenueGoogleMapEmbedUrl("")}
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
                      className="w-full border-dashed sm:w-auto"
                      onClick={() => setVenueMapDialogOpen(true)}
                    >
                      Add Google Map
                    </Button>
                  )}
                </div>
              </div>

              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="quick-edit-open-play-date">Open Play Date</Label>
                  <Input
                    id="quick-edit-open-play-date"
                    type="date"
                    className="h-11"
                    value={openPlayDate}
                    onChange={(event) => setOpenPlayDate(event.target.value)}
                  />
                </div>
                <OpenPlayTimeField
                  idPrefix="quick-edit-open-play-from"
                  label="From Time"
                  hour={openPlayFromHour}
                  meridiem={openPlayFromMeridiem}
                  onHourChange={setOpenPlayFromHour}
                  onMeridiemChange={setOpenPlayFromMeridiem}
                />
                <OpenPlayTimeField
                  idPrefix="quick-edit-open-play-to"
                  label="To Time"
                  hour={openPlayToHour}
                  meridiem={openPlayToMeridiem}
                  onHourChange={setOpenPlayToHour}
                  onMeridiemChange={setOpenPlayToMeridiem}
                />
                {timeRangeError ? (
                  <p className="text-sm text-destructive">{timeRangeError}</p>
                ) : null}
              </div>

              <div className="space-y-2">
                <Label>Courts</Label>
                {rosterEditable ? (
                  <NumberStepper value={courtCount} min={1} max={12} onChange={setCourtCount} />
                ) : (
                  <p className="text-sm text-muted-foreground">{courtCount}</p>
                )}
              </div>

              {rosterEditable ? (
                <div className="space-y-3">
                  <div>
                    <Label>Players</Label>
                    <p className="text-xs text-muted-foreground">
                      Minimum {MIN_PRE_REGISTERED_PLAYERS} players with name and gender.
                    </p>
                  </div>
                  <ul className="space-y-3">
                    {playerEntries.map((entry, index) => (
                      <li key={`player-${index}`} className="space-y-1">
                        <div className="flex items-start gap-2">
                          <Input
                            value={entry.name}
                            placeholder={`Player ${index + 1}`}
                            className="min-w-0 flex-1"
                            maxLength={MAX_PLAYER_DISPLAY_NAME_LENGTH}
                            onChange={(event) => {
                              const next = [...playerEntries];
                              next[index] = {
                                ...next[index],
                                name: sanitizePlayerDisplayNameInput(event.target.value),
                              };
                              setPlayerEntries(next);
                            }}
                          />
                          <Select
                            value={entry.gender || null}
                            onValueChange={(value) => {
                              const next = [...playerEntries];
                              next[index] = {
                                ...next[index],
                                gender: value as WizardPlayerEntry["gender"],
                              };
                              setPlayerEntries(next);
                            }}
                          >
                            <SelectTrigger className="w-[9.5rem] shrink-0">
                              <SelectValue placeholder="Gender" />
                            </SelectTrigger>
                            <SelectContent>
                              {GENDER_OPTIONS.filter(
                                (option) => option.value === "male" || option.value === "female",
                              ).map((option) => (
                                <SelectItem key={option.value} value={option.value}>
                                  {option.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          {playerEntries.length > 1 ? (
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="size-11 shrink-0 text-muted-foreground hover:text-destructive"
                              aria-label={`Remove player ${index + 1}`}
                              onClick={() =>
                                setPlayerEntries((prev) =>
                                  prev.filter((_, rowIndex) => rowIndex !== index),
                                )
                              }
                            >
                              <Trash2 className="h-4 w-4" aria-hidden />
                            </Button>
                          ) : (
                            <span className="size-11 shrink-0" aria-hidden />
                          )}
                        </div>
                      </li>
                    ))}
                  </ul>
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full"
                    onClick={() => setPlayerEntries((prev) => [...prev, EMPTY_PLAYER])}
                  >
                    <Plus className="mr-2 h-4 w-4" aria-hidden />
                    Add more player
                  </Button>
                  <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-border bg-muted/30 px-4 py-3">
                    <Checkbox
                      checked={checkInAllPlayers}
                      onCheckedChange={(checked) => setCheckInAllPlayers(checked === true)}
                    />
                    <span className="space-y-1 leading-snug">
                      <span className="block text-sm font-medium">Default check in all players</span>
                      <span className="block text-xs text-muted-foreground">
                        When checked, every player starts in the active queue.
                      </span>
                    </span>
                  </label>
                </div>
              ) : null}

              <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-border bg-muted/30 px-4 py-3">
                <Checkbox
                  checked={allowManualPlayerAdd}
                  onCheckedChange={(checked) => setAllowManualPlayerAdd(checked === true)}
                />
                <span className="space-y-1 leading-snug">
                  <span className="block text-sm font-medium">Allow new users to be added manually</span>
                </span>
              </label>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-3 border-t bg-muted/40 px-4 py-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button disabled={loading || loadingDetails || !canSave()} onClick={() => void submit()}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : "Save changes"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>

    <GoogleMapEmbedDialog
      open={venueMapDialogOpen}
      onOpenChange={setVenueMapDialogOpen}
      initialValue={venueGoogleMapEmbedUrl}
      textareaId="quick-edit-venue-google-map-embed"
      onSave={(embedUrl) => {
        setVenueGoogleMapEmbedUrl(embedUrl);
        setVenueMapDialogOpen(false);
      }}
    />
    </>
  );
}
