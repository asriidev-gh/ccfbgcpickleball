"use client";

import { Loader2 } from "lucide-react";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { NumberStepper } from "@/components/ui/number-stepper";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DEMO_OPEN_PLAY_DEFAULT_COURT_COUNT,
  DEMO_OPEN_PLAY_DEFAULT_PLAYER_COUNT,
  DEMO_OPEN_PLAY_PLAYER_COUNTS,
  getDemoOpenPlayMaxCourts,
  type DemoOpenPlayPlayerCount,
} from "@/lib/demo-open-play";

type CreateDemoOpenPlayDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  isPending: boolean;
  onSubmit: (params: { courtCount: number; playerCount: DemoOpenPlayPlayerCount }) => void;
};

export function CreateDemoOpenPlayDialog({
  open,
  onOpenChange,
  isPending,
  onSubmit,
}: CreateDemoOpenPlayDialogProps) {
  const [courtCount, setCourtCount] = useState(DEMO_OPEN_PLAY_DEFAULT_COURT_COUNT);
  const [playerCount, setPlayerCount] = useState(String(DEMO_OPEN_PLAY_DEFAULT_PLAYER_COUNT));

  const selectedPlayerCount = Number(playerCount) as DemoOpenPlayPlayerCount;
  const maxCourts = getDemoOpenPlayMaxCourts(selectedPlayerCount);

  useEffect(() => {
    if (!open) return;
    setCourtCount(DEMO_OPEN_PLAY_DEFAULT_COURT_COUNT);
    setPlayerCount(String(DEMO_OPEN_PLAY_DEFAULT_PLAYER_COUNT));
  }, [open]);

  useEffect(() => {
    setCourtCount((current) => Math.min(current, maxCourts));
  }, [maxCourts]);

  const handlePlayerCountChange = (next: string | null) => {
    const nextPlayerCount = (next ?? String(DEMO_OPEN_PLAY_DEFAULT_PLAYER_COUNT)) as string;
    setPlayerCount(nextPlayerCount);
    const nextMaxCourts = getDemoOpenPlayMaxCourts(Number(nextPlayerCount) as DemoOpenPlayPlayerCount);
    setCourtCount((current) => Math.min(current, nextMaxCourts));
  };

  const handleSubmit = () => {
    onSubmit({
      courtCount,
      playerCount: Number(playerCount) as DemoOpenPlayPlayerCount,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Create Demo Open Play</DialogTitle>
          <DialogDescription>
            This open play is for demo purposes only. Choose how many courts and players to
            generate.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 py-1">
          <div className="space-y-3">
            <Label htmlFor="demo-player-count">Number of players</Label>
            <Select value={playerCount} disabled={isPending} onValueChange={handlePlayerCountChange}>
              <SelectTrigger id="demo-player-count" className="h-11 w-full bg-background">
                <SelectValue placeholder="Select player count" />
              </SelectTrigger>
              <SelectContent className="bg-popover text-popover-foreground">
                {DEMO_OPEN_PLAY_PLAYER_COUNTS.map((count) => (
                  <SelectItem key={count} value={String(count)}>
                    {count} players
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-3">
            <Label htmlFor="demo-court-count">Number of courts</Label>
            <NumberStepper
              id="demo-court-count"
              min={1}
              max={maxCourts}
              value={courtCount}
              onChange={setCourtCount}
            />
            <p className="text-sm text-muted-foreground">
              Up to {maxCourts} {maxCourts === 1 ? "court" : "courts"} for {selectedPlayerCount} players.
            </p>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" disabled={isPending} onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button disabled={isPending} onClick={handleSubmit}>
            {isPending ? (
              <>
                <Loader2 className="animate-spin" />
                Creating…
              </>
            ) : (
              "Create demo"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
