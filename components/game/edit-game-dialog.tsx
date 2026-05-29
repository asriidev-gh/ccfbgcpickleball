"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NumberStepper } from "@/components/ui/number-stepper";

const types = ["Beginner", "Intermediate", "Advanced"] as const;

export type EditGameDialogGame = {
  gameId: string;
  title: string;
  openPlayType: string;
  courtCount: number;
  expectedPlayers: number;
  strictPlayerCount?: boolean;
};

type EditGameDialogProps = {
  game: EditGameDialogGame | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
};

export function EditGameDialog({ game, open, onOpenChange, onSaved }: EditGameDialogProps) {
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    title: "",
    openPlayType: "Beginner" as (typeof types)[number],
    courtCount: 2,
    expectedPlayers: 24,
    strictPlayerCount: false,
  });

  useEffect(() => {
    if (!game || !open) return;
    setForm({
      title: game.title,
      openPlayType:
        types.find((type) => type === game.openPlayType) ?? "Beginner",
      courtCount: game.courtCount,
      expectedPlayers: game.expectedPlayers,
      strictPlayerCount: game.strictPlayerCount === true,
    });
  }, [game, open]);

  const submit = async () => {
    if (!game) return;
    try {
      setLoading(true);
      const response = await fetch(`/api/games/${game.gameId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message);
      toast.success("Game updated.");
      onOpenChange(false);
      onSaved();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update game.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[min(92dvh,52rem)] w-[calc(100%-1.5rem)] max-w-lg flex-col gap-0 overflow-hidden p-0">
        <DialogHeader className="border-b px-6 py-5">
          <DialogTitle className="text-xl">Edit game</DialogTitle>
          {game ? (
            <p className="text-sm text-muted-foreground">{game.title}</p>
          ) : null}
        </DialogHeader>

        <div className="flex-1 space-y-5 overflow-y-auto px-6 py-6">
          <div className="space-y-3">
            <Label htmlFor="edit-game-title" className="text-base">
              Game title
            </Label>
            <Input
              id="edit-game-title"
              className="h-11 text-base"
              value={form.title}
              onChange={(event) => setForm((prev) => ({ ...prev, title: event.target.value }))}
            />
          </div>

          <div className="space-y-3">
            <Label className="text-base">Open play type</Label>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
              {types.map((type) => (
                <Button
                  key={type}
                  type="button"
                  size="sm"
                  variant={form.openPlayType === type ? "default" : "outline"}
                  className="min-h-11 px-2 py-2 text-center text-sm leading-snug"
                  onClick={() => setForm((prev) => ({ ...prev, openPlayType: type }))}
                >
                  {type}
                </Button>
              ))}
            </div>
          </div>

          <div className="space-y-3">
            <Label htmlFor="edit-court-count" className="text-base">
              How many courts?
            </Label>
            <NumberStepper
              id="edit-court-count"
              min={1}
              max={20}
              value={form.courtCount}
              onChange={(courtCount) => setForm((prev) => ({ ...prev, courtCount }))}
            />
          </div>

          <div className="space-y-3">
            <Label htmlFor="edit-expected-players" className="text-base">
              Expected players
            </Label>
            <NumberStepper
              id="edit-expected-players"
              min={4}
              max={300}
              value={form.expectedPlayers}
              onChange={(expectedPlayers) =>
                setForm((prev) => ({ ...prev, expectedPlayers }))
              }
            />
          </div>

          <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-border bg-muted/30 px-4 py-3">
            <Checkbox
              id="edit-strict-player-count"
              checked={form.strictPlayerCount}
              onCheckedChange={(checked) =>
                setForm((prev) => ({
                  ...prev,
                  strictPlayerCount: checked === true,
                }))
              }
            />
            <span className="space-y-1 leading-snug">
              <span className="block text-base font-medium">Strict player count</span>
              <span className="block text-sm text-muted-foreground">
                When enabled, registration stops at {form.expectedPlayers} players.
              </span>
            </span>
          </label>
        </div>

        <div className="flex justify-end gap-3 border-t bg-muted/40 px-6 py-4">
          <Button variant="outline" size="lg" onClick={() => onOpenChange(false)} disabled={loading}>
            Cancel
          </Button>
          <Button size="lg" onClick={submit} disabled={loading || !game}>
            {loading ? "Saving…" : "Save changes"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
