"use client";

import { Check, ChevronDown, Palette } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  COURTS_VIEW_COURT_THEME_OPTIONS,
  getCourtsViewCourtThemeLabel,
  type CourtsViewCourtTheme,
} from "@/lib/courts-view-court-theme";
import { cn } from "@/lib/utils";

function CourtThemeSwatch({
  colors,
  className,
}: {
  colors: [string, string, string];
  className?: string;
}) {
  return (
    <span
      className={cn(
        "court-theme-swatch inline-flex h-4 w-7 shrink-0 overflow-hidden rounded-sm border border-white/20",
        className,
      )}
      aria-hidden
    >
      <span className="h-full flex-1" style={{ backgroundColor: colors[0] }} />
      <span className="h-full flex-[0.55]" style={{ backgroundColor: colors[1] }} />
      <span className="h-full flex-1" style={{ backgroundColor: colors[2] }} />
    </span>
  );
}

type CourtsViewCourtThemeSelectProps = {
  value: CourtsViewCourtTheme;
  onChange: (theme: CourtsViewCourtTheme) => void;
  className?: string;
};

export function CourtsViewCourtThemeSelect({
  value,
  onChange,
  className,
}: CourtsViewCourtThemeSelectProps) {
  const selected = COURTS_VIEW_COURT_THEME_OPTIONS.find((option) => option.id === value);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            type="button"
            variant="outline"
            size="sm"
            className={cn("courts-view-court-theme-select h-8 gap-1.5 px-2.5 font-normal", className)}
            aria-label={`Court theme: ${getCourtsViewCourtThemeLabel(value)}`}
          />
        }
      >
        <Palette className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
        {selected ? <CourtThemeSwatch colors={selected.swatch} /> : null}
        <span className="hidden sm:inline">{getCourtsViewCourtThemeLabel(value)}</span>
        <ChevronDown className="h-4 w-4 shrink-0 opacity-60" aria-hidden />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52">
        <DropdownMenuGroup>
          <DropdownMenuLabel>Court theme</DropdownMenuLabel>
          {COURTS_VIEW_COURT_THEME_OPTIONS.map((option) => (
            <DropdownMenuItem
              key={option.id}
              className="courts-view-court-theme-option gap-2"
              onClick={() => onChange(option.id)}
            >
              {value === option.id ? (
                <Check className="size-4 shrink-0 text-primary" aria-hidden />
              ) : (
                <span className="size-4 shrink-0" aria-hidden />
              )}
              <CourtThemeSwatch colors={option.swatch} />
              <span>{option.label}</span>
            </DropdownMenuItem>
          ))}
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
