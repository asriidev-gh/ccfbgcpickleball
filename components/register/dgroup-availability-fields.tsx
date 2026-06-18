"use client";

import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  DGROUP_WEEKDAY_LABELS,
  DGROUP_WEEKDAYS,
  getDgroupTimeRangeError,
  type DgroupWeekday,
} from "@/lib/dgroup-availability-shared";
import { cn } from "@/lib/utils";

type DgroupAvailabilityFieldsProps = {
  days: DgroupWeekday[];
  timeFrom: string;
  timeTo: string;
  disabled?: boolean;
  fieldErrors?: Record<string, string>;
  onToggleDay: (day: DgroupWeekday, checked: boolean) => void;
  onTimeFromChange: (value: string) => void;
  onTimeToChange: (value: string) => void;
};

export function DgroupAvailabilityFields({
  days,
  timeFrom,
  timeTo,
  disabled = false,
  fieldErrors = {},
  onToggleDay,
  onTimeFromChange,
  onTimeToChange,
}: DgroupAvailabilityFieldsProps) {
  const timeRangeError =
    fieldErrors.dgroupAvailableTimeTo ||
    fieldErrors.dgroupAvailableTimeFrom ||
    getDgroupTimeRangeError(timeFrom, timeTo);

  return (
    <div className="register-block space-y-4 rounded-lg border border-border/70 bg-muted/5 p-4">
      <div className="space-y-2">
        <Label className="register-label">Which days are you usually available?</Label>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {DGROUP_WEEKDAYS.map((day) => {
            const checked = days.includes(day);
            return (
              <label
                key={day}
                className={cn(
                  "flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm transition-colors",
                  checked
                    ? "border-primary/40 bg-primary/10"
                    : "border-border/70 bg-background/50",
                  fieldErrors.dgroupAvailableDays && !checked && "border-destructive/40",
                )}
              >
                <Checkbox
                  checked={checked}
                  disabled={disabled}
                  onCheckedChange={(value) => onToggleDay(day, Boolean(value))}
                />
                <span>{DGROUP_WEEKDAY_LABELS[day]}</span>
              </label>
            );
          })}
        </div>
        {fieldErrors.dgroupAvailableDays ? (
          <p className="text-sm text-destructive" role="alert">
            {fieldErrors.dgroupAvailableDays}
          </p>
        ) : null}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="dgroup-time-from">Time available from</Label>
          <Input
            id="dgroup-time-from"
            type="time"
            value={timeFrom}
            max={timeTo || undefined}
            disabled={disabled}
            aria-invalid={Boolean(fieldErrors.dgroupAvailableTimeFrom || timeRangeError)}
            className={cn(
              "h-11 bg-background",
              (fieldErrors.dgroupAvailableTimeFrom || timeRangeError) &&
                "border-destructive focus-visible:ring-destructive/30",
            )}
            onChange={(event) => onTimeFromChange(event.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="dgroup-time-to">Time available to</Label>
          <Input
            id="dgroup-time-to"
            type="time"
            value={timeTo}
            min={timeFrom || undefined}
            disabled={disabled}
            aria-invalid={Boolean(fieldErrors.dgroupAvailableTimeTo || timeRangeError)}
            className={cn(
              "h-11 bg-background",
              (fieldErrors.dgroupAvailableTimeTo || timeRangeError) &&
                "border-destructive focus-visible:ring-destructive/30",
            )}
            onChange={(event) => onTimeToChange(event.target.value)}
          />
        </div>
      </div>
      {timeRangeError ? (
        <p className="text-sm text-destructive" role="alert">
          {timeRangeError}
        </p>
      ) : null}
    </div>
  );
}
