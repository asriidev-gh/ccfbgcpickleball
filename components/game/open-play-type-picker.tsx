"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  formatMixedOpenPlayLevels,
  isAnyLevelOpenPlayType,
  isFixedOpenPlayType,
  isMixedOpenPlayType,
  OPEN_PLAY_TYPES,
  parseMixedOpenPlayLevels,
  PLAYER_OPEN_PLAY_LEVELS,
  type OpenPlayType,
  type PlayerOpenPlayLevel,
} from "@/lib/open-play-types";
import {
  WIZARD_OPTION_SELECTED,
  WIZARD_OPTION_UNSELECTED,
} from "@/lib/wizard-field-styles";
import { cn } from "@/lib/utils";

type OpenPlayTypePickerProps = {
  value: string;
  onChange: (value: string) => void;
  label?: string;
  description?: string;
  className?: string;
};

function deriveMultiselectState(value: string): {
  multiselect: boolean;
  selectedLevels: PlayerOpenPlayLevel[];
} {
  const mixed = parseMixedOpenPlayLevels(value);
  if (mixed) {
    return { multiselect: true, selectedLevels: mixed };
  }

  if (isFixedOpenPlayType(value)) {
    return { multiselect: false, selectedLevels: [value] };
  }

  return { multiselect: false, selectedLevels: ["Beginner"] };
}

export function OpenPlayTypePicker({
  value,
  onChange,
  label = "Players level",
  description,
  className,
}: OpenPlayTypePickerProps) {
  const [multiselect, setMultiselect] = useState(() => deriveMultiselectState(value).multiselect);
  const [selectedLevels, setSelectedLevels] = useState<PlayerOpenPlayLevel[]>(
    () => deriveMultiselectState(value).selectedLevels,
  );

  const handleMultiselectToggle = (checked: boolean) => {
    if (checked) {
      const levels: PlayerOpenPlayLevel[] =
        isFixedOpenPlayType(value)
          ? [value]
          : isMixedOpenPlayType(value)
            ? (parseMixedOpenPlayLevels(value) ?? ["Beginner"])
            : selectedLevels.length > 0
              ? selectedLevels
              : ["Beginner"];
      setMultiselect(true);
      setSelectedLevels(levels);
      onChange(formatMixedOpenPlayLevels(levels));
      return;
    }

    const nextLevel =
      isMixedOpenPlayType(value)
        ? (parseMixedOpenPlayLevels(value)?.[0] ?? selectedLevels[0] ?? "Beginner")
        : isFixedOpenPlayType(value)
          ? value
          : selectedLevels[0] ?? "Beginner";

    setMultiselect(false);
    setSelectedLevels([nextLevel]);
    onChange(nextLevel);
  };

  const handleSingleSelect = (type: OpenPlayType) => {
    if (multiselect) return;
    onChange(type);
  };

  const handleLevelToggle = (level: PlayerOpenPlayLevel) => {
    if (!multiselect) return;

    const isSelected = selectedLevels.includes(level);
    const nextLevels = isSelected
      ? selectedLevels.length === 1
        ? selectedLevels
        : selectedLevels.filter((entry) => entry !== level)
      : [...selectedLevels, level];

    setSelectedLevels(nextLevels);
    onChange(formatMixedOpenPlayLevels(nextLevels));
  };

  const singleValue = isAnyLevelOpenPlayType(value)
    ? value
    : isFixedOpenPlayType(value)
      ? value
      : isMixedOpenPlayType(value)
        ? null
        : ("Beginner" as OpenPlayType);

  return (
    <div className={cn("space-y-4", className)}>
      <div className="space-y-3">
        <div className="space-y-1">
          <Label className="text-base">{label}</Label>
          {description ? <p className="text-sm text-muted-foreground">{description}</p> : null}
        </div>
        <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-border bg-muted/30 px-4 py-3">
          <Checkbox
            checked={multiselect}
            onCheckedChange={(checked) => handleMultiselectToggle(checked === true)}
          />
          <span className="space-y-1 leading-snug">
            <span className="block text-sm font-medium">Multiselect</span>
            <span className="block text-sm text-muted-foreground">
              Choose one or more skill levels. The session title defaults to a mix when multiple
              levels are selected.
            </span>
          </span>
        </label>
      </div>

      <div className="grid grid-cols-1 justify-items-stretch gap-3 sm:grid-cols-2">
        {multiselect
          ? PLAYER_OPEN_PLAY_LEVELS.map((level) => {
              const selected = selectedLevels.includes(level);

              return (
                <Button
                  key={level}
                  type="button"
                  variant="ghost"
                  size="sm"
                  className={cn(
                    "h-auto min-h-12 w-full justify-center whitespace-normal border px-3 py-2.5 text-center text-sm leading-snug",
                    selected ? WIZARD_OPTION_SELECTED : WIZARD_OPTION_UNSELECTED,
                  )}
                  onClick={() => handleLevelToggle(level)}
                >
                  {level}
                </Button>
              );
            })
          : OPEN_PLAY_TYPES.map((type) => {
              const selected = singleValue === type;

              return (
                <Button
                  key={type}
                  type="button"
                  variant="ghost"
                  size="sm"
                  className={cn(
                    "h-auto min-h-12 w-full justify-center whitespace-normal border px-3 py-2.5 text-center text-sm leading-snug",
                    selected ? WIZARD_OPTION_SELECTED : WIZARD_OPTION_UNSELECTED,
                  )}
                  onClick={() => handleSingleSelect(type)}
                >
                  {type}
                </Button>
              );
            })}
      </div>
    </div>
  );
}
