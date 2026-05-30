/** Builds a short human-readable device label from the request User-Agent. */
export function getDeviceLabelFromRequest(request: Request): string {
  const ua = request.headers.get("user-agent")?.trim();
  if (!ua) return "Unknown device";

  const isTablet = /iPad|Tablet|PlayBook|Silk/i.test(ua);
  const isMobile = !isTablet && /Mobile|Android|iPhone|iPod|IEMobile|BlackBerry/i.test(ua);

  let os = "Unknown OS";
  if (/Windows NT/i.test(ua)) os = "Windows";
  else if (/iPhone|iPad|iPod/i.test(ua)) os = "iOS";
  else if (/Mac OS X|Macintosh/i.test(ua)) os = "macOS";
  else if (/Android/i.test(ua)) os = "Android";
  else if (/CrOS/i.test(ua)) os = "ChromeOS";
  else if (/Linux/i.test(ua)) os = "Linux";

  let browser = "";
  if (/Edg\//i.test(ua)) browser = "Edge";
  else if (/OPR\/|Opera/i.test(ua)) browser = "Opera";
  else if (/Chrome\//i.test(ua) && !/Edg/i.test(ua)) browser = "Chrome";
  else if (/Firefox\//i.test(ua)) browser = "Firefox";
  else if (/Safari\//i.test(ua) && !/Chrome/i.test(ua)) browser = "Safari";

  const deviceType = isTablet ? "Tablet" : isMobile ? "Mobile" : "Desktop";
  return browser ? `${deviceType} · ${os} · ${browser}` : `${deviceType} · ${os}`;
}
