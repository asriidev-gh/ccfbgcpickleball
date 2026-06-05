/** Browsers cannot navigate to http://0.0.0.0 (ERR_ADDRESS_INVALID). */
export function normalizeBrowserOrigin(origin: string) {
  return origin
    .replace(/^http:\/\/0\.0\.0\.0(?=:|$)/, "http://localhost")
    .replace(/^https:\/\/0\.0\.0\.0(?=:|$)/, "https://localhost");
}

export function resolveClientBrowserOrigin() {
  if (typeof window === "undefined") return "http://localhost:3000";
  return normalizeBrowserOrigin(window.location.origin);
}

export function buildImpersonateUrl(token: string) {
  return `${resolveClientBrowserOrigin()}/api/auth/impersonate?token=${encodeURIComponent(token)}`;
}
