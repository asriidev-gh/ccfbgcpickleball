"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import { ClipboardList, Loader2 } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { MarketplaceListingPhotoDialog } from "@/components/marketplace/marketplace-listing-photo-dialog";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatAppDateTime } from "@/lib/format-datetime";
import { formatMarketplaceFulfillmentMethod, formatMarketplacePrice } from "@/lib/marketplace-listings-shared";
import {
  canPlayerCancelMarketplaceOrder,
  filterPlayerMarketplaceOrders,
  formatPlayerMarketplaceOrderStatusFilter,
  formatMarketplaceOrderLine,
  formatMarketplaceOrderStatus,
  marketplaceOrderLineTotalQuantity,
  PLAYER_MARKETPLACE_ORDER_STATUS_FILTER_OPTIONS,
  spectateMarketplaceOrdersQueryKey,
  type MarketplaceOrderItem,
  type PlayerMarketplaceOrderStatusFilter,
} from "@/lib/marketplace-orders-shared";
import { formatMarketplacePaymentMethod } from "@/lib/marketplace-payment-shared";
import { getLinkedPlayerIdForGame } from "@/lib/player-session";
import { cn } from "@/lib/utils";

function orderStatusBadgeClass(status: MarketplaceOrderItem["status"]) {
  switch (status) {
    case "pending":
      return "border-amber-500/40 bg-amber-500/10 text-amber-800 dark:text-amber-200";
    case "acknowledged":
      return "border-sky-500/40 bg-sky-500/10 text-sky-800 dark:text-sky-200";
    case "for_release":
      return "border-violet-500/40 bg-violet-500/10 text-violet-800 dark:text-violet-200";
    case "fulfilled":
      return "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300";
    case "cancelled":
      return "border-border bg-muted/50 text-muted-foreground";
  }
}

function orderStatusLabel(status: MarketplaceOrderItem["status"]) {
  return formatMarketplaceOrderStatus(status);
}

