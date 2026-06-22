import { clearPendingEphemeralQuickGameTransfer } from "@/lib/ephemeral-quick-game-transfer";
import { clearAllQuickGameSessions } from "@/lib/quick-game-store";

/** Drop browser-stored game sessions so /play and dashboards start fresh after logout. */
export function clearBrowserSessionsOnLogout() {
  clearAllQuickGameSessions();
  clearPendingEphemeralQuickGameTransfer();
}
