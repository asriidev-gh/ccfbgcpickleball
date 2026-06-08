"use client";

import { Check, Palette } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import {
  APP_THEMES,
  applyTheme,
  DEFAULT_THEME,
  THEME_STORAGE_KEY,
  type AppTheme,
} from "@/components/theme/theme-manager";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

function useThemeState() {
  const [theme, setTheme] = useState<AppTheme>(() => {
    if (typeof window === "undefined") return DEFAULT_THEME;
    return (localStorage.getItem(THEME_STORAGE_KEY) as AppTheme | null) ?? DEFAULT_THEME;
  });

  const updateTheme = (nextTheme: AppTheme) => {
    setTheme(nextTheme);
    localStorage.setItem(THEME_STORAGE_KEY, nextTheme);
    applyTheme(nextTheme);
    toast.success(`Theme: ${APP_THEMES.find((t) => t.value === nextTheme)?.label}`);
  };

  return { theme, updateTheme };
}

export function ThemeMenuItems() {
  const { theme, updateTheme } = useThemeState();

  return (
    <DropdownMenuGroup>
      <DropdownMenuLabel className="flex items-center gap-2">
        <Palette className="h-4 w-4" />
        Change Theme
      </DropdownMenuLabel>
      {APP_THEMES.map((option) => (
        <DropdownMenuItem key={option.value} onClick={() => updateTheme(option.value)}>
          {theme === option.value ? <Check className="text-primary" /> : <span className="w-4" />}
          {option.label}
        </DropdownMenuItem>
      ))}
    </DropdownMenuGroup>
  );
}

export function ThemePickerDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { theme, updateTheme } = useThemeState();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Palette className="h-5 w-5 shrink-0 text-primary" aria-hidden />
            Change Theme
          </DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-1 py-1">
          {APP_THEMES.map((option) => (
            <Button
              key={option.value}
              type="button"
              variant={theme === option.value ? "default" : "outline"}
              className="h-10 w-full justify-start gap-2"
              onClick={() => {
                updateTheme(option.value);
                onOpenChange(false);
              }}
            >
              {theme === option.value ? <Check className="h-4 w-4 shrink-0" aria-hidden /> : null}
              {option.label}
            </Button>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function ThemeMenu() {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            variant="outline"
            size="icon"
            className="h-11 w-11 shrink-0 rounded-full border-border"
            aria-label="Change theme"
          />
        }
      >
        <Palette className="h-6 w-6" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <ThemeMenuItems />
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
