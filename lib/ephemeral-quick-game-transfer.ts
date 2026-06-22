import type { QueryClient } from "@tanstack/react-query";
import Swal from "sweetalert2";
import { toast } from "sonner";

import { applyEndOpenPlayOptimistic } from "@/lib/game-payload-mutations";
import { savedQuickGamesQueryKey } from "@/hooks/use-saved-quick-games";
import {
  createAccountQuickGameId,
  getQuickGameDashboardPath,
  isEphemeralQuickGame,
} from "@/lib/local-game-id";
import {
  seedLocalGameOperatorCache,
  writeOperatorGamePayload,
} from "@/lib/operator-game-cache";
import type { OperatorFullPayload } from "@/lib/operator-payload";
import { saveQuickGameSession } from "@/lib/quick-game-persistence-client";
import {
  initializeQuickGameSession,
  readQuickGamePayload,
  removeQuickGameSession,
} from "@/lib/quick-game-store";
import { swalAlertBaseOptions } from "@/lib/swal-theme";

const PENDING_TRANSFER_KEY = "ccfpickleball:pending-ephemeral-quick-game-transfer";

export type PendingEphemeralQuickGameTransfer = {
  sourceGameId: string;
  payload: OperatorFullPayload;
  endAfterSave: boolean;
};

export type EphemeralSaveChoice = "save" | "decline" | "dismiss";

export function stashPendingEphemeralQuickGameTransfer(transfer: PendingEphemeralQuickGameTransfer) {
  if (typeof sessionStorage === "undefined") return;
  sessionStorage.setItem(PENDING_TRANSFER_KEY, JSON.stringify(transfer));
}

export function readPendingEphemeralQuickGameTransfer(): PendingEphemeralQuickGameTransfer | null {
  if (typeof sessionStorage === "undefined") return null;
  const raw = sessionStorage.getItem(PENDING_TRANSFER_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as PendingEphemeralQuickGameTransfer;
  } catch {
    return null;
  }
}

export function clearPendingEphemeralQuickGameTransfer() {
  if (typeof sessionStorage === "undefined") return;
  sessionStorage.removeItem(PENDING_TRANSFER_KEY);
}

export function remapEphemeralPayloadToAccount(
  payload: OperatorFullPayload,
  newGameId: string,
): OperatorFullPayload {
  return {
    ...payload,
    game: {
      ...payload.game,
      gameId: newGameId,
      liveQueue: false,
      quickGamePersistence: "account",
    },
  };
}

export async function promptSaveEphemeralQuickGame(): Promise<EphemeralSaveChoice> {
  const result = await Swal.fire({
    ...swalAlertBaseOptions,
    title: "Save open session?",
    text: "You want to save this open session to your account before ending.",
    icon: "question",
    showCancelButton: true,
    confirmButtonText: "Yes",
    cancelButtonText: "No need",
  });
  if (result.isConfirmed) return "save";
  if (result.dismiss === Swal.DismissReason.cancel) return "decline";
  return "dismiss";
}

async function persistEphemeralPayloadAsAccountGame(
  queryClient: QueryClient,
  sourceGameId: string,
  payload: OperatorFullPayload,
  options: { endAfterSave: boolean },
): Promise<string> {
  const newGameId = createAccountQuickGameId();
  let next = remapEphemeralPayloadToAccount(payload, newGameId);
  if (options.endAfterSave) {
    next = applyEndOpenPlayOptimistic(next);
  }

  removeQuickGameSession(sourceGameId);
  initializeQuickGameSession(newGameId, next);
  writeOperatorGamePayload(queryClient, newGameId, next);
  seedLocalGameOperatorCache(queryClient, newGameId);

  const saveStatus: "active" | "ended" =
    next.game.status === "ended" ? "ended" : "active";

  await saveQuickGameSession(
    newGameId,
    next,
    options.endAfterSave ? "end" : "create",
    saveStatus,
  );
  void queryClient.invalidateQueries({ queryKey: savedQuickGamesQueryKey() });
  return newGameId;
}

export async function transferEphemeralQuickGameToAccount(
  queryClient: QueryClient,
  sourceGameId: string,
  options: { endAfterSave: boolean },
): Promise<string> {
  const payload = readQuickGamePayload(sourceGameId);
  if (!payload) throw new Error("Session not found.");
  if (!isEphemeralQuickGame(sourceGameId)) {
    throw new Error("Only public quick play sessions can be transferred.");
  }
  return persistEphemeralPayloadAsAccountGame(queryClient, sourceGameId, payload, options);
}

export async function completePendingEphemeralQuickGameTransfer(
  queryClient: QueryClient,
): Promise<string | null> {
  const pending = readPendingEphemeralQuickGameTransfer();
  if (!pending) return null;
  clearPendingEphemeralQuickGameTransfer();

  const livePayload = readQuickGamePayload(pending.sourceGameId);
  const payload = livePayload ?? pending.payload;

  return persistEphemeralPayloadAsAccountGame(queryClient, pending.sourceGameId, payload, {
    endAfterSave: pending.endAfterSave,
  });
}

export async function beginEphemeralQuickGameSaveToAccount({
  gameId,
  queryClient,
  router,
  endAfterSave,
}: {
  gameId: string;
  queryClient: QueryClient;
  router: { push: (href: string) => void; replace: (href: string) => void };
  endAfterSave: boolean;
}) {
  const payload = readQuickGamePayload(gameId);
  if (!payload) {
    toast.error("Session not found.");
    return;
  }

  const authResponse = await fetch("/api/auth/me");
  const auth = (await authResponse.json()) as { user: unknown | null };

  if (auth.user) {
    try {
      const newGameId = await transferEphemeralQuickGameToAccount(queryClient, gameId, {
        endAfterSave,
      });
      toast.success("Your public session has been saved in your account.");
      router.replace(getQuickGameDashboardPath(newGameId));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to save session.");
    }
    return;
  }

  stashPendingEphemeralQuickGameTransfer({
    sourceGameId: gameId,
    payload,
    endAfterSave,
  });
  router.push("/login?mode=register&saveQuickPlay=1");
}
