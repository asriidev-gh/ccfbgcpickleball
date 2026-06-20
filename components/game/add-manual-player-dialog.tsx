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
import { refetchOperatorQueueData } from "@/lib/fetch-operator-game";

type AddManualPlayerDialogProps = {
  gameId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onPlayerAdded?: () => void | Promise<void>;
};

export function AddManualPlayerDialog({
  gameId,
  open,
  onOpenChange,
  onPlayerAdded,
}: AddManualPlayerDialogProps) {
  const queryClient = useQueryClient();
  const [displayName, setDisplayName] = useState("");

  useEffect(() => {
    if (!open) {
      setDisplayName("");
    }
  }, [open]);

  const addPlayerMutation = useMutation({
    mutationFn: async (name: string) => {
      const response = await fetch(`/api/games/${gameId}/add-player`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ displayName: name }),
      });
      const payload = (await response.json()) as { message?: string };
      if (!response.ok) throw new Error(payload.message ?? "Failed to add player.");
      return payload.message ?? "Player added to the queue.";
    },
    onSuccess: async (message) => {
      await refetchOperatorQueueData(queryClient, gameId);
      await onPlayerAdded?.();
      toast.success(message);
      setDisplayName("");
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
    addPlayerMutation.mutate(trimmed);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add player</DialogTitle>
          <DialogDescription>
            Enter a name and the player will be added to the end of the queue.
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
