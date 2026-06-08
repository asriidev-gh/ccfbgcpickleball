"use client";

import { createContext, useContext, type ReactNode } from "react";

type GamePlayerProfileContextValue = {
  profileEnabled: boolean;
};

const GamePlayerProfileContext = createContext<GamePlayerProfileContextValue>({
  profileEnabled: false,
});

export function GamePlayerProfileProvider({
  profileEnabled,
  children,
}: {
  profileEnabled: boolean;
  children: ReactNode;
}) {
  return (
    <GamePlayerProfileContext.Provider value={{ profileEnabled }}>
      {children}
    </GamePlayerProfileContext.Provider>
  );
}

export function useGamePlayerProfile() {
  return useContext(GamePlayerProfileContext);
}
