import { create } from "zustand";

type UiStore = {
  createGameWizardOpen: boolean;
  setCreateGameWizardOpen: (open: boolean) => void;
};

export const useUiStore = create<UiStore>((set) => ({
  createGameWizardOpen: false,
  setCreateGameWizardOpen: (open) => set({ createGameWizardOpen: open }),
}));
