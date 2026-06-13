"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import { HeartHandshake, Loader2 } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
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
import { Textarea } from "@/components/ui/textarea";
import type { PrayerReplyItem } from "@/lib/owner-prayer-replies-shared";
import {
  MAX_PRAYER_REQUEST_LENGTH,
  MIN_PRAYER_REQUEST_LENGTH,
} from "@/lib/owner-prayer-requests-shared";

type PrayerStatusResponse = {
  showCcfFeatures: boolean;
  hasRequest: boolean;
  requestText: string;
  status: "pending" | "acknowledged" | "dismissed" | null;
  submittedAt: string | null;
  replies: PrayerReplyItem[];
  replyCount?: number;
};

export function SpectatePrayerRequestDialog({
  gameId,
  playerId,
  open,
  onOpenChange,
  historyOnly = false,
}: {
  gameId: string;
  playerId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  historyOnly?: boolean;
}) {
  const queryClient = useQueryClient();
  const [requestText, setRequestText] = useState("");
  const chatEndRef = useRef<HTMLDivElement>(null);
  const showedChatRef = useRef(false);
  const canDismissAfterViewRef = useRef(false);

  const { data: status, isLoading } = useQuery({
    queryKey: ["spectate-prayer-status", gameId, playerId],
    queryFn: async () => {
      const response = await fetch(
        `/api/games/${gameId}/spectate/player/prayer-request?playerId=${encodeURIComponent(playerId)}`,
      );
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.message ?? "Failed to load prayer request.");
      return payload as PrayerStatusResponse;
    },
    enabled: open,
    staleTime: 0,
    refetchOnMount: "always",
  });

  const replies = useMemo(() => {
    const items = status?.replies ?? [];
    return [...items].reverse();
  }, [status?.replies]);

  useEffect(() => {
    if (!open) {
      setRequestText("");
      return;
    }
    if (!isLoading && status?.hasRequest) {
      showedChatRef.current = true;
      canDismissAfterViewRef.current = status.status === "acknowledged";
    }
    if (status?.hasRequest) {
      setRequestText(status.requestText);
    }
  }, [open, isLoading, status?.hasRequest, status?.requestText]);

  useEffect(() => {
    if (!open || isLoading || !status?.hasRequest) return;
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [open, isLoading, status?.hasRequest, replies.length]);

  const markViewedMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch(`/api/games/${gameId}/spectate/player/prayer-request/view`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ playerId }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.message ?? "Failed to update prayer request.");
      return payload as { marked?: boolean };
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.refetchQueries({ queryKey: ["spectate-prayer-status", gameId, playerId] }),
        queryClient.refetchQueries({ queryKey: ["spectate-player-features", gameId, playerId] }),
      ]);
    },
  });

  const submitMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch(`/api/games/${gameId}/spectate/player/prayer-request`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ playerId, requestText }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.message ?? "Failed to submit prayer request.");
      return payload as { message?: string };
    },
    onSuccess: (payload) => {
      toast.success(payload.message ?? "Prayer request submitted.");
      queryClient.invalidateQueries({ queryKey: ["spectate-prayer-status", gameId, playerId] });
      queryClient.invalidateQueries({ queryKey: ["spectate-player-features", gameId, playerId] });
      onOpenChange(false);
    },
    onError: (submitError) => {
      toast.error(submitError instanceof Error ? submitError.message : "Failed to submit.");
    },
  });

  const hasExistingRequest = Boolean(status?.hasRequest);
  const isAcknowledged = status?.status === "acknowledged";
  const canSubmitNew = !hasExistingRequest;
  const trimmedRequestLength = requestText.trim().length;
  const meetsPrayerLength =
    trimmedRequestLength >= MIN_PRAYER_REQUEST_LENGTH &&
    trimmedRequestLength <= MAX_PRAYER_REQUEST_LENGTH;
  const showChat = hasExistingRequest || historyOnly;

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) {
      const shouldMarkViewed = showedChatRef.current && canDismissAfterViewRef.current;
      showedChatRef.current = false;
      canDismissAfterViewRef.current = false;
      onOpenChange(false);
      if (shouldMarkViewed) {
        markViewedMutation.mutate();
      }
      return;
    }
    onOpenChange(nextOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="flex max-h-[min(90vh,36rem)] w-full max-w-[calc(100%-1.5rem)] flex-col gap-0 overflow-hidden p-0 sm:max-w-md">
        <div className="shrink-0 space-y-1.5 border-b border-border/60 px-5 py-4 pr-11">
          <DialogHeader className="gap-1.5">
            <DialogTitle className="flex items-center gap-2">
              <HeartHandshake className="h-5 w-5 shrink-0 prayer-accent-icon" aria-hidden />
              {historyOnly || hasExistingRequest ? "Prayer request chat" : "Request a prayer"}
            </DialogTitle>
            <DialogDescription>
              {historyOnly || hasExistingRequest
                ? "Your prayer request and replies from your club."
                : "Share a prayer request with the club. Your organizer can follow up privately."}
            </DialogDescription>
          </DialogHeader>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          {isLoading ? (
            <div className="flex min-h-28 items-center justify-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              Loading…
            </div>
          ) : showChat ? (
            <div className="space-y-3 rounded-xl border border-border/70 bg-muted/10 p-4">
              <div className="flex flex-wrap items-center gap-2">
                <Badge className="prayer-submitted-badge">
                  Submitted
                </Badge>
                {isAcknowledged ? (
                  <Badge className="prayer-acknowledged-badge">
                    Acknowledged
                  </Badge>
                ) : null}
                {replies.length > 0 ? (
                  <Badge variant="secondary" className="tabular-nums">
                    {replies.length} repl{replies.length === 1 ? "y" : "ies"}
                  </Badge>
                ) : null}
              </div>

              <div className="max-h-64 space-y-3 overflow-y-auto pr-1">
                <div className="flex flex-col items-end gap-1.5">
                  <span className="px-1 text-xs font-medium text-muted-foreground">You</span>
                  <div className="prayer-player-bubble w-full max-w-[88%] rounded-2xl rounded-tr-sm px-3.5 py-2.5 ring-1">
                    <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground/90">
                      {requestText}
                    </p>
                    {status?.submittedAt ? (
                      <p className="mt-1.5 text-[11px] text-muted-foreground">
                        {formatDistanceToNow(new Date(status.submittedAt), { addSuffix: true })}
                      </p>
                    ) : null}
                  </div>
                </div>

                {replies.length === 0 ? (
                  <p className="py-3 text-center text-sm text-muted-foreground">
                    No replies from your club yet.
                  </p>
                ) : null}

                {replies.map((reply) => (
                  <div key={reply.id} className="flex flex-col items-start gap-1.5">
                    <span className="px-1 text-xs font-medium text-muted-foreground">Your club</span>
                    <div className="w-full max-w-[88%] rounded-2xl rounded-tl-sm bg-background px-3.5 py-2.5 shadow-sm ring-1 ring-border/60">
                      <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground/90">
                        {reply.text}
                      </p>
                      <p className="mt-1.5 text-[11px] text-muted-foreground">
                        {formatDistanceToNow(new Date(reply.createdAt), { addSuffix: true })}
                      </p>
                    </div>
                  </div>
                ))}
                <div ref={chatEndRef} />
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <Label htmlFor="spectate-prayer-request">Prayer request</Label>
              <Textarea
                id="spectate-prayer-request"
                value={requestText}
                maxLength={MAX_PRAYER_REQUEST_LENGTH}
                rows={6}
                placeholder="Share what you would like the club to pray for…"
                className="min-h-[8rem] w-full resize-y"
                onChange={(event) => setRequestText(event.target.value)}
              />
              <p className="text-xs text-muted-foreground tabular-nums">
                {trimmedRequestLength}/{MAX_PRAYER_REQUEST_LENGTH} (min {MIN_PRAYER_REQUEST_LENGTH})
              </p>
            </div>
          )}
        </div>

        <DialogFooter className="mx-0 mb-0 shrink-0 gap-2 rounded-none border-t bg-muted/40 px-5 py-3.5 sm:flex-row sm:justify-end">
          <Button type="button" variant="outline" onClick={() => handleOpenChange(false)}>
            Close
          </Button>
          {canSubmitNew && !historyOnly ? (
            <Button
              type="button"
              disabled={submitMutation.isPending || !meetsPrayerLength || isLoading}
              onClick={() => submitMutation.mutate()}
            >
              {submitMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
                  Submitting…
                </>
              ) : (
                "Submit request"
              )}
            </Button>
          ) : null}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
