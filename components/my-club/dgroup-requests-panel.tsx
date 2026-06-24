"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import {
  CheckCircle2,
  ClipboardCheck,
  Loader2,
  Mail,
  MessageSquarePlus,
  Phone,
  RotateCcw,
  Search,
  UserRound,
} from "lucide-react";
import { useEffect, useState } from "react";
import Swal from "sweetalert2";
import { toast } from "sonner";

import { DgroupRemarksDialog } from "@/components/my-club/dgroup-remarks-dialog";
import { MyClubExcelExportButton } from "@/components/my-club/my-club-excel-export-button";
import { PlayerAvatar } from "@/components/game/player-avatar";
import { OwnerPlayerDetailsDialog } from "@/components/users/owner-player-details-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatDgroupAvailabilitySummary } from "@/lib/dgroup-availability-shared";
import { formatAppDateTime } from "@/lib/format-datetime";
import type {
  DgroupRequestItem,
  DgroupRequestView,
} from "@/lib/owner-dgroup-requests-shared";
import {
  myClubDgroupCountQueryKey,
  myClubDgroupRequestsQueryKey,
  myClubQueryOptions,
} from "@/lib/my-club-queries";
import { cn } from "@/lib/utils";

const acknowledgeAlertOptions = {
  background: "#0f172a",
  color: "#e2e8f0",
  confirmButtonColor: "#8b5cf6",
  cancelButtonColor: "#64748b",
};

const unmarkAlertOptions = {
  background: "#0f172a",
  color: "#e2e8f0",
  confirmButtonColor: "#f59e0b",
  cancelButtonColor: "#64748b",
};

function useDgroupRequests(
  view: DgroupRequestView,
  debouncedSearch: string,
  includeRegistrationDgroup = false,
  showAcknowledged = false,
) {
  return useQuery({
    queryKey: [
      myClubDgroupRequestsQueryKey,
      view,
      debouncedSearch,
      includeRegistrationDgroup,
      showAcknowledged,
    ],
    queryFn: async () => {
      const params = new URLSearchParams({ view });
      if (debouncedSearch) params.set("q", debouncedSearch);
      if (view === "joined" && includeRegistrationDgroup) {
        params.set("includeRegistrationDgroup", "true");
      }
      if (view === "pending" && showAcknowledged) {
        params.set("showAcknowledged", "true");
      }
      const response = await fetch(`/api/my-club/dgroup-requests?${params.toString()}`);
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.message ?? "Failed to load D-group requests.");
      return payload as {
        requests: DgroupRequestItem[];
        total: number;
        view: DgroupRequestView;
        includeRegistrationDgroup?: boolean;
        showAcknowledged?: boolean;
      };
    },
    ...myClubQueryOptions,
  });
}

const joinedAlertOptions = {
  background: "#0f172a",
  color: "#e2e8f0",
  confirmButtonColor: "#22c55e",
  cancelButtonColor: "#64748b",
};

