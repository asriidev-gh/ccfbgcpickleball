import type { MarketplacePaymentMethod } from "@/lib/marketplace-payment-shared";

export const MAX_MARKETPLACE_PHOTO_BYTES = 5 * 1024 * 1024;

export const MAX_MARKETPLACE_TITLE_LENGTH = 120;
export const MAX_MARKETPLACE_DESCRIPTION_LENGTH = 300;
export const MAX_MARKETPLACE_PRODUCT_TAG_LENGTH = 40;
export const MAX_MARKETPLACE_LOCATION_LENGTH = 200;
export const MAX_MARKETPLACE_PICKUP_LOCATION_LENGTH = 200;
export const MAX_MARKETPLACE_DELIVERY_ADDRESS_LENGTH = 300;
export const MAX_MARKETPLACE_LANDMARK_LENGTH = 200;
export const MAX_MARKETPLACE_CONTACT_NAME_LENGTH = 120;
export const MAX_MARKETPLACE_CONTACT_NUMBER_LENGTH = 40;
export const MAX_MARKETPLACE_DELIVERY_NOTES_LENGTH = 300;
export const MAX_MARKETPLACE_ITEM_SIZE_LENGTH = 40;
export const MAX_MARKETPLACE_ITEM_COLOR_LENGTH = 40;

export const MARKETPLACE_CONDITIONS = ["New", "Used"] as const;
export type MarketplaceCondition = (typeof MARKETPLACE_CONDITIONS)[number];

export const MARKETPLACE_ITEM_TYPES = [
  "Tshirt",
  "Paddle",
  "Pickleballs",
  "Shoes",
  "Bag",
  "Shorts",
  "Skirt",
  "Hat / Visor",
  "Grip / Overgrip",
  "Wristband",
  "Towel",
  "Net",
  "Ball hopper",
  "Socks",
  "Hoodie / Jacket",
  "Eyewear",
  "Gloves",
  "Other",
] as const;
export type MarketplaceItemType = (typeof MARKETPLACE_ITEM_TYPES)[number];

export const MARKETPLACE_FULFILLMENT_METHODS = ["pickup", "courier"] as const;
export type MarketplaceFulfillmentMethod = (typeof MARKETPLACE_FULFILLMENT_METHODS)[number];

export type MarketplaceListingItem = {
  id: string;
  title: string;
  price: number;
  condition: MarketplaceCondition;
  description: string;
  productTag: string | null;
  itemType: MarketplaceItemType | null;
  itemSize: string | null;
  itemColor: string | null;
  location: string;
  fulfillmentMethod: MarketplaceFulfillmentMethod;
  pickupLocation: string | null;
  deliveryFee: number | null;
  deliveryFeeShoulderedByRecipient: boolean;
  photoUrl: string | null;
  paymentMethods: MarketplacePaymentMethod[];
  gcashName: string | null;
  gcashNumber: string | null;
  bankName: string | null;
  bankAccountName: string | null;
  bankAccountNumber: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

export function formatMarketplacePrice(price: number) {
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    maximumFractionDigits: 2,
  }).format(price);
}

/** Split seller-configured size/color values (e.g. "S,M,L,XL") into select options. */
export function parseMarketplaceListingOptions(value: string | null | undefined): string[] {
  const trimmed = value?.trim();
  if (!trimmed) return [];

  const seen = new Set<string>();
  const options: string[] = [];
  for (const part of trimmed.split(/[,;]/)) {
    const option = part.trim();
    if (!option) continue;
    const key = option.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    options.push(option);
  }
  return options;
}

export function formatMarketplaceListingOptionsLabel(value: string | null | undefined) {
  const options = parseMarketplaceListingOptions(value);
  return options.length > 0 ? options.join(", ") : null;
}

export function formatMarketplaceFulfillmentMethod(method: MarketplaceFulfillmentMethod) {
  return method === "pickup" ? "Pick up" : "By courier";
}

export function marketplaceListingPickupLocation(
  listing: Pick<MarketplaceListingItem, "fulfillmentMethod" | "pickupLocation" | "location">,
) {
  if (listing.fulfillmentMethod !== "pickup") return null;
  const pickupLocation = listing.pickupLocation?.trim();
  return pickupLocation || listing.location;
}

export function marketplaceListingDeliveryFeeAmount(
  listing: Pick<
    MarketplaceListingItem,
    "fulfillmentMethod" | "deliveryFee" | "deliveryFeeShoulderedByRecipient"
  >,
) {
  if (listing.fulfillmentMethod !== "courier") return 0;
  if (listing.deliveryFeeShoulderedByRecipient) return 0;
  return listing.deliveryFee ?? 0;
}

export function formatMarketplaceListingCourierDeliveryLabel(
  listing: Pick<
    MarketplaceListingItem,
    "fulfillmentMethod" | "deliveryFee" | "deliveryFeeShoulderedByRecipient"
  >,
) {
  if (listing.fulfillmentMethod !== "courier") return null;
  if (listing.deliveryFeeShoulderedByRecipient) {
    return "Delivery fee shouldered by recipient";
  }
  if (listing.deliveryFee != null) {
    return `Delivery fee ${formatMarketplacePrice(listing.deliveryFee)}`;
  }
  return null;
}
