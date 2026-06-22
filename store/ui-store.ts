import { create } from "zustand";

export type CreateGameWizardPreset = {
  liveQueue: boolean;
  registrationMode?: "self" | "owner";
};

type UiStore = {
  createGameWizardOpen: boolean;
  createGameWizardPreset: CreateGameWizardPreset | null;
  setCreateGameWizardOpen: (open: boolean, preset?: CreateGameWizardPreset | null) => void;
};

export const useUiStore = create<UiStore>((set) => ({
  createGameWizardOpen: false,
  createGameWizardPreset: null,
  setCreateGameWizardOpen: (open, preset) =>
    set({
      createGameWizardOpen: open,
      createGameWizardPreset: open ? (preset ?? { liveQueue: true }) : null,
    }),
}));