function DgroupRequestCard({
  request,
  view,
  resolvePending,
  onViewProfile,
  onMarkJoined,
  onAcknowledge,
  onAddRemarks,
  onUnmarkJoined,
}: {
  request: DgroupRequestItem;
  view: DgroupRequestView;
  resolvePending: boolean;
  onViewProfile: () => void;
  onMarkJoined: () => void;
  onAcknowledge: () => void;
  onAddRemarks: () => void;
  onUnmarkJoined: () => void;
}) {
  const isJoined = view === "joined";
  const isRegistrationJoined = request.joinedSource === "registration";

  return (
    <Card className="glass-panel overflow-hidden">
      <CardContent className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <PlayerAvatar
            player={{
              _id: request.id,
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
              {isJoined ? (
                isRegistrationJoined ? (
                  <Badge className="bg-sky-500/15 text-sky-800 dark:text-sky-200">
                    In D-group (registration)
                  </Badge>
                ) : (
                  <Badge className="bg-emerald-500/15 text-emerald-800 dark:text-emerald-200">
                    Marked joined
                  </Badge>
                )
              ) : (
                <>
                  <Badge className="bg-amber-500/15 text-amber-800 dark:text-amber-200">
                    Wants to join
                  </Badge>
                  {request.isAcknowledged ? (
                    <Badge className="dgroup-acknowledged-badge">
                      Acknowledged
                    </Badge>
                  ) : null}
                </>
              )}
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
              {request.requestedAt ? <>Requested {formatAppDateTime(request.requestedAt)}</> : null}
              {request.sessionCount > 0
                ? `${request.requestedAt ? " · " : ""}${request.sessionCount} session${request.sessionCount === 1 ? "" : "s"}`
                : ""}
              {request.lastRegisteredAt
                ? ` · Last seen ${formatDistanceToNow(new Date(request.lastRegisteredAt), { addSuffix: true })}`
                : ""}
            </p>
            {!isJoined &&
            (request.dgroupAvailableDays.length > 0 ||
              request.dgroupAvailableTimeFrom ||
              request.dgroupAvailableTimeTo) ? (
              <p className="text-xs text-amber-800/90 dark:text-amber-200/90">
                Available:{" "}
                {formatDgroupAvailabilitySummary(
                  request.dgroupAvailableDays,
                  request.dgroupAvailableTimeFrom,
                  request.dgroupAvailableTimeTo,
                )}
              </p>
            ) : null}
            {!isJoined && (request.remarkCount ?? 0) > 0 ? (
              <p className="text-xs text-muted-foreground">
                {request.remarkCount} remark{(request.remarkCount ?? 0) === 1 ? "" : "s"}
              </p>
            ) : null}
          </div>
        </div>

        <div className="flex flex-wrap gap-2 sm:justify-end">
          <Button type="button" size="sm" variant="outline" onClick={onViewProfile}>
            View profile
          </Button>
          {isJoined ? (
            !isRegistrationJoined ? (
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="border-amber-500/40 text-amber-700 hover:bg-amber-500/10 dark:text-amber-300"
                disabled={resolvePending}
                onClick={onUnmarkJoined}
              >
                <RotateCcw className="mr-1.5 h-4 w-4" aria-hidden />
                Unmark joined
              </Button>
            ) : null
          ) : (
            <>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="border-sky-500/40 text-sky-700 hover:bg-sky-500/10 dark:text-sky-300"
                disabled={resolvePending}
                onClick={onAddRemarks}
              >
                <MessageSquarePlus className="mr-1.5 h-4 w-4" aria-hidden />
                Add remarks
                {(request.remarkCount ?? 0) > 0 ? (
                  <span className="ml-1.5 rounded-full bg-sky-500/15 px-1.5 py-0 text-[10px] tabular-nums">
                    {request.remarkCount}
                  </span>
                ) : null}
              </Button>
              {!request.isAcknowledged ? (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="dgroup-acknowledge-btn"
                  disabled={resolvePending}
                  onClick={onAcknowledge}
                >
                  <ClipboardCheck className="mr-1.5 h-4 w-4" aria-hidden />
                  Acknowledge
                </Button>
              ) : null}
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="border-emerald-500/40 text-emerald-700 hover:bg-emerald-500/10 dark:text-emerald-300"
                disabled={resolvePending}
                onClick={onMarkJoined}
              >
                <CheckCircle2 className="mr-1.5 h-4 w-4" aria-hidden />
                Mark joined
              </Button>
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function DgroupRequestList({
  view,
  requests,
  isLoading,
  error,
  isFetching,
  resolvePending,
  includeRegistrationDgroup = false,
  showAcknowledged = false,
  onViewProfile,
  onMarkJoined,
  onAcknowledge,
  onAddRemarks,
  onUnmarkJoined,
}: {
  view: DgroupRequestView;
  requests: DgroupRequestItem[];
  isLoading: boolean;
  error: Error | null;
  isFetching: boolean;
  resolvePending: boolean;
  includeRegistrationDgroup?: boolean;
  showAcknowledged?: boolean;
  onViewProfile: (request: DgroupRequestItem) => void;
  onMarkJoined: (request: DgroupRequestItem) => void;
  onAcknowledge: (request: DgroupRequestItem) => void;
  onAddRemarks: (request: DgroupRequestItem) => void;
  onUnmarkJoined: (request: DgroupRequestItem) => void;
}) {
  if (isLoading) {
    return (
      <div className="flex min-h-40 items-center justify-center text-muted-foreground">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" aria-hidden />
        Loading D-group {view === "joined" ? "joined list" : "requests"}…
      </div>
    );
  }

  if (error) {
    return (
      <p className="text-sm text-destructive">
        {error instanceof Error ? error.message : "Failed to load D-group requests."}
      </p>
    );
  }

  if (requests.length === 0) {
    return (
      <Card className="glass-panel border-dashed">
        <CardContent className="flex flex-col items-center justify-center gap-3 py-12 text-center">
          <UserRound className="h-10 w-10 text-muted-foreground/70" aria-hidden />
          <div>
            <p className="font-medium text-foreground">
              {view === "joined"
                ? "No joined D-group members yet"
                : showAcknowledged
                  ? "No acknowledged requests"
                  : "No open D-group requests"}
            </p>
            <p className="mt-1 max-w-md text-sm text-muted-foreground">
              {view === "joined"
                ? includeRegistrationDgroup
                  ? "No marked joins or registration D-group members match your search."
                  : "Players you mark as joined from the active request list will appear here. Turn on the checkbox below to include players who said they are already in a D-group during registration."
                : showAcknowledged
                  ? "Acknowledged requests will appear here. Uncheck the filter to return to open requests that still need follow-up."
                  : "When players register and choose “Yes” to joining a D-group, they will appear here for follow-up."}
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
        <DgroupRequestCard
          key={request.id}
          request={request}
          view={view}
          resolvePending={resolvePending}
          onViewProfile={() => onViewProfile(request)}
          onMarkJoined={() => onMarkJoined(request)}
          onAcknowledge={() => onAcknowledge(request)}
          onAddRemarks={() => onAddRemarks(request)}
          onUnmarkJoined={() => onUnmarkJoined(request)}
        />
      ))}
    </div>
  );
}

export function DgroupRequestsPanel({ embedded = false }: { embedded?: boolean }) {
  const queryClient = useQueryClient();
  const [searchInput, setSearchInput] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [activeView, setActiveView] = useState<DgroupRequestView>("pending");
  const [showAcknowledged, setShowAcknowledged] = useState(false);
  const [showRegistrationDgroup, setShowRegistrationDgroup] = useState(false);
  const [selectedPlayer, setSelectedPlayer] = useState<{ id: string; name: string } | null>(null);
  const [remarksTarget, setRemarksTarget] = useState<{ id: string; name: string } | null>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearch(searchInput.trim()), 300);
    return () => window.clearTimeout(timer);
  }, [searchInput]);

  const pendingQuery = useDgroupRequests("pending", debouncedSearch, false, showAcknowledged);
  const joinedQuery = useDgroupRequests("joined", debouncedSearch, showRegistrationDgroup);

  const resolveMutation = useMutation({
    mutationFn: async ({
      playerId,
      action,
    }: {
      playerId: string;
      action: "mark_joined" | "acknowledge" | "unmark_joined";
    }) => {
      const response = await fetch(`/api/my-club/dgroup-requests/${playerId}`, {
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
      queryClient.invalidateQueries({ queryKey: [myClubDgroupRequestsQueryKey] });
      queryClient.invalidateQueries({ queryKey: myClubDgroupCountQueryKey });
      if (variables.action === "mark_joined") {
        setActiveView("joined");
      } else if (variables.action === "unmark_joined") {
        setActiveView("pending");
      }
    },
    onError: (resolveError) => {
      toast.error(resolveError instanceof Error ? resolveError.message : "Failed to update request.");
    },
  });

  const confirmMarkJoined = async (request: DgroupRequestItem) => {
    const result = await Swal.fire({
      title: "Mark as joined?",
      text: `${request.name} will be recorded as part of a D-group.`,
      icon: "question",
      showCancelButton: true,
      confirmButtonText: "Mark joined",
      ...joinedAlertOptions,
    });
    if (result.isConfirmed) {
      resolveMutation.mutate({ playerId: request.id, action: "mark_joined" });
    }
  };

  const confirmAcknowledge = async (request: DgroupRequestItem) => {
    const result = await Swal.fire({
      title: "Acknowledge request?",
      text: `${request.name} will see that their D-group request was acknowledged and cannot submit again.`,
      icon: "question",
      showCancelButton: true,
      confirmButtonText: "Acknowledge",
      ...acknowledgeAlertOptions,
    });
    if (result.isConfirmed) {
      resolveMutation.mutate({ playerId: request.id, action: "acknowledge" });
    }
  };

  const confirmUnmarkJoined = async (request: DgroupRequestItem) => {
    const result = await Swal.fire({
      title: "Return to active requests?",
      text: `${request.name} will be moved back to the open D-group request list.`,
      icon: "question",
      showCancelButton: true,
      confirmButtonText: "Unmark joined",
      ...unmarkAlertOptions,
    });
    if (result.isConfirmed) {
      resolveMutation.mutate({ playerId: request.id, action: "unmark_joined" });
    }
  };

  const pendingTotal = pendingQuery.data?.total ?? 0;
  const joinedTotal = joinedQuery.data?.total ?? 0;

  const buildDgroupExportUrl = () => {
    const params = new URLSearchParams({ view: activeView });
    if (debouncedSearch) params.set("q", debouncedSearch);
    if (activeView === "pending" && showAcknowledged) params.set("showAcknowledged", "true");
    if (activeView === "joined" && showRegistrationDgroup) {
      params.set("includeRegistrationDgroup", "true");
    }
    return `/api/my-club/dgroup-requests/export?${params.toString()}`;
  };

  const dgroupExportFilename =
    activeView === "joined"
      ? showRegistrationDgroup
        ? "dgroup-requests-joined-with-registration.xlsx"
        : "dgroup-requests-joined.xlsx"
      : showAcknowledged
        ? "dgroup-requests-acknowledged.xlsx"
        : "dgroup-requests-open.xlsx";

  return (
    <div className={cn("space-y-5", embedded && "my-club-tab-content")}>
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border/60 pb-4">
        <div>
          {!embedded ? (
            <>
              <h2 className="section-title">D-group requests</h2>
              <p className="caption mt-1">
                Follow up on players who asked to join a D-group, and track who has joined.
              </p>
            </>
          ) : (
            <>
              <p className="text-sm font-semibold text-foreground">D-group requests</p>
              <p className="mt-0.5 text-sm text-muted-foreground">
                Follow up on open requests and review players marked as joined.
              </p>
            </>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <MyClubExcelExportButton
            buildUrl={buildDgroupExportUrl}
            defaultFilename={dgroupExportFilename}
            disabled={
              activeView === "pending"
                ? pendingQuery.isLoading
                : joinedQuery.isLoading
            }
          />
          <Badge variant="secondary" className="h-7 px-3 text-sm tabular-nums">
            {activeView === "pending"
              ? showAcknowledged
                ? `${pendingTotal} acknowledged`
                : `${pendingTotal} pending`
              : `${joinedTotal} joined`}
          </Badge>
        </div>
      </div>

      <div className="relative">
        <Search
          className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
          aria-hidden
        />
        <Input
          value={searchInput}
          placeholder="Search by name, email, or mobile…"
          className="h-11 bg-background pl-9"
          onChange={(event) => setSearchInput(event.target.value)}
        />
      </div>

      <Tabs
        value={activeView}
        onValueChange={(value) => setActiveView(value as DgroupRequestView)}
        className="gap-4"
      >
        <TabsList className="h-auto w-full flex-wrap justify-start gap-1 bg-muted/40 p-1 sm:w-auto">
          <TabsTrigger value="pending" className="gap-1.5 px-3">
            Active requests
            {pendingTotal > 0 ? (
              <Badge variant="secondary" className="px-1.5 py-0 text-xs tabular-nums">
                {pendingTotal}
              </Badge>
            ) : null}
          </TabsTrigger>
          <TabsTrigger value="joined" className="gap-1.5 px-3">
            Joined
            {joinedTotal > 0 ? (
              <Badge variant="secondary" className="px-1.5 py-0 text-xs tabular-nums">
                {joinedTotal}
              </Badge>
            ) : null}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="pending" className="mt-0 space-y-4 outline-none">
          <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-border/70 bg-muted/10 p-4">
            <Checkbox
              checked={showAcknowledged}
              onCheckedChange={(value) => setShowAcknowledged(Boolean(value))}
            />
            <span className="space-y-1">
              <span className="block text-sm font-medium text-foreground">Acknowledged</span>
              <span className="block text-sm text-muted-foreground">
                Show requests you have acknowledged. Unchecked shows open requests still awaiting follow-up.
              </span>
            </span>
          </label>

          <DgroupRequestList
            view="pending"
            requests={pendingQuery.data?.requests ?? []}
            isLoading={pendingQuery.isLoading}
            error={pendingQuery.error}
            isFetching={pendingQuery.isFetching}
            resolvePending={resolveMutation.isPending}
            showAcknowledged={showAcknowledged}
            onViewProfile={(request) => setSelectedPlayer({ id: request.id, name: request.name })}
            onMarkJoined={(request) => void confirmMarkJoined(request)}
            onAcknowledge={(request) => void confirmAcknowledge(request)}
            onAddRemarks={(request) => setRemarksTarget({ id: request.id, name: request.name })}
            onUnmarkJoined={() => undefined}
          />
        </TabsContent>

        <TabsContent value="joined" className="mt-0 space-y-4 outline-none">
          <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-border/70 bg-muted/10 p-4">
            <Checkbox
              checked={showRegistrationDgroup}
              onCheckedChange={(value) => setShowRegistrationDgroup(Boolean(value))}
            />
            <span className="space-y-1">
              <span className="block text-sm font-medium text-foreground">
                Show players with D-group from registration
              </span>
              <span className="block text-sm text-muted-foreground">
                Include players who answered yes to being in a D-group when they registered.
              </span>
            </span>
          </label>

          <DgroupRequestList
            view="joined"
            requests={joinedQuery.data?.requests ?? []}
            isLoading={joinedQuery.isLoading}
            error={joinedQuery.error}
            isFetching={joinedQuery.isFetching}
            resolvePending={resolveMutation.isPending}
            includeRegistrationDgroup={showRegistrationDgroup}
            onViewProfile={(request) => setSelectedPlayer({ id: request.id, name: request.name })}
            onMarkJoined={() => undefined}
            onAcknowledge={() => undefined}
            onAddRemarks={() => undefined}
            onUnmarkJoined={(request) => void confirmUnmarkJoined(request)}
          />
        </TabsContent>
      </Tabs>

      <OwnerPlayerDetailsDialog
        player={selectedPlayer}
        onClose={() => setSelectedPlayer(null)}
      />

      {remarksTarget ? (
        <DgroupRemarksDialog
          playerId={remarksTarget.id}
          playerName={remarksTarget.name}
          open={Boolean(remarksTarget)}
          onOpenChange={(open) => {
            if (!open) setRemarksTarget(null);
          }}
        />
      ) : null}
    </div>
  );
}
