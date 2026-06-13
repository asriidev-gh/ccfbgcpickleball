"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import {
  CheckCircle2,
  HeartHandshake,
  Loader2,
  Mail,
  MessageSquareReply,
  Phone,
  Search,
  Trash2,
} from "lucide-react";
import { useEffect, useState } from "react";
import Swal from "sweetalert2";
import { toast } from "sonner";

import { PlayerAvatar } from "@/components/game/player-avatar";
import { PrayerReplyDialog } from "@/components/my-club/prayer-reply-dialog";
import { OwnerPlayerDetailsDialog } from "@/components/users/owner-player-details-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatAppDateTime } from "@/lib/format-datetime";
import { PRAYER_ACKNOWLEDGE_REPLY_TEXT } from "@/lib/owner-prayer-replies-shared";
import type {
  PrayerRequestItem,
  PrayerRequestView,
} from "@/lib/owner-prayer-requests-shared";
import { cn } from "@/lib/utils";

const acknowledgeAlertOptions = {
  background: "#0f172a",
  color: "#e2e8f0",
  confirmButtonColor: "#f43f5e",
  cancelButtonColor: "#64748b",
};

const deleteAlertOptions = {
  background: "#0f172a",
  color: "#e2e8f0",
  confirmButtonColor: "#ef4444",
  cancelButtonColor: "#64748b",
};

function usePrayerRequests(view: PrayerRequestView, debouncedSearch: string) {
  return useQuery({
    queryKey: ["my-club-prayer-requests", view, debouncedSearch],
    queryFn: async () => {
      const params = new URLSearchParams({ view });
      if (debouncedSearch) params.set("q", debouncedSearch);
      const response = await fetch(`/api/my-club/prayer-requests?${params.toString()}`);
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.message ?? "Failed to load prayer requests.");
      return payload as {
        requests: PrayerRequestItem[];
        total: number;
        view: PrayerRequestView;
      };
    },
  });
}

