"use client";

import { Minus, Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type NumberStepperProps = {
  id?: string;
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  className?: string;
  inputClassName?: string;
  buttonClassName?: string;
  invalid?: boolean;
};

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

export function NumberStepper({
  id,
  value,
  onChange,
  min = 1,
  max = 99,
  step = 1,
  className,
  inputClassName,
  buttonClassName,
  invalid = false,
}: NumberStepperProps) {
  const setValue = (next: number) => onChange(clamp(next, min, max));

  return (
    <div className={cn("number-stepper flex items-center gap-2", className)}>
      <Button
        type="button"
        variant="outline"
        size="icon"
        className={cn("h-11 w-11 shrink-0", buttonClassName)}
        aria-label="Decrease"
        disabled={value <= min}
        onClick={() => setValue(value - step)}
      >
        <Minus className="h-4 w-4" />
      </Button>
      <Input
        id={id}
        type="number"
        min={min}
        max={max}
        step={step}
        value={value}
        aria-invalid={invalid}
        className={cn("h-11 text-center text-base tabular-nums", inputClassName)}
        onChange={(event) => {
          const parsed = Number.parseInt(event.target.value, 10);
          if (Number.isNaN(parsed)) return;
          setValue(parsed);
        }}
        onBlur={(event) => {
          const parsed = Number.parseInt(event.target.value, 10);
          if (Number.isNaN(parsed) || parsed < min) {
            onChange(min);
          }
        }}
      />
      <Button
        type="button"
        variant="outline"
        size="icon"
        className={cn("h-11 w-11 shrink-0", buttonClassName)}
        aria-label="Increase"
        disabled={value >= max}
        onClick={() => setValue(value + step)}
      >
        <Plus className="h-4 w-4" />
      </Button>
    </div>
  );
}
