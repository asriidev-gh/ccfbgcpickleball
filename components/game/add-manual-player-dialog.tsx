"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { refetchOperatorQueueData } from "@/lib/fetch-operator-game";
import type { GenderOption } from "@/lib/player-profile-shared";

const MANUAL_ADD_GENDER_OPTIONS = [
  { value: "male", label: "Male" },
  { value: "female", label: "Female" },
] as const satisfies ReadonlyArray<{ value: GenderOption; label: string }>;

type AddManualPlayerDialogProps = {
  gameId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onPlayerAdded?: () => void | Promise<void>;
};

type AddManualPlayerPayload = {
  displayName: string;
  gender: GenderOption;
};

export function AddManualPlayerDialog({
  gameId,
  open,
  onOpenChange,
  onPlayerAdded,
}: AddManualPlayerDialogProps) {
  const queryClient = useQueryClient();
  const [displayName, setDisplayName] = useState("");
  const [gender, setGender] = useState<GenderOption | "">("");

  useEffect(() => {
    if (!open) {
      setDisplayName("");
      setGender("");
    }
  }, [open]);

  const addPlayerMutation = useMutation({
    mutationFn: async (payload: AddManualPlayerPayload) => {
      const response = await fetch(`/api/games/${gameId}/add-player`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = (await response.json()) as { message?: string };
      if (!response.ok) throw new Error(data.message ?? "Failed to add player.");
      return data.message ?? "Player added to the queue.";
    },
    onSuccess: async (message) => {
      await refetchOperatorQueueData(queryClient, gameId);
      await onPlayerAdded?.();
      toast.success(message);
      setDisplayName("");
      setGender("");
      onOpenChange(false);
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Failed to add player.");
    },
  });

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    const trimmed = displayName.trim();
    if (!trimmed) {
      toast.error("Enter a player name.");
      return;
    }
    if (!gender) {
      toast.error("Select a gender.");
      return;
    }
    addPlayerMutation.mutate({ displayName: trimmed, gender });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add player</DialogTitle>
          <DialogDescription>
            Enter a name and gender. The player will be added to the end of the queue.
          </DialogDescription>
        </DialogHeader>
        <form className="space-y-4" onSubmit={handleSubmit}>
          <div className="space-y-2">
            <Label htmlFor="manual-player-name">Player name</Label>
            <Input
              id="manual-player-name"
              value={displayName}
              onChange={(event) => setDisplayName(event.target.value)}
              placeholder="e.g. Juan Dela Cruz"
              autoFocus
              disabled={addPlayerMutation.isPending}
            />
          </div>
          <fieldset className="space-y-3">
            <legend className="text-sm font-medium leading-none">Gender</legend>
            <RadioGroup
              value={gender}
              onValueChange={(value) => {
                if (value === "male" || value === "female") {
                  setGender(value);
                }
              }}
              className="gap-2"
              disabled={addPlayerMutation.isPending}
            >
              {MANUAL_ADD_GENDER_OPTIONS.map((option) => (
                <label
                  key={option.value}
                  className="flex cursor-pointer items-center gap-3 rounded-lg border border-border/70 px-3 py-2.5 transition-colors has-[[data-checked]]:border-primary/50 has-[[data-checked]]:bg-primary/5"
                >
                  <RadioGroupItem value={option.value} />
                  <span className="text-sm font-medium">{option.label}</span>
                </label>
              ))}
            </RadioGroup>
          </fieldset>
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={addPlayerMutation.isPending}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={addPlayerMutation.isPending}>
              {addPlayerMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
                  Adding…
                </>
              ) : (
                "Add player"
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
