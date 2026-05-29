function parseEnvFlag(value: string | undefined): boolean {
  if (!value) return false;
  const normalized = value.trim().toLowerCase();
  return normalized === "true" || normalized === "1" || normalized === "on" || normalized === "yes";
}

/** Show Reset on operator dashboard and allow POST /api/games/[id]/reset */
export function isGameResetEnabled(): boolean {
  return (
    parseEnvFlag(process.env.NEXT_PUBLIC_ENABLE_GAME_RESET) ||
    parseEnvFlag(process.env.ENABLE_GAME_RESET)
  );
}
