"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2, Users } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  DGROUP_WEEKDAY_LABELS,
  DGROUP_WEEKDAYS,
  getDgroupTimeRangeError,
  type DgroupWeekday,
} from "@/lib/dgroup-availability-shared";
import type { SpectatePlayerFeatures } from "@/lib/spectate-player-features-shared";
import { cn } from "@/lib/utils";

export function SpectateDgroupRequestDialog({
  gameId,
  playerId,
  open,
  onOpenChange,
  initial,
}: {
  gameId: string;
  playerId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initial: Pick<
    SpectatePlayerFeatures,
    | "wantsToJoinDgroup"
    | "dgroupAvailableDays"
    | "dgroupAvailableTimeFrom"
    | "dgroupAvailableTimeTo"
    | "isDgroupRequestAcknowledged"
    | "hasSubmittedDgroupRequest"
  >;
}) {
  const queryClient = useQueryClient();
  const [wantsToJoin, setWantsToJoin] = useState(false);
  const [days, setDays] = useState<DgroupWeekday[]>([]);
  const [timeFrom, setTimeFrom] = useState("");
  const [timeTo, setTimeTo] = useState("");

  useEffect(() => {
    if (!open) return;
    setWantsToJoin(initial.wantsToJoinDgroup === true);
    setDays(initial.dgroupAvailableDays);
    setTimeFrom(initial.dgroupAvailableTimeFrom);
    setTimeTo(initial.dgroupAvailableTimeTo);
  }, [open, initial]);

  const readOnly = initial.hasSubmittedDgroupRequest;
  const isAcknowledged = initial.isDgroupRequestAcknowledged;

  const submitMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch(`/api/games/${gameId}/spectate/player/dgroup-request`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          playerId,
          wantsToJoinDgroup: wantsToJoin,
          dgroupAvailableDays: wantsToJoin ? days : [],
          dgroupAvailableTimeFrom: wantsToJoin ? timeFrom : "",
          dgroupAvailableTimeTo: wantsToJoin ? timeTo : "",
        }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.message ?? "Failed to submit D-group request.");
      return payload as { message?: string };
    },
    onSuccess: (payload) => {
      toast.success(payload.message ?? "D-group request saved.");
      queryClient.invalidateQueries({ queryKey: ["spectate-player-features", gameId, playerId] });
      onOpenChange(false);
    },
    onError: (submitError) => {
      toast.error(submitError instanceof Error ? submitError.message : "Failed to submit.");
    },
  });

  const toggleDay = (day: DgroupWeekday, checked: boolean) => {
    setDays((prev) =>
      checked ? [...prev, day] : prev.filter((value) => value !== day),
    );
  };

  const timeRangeError = wantsToJoin ? getDgroupTimeRangeError(timeFrom, timeTo) : null;
  const canSubmit =
    !wantsToJoin ||
    (days.length > 0 && Boolean(timeFrom) && Boolean(timeTo) && !timeRangeError);

  const handleSubmit = () => {
    if (!canSubmit) {
      if (timeRangeError) toast.error(timeRangeError);
      else if (wantsToJoin && days.length === 0) toast.error("Select at least one day you are available.");
      else if (wantsToJoin && (!timeFrom || !timeTo)) toast.error("Enter both start and end times.");
      return;
    }
    submitMutation.mutate();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="h-5 w-5 text-amber-600" aria-hidden />
            Join a D-group
          </DialogTitle>
          <DialogDescription>
            {readOnly
              ? isAcknowledged
                ? "Your D-group request was acknowledged. You cannot submit another request."
                : "Your D-group request has been submitted. You cannot submit another request."
              : "Let the club know you want to join a D-group and when you are usually available."}
          </DialogDescription>
        </DialogHeader>

        {readOnly ? (
          <div className="space-y-3 rounded-xl border border-amber-500/30 bg-amber-500/10 p-4">
            <div className="flex flex-wrap items-center gap-2">
              <Badge className="bg-amber-500/15 text-amber-800 dark:text-amber-200">
                Submitted
              </Badge>
              {isAcknowledged ? (
                <Badge className="dgroup-acknowledged-badge">
                  Acknowledged
                </Badge>
              ) : null}
            </div>
            <p className="text-sm text-foreground">
              {isAcknowledged
                ? "Your club has acknowledged your request and will follow up with you."
                : "Your request is on file. The club will review it soon."}
            </p>
          </div>
        ) : (
        <div className="space-y-5">
          <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-border/70 bg-muted/10 p-4">
            <Checkbox
              checked={wantsToJoin}
              onCheckedChange={(value) => setWantsToJoin(Boolean(value))}
            />
            <span className="space-y-1">
              <span className="block text-sm font-medium text-foreground">
                I want to request to join a D-group
              </span>
              <span className="block text-sm text-muted-foreground">
                The club can follow up with you about fellowship groups.
              </span>
            </span>
          </label>

          {wantsToJoin ? (
            <div className="space-y-4 rounded-xl border border-border/70 bg-muted/5 p-4">
              <div className="space-y-2">
                <Label>Day of the week availability</Label>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {DGROUP_WEEKDAYS.map((day) => {
                    const checked = days.includes(day);
                    return (
                      <label
                        key={day}
                        className={cn(
                          "flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm transition-colors",
                          checked
                            ? "border-amber-500/40 bg-amber-500/10"
                            : "border-border/70 bg-background/50",
                        )}
                      >
                        <Checkbox
                          checked={checked}
                          onCheckedChange={(value) => toggleDay(day, Boolean(value))}
                        />
                        <span>{DGROUP_WEEKDAY_LABELS[day]}</span>
                      </label>
                    );
                  })}
                </div>
              </div>

              <div className="space-y-2">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="dgroup-time-from">Time available from</Label>
                    <Input
                      id="dgroup-time-from"
                      type="time"
                      value={timeFrom}
                      max={timeTo || undefined}
                      aria-invalid={Boolean(timeRangeError)}
                      className={cn(
                        "h-11 bg-background",
                        timeRangeError && "border-destructive focus-visible:ring-destructive/30",
                      )}
                      onChange={(event) => setTimeFrom(event.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="dgroup-time-to">Time available to</Label>
                    <Input
                      id="dgroup-time-to"
                      type="time"
                      value={timeTo}
                      min={timeFrom || undefined}
                      aria-invalid={Boolean(timeRangeError)}
                      className={cn(
                        "h-11 bg-background",
                        timeRangeError && "border-destructive focus-visible:ring-destructive/30",
                      )}
                      onChange={(event) => setTimeTo(event.target.value)}
                    />
                  </div>
                </div>
                {timeRangeError ? (
                  <p className="text-sm text-destructive" role="alert">
                    {timeRangeError}
                  </p>
                ) : null}
              </div>
            </div>
          ) : null}
        </div>
        )}

        <DialogFooter className="gap-2 sm:gap-0">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            {readOnly ? "Close" : "Cancel"}
          </Button>
          {!readOnly ? (
          <Button
            type="button"
            disabled={submitMutation.isPending || (wantsToJoin && !canSubmit)}
            onClick={handleSubmit}
          >
            {submitMutation.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
                Saving…
              </>
            ) : (
              "Submit request"
            )}
          </Button>
          ) : null}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
