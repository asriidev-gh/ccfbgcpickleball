import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

import type { OperatorFullPayload } from "@/lib/operator-payload";

type EphemeralQuickGameStore = {
  sessions: Record<string, OperatorFullPayload>;
  initializeSession: (gameId: string, payload: OperatorFullPayload) => void;
  getSession: (gameId: string) => OperatorFullPayload | undefined;
  setSession: (gameId: string, payload: OperatorFullPayload) => void;
  removeSession: (gameId: string) => void;
};

export const useEphemeralQuickGameStore = create<EphemeralQuickGameStore>()(
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
    }),
    {
      name: "ccf-ephemeral-quick-games",
      storage: createJSONStorage(() => sessionStorage),
      partialize: (state) => ({ sessions: state.sessions }),
    },
  ),
);
