import { clearPendingEphemeralQuickGameTransfer } from "@/lib/ephemeral-quick-game-transfer";
import { clearAllQuickGameSessions } from "@/lib/quick-game-store";

const SESSION_STORAGE_PREFIXES = [
  "ccf-queue-highlight-",
  "ccf-operator-dashboard-lease-",
  "spectator-presence-",
  "ccf-spectator-checkout-read:",
  "ccf-ephemeral-leaderboard-save-dismiss:",
] as const;

const LOCAL_STORAGE_PREFIXES = ["ccf-queue-highlight-active:"] as const;

function clearStorageByPrefixes(
  storage: Storage,
  prefixes: readonly string[],
) {
  const keys: string[] = [];
  for (let index = 0; index < storage.length; index += 1) {
    const key = storage.key(index);
    if (key && prefixes.some((prefix) => key.startsWith(prefix))) {
      keys.push(key);
    }
  }
  keys.forEach((key) => storage.removeItem(key));
}

/** Drop browser-stored game sessions so /play and dashboards start fresh after logout. */
export function clearBrowserSessionsOnLogout() {
  clearAllQuickGameSessions();
  clearPendingEphemeralQuickGameTransfer();

  if (typeof window === "undefined") return;

  clearStorageByPrefixes(sessionStorage, SESSION_STORAGE_PREFIXES);
  clearStorageByPrefixes(localStorage, LOCAL_STORAGE_PREFIXES);
}
