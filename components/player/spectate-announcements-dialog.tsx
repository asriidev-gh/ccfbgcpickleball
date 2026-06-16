"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import { Loader2, Megaphone } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ClubAnnouncementBody } from "@/components/my-club/club-announcement-body";
import type { SpectatePlayerAnnouncement } from "@/lib/spectate-player-features-shared";

export function SpectateAnnouncementsDialog({
  gameId,
  playerId,
  open,
  onOpenChange,
}: {
  gameId: string;
  playerId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const queryClient = useQueryClient();

  const { data, isLoading, error } = useQuery({
    queryKey: ["spectate-announcements", gameId, playerId],
    queryFn: async () => {
      const response = await fetch(
        `/api/games/${gameId}/spectate/player/announcements?playerId=${encodeURIComponent(playerId)}`,
      );
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.message ?? "Failed to load community posts.");
      return payload as { announcements: SpectatePlayerAnnouncement[]; unreadCount: number };
    },
    enabled: open,
    staleTime: 0,
    refetchOnMount: "always",
  });

  const markReadMutation = useMutation({
    mutationFn: async (announcementId: string) => {
      const response = await fetch(`/api/games/${gameId}/spectate/player/announcements/read`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ playerId, announcementIds: [announcementId] }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.message ?? "Failed to mark community post as read.");
      return payload;
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.refetchQueries({ queryKey: ["spectate-player-features", gameId, playerId] }),
        queryClient.refetchQueries({ queryKey: ["spectate-announcements", gameId, playerId] }),
      ]);
    },
  });

  const announcements = data?.announcements ?? [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] max-w-lg overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Community Posts</DialogTitle>
          <DialogDescription>Posts and updates from your club for this open play.</DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex min-h-32 items-center justify-center text-muted-foreground">
            <Loader2 className="mr-2 h-5 w-5 animate-spin" aria-hidden />
            Loading community posts…
          </div>
        ) : error ? (
          <p className="text-sm text-destructive">
            {error instanceof Error ? error.message : "Failed to load community posts."}
          </p>
        ) : announcements.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-10 text-center">
            <Megaphone className="h-10 w-10 text-muted-foreground/70" aria-hidden />
            <p className="text-sm text-muted-foreground">No new community posts.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {announcements.map((announcement) => (
              <article
                key={announcement.id}
                className="rounded-xl border border-border/70 bg-muted/10 p-4"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <h3 className="font-semibold text-foreground">{announcement.title}</h3>
                  {!announcement.isRead ? (
                    <Badge variant="secondary" className="bg-sky-500/15 text-sky-800 dark:text-sky-200">
                      New
                    </Badge>
                  ) : null}
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  {formatDistanceToNow(new Date(announcement.publishedAt), { addSuffix: true })}
                </p>
                <ClubAnnouncementBody body={announcement.body} className="mt-3" />
                <div className="mt-4 flex justify-end">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={
                      markReadMutation.isPending && markReadMutation.variables === announcement.id
                    }
                    onClick={() => markReadMutation.mutate(announcement.id)}
                  >
                    {markReadMutation.isPending && markReadMutation.variables === announcement.id ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
                        Marking…
                      </>
                    ) : (
                      "Mark as read"
                    )}
                  </Button>
                </div>
              </article>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
