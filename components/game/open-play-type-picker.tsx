"use client";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { OPEN_PLAY_TYPES, type OpenPlayType } from "@/lib/open-play-types";
import { cn } from "@/lib/utils";

type OpenPlayTypePickerProps = {
  value: OpenPlayType;
  onChange: (value: OpenPlayType) => void;
  label?: string;
  description?: string;
  className?: string;
};

export function OpenPlayTypePicker({
  value,
  onChange,
  label = "Players level",
  description,
  className,
}: OpenPlayTypePickerProps) {
  return (
    <div className={cn("space-y-4", className)}>
      <div className="space-y-1">
        <Label className="text-base">{label}</Label>
        {description ? <p className="text-sm text-muted-foreground">{description}</p> : null}
      </div>
      <div className="grid grid-cols-1 justify-items-stretch gap-3 sm:grid-cols-2">
        {OPEN_PLAY_TYPES.map((type) => {
          const selected = value === type;

          return (
            <Button
              key={type}
              type="button"
              variant="ghost"
              size="sm"
              className={cn(
                "h-auto min-h-12 w-full justify-center whitespace-normal border px-3 py-2.5 text-center text-sm leading-snug",
                selected
                  ? "border-primary bg-primary text-primary-foreground shadow-none hover:bg-primary/90"
                  : "border-primary/45 bg-background text-foreground hover:border-primary/70 hover:bg-primary/5",
              )}
              onClick={() => onChange(type)}
            >
              {type}
            </Button>
          );
        })}
      </div>
    </div>
  );
}