function OrderCard({
  order,
  gameId,
  playerId,
}: {
  order: MarketplaceOrderItem;
  gameId: string;
  playerId: string;
}) {
  const queryClient = useQueryClient();
  const [photoPreview, setPhotoPreview] = useState<{ url: string; title: string } | null>(null);

  const cancelMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch(
        `/api/games/${gameId}/spectate/player/marketplace/orders/${order.id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ playerId }),
        },
      );
      const payload = (await response.json()) as { message?: string };
      if (!response.ok) throw new Error(payload.message ?? "Failed to cancel order.");
      return payload;
    },
    onSuccess: (payload) => {
      toast.success(payload.message ?? "Order cancelled.");
      void queryClient.invalidateQueries({
        queryKey: spectateMarketplaceOrdersQueryKey(gameId, playerId),
      });
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Failed to cancel order.");
    },
  });

  const handleCancel = () => {
    if (!window.confirm("Cancel this order? The seller will no longer fulfill it.")) return;
    cancelMutation.mutate();
  };

  const totalQuantity = marketplaceOrderLineTotalQuantity(order.lines);

  return (
    <>
      <Card className="glass-panel overflow-hidden">
        {order.listingPhotoUrl ? (
          <div className="border-b border-border/60 bg-muted/15 px-4 py-3">
            <button
              type="button"
              className="mx-auto block w-full rounded-xl outline-none transition-opacity hover:opacity-90 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
              aria-label={`View full photo of ${order.listingTitle}`}
              onClick={() =>
                setPhotoPreview({ url: order.listingPhotoUrl!, title: order.listingTitle })
              }
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={order.listingPhotoUrl}
                alt={order.listingTitle}
                className="mx-auto max-h-40 w-full cursor-pointer rounded-xl border border-border/70 bg-background object-contain"
              />
            </button>
          </div>
        ) : null}
      <CardHeader className="space-y-2 pb-3">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <CardTitle className="text-lg">{order.listingTitle}</CardTitle>
          <Badge variant="outline" className={cn(orderStatusBadgeClass(order.status))}>
            {orderStatusLabel(order.status)}
          </Badge>
        </div>
        <p className="text-xs text-muted-foreground">
          Ordered {formatAppDateTime(order.createdAt)}
          {order.updatedAt !== order.createdAt ? (
            <>
              {" "}
              · Updated {formatDistanceToNow(new Date(order.updatedAt), { addSuffix: true })}
            </>
          ) : null}
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <ul className="space-y-1.5 text-sm">
          {order.lines.map((line, index) => (
            <li key={`${order.id}-line-${index}`} className="text-foreground/90">
              {formatMarketplaceOrderLine(line)}
            </li>
          ))}
        </ul>
        <p className="text-sm font-medium tabular-nums">
          {totalQuantity} {totalQuantity === 1 ? "item" : "items"} total
        </p>
        <div className="space-y-1 text-sm">
          <div className="flex items-center justify-between gap-3">
            <span className="text-muted-foreground">Items</span>
            <span className="tabular-nums">{formatMarketplacePrice(order.itemSubtotal)}</span>
          </div>
          {order.fulfillmentMethod === "courier" ? (
            <div className="flex items-center justify-between gap-3">
              <span className="text-muted-foreground">Delivery fee</span>
              <span className="tabular-nums">{formatMarketplacePrice(order.deliveryFee)}</span>
            </div>
          ) : null}
          <div className="flex items-center justify-between gap-3 font-medium">
            <span>Total</span>
            <span className="tabular-nums">{formatMarketplacePrice(order.orderTotal)}</span>
          </div>
          <p className="text-xs text-muted-foreground">
            {formatMarketplaceFulfillmentMethod(order.fulfillmentMethod)}
          </p>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={`player-order-status-${order.id}`} className="text-xs">
            Order status
          </Label>
          <Select value={order.status} disabled>
            <SelectTrigger
              id={`player-order-status-${order.id}`}
              className="h-8 w-full bg-background text-foreground sm:max-w-xs"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-popover text-popover-foreground">
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="acknowledged">Acknowledged</SelectItem>
              <SelectItem value="for_release">For Release</SelectItem>
              <SelectItem value="fulfilled">Fulfilled</SelectItem>
              <SelectItem value="cancelled">Cancelled</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {order.delivery ? (
          <div className="space-y-1 rounded-xl border border-border/70 bg-muted/15 p-3 text-sm">
            <p className="font-medium text-foreground">Delivery details</p>
            <p>{order.delivery.deliveryAddress}</p>
            <p className="text-muted-foreground">Landmark: {order.delivery.landmark}</p>
            <p className="text-muted-foreground">
              {order.delivery.contactPerson} · {order.delivery.contactNumber}
            </p>
            {order.delivery.deliveryNotes ? (
              <p className="text-muted-foreground">Notes: {order.delivery.deliveryNotes}</p>
            ) : null}
          </div>
        ) : null}
        <div className="space-y-1 rounded-xl border border-border/70 bg-muted/15 p-3 text-sm">
          <p className="font-medium text-foreground">Payment method</p>
          <p>{formatMarketplacePaymentMethod(order.paymentMethod)}</p>
        </div>
        {order.paymentProofUrl ? (
          <div className="space-y-2 rounded-xl border border-border/70 bg-muted/15 p-3">
            <p className="text-sm font-medium text-foreground">Proof of payment</p>
            <button
              type="button"
              className="mx-auto block w-full rounded-lg outline-none transition-opacity hover:opacity-90 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
              aria-label={`View payment proof for ${order.listingTitle}`}
              onClick={() =>
                setPhotoPreview({
                  url: order.paymentProofUrl!,
                  title: `Payment proof — ${order.listingTitle}`,
                })
              }
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={order.paymentProofUrl}
                alt="Payment proof"
                className="mx-auto max-h-48 w-full cursor-pointer rounded-lg border border-border/70 bg-background object-contain"
              />
            </button>
          </div>
        ) : null}
        {canPlayerCancelMarketplaceOrder(order.status) ? (
          <Button
            type="button"
            variant="outline"
            className="w-full sm:w-auto"
            disabled={cancelMutation.isPending}
            onClick={handleCancel}
          >
            {cancelMutation.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
                Cancelling…
              </>
            ) : (
              "Cancel order"
            )}
          </Button>
        ) : null}
      </CardContent>
    </Card>
      {photoPreview ? (
        <MarketplaceListingPhotoDialog
          photoUrl={photoPreview.url}
          title={photoPreview.title}
          open={photoPreview !== null}
          onOpenChange={(open) => {
            if (!open) setPhotoPreview(null);
          }}
        />
      ) : null}
    </>
  );
}

export function PlayerMarketplaceOrdersView({ gameId }: { gameId: string }) {
  const [playerId, setPlayerId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<PlayerMarketplaceOrderStatusFilter>("all");

  useEffect(() => {
    const readSession = () => setPlayerId(getLinkedPlayerIdForGame(gameId));
    readSession();
    window.addEventListener("focus", readSession);
    return () => window.removeEventListener("focus", readSession);
  }, [gameId]);

  const { data, isLoading, error } = useQuery({
    queryKey: playerId ? spectateMarketplaceOrdersQueryKey(gameId, playerId) : ["spectate-marketplace-orders"],
    enabled: Boolean(playerId),
    queryFn: async () => {
      const response = await fetch(
        `/api/games/${gameId}/spectate/player/marketplace/orders?playerId=${encodeURIComponent(playerId!)}`,
      );
      const payload = (await response.json()) as {
        orders: MarketplaceOrderItem[];
        message?: string;
      };
      if (!response.ok) throw new Error(payload.message ?? "Failed to load orders.");
      return payload.orders;
    },
  });

  const orders = data ?? [];
  const filteredOrders = filterPlayerMarketplaceOrders(orders, statusFilter);

  if (!playerId) {
    return (
      <Card className="glass-panel border-dashed">
        <CardContent className="py-8 text-center text-sm text-muted-foreground">
          <Link
            href={`/register/${gameId}`}
            className={cn(buttonVariants({ variant: "link" }), "h-auto p-0")}
          >
            Register for this open play
          </Link>{" "}
          to view your marketplace orders.
        </CardContent>
      </Card>
    );
  }

  if (isLoading) {
    return (
      <p className="flex items-center gap-2 py-8 text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
        Loading your orders…
      </p>
    );
  }

  if (error) {
    return (
      <p className="py-8 text-destructive">
        {error instanceof Error ? error.message : "Failed to load orders."}
      </p>
    );
  }

  if (orders.length === 0) {
    return (
      <Card className="glass-panel border-dashed">
        <CardContent className="flex flex-col items-center justify-center gap-3 py-12 text-center">
          <ClipboardList className="h-10 w-10 text-muted-foreground/70" aria-hidden />
          <div>
            <p className="font-medium text-foreground">No orders yet</p>
            <p className="mt-1 max-w-sm text-sm text-muted-foreground">
              Browse the marketplace and place an order when you find something you want.
            </p>
          </div>
          <Link href={`/games/${gameId}/spectate/marketplace`}>
            <Button variant="outline" size="sm">
              Browse marketplace
            </Button>
          </Link>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <p className="text-xs text-muted-foreground">
          {filteredOrders.length} of {orders.length}{" "}
          {orders.length === 1 ? "order" : "orders"}
        </p>
        <div className="space-y-1.5">
          <Label htmlFor="player-orders-status-filter" className="text-xs">
            Filter by status
          </Label>
          <Select
            value={statusFilter}
            onValueChange={(value) =>
              setStatusFilter((value ?? "all") as PlayerMarketplaceOrderStatusFilter)
            }
          >
            <SelectTrigger
              id="player-orders-status-filter"
              className="h-8 w-[11.5rem] bg-background text-foreground"
            >
              <span className="flex flex-1 truncate text-left">
                {formatPlayerMarketplaceOrderStatusFilter(statusFilter)}
              </span>
            </SelectTrigger>
            <SelectContent className="bg-popover text-popover-foreground">
              {PLAYER_MARKETPLACE_ORDER_STATUS_FILTER_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {filteredOrders.length === 0 ? (
        <Card className="glass-panel border-dashed">
          <CardContent className="py-8 text-center text-sm text-muted-foreground">
            No orders match this status filter.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {filteredOrders.map((order) => (
            <OrderCard key={order.id} order={order} gameId={gameId} playerId={playerId} />
          ))}
        </div>
      )}
    </div>
  );
}
