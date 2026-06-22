function hostnameFromAppUrl(url: string) {
  try {
    return new URL(url).hostname;
  } catch {
    return null;
  }
}

function formatShareCardSiteHost(hostname: string) {
  const bare = hostname.trim().replace(/^www\./i, "");
  if (!bare) return "";
  return `www.${bare}`;
}

function isLocalOrLanHost(hostname: string) {
  return hostname === "localhost" || /^\d+\.\d+\.\d+\.\d+$/.test(hostname);
}

function siteLabelFromEnv() {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (!appUrl) return null;
  const hostname = hostnameFromAppUrl(appUrl);
  if (!hostname) return null;
  return formatShareCardSiteHost(hostname);
}

/** Public site label for share cards, e.g. www.paddleflowj316.com */
export function getShareCardSiteLabel(host?: string): string {
  const envLabel = siteLabelFromEnv();

  if (host) {
    const hostname = host.split(":")[0]?.trim() ?? "";
    if (!hostname) return envLabel ?? "www.paddleflowj316.com";
    if (isLocalOrLanHost(hostname)) {
      return envLabel ?? formatShareCardSiteHost(hostname);
    }
    return formatShareCardSiteHost(hostname);
  }

  if (typeof window !== "undefined") {
    return getShareCardSiteLabel(window.location.host);
  }

  return envLabel ?? "www.paddleflowj316.com";
}
