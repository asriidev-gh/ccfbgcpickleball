"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select";
import type { PlayerCardShareContent } from "@/lib/player-card-share-content";
import { cn } from "@/lib/utils";

type PlayerCardShareContentPickerProps = {
  value: PlayerCardShareContent;
  onChange: (value: PlayerCardShareContent) => void;
  endorsementCount: number;
  disabled?: boolean;
  className?: string;
};

const OPTIONS: Array<{ value: PlayerCardShareContent; label: string }> = [
  { value: "stats", label: "Scores & rank" },
  { value: "endorsements", label: "Endorsements" },
  { value: "both", label: "Both" },
];

export function PlayerCardShareContentPicker({
  value,
  onChange,
  endorsementCount,
  disabled = false,
  className,
}: PlayerCardShareContentPickerProps) {
  const hasEndorsements = endorsementCount > 0;
  const selectedLabel = OPTIONS.find((option) => option.value === value)?.label ?? "What to share";

  return (
    <div className={cn("min-w-0 flex-1 basis-0", className)}>
      <Select
        value={value}
        disabled={disabled}
        onValueChange={(next) => {
          if (next === "stats" || next === "endorsements" || next === "both") {
            onChange(next);
          }
        }}
      >
        <SelectTrigger
          id="player-card-share-content"
          aria-label="What to share"
          className="h-9 min-w-0 w-full max-w-none bg-background text-foreground shadow-sm data-[size=default]:h-9"
        >
          <span className="flex flex-1 truncate text-left">{selectedLabel}</span>
        </SelectTrigger>
        <SelectContent align="start" className="bg-popover text-popover-foreground">
          {OPTIONS.map((option) => {
            const optionDisabled = !hasEndorsements && option.value !== "stats";
            return (
              <SelectItem key={option.value} value={option.value} disabled={optionDisabled}>
                {option.label}
              </SelectItem>
            );
          })}
        </SelectContent>
      </Select>
    </div>
  );
}