function PrayerRequestCard({
  request,
  view,
  actionPending,
  onViewProfile,
  onReply,
  onViewHistory,
  onAcknowledge,
  onDelete,
}: {
  request: PrayerRequestItem;
  view: PrayerRequestView;
  actionPending: boolean;
  onViewProfile: () => void;
  onReply: () => void;
  onViewHistory: () => void;
  onAcknowledge: () => void;
  onDelete: () => void;
}) {
  const isAcknowledged = view === "acknowledged";

  return (
    <Card className="glass-panel overflow-hidden">
      <CardContent className="flex flex-col gap-4 p-4">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex min-w-0 items-start gap-3">
            <PlayerAvatar
              player={{
                _id: request.playerId,
                firstName: request.firstName,
                lastName: request.lastName,
                photoUrl: request.photoUrl,
                photoPublicId: request.photoPublicId,
              }}
              size="lg"
            />
            <div className="min-w-0 space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <p className="font-semibold text-foreground">{request.name}</p>
                <Badge className="prayer-submitted-badge">
                  Prayer request
                </Badge>
                {isAcknowledged ? (
                  <Badge className="prayer-acknowledged-badge">
                    Acknowledged
                  </Badge>
                ) : null}
                {request.replyCount > 0 ? (
                  <button
                    type="button"
                    className={cn(
                      "inline-flex h-5 items-center rounded-md border border-transparent bg-secondary px-1.5 text-xs font-medium text-secondary-foreground tabular-nums",
                      "cursor-pointer transition-colors hover:bg-secondary/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    )}
                    onClick={onViewHistory}
                    aria-label={`View ${request.replyCount} repl${request.replyCount === 1 ? "y" : "ies"}`}
                  >
                    {request.replyCount} repl{request.replyCount === 1 ? "y" : "ies"}
                  </button>
                ) : null}
              </div>
              <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
                <span className="inline-flex items-center gap-1.5">
                  <Mail className="h-3.5 w-3.5 shrink-0" aria-hidden />
                  {request.email}
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <Phone className="h-3.5 w-3.5 shrink-0" aria-hidden />
                  {request.mobileNumber}
                </span>
              </div>
              <p className="text-xs text-muted-foreground">
                Requested {formatAppDateTime(request.submittedAt)}
                {request.acknowledgedAt
                  ? ` · Acknowledged ${formatDistanceToNow(new Date(request.acknowledgedAt), { addSuffix: true })}`
                  : ""}
                {request.sessionCount > 0
                  ? ` · ${request.sessionCount} session${request.sessionCount === 1 ? "" : "s"}`
                  : ""}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2 sm:justify-end">
            <Button type="button" size="sm" variant="outline" onClick={onViewProfile}>
              View profile
            </Button>
            <Button type="button" size="sm" variant="outline" onClick={onReply}>
              <MessageSquareReply className="mr-1.5 h-4 w-4" aria-hidden />
              {isAcknowledged ? "Reply again" : "Reply"}
            </Button>
            {!isAcknowledged ? (
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="prayer-acknowledge-btn"
                disabled={actionPending}
                onClick={onAcknowledge}
              >
                <CheckCircle2 className="mr-1.5 h-4 w-4" aria-hidden />
                Acknowledge
              </Button>
            ) : (
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="border-destructive/40 text-destructive hover:bg-destructive/10"
                disabled={actionPending}
                onClick={onDelete}
              >
                <Trash2 className="mr-1.5 h-4 w-4" aria-hidden />
                Delete
              </Button>
            )}
          </div>
        </div>

        <div className="rounded-xl border border-border/70 bg-muted/10 px-4 py-3">
          <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground/90">
            {request.requestText}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

function PrayerRequestList({
  view,
  requests,
  isLoading,
  error,
  isFetching,
  actionPending,
  onViewProfile,
  onReply,
  onViewHistory,
  onAcknowledge,
  onDelete,
}: {
  view: PrayerRequestView;
  requests: PrayerRequestItem[];
  isLoading: boolean;
  error: Error | null;
  isFetching: boolean;
  actionPending: boolean;
  onViewProfile: (request: PrayerRequestItem) => void;
  onReply: (request: PrayerRequestItem) => void;
  onViewHistory: (request: PrayerRequestItem) => void;
  onAcknowledge: (request: PrayerRequestItem) => void;
  onDelete: (request: PrayerRequestItem) => void;
}) {
  if (isLoading) {
    return (
      <div className="flex min-h-40 items-center justify-center text-muted-foreground">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" aria-hidden />
        Loading prayer requests…
      </div>
    );
  }

  if (error) {
    return (
      <p className="text-sm text-destructive">
        {error instanceof Error ? error.message : "Failed to load prayer requests."}
      </p>
    );
  }

  if (requests.length === 0) {
    return (
      <Card className="glass-panel border-dashed">
        <CardContent className="flex flex-col items-center justify-center gap-3 py-12 text-center">
          <HeartHandshake className="h-10 w-10 text-muted-foreground/70" aria-hidden />
          <div>
            <p className="font-medium text-foreground">
              {view === "acknowledged"
                ? "No acknowledged prayer requests yet"
                : "No pending prayer requests"}
            </p>
            <p className="mt-1 max-w-md text-sm text-muted-foreground">
              {view === "acknowledged"
                ? "Prayer requests you acknowledge will appear here for follow-up and replies."
                : "When players share a prayer request during registration, it will appear here for follow-up."}
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      {isFetching && !isLoading ? (
        <p className="text-xs text-muted-foreground">Refreshing list…</p>
      ) : null}
      {requests.map((request) => (
        <PrayerRequestCard
          key={request.id}
          request={request}
          view={view}
          actionPending={actionPending}
          onViewProfile={() => onViewProfile(request)}
          onReply={() => onReply(request)}
          onViewHistory={() => onViewHistory(request)}
          onAcknowledge={() => onAcknowledge(request)}
          onDelete={() => onDelete(request)}
        />
      ))}
    </div>
  );
}

export function PrayerRequestsPanel({ embedded = false }: { embedded?: boolean }) {
  const queryClient = useQueryClient();
  const [searchInput, setSearchInput] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [activeView, setActiveView] = useState<PrayerRequestView>("pending");
  const [selectedPlayer, setSelectedPlayer] = useState<{ id: string; name: string } | null>(null);
  const [replyRequest, setReplyRequest] = useState<PrayerRequestItem | null>(null);
  const [historyOnly, setHistoryOnly] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearch(searchInput.trim()), 300);
    return () => window.clearTimeout(timer);
  }, [searchInput]);

  const pendingQuery = usePrayerRequests("pending", debouncedSearch);
  const acknowledgedQuery = usePrayerRequests("acknowledged", debouncedSearch);

  const actionMutation = useMutation({
    mutationFn: async ({
      requestId,
      action,
    }: {
      requestId: string;
      action: "acknowledge" | "delete";
    }) => {
      const response = await fetch(`/api/my-club/prayer-requests/${requestId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.message ?? "Failed to update request.");
      return payload;
    },
    onSuccess: (payload, variables) => {
      toast.success(payload.message ?? "Request updated.");
      queryClient.invalidateQueries({ queryKey: ["my-club-prayer-requests"] });
      queryClient.invalidateQueries({ queryKey: ["my-club-prayer-count"] });
      if (variables.action === "acknowledge") {
        setActiveView("acknowledged");
      }
    },
    onError: (actionError) => {
      toast.error(actionError instanceof Error ? actionError.message : "Failed to update request.");
    },
  });

  const confirmAcknowledge = async (request: PrayerRequestItem) => {
    const result = await Swal.fire({
      title: "Mark as acknowledged?",
      text: `This will acknowledge ${request.name}'s prayer request and send the reply "${PRAYER_ACKNOWLEDGE_REPLY_TEXT}"`,
      icon: "question",
      showCancelButton: true,
      confirmButtonText: "Acknowledge",
      ...acknowledgeAlertOptions,
    });
    if (result.isConfirmed) {
      actionMutation.mutate({ requestId: request.id, action: "acknowledge" });
    }
  };

  const confirmDelete = async (request: PrayerRequestItem) => {
    const result = await Swal.fire({
      title: "Delete prayer request?",
      text: `${request.name}'s acknowledged prayer request and all replies will be permanently removed.`,
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Delete",
      ...deleteAlertOptions,
    });
    if (result.isConfirmed) {
      actionMutation.mutate({ requestId: request.id, action: "delete" });
    }
  };

  const openReply = (request: PrayerRequestItem) => {
    setHistoryOnly(false);
    setReplyRequest(request);
  };

  const openHistory = (request: PrayerRequestItem) => {
    setHistoryOnly(true);
    setReplyRequest(request);
  };

  const pendingTotal = pendingQuery.data?.total ?? 0;
  const acknowledgedTotal = acknowledgedQuery.data?.total ?? 0;

  return (
    <div className={cn("space-y-5", embedded && "my-club-tab-content")}>
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border/60 pb-4">
        <div>
          {!embedded ? (
            <>
              <h2 className="section-title">Prayer requests</h2>
              <p className="caption mt-1">
                Prayer requests shared by players during session registration.
              </p>
            </>
          ) : (
            <>
              <p className="text-sm font-semibold text-foreground">Prayer requests</p>
              <p className="mt-0.5 text-sm text-muted-foreground">
                Review pending requests and follow up on acknowledged ones.
              </p>
            </>
          )}
        </div>
        <Badge variant="secondary" className="h-7 px-3 text-sm tabular-nums">
          {activeView === "pending" ? `${pendingTotal} pending` : `${acknowledgedTotal} acknowledged`}
        </Badge>
      </div>

      <div className="relative">
        <Search
          className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
          aria-hidden
        />
        <Input
          value={searchInput}
          placeholder="Search by name, contact, or prayer request…"
          className="h-11 bg-background pl-9"
          onChange={(event) => setSearchInput(event.target.value)}
        />
      </div>

      <Tabs
        value={activeView}
        onValueChange={(value) => setActiveView(value as PrayerRequestView)}
        className="gap-4"
      >
        <TabsList className="h-auto w-full flex-wrap justify-start gap-1 bg-muted/40 p-1 sm:w-auto">
          <TabsTrigger value="pending" className="gap-1.5 px-3">
            Pending requests
            {pendingTotal > 0 ? (
              <Badge variant="secondary" className="px-1.5 py-0 text-xs tabular-nums">
                {pendingTotal}
              </Badge>
            ) : null}
          </TabsTrigger>
          <TabsTrigger value="acknowledged" className="gap-1.5 px-3">
            Acknowledged prayer requests
            {acknowledgedTotal > 0 ? (
              <Badge variant="secondary" className="px-1.5 py-0 text-xs tabular-nums">
                {acknowledgedTotal}
              </Badge>
            ) : null}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="pending" className="mt-0 outline-none">
          <PrayerRequestList
            view="pending"
            requests={pendingQuery.data?.requests ?? []}
            isLoading={pendingQuery.isLoading}
            error={pendingQuery.error}
            isFetching={pendingQuery.isFetching}
            actionPending={actionMutation.isPending}
            onViewProfile={(request) =>
              setSelectedPlayer({ id: request.playerId, name: request.name })
            }
            onReply={(request) => openReply(request)}
            onViewHistory={(request) => openHistory(request)}
            onAcknowledge={(request) => void confirmAcknowledge(request)}
            onDelete={() => undefined}
          />
        </TabsContent>

        <TabsContent value="acknowledged" className="mt-0 outline-none">
          <PrayerRequestList
            view="acknowledged"
            requests={acknowledgedQuery.data?.requests ?? []}
            isLoading={acknowledgedQuery.isLoading}
            error={acknowledgedQuery.error}
            isFetching={acknowledgedQuery.isFetching}
            actionPending={actionMutation.isPending}
            onViewProfile={(request) =>
              setSelectedPlayer({ id: request.playerId, name: request.name })
            }
            onReply={(request) => openReply(request)}
            onViewHistory={(request) => openHistory(request)}
            onAcknowledge={() => undefined}
            onDelete={(request) => void confirmDelete(request)}
          />
        </TabsContent>
      </Tabs>

      <OwnerPlayerDetailsDialog
        player={selectedPlayer}
        onClose={() => setSelectedPlayer(null)}
      />

      {replyRequest ? (
        <PrayerReplyDialog
          requestId={replyRequest.id}
          playerName={replyRequest.name}
          requestText={replyRequest.requestText}
          submittedAt={replyRequest.submittedAt}
          historyOnly={historyOnly}
          open={Boolean(replyRequest)}
          onOpenChange={(open) => {
            if (!open) {
              setReplyRequest(null);
              setHistoryOnly(false);
            }
          }}
          onAcknowledged={() => {
            setActiveView("acknowledged");
            setReplyRequest(null);
            setHistoryOnly(false);
          }}
        />
      ) : null}
    </div>
  );
}
