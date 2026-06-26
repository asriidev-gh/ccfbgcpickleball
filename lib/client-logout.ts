import { logoutAccount } from "@/lib/logout-action";
import { clearBrowserSessionsOnLogout } from "@/lib/logout-session-cleanup";

export function performClientLogout() {
  clearBrowserSessionsOnLogout();
  void logoutAccount();
}
