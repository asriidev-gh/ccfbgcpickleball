"use client";

import { useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";

import { PlayerEndorsementBadgeList } from "@/components/player/player-endorsement-badge-list";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { AllTimeEndorsementReceived } from "@/lib/all-time-endorsements";
import { resolvePlayerPhotoUrl } from "@/lib/player-avatar-url";

export type AllTimeEndorsementsScope = "owner" | "public";

const ENDPOINT: Record<AllTimeEndorsementsScope, string> = {
  owner: "/api/leaderboard/all-time/endorsements",
  public: "/api/standings/endorsements",
};

async function fetchAllTimeEndorsements(scope: AllTimeEndorsementsScope, id: string) {
  const response = await fetch(`${ENDPOINT[scope]}?id=${encodeURIComponent(id)}`);
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.message ?? "Failed to load endorsements.");
  }
  return (data.endorsements ?? []) as AllTimeEndorsementReceived[];
}

function initialsOf(name: string) {
  const parts = name.split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] ?? ""}${parts[parts.length - 1][0] ?? ""}`.toUpperCase();
}

function formatDate(iso: string) {
  const date = new Date(iso);
  return Number.isNaN(date.getTime())
    ? ""
    : date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

/** Who endorsed a leaderboard player, across every session counted in the all-time standings. */
export function AllTimeEndorsementsDialog({
  scope,
  rowId,
  playerName,
  open,
  onOpenChange,
}: {
  scope: AllTimeEndorsementsScope;
  rowId: string | null;
  playerName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { data: endorsements = [], isLoading, isError, error } = useQuery({
    queryKey: ["all-time-endorsements", scope, rowId],
    queryFn: () => fetchAllTimeEndorsements(scope, rowId ?? ""),
    enabled: open && Boolean(rowId),
    staleTime: 60_000,
  });

  const countLabel =
    endorsements.length === 1 ? "1 endorsement" : `${endorsements.length} endorsements`;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="endorsements-received-dialog flex max-h-[min(92vh,44rem)] flex-col gap-0 overflow-hidden p-0 sm:max-w-md">
        <DialogHeader className="shrink-0 gap-0 border-b px-5 py-4 sm:px-6">
          <DialogTitle className="text-left leading-tight">
            {playerName}&apos;s endorsements
          </DialogTitle>
          <DialogDescription className="text-left">
            {isLoading ? "Loading endorsements…" : countLabel}
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4 sm:px-6 sm:py-5">
          {isLoading ? (
            <div className="flex items-center justify-center py-12 text-muted-foreground">
              <Loader2 className="size-5 animate-spin" aria-hidden />
            </div>
          ) : isError ? (
            <p className="py-10 text-center text-sm text-destructive">
              {error instanceof Error ? error.message : "Failed to load endorsements."}
            </p>
          ) : endorsements.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted-foreground">No endorsements yet.</p>
          ) : (
            <ul className="endorsements-received-list">
              {endorsements.map((endorsement) => (
                <li
                  key={`${endorsement.endorserName}-${endorsement.createdAt}`}
                  className="endorsements-received-list__item"
                >
                  <div className="endorsements-received-dialog__row">
                    <Avatar size="lg" className="shrink-0">
                      <AvatarImage
                        src={resolvePlayerPhotoUrl({
                          firstName: endorsement.endorserName,
                          lastName: "",
                          photoUrl: endorsement.photoUrl,
                          photoPublicId: endorsement.photoPublicId,
                        })}
                        alt=""
                      />
                      <AvatarFallback className="text-sm font-medium">
                        {initialsOf(endorsement.endorserName)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="endorsements-received-dialog__body">
                      <p className="endorsements-received-dialog__name">
                        {endorsement.endorserName}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {[endorsement.sessionTitle, formatDate(endorsement.createdAt)]
                          .filter(Boolean)
                          .join(" · ")}
                      </p>
                      <PlayerEndorsementBadgeList badges={endorsement.badges} />
                      {endorsement.notes.trim() ? (
                        <p className="endorsements-received-dialog__note">
                          &ldquo;{endorsement.notes.trim()}&rdquo;
                        </p>
                      ) : null}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
