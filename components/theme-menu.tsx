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
