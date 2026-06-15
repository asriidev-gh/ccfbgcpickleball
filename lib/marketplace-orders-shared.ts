import type { MarketplaceFulfillmentMethod } from "@/lib/marketplace-listings-shared";
import type { MarketplacePaymentMethod } from "@/lib/marketplace-payment-shared";

export const MAX_MARKETPLACE_ORDER_LINES = 10;
export const MAX_MARKETPLACE_ORDER_QUANTITY = 99;
export const MIN_MARKETPLACE_ORDER_QUANTITY = 1;

export const MARKETPLACE_ORDER_STATUSES = [
  "pending",
  "acknowledged",
  "for_release",
  "fulfilled",
  "cancelled",
] as const;
export type MarketplaceOrderStatus = (typeof MARKETPLACE_ORDER_STATUSES)[number];

export type MarketplaceOrderLine = {
  size: string | null;
  color: string | null;
  quantity: number;
};

export type MarketplaceOrderDeliveryDetails = {
  deliveryAddress: string;
  landmark: string;
  contactPerson: string;
  contactNumber: string;
  deliveryNotes: string | null;
};

export type MarketplaceOrderItem = {
  id: string;
  listingId: string;
  listingTitle: string;
  listingPhotoUrl: string | null;
  playerId: string;
  playerName: string;
  gameId: string;
  lines: MarketplaceOrderLine[];
  fulfillmentMethod: MarketplaceFulfillmentMethod;
  unitPrice: number;
  itemSubtotal: number;
  deliveryFee: number;
  orderTotal: number;
  delivery: MarketplaceOrderDeliveryDetails | null;
  paymentMethod: MarketplacePaymentMethod;
  paymentProofUrl: string | null;
  status: MarketplaceOrderStatus;
  createdAt: string;
  updatedAt: string;
};

export function marketplaceOrderLineTotalQuantity(lines: MarketplaceOrderLine[]) {
  return lines.reduce((sum, line) => sum + line.quantity, 0);
}

export function formatMarketplaceOrderLine(line: MarketplaceOrderLine) {
  const parts: string[] = [];
  if (line.size) parts.push(line.size);
  if (line.color) parts.push(line.color);
  const label = parts.length > 0 ? parts.join(" / ") : "Item";
  return `${label} × ${line.quantity}`;
}

export function spectateMarketplaceOrdersQueryKey(gameId: string, playerId: string) {
  return ["spectate-marketplace-orders", gameId, playerId] as const;
}

export function ownerMarketplaceOrdersQueryKey() {
  return ["marketplace-orders"] as const;
}

export function canPlayerCancelMarketplaceOrder(status: MarketplaceOrderStatus) {
  return status === "pending";
}

export function isOwnerOpenMarketplaceOrder(status: MarketplaceOrderStatus) {
  return status === "acknowledged" || status === "for_release";
}

export function formatMarketplaceOrderStatus(status: MarketplaceOrderStatus) {
  switch (status) {
    case "pending":
      return "Pending";
    case "acknowledged":
      return "Acknowledged";
    case "for_release":
      return "For Release";
    case "fulfilled":
      return "Fulfilled";
    case "cancelled":
      return "Cancelled";
  }
}

export type PlayerMarketplaceOrderStatusFilter = "all" | MarketplaceOrderStatus;

export const PLAYER_MARKETPLACE_ORDER_STATUS_FILTER_OPTIONS: Array<{
  value: PlayerMarketplaceOrderStatusFilter;
  label: string;
}> = [
  { value: "all", label: "All orders" },
  { value: "pending", label: "Pending" },
  { value: "acknowledged", label: "Acknowledged" },
  { value: "for_release", label: "For Release" },
  { value: "fulfilled", label: "Fulfilled" },
  { value: "cancelled", label: "Cancelled" },
];

export function filterPlayerMarketplaceOrders(
  orders: MarketplaceOrderItem[],
  filter: PlayerMarketplaceOrderStatusFilter,
) {
  if (filter === "all") return orders;
  return orders.filter((order) => order.status === filter);
}

export function formatPlayerMarketplaceOrderStatusFilter(
  filter: PlayerMarketplaceOrderStatusFilter,
) {
  return (
    PLAYER_MARKETPLACE_ORDER_STATUS_FILTER_OPTIONS.find((option) => option.value === filter)
      ?.label ?? "All orders"
  );
}

export const OWNER_MARKETPLACE_ORDER_STATUS_PLACEHOLDER = "select_order_status" as const;

export type OwnerMarketplaceOrderStatusSelectValue =
  | typeof OWNER_MARKETPLACE_ORDER_STATUS_PLACEHOLDER
  | "mark_for_release"
  | "fulfill";

export function ownerMarketplaceOrderStatusSelectValue(
  status: MarketplaceOrderStatus,
): OwnerMarketplaceOrderStatusSelectValue {
  if (status === "for_release") return "mark_for_release";
  return OWNER_MARKETPLACE_ORDER_STATUS_PLACEHOLDER;
}

export function formatOwnerMarketplaceOrderActionLabel(action: "mark_for_release" | "fulfill") {
  switch (action) {
    case "mark_for_release":
      return "Mark for release";
    case "fulfill":
      return "Mark as fulfilled";
  }
}

export function marketplaceOrderItemSubtotal(unitPrice: number, lines: MarketplaceOrderLine[]) {
  return unitPrice * marketplaceOrderLineTotalQuantity(lines);
}
