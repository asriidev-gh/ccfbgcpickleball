"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import { ChevronDown, ClipboardCheck, Loader2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { formatAppDateTime } from "@/lib/format-datetime";
import { formatMarketplaceFulfillmentMethod, formatMarketplacePrice } from "@/lib/marketplace-listings-shared";
import {
  formatMarketplaceOrderLine,
  formatMarketplaceOrderStatus,
  isOwnerOpenMarketplaceOrder,
  marketplaceOrderLineTotalQuantity,
  ownerMarketplaceOrdersQueryKey,
  type MarketplaceOrderItem,
} from "@/lib/marketplace-orders-shared";
import { formatMarketplacePaymentMethod } from "@/lib/marketplace-payment-shared";
import { cn } from "@/lib/utils";

type OwnerOrderAction = "acknowledge" | "mark_for_release" | "fulfill";

function orderStatusMenuLabel(status: MarketplaceOrderItem["status"]) {
  if (status === "for_release") return "Mark for release";
  return "Update status";
}

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

export function MarketplaceOrderRow({
  order,
  showListingTitle = false,
}: {
  order: MarketplaceOrderItem;
  showListingTitle?: boolean;
}) {
  const queryClient = useQueryClient();
  const [extrasOpen, setExtrasOpen] = useState(
    () => order.status === "pending" && Boolean(order.paymentProofUrl || order.delivery),
  );

  const updateMutation = useMutation({
    mutationFn: async (action: OwnerOrderAction) => {
      const response = await fetch(`/api/marketplace/orders/${order.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const payload = (await response.json()) as { message?: string };
      if (!response.ok) throw new Error(payload.message ?? "Failed to update order.");
      return payload;
    },
    onSuccess: (payload) => {
      toast.success(payload.message ?? "Order updated.");
      void queryClient.invalidateQueries({ queryKey: ownerMarketplaceOrdersQueryKey() });
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Failed to update order.");
    },
  });

  const totalQuantity = marketplaceOrderLineTotalQuantity(order.lines);
  const isUpdating = updateMutation.isPending;
  const linesSummary = order.lines.map(formatMarketplaceOrderLine).join(" · ");
  const hasExtras = Boolean(order.paymentProofUrl || order.delivery);

  return (
    <div className="rounded-md border border-border/60 bg-muted/10 px-2.5 py-2">
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1 space-y-1">
          {showListingTitle ? (
            <p className="truncate text-[0.6875rem] font-medium text-muted-foreground">
              {order.listingTitle}
            </p>
          ) : null}
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <p className="truncate text-sm font-medium text-foreground">{order.playerName}</p>
            <Badge
              variant="outline"
              className={cn("h-5 px-1.5 text-[0.625rem]", orderStatusBadgeClass(order.status))}
            >
              {formatMarketplaceOrderStatus(order.status)}
            </Badge>
          </div>
          <p className="line-clamp-2 text-xs text-foreground/85">{linesSummary}</p>
          <p className="text-[0.6875rem] leading-snug text-muted-foreground">
            <span className="font-medium tabular-nums text-foreground">
              {formatMarketplacePrice(order.orderTotal)}
            </span>
            <span className="mx-1 text-border">·</span>
            {totalQuantity} {totalQuantity === 1 ? "item" : "items"}
            {order.fulfillmentMethod === "courier" ? (
              <>
                <span className="mx-1 text-border">·</span>
                +{formatMarketplacePrice(order.deliveryFee)} ship
              </>
            ) : null}
            <span className="mx-1 text-border">·</span>
            {formatMarketplacePaymentMethod(order.paymentMethod)}
            <span className="mx-1 text-border">·</span>
            {formatMarketplaceFulfillmentMethod(order.fulfillmentMethod)}
          </p>
          <p className="text-[0.625rem] text-muted-foreground/80">
            {formatAppDateTime(order.createdAt)}
            {order.updatedAt !== order.createdAt ? (
              <> · {formatDistanceToNow(new Date(order.updatedAt), { addSuffix: true })}</>
            ) : null}
          </p>
        </div>

        <div className="flex shrink-0 flex-col items-end gap-1">
          {order.status === "pending" ? (
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-7 border-sky-500/40 px-2 text-[0.6875rem] text-sky-700 hover:bg-sky-500/10 dark:text-sky-300"
              disabled={isUpdating}
              onClick={() => updateMutation.mutate("acknowledge")}
            >
              {isUpdating ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
              ) : (
                <>
                  <ClipboardCheck className="mr-1 h-3.5 w-3.5" aria-hidden />
                  Ack
                </>
              )}
            </Button>
          ) : null}
          {isOwnerOpenMarketplaceOrder(order.status) ? (
            <DropdownMenu>
              <DropdownMenuTrigger
                disabled={isUpdating}
                className={cn(
                  "inline-flex h-7 items-center gap-1 rounded-md border border-input bg-background px-2",
                  "text-[0.6875rem] text-foreground outline-none focus-visible:border-ring focus-visible:ring-2",
                  "focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-input/30",
                )}
              >
                <span className="max-w-[5.5rem] truncate">{orderStatusMenuLabel(order.status)}</span>
                {isUpdating ? (
                  <Loader2 className="h-3 w-3 shrink-0 animate-spin" aria-hidden />
                ) : (
                  <ChevronDown className="h-3 w-3 shrink-0 opacity-60" aria-hidden />
                )}
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="end"
                className="w-[10.5rem] bg-popover text-popover-foreground"
              >
                {order.status === "acknowledged" ? (
                  <DropdownMenuItem onClick={() => updateMutation.mutate("mark_for_release")}>
                    Mark for release
                  </DropdownMenuItem>
                ) : null}
                <DropdownMenuItem onClick={() => updateMutation.mutate("fulfill")}>
                  Mark as fulfilled
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : null}
        </div>
      </div>

      {hasExtras ? (
        <div className="mt-1.5 border-t border-border/50 pt-1.5">
          <button
            type="button"
            className="flex w-full items-center gap-1 text-[0.6875rem] text-muted-foreground hover:text-foreground"
            onClick={() => setExtrasOpen((open) => !open)}
            aria-expanded={extrasOpen}
          >
            <ChevronDown
              className={cn("h-3 w-3 transition-transform", extrasOpen && "rotate-180")}
              aria-hidden
            />
            {extrasOpen ? "Hide details" : "Show delivery & payment proof"}
          </button>
          {extrasOpen ? (
            <div className="mt-1.5 space-y-1.5 text-xs">
              {order.delivery ? (
                <p className="rounded-md bg-background/60 px-2 py-1.5 text-muted-foreground">
                  <span className="font-medium text-foreground">Delivery: </span>
                  {order.delivery.deliveryAddress}
                  <span className="text-border"> · </span>
                  {order.delivery.contactPerson} ({order.delivery.contactNumber})
                </p>
              ) : null}
              {order.paymentProofUrl ? (
                <div className="rounded-md bg-background/60 p-1.5">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={order.paymentProofUrl}
                    alt="Payment proof"
                    className="mx-auto max-h-24 w-full rounded object-contain"
                  />
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
