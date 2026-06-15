"use client";

import { Bell, ChevronDown } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { MarketplaceOrderRow } from "@/components/marketplace/marketplace-order-row";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select";
import {
  filterPlayerMarketplaceOrders,
  formatPlayerMarketplaceOrderStatusFilter,
  PLAYER_MARKETPLACE_ORDER_STATUS_FILTER_OPTIONS,
  type MarketplaceOrderItem,
  type PlayerMarketplaceOrderStatusFilter,
} from "@/lib/marketplace-orders-shared";
import { cn } from "@/lib/utils";

const ORDER_STATUS_RANK: Record<MarketplaceOrderItem["status"], number> = {
  pending: 0,
  acknowledged: 1,
  for_release: 2,
  fulfilled: 3,
  cancelled: 99,
};

function sortListingOrders(orders: MarketplaceOrderItem[]) {
  return [...orders].sort((a, b) => {
    const rankDiff = ORDER_STATUS_RANK[a.status] - ORDER_STATUS_RANK[b.status];
    if (rankDiff !== 0) return rankDiff;
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });
}

export function MarketplaceListingOrdersPanel({
  listingId,
  orders,
}: {
  listingId: string;
  orders: MarketplaceOrderItem[];
}) {
  const sortedOrders = useMemo(() => sortListingOrders(orders), [orders]);
  const pendingCount = sortedOrders.filter((order) => order.status === "pending").length;

  const [open, setOpen] = useState(() => pendingCount > 0);
  const [statusFilter, setStatusFilter] = useState<PlayerMarketplaceOrderStatusFilter>("pending");

  const filteredOrders = useMemo(
    () => filterPlayerMarketplaceOrders(sortedOrders, statusFilter),
    [sortedOrders, statusFilter],
  );

  useEffect(() => {
    if (pendingCount > 0) setOpen(true);
  }, [listingId, pendingCount]);

  useEffect(() => {
    setStatusFilter("pending");
  }, [listingId]);

  if (sortedOrders.length === 0) return null;

  return (
    <div className="border-t border-border/60 px-3 pb-3 pt-2 sm:px-4">
      <button
        type="button"
        className="flex w-full items-center justify-between gap-3 rounded-md py-1 text-left transition-colors hover:bg-muted/30"
        onClick={() => setOpen((current) => !current)}
        aria-expanded={open}
        aria-controls={`listing-orders-${listingId}`}
      >
        <span className="flex min-w-0 items-center gap-2">
          <ChevronDown
            className={cn(
              "h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform",
              open && "rotate-180",
            )}
            aria-hidden
          />
          <span className="text-xs font-medium text-foreground sm:text-sm">Orders</span>
          <Badge variant="secondary" className="h-5 px-1.5 py-0 text-[0.625rem] tabular-nums">
            {sortedOrders.length}
          </Badge>
          {pendingCount > 0 ? (
            <Badge
              variant="outline"
              className="h-5 gap-0.5 border-amber-500/40 bg-amber-500/10 px-1.5 py-0 text-[0.625rem] text-amber-800 dark:text-amber-200"
            >
              <Bell className="h-2.5 w-2.5" aria-hidden />
              {pendingCount} new
            </Badge>
          ) : null}
        </span>
        <span className="text-[0.6875rem] text-muted-foreground">{open ? "Hide" : "Show"}</span>
      </button>

      {open ? (
        <div id={`listing-orders-${listingId}`} className="mt-1.5 space-y-1.5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Label
              htmlFor={`listing-orders-status-${listingId}`}
              className="text-[0.6875rem] text-muted-foreground"
            >
              Filter by status
            </Label>
            <Select
              value={statusFilter}
              onValueChange={(value) =>
                setStatusFilter((value ?? "all") as PlayerMarketplaceOrderStatusFilter)
              }
            >
              <SelectTrigger
                id={`listing-orders-status-${listingId}`}
                className="h-7 w-[10.5rem] bg-background text-foreground"
              >
                <span className="flex flex-1 truncate text-left text-xs">
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

          {filteredOrders.length === 0 ? (
            <p className="py-2 text-center text-xs text-muted-foreground">
              No orders match this status filter.
            </p>
          ) : (
            <div className="space-y-1">
              {filteredOrders.map((order) => (
                <MarketplaceOrderRow key={order.id} order={order} />
              ))}
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}
