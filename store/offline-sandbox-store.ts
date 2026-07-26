import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

import type { OperatorFullPayload } from "@/lib/operator-payload";

type OfflineSandboxStore = {
  sessions: Record<string, OperatorFullPayload>;
  /** Maps offline sandbox id → live gameId it was cloned from. */
  sourceLiveGameIds: Record<string, string>;
  initializeSession: (
    gameId: string,
    payload: OperatorFullPayload,
    sourceLiveGameId: string,
  ) => void;
  getSession: (gameId: string) => OperatorFullPayload | undefined;
  getSourceLiveGameId: (gameId: string) => string | undefined;
  setSession: (gameId: string, payload: OperatorFullPayload) => void;
  removeSession: (gameId: string) => void;
  clearAllSessions: () => void;
};

export const useOfflineSandboxStore = create<OfflineSandboxStore>()(
  persist(
    (set, get) => ({
      sessions: {},
      sourceLiveGameIds: {},
      initializeSession: (gameId, payload, sourceLiveGameId) => {
        set((state) => ({
          sessions: { ...state.sessions, [gameId]: payload },
          sourceLiveGameIds: {
            ...state.sourceLiveGameIds,
            [gameId]: sourceLiveGameId,
          },
        }));
      },
      getSession: (gameId) => get().sessions[gameId],
      getSourceLiveGameId: (gameId) => get().sourceLiveGameIds[gameId],
      setSession: (gameId, payload) => {
        set((state) => ({
          sessions: { ...state.sessions, [gameId]: payload },
        }));
      },
      removeSession: (gameId) => {
        set((state) => {
          const nextSessions = { ...state.sessions };
          const nextSources = { ...state.sourceLiveGameIds };
          delete nextSessions[gameId];
          delete nextSources[gameId];
          return { sessions: nextSessions, sourceLiveGameIds: nextSources };
        });
      },
      clearAllSessions: () => set({ sessions: {}, sourceLiveGameIds: {} }),
    }),
    {
      name: "ccf-offline-sandbox-games",
      storage: createJSONStorage(() => sessionStorage),
      partialize: (state) => ({
        sessions: state.sessions,
        sourceLiveGameIds: state.sourceLiveGameIds,
      }),
    },
  ),
);
