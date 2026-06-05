"use client";

import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { OpenPlayMeridiem } from "@/lib/open-play-time-range";

const OPEN_PLAY_HOUR_OPTIONS = Array.from({ length: 12 }, (_, index) => String(index + 1));
const OPEN_PLAY_MERIDIEM_OPTIONS: OpenPlayMeridiem[] = ["AM", "PM"];

type OpenPlayTimeFieldProps = {
  idPrefix: string;
  label: string;
  hour: string;
  meridiem: OpenPlayMeridiem | "";
  onHourChange: (hour: string) => void;
  onMeridiemChange: (meridiem: OpenPlayMeridiem) => void;
};

export function OpenPlayTimeField({
  idPrefix,
  label,
  hour,
  meridiem,
  onHourChange,
  onMeridiemChange,
}: OpenPlayTimeFieldProps) {
  return (
    <div className="space-y-2">
      <Label className="text-base">{label}</Label>
      <div className="grid grid-cols-2 gap-3">
        <Select value={hour || null} onValueChange={(value) => onHourChange(value ?? "")}>
          <SelectTrigger id={`${idPrefix}-hour`} className="h-11 w-full bg-background text-base">
            <SelectValue placeholder="Hour" />
          </SelectTrigger>
          <SelectContent className="bg-popover text-popover-foreground">
            {OPEN_PLAY_HOUR_OPTIONS.map((option) => (
              <SelectItem key={option} value={option}>
                {option}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={meridiem || null}
          onValueChange={(value) => onMeridiemChange((value ?? "AM") as OpenPlayMeridiem)}
        >
          <SelectTrigger
            id={`${idPrefix}-meridiem`}
            className="h-11 w-full bg-background text-base"
          >
            <SelectValue placeholder="AM/PM" />
          </SelectTrigger>
          <SelectContent className="bg-popover text-popover-foreground">
            {OPEN_PLAY_MERIDIEM_OPTIONS.map((option) => (
              <SelectItem key={option} value={option}>
                {option}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
