import { getDeviceLabelFromRequest } from "@/lib/device-from-request";

export type VisitorRequestInfo = {
  ip: string;
  country: string;
  region: string;
  city: string;
  device: string;
};

function header(request: Request, name: string) {
  const value = request.headers.get(name)?.trim() ?? "";
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

/**
 * IP, device and best-effort location. Location comes from the host's geo headers
 * (Vercel or Cloudflare); it is empty when the host doesn't provide them.
 */
export function getVisitorRequestInfo(request: Request): VisitorRequestInfo {
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip")?.trim() ||
    request.headers.get("cf-connecting-ip")?.trim() ||
    "";

  return {
    ip: ip.slice(0, 64),
    country: (header(request, "x-vercel-ip-country") || header(request, "cf-ipcountry")).slice(0, 8),
    region: header(request, "x-vercel-ip-country-region").slice(0, 64),
    city: (header(request, "x-vercel-ip-city") || header(request, "cf-ipcity")).slice(0, 96),
    device: getDeviceLabelFromRequest(request),
  };
}
