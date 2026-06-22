import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

import type { OperatorFullPayload } from "@/lib/operator-payload";

type LocalGameStore = {
  sessions: Record<string, OperatorFullPayload>;
  initializeSession: (gameId: string, payload: OperatorFullPayload) => void;
  getSession: (gameId: string) => OperatorFullPayload | undefined;
  setSession: (gameId: string, payload: OperatorFullPayload) => void;
  removeSession: (gameId: string) => void;
  clearAllSessions: () => void;
};

export const useLocalGameStore = create<LocalGameStore>()(
  persist(
    (set, get) => ({
      sessions: {},
      initializeSession: (gameId, payload) => {
        set((state) => ({
          sessions: { ...state.sessions, [gameId]: payload },
        }));
      },
      getSession: (gameId) => get().sessions[gameId],
      setSession: (gameId, payload) => {
        set((state) => ({
          sessions: { ...state.sessions, [gameId]: payload },
        }));
      },
      removeSession: (gameId) => {
        set((state) => {
          const next = { ...state.sessions };
          delete next[gameId];
          return { sessions: next };
        });
      },
      clearAllSessions: () => set({ sessions: {} }),
    }),
    {
      name: "ccf-local-live-queue-games",
      storage: createJSONStorage(() => sessionStorage),
      partialize: (state) => ({ sessions: state.sessions }),
    },
  ),
);

export function readLocalGamePayload(gameId: string) {
  return useLocalGameStore.getState().getSession(gameId);
}

export function writeLocalGamePayload(gameId: string, payload: OperatorFullPayload) {
  useLocalGameStore.getState().setSession(gameId, payload);
}

export function updateLocalGamePayload(
  gameId: string,
  updater: (current: OperatorFullPayload) => OperatorFullPayload | null,
) {
  const current = readLocalGamePayload(gameId);
  if (!current) return null;
  const next = updater(current);
  if (!next) return null;
  writeLocalGamePayload(gameId, next);
  return next;
}
