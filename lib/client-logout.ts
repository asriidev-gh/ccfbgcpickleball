import { clearBrowserSessionsOnLogout } from "@/lib/logout-session-cleanup";

export async function performClientLogout() {
  clearBrowserSessionsOnLogout();
  await fetch("/api/auth/logout", { method: "POST" });
}
