"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NumberStepper } from "@/components/ui/number-stepper";
import { useUiStore } from "@/store/ui-store";

const types = ["Beginner", "Intermediate", "Advanced"] as const;

function defaultGameTitle(openPlayType: string) {
  return `${openPlayType} Open Play`;
}

export function CreateGameWizard() {
  const router = useRouter();
  const { createGameWizardOpen, setCreateGameWizardOpen } = useUiStore();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    title: "",
    openPlayType: "Beginner",
    courtCount: 2,
    expectedPlayers: 24,
    strictPlayerCount: false,
  });

  const submit = async () => {
    try {
      setLoading(true);
      const response = await fetch("/api/games/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          title: form.title.trim() || defaultGameTitle(form.openPlayType),
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message);
      toast.success("Game created.");
      setCreateGameWizardOpen(false);
      router.push(`/games/${data.game.gameId}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to create game.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={createGameWizardOpen} onOpenChange={setCreateGameWizardOpen}>
      <DialogContent className="flex max-h-[min(92dvh,52rem)] w-[calc(100%-1.5rem)] max-w-3xl flex-col gap-0 overflow-hidden p-0 sm:max-w-xl md:max-w-2xl lg:max-w-3xl">
        <DialogHeader className="border-b px-6 py-5">
          <DialogTitle className="text-xl">Create Pickleball Game</DialogTitle>
          <p className="text-sm text-muted-foreground">Step {step} of 4</p>
        </DialogHeader>

        <div className="min-h-[280px] flex-1 overflow-y-auto px-6 py-6">
          {step === 1 ? (
            <div className="space-y-4">
              <Label className="text-base">Open Play Type</Label>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                {types.map((type) => (
                  <Button
                    key={type}
                    variant={form.openPlayType === type ? "default" : "outline"}
                    size="sm"
                    className="min-h-12 w-full px-2 py-2.5 text-center text-sm leading-snug"
                    onClick={() => setForm((prev) => ({ ...prev, openPlayType: type }))}
                  >
                    {type}
                  </Button>
                ))}
              </div>
            </div>
          ) : null}
          {step === 2 ? (
            <div className="mx-auto w-full max-w-md space-y-3">
              <Label htmlFor="courtCount" className="text-base">
                How many courts?
              </Label>
              <NumberStepper
                id="courtCount"
                min={1}
                max={20}
                value={form.courtCount}
                onChange={(courtCount) => setForm((prev) => ({ ...prev, courtCount }))}
              />
            </div>
          ) : null}
          {step === 3 ? (
            <div className="mx-auto w-full max-w-md space-y-4">
              <div className="space-y-3">
                <Label htmlFor="expectedPlayers" className="text-base">
                  How many players do you expect?
                </Label>
                <NumberStepper
                  id="expectedPlayers"
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
                  id="strictPlayerCount"
                  checked={form.strictPlayerCount}
                  onCheckedChange={(checked) =>
                    setForm((prev) => ({
                      ...prev,
                      strictPlayerCount: checked === true,
                    }))
                  }
                />
                <span className="space-y-1 leading-snug">
                  <span className="block text-base font-medium">Strict Player Count</span>
                  <span className="block text-sm text-muted-foreground">
                    When enabled, registration stops at {form.expectedPlayers} players. When
                    disabled, more players can still register.
                  </span>
                </span>
              </label>
            </div>
          ) : null}
          {step === 4 ? (
            <div className="mx-auto w-full max-w-md space-y-3">
              <Label htmlFor="title" className="text-base">
                Game title
              </Label>
              <Input
                id="title"
                className="h-11 text-base"
                placeholder={defaultGameTitle(form.openPlayType)}
                value={form.title}
                onChange={(event) => setForm((prev) => ({ ...prev, title: event.target.value }))}
              />
            </div>
          ) : null}
        </div>

        <div className="flex justify-between gap-3 border-t bg-muted/40 px-6 py-4">
          <Button
            variant="outline"
            size="lg"
            disabled={step === 1}
            onClick={() => setStep((prev) => Math.max(1, prev - 1))}
          >
            Back
          </Button>
          {step < 4 ? (
            <Button size="lg" onClick={() => setStep((prev) => Math.min(4, prev + 1))}>
              Next
            </Button>
          ) : (
            <Button size="lg" onClick={submit} disabled={loading}>
              {loading ? "Creating..." : "Create Game"}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
