/** Public base URL for QR codes and links opened on player phones (never use request Host). */
export function getPublicAppBaseUrl(): string {
  const fromEnv =
    process.env.APP_URL?.trim().replace(/\/$/, "") ||
    process.env.NEXT_PUBLIC_APP_URL?.trim().replace(/\/$/, "");
  if (fromEnv) return fromEnv;
  return "http://localhost:3000";
}

/** Base URL for server-side redirects; prefers public env, then request host. */
export function getAppBaseUrl(request?: Request): string {
  const publicBase = getPublicAppBaseUrl();
  if (publicBase !== "http://localhost:3000") return publicBase;

  if (request) {
    const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
    const forwardedProto = request.headers.get("x-forwarded-proto");
    const proto =
      forwardedProto ?? (host?.includes("localhost") || host?.startsWith("127.") ? "http" : "https");
    if (host) return `${proto}://${host}`;
  }

  return publicBase;
}

export function getGameRegisterUrl(baseUrl: string, gameId: string) {
  return `${baseUrl}/register/${gameId}`;
}

export function getGameSpectatorUrl(baseUrl: string, gameId: string) {
  return `${baseUrl}/games/${gameId}/spectate`;
}

export function isLocalhostAppUrl(url: string) {
  try {
    const { hostname } = new URL(url);
    return hostname === "localhost" || hostname === "127.0.0.1";
  } catch {
    return /localhost|127\.0\.0\.1/.test(url);
  }
}
