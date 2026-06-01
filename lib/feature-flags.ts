function parseEnvFlag(value: string | undefined): boolean {
  if (!value) return false;
  const normalized = value.trim().toLowerCase();
  return normalized === "true" || normalized === "1" || normalized === "on" || normalized === "yes";
}

/** Legacy env flag; reset is gated by demo open play title in the dashboard and API. */
export function isGameResetEnabled(): boolean {
  return (
    parseEnvFlag(process.env.NEXT_PUBLIC_ENABLE_GAME_RESET) ||
    parseEnvFlag(process.env.ENABLE_GAME_RESET)
  );
}
