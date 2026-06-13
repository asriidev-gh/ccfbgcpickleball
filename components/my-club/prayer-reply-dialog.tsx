"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import { Loader2, MessageSquareReply } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

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
import {
  MAX_PRAYER_REPLY_LENGTH,
  type PrayerReplyItem,
} from "@/lib/owner-prayer-replies-shared";

export function PrayerReplyDialog({
  requestId,
  playerName,
  requestText,
  submittedAt,
  historyOnly = false,
  open,
  onOpenChange,
  onAcknowledged,
}: {
  requestId: string;
  playerName: string;
  requestText: string;
  submittedAt: string;
  historyOnly?: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAcknowledged?: () => void;
}) {
  const queryClient = useQueryClient();
  const [draftText, setDraftText] = useState("");
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) setDraftText("");
  }, [open]);

  const { data, isLoading, error } = useQuery({
    queryKey: ["my-club-prayer-replies", requestId],
    queryFn: async () => {
      const response = await fetch(`/api/my-club/prayer-requests/${requestId}/replies`);
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.message ?? "Failed to load replies.");
      return payload as { replies: PrayerReplyItem[] };
    },
    enabled: open,
  });

  const replies = useMemo(() => {
    const items = data?.replies ?? [];
    return [...items].reverse();
  }, [data?.replies]);

  useEffect(() => {
    if (!open || isLoading) return;
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [open, isLoading, replies.length]);

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["my-club-prayer-replies", requestId] });
    queryClient.invalidateQueries({ queryKey: ["my-club-prayer-requests"] });
    queryClient.invalidateQueries({ queryKey: ["my-club-prayer-count"] });
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      const text = draftText.trim();
      if (!text) throw new Error("Reply is required.");

      const response = await fetch(`/api/my-club/prayer-requests/${requestId}/replies`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.message ?? "Failed to send reply.");
      return payload as { message?: string; acknowledged?: boolean };
    },
    onSuccess: (payload) => {
      toast.success(payload.message ?? "Reply sent.");
      setDraftText("");
      invalidate();
      if (payload.acknowledged) {
        onAcknowledged?.();
      }
    },
    onError: (saveError) => {
      toast.error(saveError instanceof Error ? saveError.message : "Failed to send reply.");
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg sm:max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MessageSquareReply className="prayer-accent-icon h-5 w-5" aria-hidden />
            {historyOnly ? "Prayer request chat" : "Reply to prayer request"}
          </DialogTitle>
          <DialogDescription>
            {historyOnly
              ? `Conversation with ${playerName}.`
              : `Send a reply to ${playerName}. They will see your message in their player view.`}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Chat history</Label>
            <div className="max-h-72 space-y-3 overflow-y-auto rounded-xl border border-border/70 bg-muted/10 p-3">
              <div className="flex flex-col items-start gap-1">
                <span className="text-xs font-medium text-muted-foreground">{playerName}</span>
                <div className="max-w-[92%] rounded-2xl rounded-tl-sm bg-background px-3 py-2 shadow-sm ring-1 ring-border/60">
                  <p className="whitespace-pre-wrap text-sm text-foreground/90">{requestText}</p>
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    {formatDistanceToNow(new Date(submittedAt), { addSuffix: true })}
                  </p>
                </div>
              </div>

              {isLoading ? (
                <div className="flex items-center gap-2 py-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                  Loading replies…
                </div>
              ) : error ? (
                <p className="text-sm text-destructive">
                  {error instanceof Error ? error.message : "Failed to load replies."}
                </p>
              ) : (
                replies.map((reply) => (
                  <div key={reply.id} className="flex flex-col items-end gap-1">
                    <span className="text-xs font-medium text-muted-foreground">You</span>
                    <div className="prayer-player-bubble max-w-[92%] rounded-2xl rounded-tr-sm px-3 py-2 ring-1">
                      <p className="whitespace-pre-wrap text-sm text-foreground/90">{reply.text}</p>
                      <p className="mt-1 text-[11px] text-muted-foreground">
                        {formatDistanceToNow(new Date(reply.createdAt), { addSuffix: true })}
                      </p>
                    </div>
                  </div>
                ))
              )}
              <div ref={chatEndRef} />
            </div>
          </div>

          {!historyOnly ? (
            <div className="space-y-2">
              <Label htmlFor="prayer-reply-text">Your reply</Label>
              <Textarea
                id="prayer-reply-text"
                value={draftText}
                maxLength={MAX_PRAYER_REPLY_LENGTH}
                rows={3}
                placeholder="Write your reply…"
                className="min-h-[5rem] resize-y"
                onChange={(event) => setDraftText(event.target.value)}
              />
              <p className="text-xs text-muted-foreground tabular-nums">
                {draftText.length}/{MAX_PRAYER_REPLY_LENGTH}
              </p>
            </div>
          ) : null}
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
          {!historyOnly ? (
            <Button
              type="button"
              disabled={saveMutation.isPending || !draftText.trim()}
              onClick={() => saveMutation.mutate()}
            >
              {saveMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
                  Sending…
                </>
              ) : (
                "Send reply"
              )}
            </Button>
          ) : null}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
