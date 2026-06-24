import type { MarketplaceListingItem } from "@/lib/marketplace-listings-shared";
import type { MarketplaceOrderItem } from "@/lib/marketplace-orders-shared";
import { ownerMarketplaceOrdersQueryKey } from "@/lib/marketplace-orders-shared";
import { ownerHubQueryOptions } from "@/lib/owner-hub-query-options";

export const marketplaceListingsQueryKey = ["marketplace-listings"] as const;

export type MarketplaceListingsResponse = {
  listings: MarketplaceListingItem[];
  photoUploadConfigured?: boolean;
  message?: string;
};

export async function fetchMarketplaceListings(): Promise<MarketplaceListingsResponse> {
  const response = await fetch("/api/marketplace/listings");
  const payload = (await response.json()) as MarketplaceListingsResponse;
  if (!response.ok) {
    throw new Error(payload.message ?? "Failed to load listings.");
  }
  return payload;
}

export async function fetchOwnerMarketplaceOrders(): Promise<MarketplaceOrderItem[]> {
  const response = await fetch("/api/marketplace/orders");
  const payload = (await response.json()) as {
    orders: MarketplaceOrderItem[];
    message?: string;
  };
  if (!response.ok) {
    throw new Error(payload.message ?? "Failed to load orders.");
  }
  return payload.orders;
}

export { ownerMarketplaceOrdersQueryKey, ownerHubQueryOptions };
