import { marketplaceListingSchema } from "@/lib/validations";
import { MARKETPLACE_PAYMENT_METHODS, type MarketplacePaymentMethod } from "@/lib/marketplace-payment-shared";

function formString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

function formBoolean(formData: FormData, key: string, defaultValue: boolean) {
  const value = formData.get(key);
  if (value === "true") return true;
  if (value === "false") return false;
  return defaultValue;
}

function formOptionalNumber(formData: FormData, key: string) {
  const raw = formString(formData, key).replace(/,/g, "").trim();
  if (!raw) return undefined;
  const parsed = Number.parseFloat(raw);
  return Number.isFinite(parsed) ? parsed : Number.NaN;
}

function parsePaymentMethods(raw: string): MarketplacePaymentMethod[] {
  if (!raw.trim()) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((value): value is MarketplacePaymentMethod =>
      MARKETPLACE_PAYMENT_METHODS.includes(value as MarketplacePaymentMethod),
    );
  } catch {
    return [];
  }
}

export function parseMarketplaceListingFormData(formData: FormData) {
  const priceRaw = formString(formData, "price");
  const parsedPrice = Number.parseFloat(priceRaw);
  const fulfillmentMethod = formString(formData, "fulfillmentMethod") || "pickup";
  const deliveryFeeShoulderedByRecipient = formBoolean(
    formData,
    "deliveryFeeShoulderedByRecipient",
    false,
  );
  const deliveryFee = formOptionalNumber(formData, "deliveryFee");
  const paymentMethods = parsePaymentMethods(formString(formData, "paymentMethods"));

  const parsed = marketplaceListingSchema.safeParse({
    title: formString(formData, "title"),
    price: Number.isFinite(parsedPrice) ? parsedPrice : Number.NaN,
    condition: formString(formData, "condition"),
    description: formString(formData, "description"),
    productTag: formString(formData, "productTag"),
    itemType: formString(formData, "itemType"),
    itemSize: formString(formData, "itemSize"),
    itemColor: formString(formData, "itemColor"),
    location: formString(formData, "location"),
    fulfillmentMethod,
    pickupLocation: formString(formData, "pickupLocation"),
    deliveryFee:
      fulfillmentMethod === "courier" && !deliveryFeeShoulderedByRecipient
        ? deliveryFee
        : undefined,
    deliveryFeeShoulderedByRecipient,
    paymentMethods,
    gcashName: formString(formData, "gcashName"),
    gcashNumber: formString(formData, "gcashNumber"),
    bankName: formString(formData, "bankName"),
    bankAccountName: formString(formData, "bankAccountName"),
    bankAccountNumber: formString(formData, "bankAccountNumber"),
    isActive: formBoolean(formData, "isActive", true) ? "true" : "false",
  });

  const photoEntry = formData.get("photo");
  const photoFile = photoEntry instanceof File && photoEntry.size > 0 ? photoEntry : null;
  const removePhoto = formData.get("removePhoto") === "true";

  return { parsed, photoFile, removePhoto };
}
