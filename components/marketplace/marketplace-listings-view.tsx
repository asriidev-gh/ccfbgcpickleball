"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import { Loader2, MapPin, Pencil, Plus, Store, Trash2, Eye, EyeOff, Bell, Package, Truck, Wallet } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import Swal from "sweetalert2";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  MarketplaceListingPhotoField,
  type MarketplaceListingPhotoValue,
} from "@/components/marketplace/marketplace-listing-photo-field";
import { MarketplaceListingPhotoDialog } from "@/components/marketplace/marketplace-listing-photo-dialog";
import { MarketplaceListingOrdersPanel } from "@/components/marketplace/marketplace-listing-orders-panel";
import { formatAppDateTime } from "@/lib/format-datetime";
import {
  formatMarketplaceFulfillmentMethod,
  formatMarketplacePrice,
  formatMarketplaceListingOptionsLabel,
  MARKETPLACE_CONDITIONS,
  MARKETPLACE_FULFILLMENT_METHODS,
  MARKETPLACE_ITEM_TYPES,
  MAX_MARKETPLACE_DESCRIPTION_LENGTH,
  MAX_MARKETPLACE_ITEM_COLOR_LENGTH,
  MAX_MARKETPLACE_ITEM_SIZE_LENGTH,
  MAX_MARKETPLACE_LOCATION_LENGTH,
  MAX_MARKETPLACE_PICKUP_LOCATION_LENGTH,
  MAX_MARKETPLACE_PRODUCT_TAG_LENGTH,
  MAX_MARKETPLACE_TITLE_LENGTH,
  marketplaceListingPickupLocation,
  formatMarketplaceListingCourierDeliveryLabel,
  type MarketplaceCondition,
  type MarketplaceFulfillmentMethod,
  type MarketplaceItemType,
  type MarketplaceListingItem,
} from "@/lib/marketplace-listings-shared";
import {
  formatMarketplaceGcashNumberForForm,
  formatMarketplacePaymentMethod,
  isValidMarketplaceGcashNumber,
  MARKETPLACE_PAYMENT_METHODS,
  MARKETPLACE_BANK_PLACEHOLDER,
  MARKETPLACE_GCASH_NUMBER_PREFIX,
  MAX_MARKETPLACE_BANK_ACCOUNT_NAME_LENGTH,
  MAX_MARKETPLACE_BANK_ACCOUNT_NUMBER_LENGTH,
  MAX_MARKETPLACE_GCASH_NAME_LENGTH,
  MAX_MARKETPLACE_GCASH_NUMBER_LENGTH,
  normalizeMarketplaceGcashNumberInput,
  PH_LOCAL_BANKS,
  type MarketplacePaymentMethod,
} from "@/lib/marketplace-payment-shared";
import {
  ownerMarketplaceOrdersQueryKey,
  type MarketplaceOrderItem,
} from "@/lib/marketplace-orders-shared";
import { cn } from "@/lib/utils";

const alertOptions = {
  background: "#0f172a",
  color: "#e2e8f0",
  confirmButtonColor: "#ef4444",
  cancelButtonColor: "#64748b",
};

const NO_ITEM_TYPE_VALUE = "__none__";

type ListingStatusFilter = "active" | "inactive";

type ListingFormState = {
  title: string;
  price: string;
  condition: MarketplaceCondition;
  description: string;
  productTag: string;
  itemType: MarketplaceItemType | "";
  itemSize: string;
  itemColor: string;
  location: string;
  fulfillmentMethod: MarketplaceFulfillmentMethod;
  pickupLocation: string;
  deliveryFee: string;
  deliveryFeeShoulderedByRecipient: boolean;
  paymentMethods: MarketplacePaymentMethod[];
  gcashName: string;
  gcashNumber: string;
  bankName: string;
  bankAccountName: string;
  bankAccountNumber: string;
  isActive: boolean;
};

const emptyForm: ListingFormState = {
  title: "",
  price: "",
  condition: "New",
  description: "",
  productTag: "",
  itemType: "",
  itemSize: "",
  itemColor: "",
  location: "",
  fulfillmentMethod: "pickup",
  pickupLocation: "",
  deliveryFee: "",
  deliveryFeeShoulderedByRecipient: false,
  paymentMethods: ["cash"],
  gcashName: "",
  gcashNumber: "",
  bankName: "",
  bankAccountName: "",
  bankAccountNumber: "",
  isActive: true,
};

function listingToForm(listing: MarketplaceListingItem): ListingFormState {
  return {
    title: listing.title,
    price: String(listing.price),
    condition: listing.condition,
    description: listing.description,
    productTag: listing.productTag ?? "",
    itemType: listing.itemType ?? "",
    itemSize: listing.itemSize ?? "",
    itemColor: listing.itemColor ?? "",
    location: listing.location,
    fulfillmentMethod: listing.fulfillmentMethod,
    pickupLocation: listing.pickupLocation ?? "",
    deliveryFee:
      listing.fulfillmentMethod === "courier" &&
      !listing.deliveryFeeShoulderedByRecipient &&
      listing.deliveryFee != null
        ? String(listing.deliveryFee)
        : "",
    deliveryFeeShoulderedByRecipient: listing.deliveryFeeShoulderedByRecipient,
    paymentMethods: listing.paymentMethods.length > 0 ? listing.paymentMethods : ["cash"],
    gcashName: listing.gcashName ?? "",
    gcashNumber: listing.paymentMethods.includes("gcash")
      ? formatMarketplaceGcashNumberForForm(listing.gcashNumber)
      : "",
    bankName: listing.bankName ?? "",
    bankAccountName: listing.bankAccountName ?? "",
    bankAccountNumber: listing.bankAccountNumber ?? "",
    isActive: listing.isActive,
  };
}

function buildListingFormData(
  listing: MarketplaceListingItem,
  overrides?: Partial<Pick<MarketplaceListingItem, "isActive">>,
) {
  const body = new FormData();
  body.set("title", listing.title);
  body.set("price", String(listing.price));
  body.set("condition", listing.condition);
  body.set("description", listing.description);
  body.set("productTag", listing.productTag ?? "");
  body.set("itemType", listing.itemType ?? "");
  body.set("itemSize", listing.itemSize ?? "");
  body.set("itemColor", listing.itemColor ?? "");
  body.set("location", listing.location);
  body.set("fulfillmentMethod", listing.fulfillmentMethod);
  body.set("pickupLocation", listing.pickupLocation ?? "");
  body.set(
    "deliveryFee",
    listing.fulfillmentMethod === "courier" &&
      !listing.deliveryFeeShoulderedByRecipient &&
      listing.deliveryFee != null
      ? String(listing.deliveryFee)
      : "",
  );
  body.set(
    "deliveryFeeShoulderedByRecipient",
    listing.deliveryFeeShoulderedByRecipient ? "true" : "false",
  );
  body.set("paymentMethods", JSON.stringify(listing.paymentMethods));
  body.set("gcashName", listing.gcashName ?? "");
  body.set("gcashNumber", listing.gcashNumber ?? "");
  body.set("bankName", listing.bankName ?? "");
  body.set("bankAccountName", listing.bankAccountName ?? "");
  body.set("bankAccountNumber", listing.bankAccountNumber ?? "");
  const isActive = overrides?.isActive ?? listing.isActive;
  body.set("isActive", isActive ? "true" : "false");
  return body;
}

type ListingSubmitPayload = {
  form: ListingFormState;
  photo: MarketplaceListingPhotoValue;
};

const emptyPhotoValue: MarketplaceListingPhotoValue = {
  file: null,
  removePhoto: false,
};

function parsePriceInput(value: string) {
  const normalized = value.replace(/,/g, "").trim();
  if (!normalized) return null;
  const parsed = Number.parseFloat(normalized);
  if (!Number.isFinite(parsed) || parsed < 0) return null;
  return parsed;
}

function ListingEditorDialog({
  open,
  onOpenChange,
  initial,
  initialPhotoUrl,
  photoUploadConfigured,
  onSubmit,
  isPending,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initial: ListingFormState;
  initialPhotoUrl: string | null;
  photoUploadConfigured: boolean;
  onSubmit: (values: ListingSubmitPayload) => void;
  isPending: boolean;
}) {
  const [form, setForm] = useState(initial);
  const [photo, setPhoto] = useState<MarketplaceListingPhotoValue>(emptyPhotoValue);

  useEffect(() => {
    if (open) {
      setForm(initial);
      setPhoto(emptyPhotoValue);
    }
  }, [open, initial]);

  const priceValue = parsePriceInput(form.price);
  const deliveryFeeValue = parsePriceInput(form.deliveryFee);
  const showItemDetails = Boolean(form.itemType);
  const hasPhoto =
    Boolean(photo.file) || Boolean(initialPhotoUrl?.trim() && !photo.removePhoto);
  const hasFulfillmentDetails =
    form.fulfillmentMethod === "pickup"
      ? form.pickupLocation.trim().length > 0
      : form.deliveryFeeShoulderedByRecipient || deliveryFeeValue != null;
  const hasPaymentDetails =
    form.paymentMethods.length > 0 &&
    (!form.paymentMethods.includes("gcash") ||
      (form.gcashName.trim().length > 0 && isValidMarketplaceGcashNumber(form.gcashNumber))) &&
    (!form.paymentMethods.includes("bank_transfer") ||
      (form.bankName.trim().length > 0 &&
        form.bankAccountName.trim().length > 0 &&
        form.bankAccountNumber.trim().length > 0));
  const canSave =
    form.title.trim().length > 0 &&
    form.description.trim().length > 0 &&
    form.location.trim().length > 0 &&
    priceValue != null &&
    hasPhoto &&
    hasFulfillmentDetails &&
    hasPaymentDetails &&
    photoUploadConfigured;

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) onOpenChange(false);
      }}
    >
      <DialogContent className="max-h-[90vh] w-full max-w-[calc(100%-2rem)] overflow-y-auto sm:max-w-xl md:max-w-2xl lg:max-w-3xl">
        <DialogHeader>
          <DialogTitle>{initial.title ? "Edit listing" : "New listing"}</DialogTitle>
          <DialogDescription>
            Add product details for your marketplace listing. Description is limited to 300
            characters.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <div className="flex items-end justify-between gap-3">
              <Label htmlFor="listing-title">Title</Label>
              <span className="text-xs tabular-nums text-muted-foreground">
                {form.title.length}/{MAX_MARKETPLACE_TITLE_LENGTH}
              </span>
            </div>
            <Input
              id="listing-title"
              value={form.title}
              maxLength={MAX_MARKETPLACE_TITLE_LENGTH}
              disabled={isPending}
              onChange={(event) => setForm((prev) => ({ ...prev, title: event.target.value }))}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="listing-price">Price</Label>
              <Input
                id="listing-price"
                type="number"
                min={0}
                step="0.01"
                inputMode="decimal"
                value={form.price}
                disabled={isPending}
                placeholder="0.00"
                onChange={(event) => setForm((prev) => ({ ...prev, price: event.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="listing-condition">Condition</Label>
              <Select
                value={form.condition}
                disabled={isPending}
                onValueChange={(value) =>
                  setForm((prev) => ({
                    ...prev,
                    condition: value as MarketplaceCondition,
                  }))
                }
              >
                <SelectTrigger id="listing-condition" className="w-full">
                  <SelectValue placeholder="Select condition" />
                </SelectTrigger>
                <SelectContent>
                  {MARKETPLACE_CONDITIONS.map((condition) => (
                    <SelectItem key={condition} value={condition}>
                      {condition}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-end justify-between gap-3">
              <Label htmlFor="listing-description">Description</Label>
              <span className="text-xs tabular-nums text-muted-foreground">
                {form.description.length}/{MAX_MARKETPLACE_DESCRIPTION_LENGTH}
              </span>
            </div>
            <Textarea
              id="listing-description"
              value={form.description}
              rows={4}
              maxLength={MAX_MARKETPLACE_DESCRIPTION_LENGTH}
              disabled={isPending}
              className="min-h-[6rem] border-border bg-background shadow-sm"
              onChange={(event) =>
                setForm((prev) => ({ ...prev, description: event.target.value }))
              }
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-end justify-between gap-3">
              <Label htmlFor="listing-product-tag">Product tag (optional)</Label>
              <span className="text-xs tabular-nums text-muted-foreground">
                {form.productTag.length}/{MAX_MARKETPLACE_PRODUCT_TAG_LENGTH}
              </span>
            </div>
            <Input
              id="listing-product-tag"
              value={form.productTag}
              maxLength={MAX_MARKETPLACE_PRODUCT_TAG_LENGTH}
              disabled={isPending}
              placeholder="e.g. Paddle, Shoes, Bag"
              onChange={(event) => setForm((prev) => ({ ...prev, productTag: event.target.value }))}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="listing-item-type">Item type (optional)</Label>
            <Select
              value={form.itemType || NO_ITEM_TYPE_VALUE}
              disabled={isPending}
              onValueChange={(value) => {
                const nextType = value === NO_ITEM_TYPE_VALUE ? "" : (value as MarketplaceItemType);
                setForm((prev) => ({
                  ...prev,
                  itemType: nextType,
                  itemSize: nextType ? prev.itemSize : "",
                  itemColor: nextType ? prev.itemColor : "",
                }));
              }}
            >
              <SelectTrigger id="listing-item-type" className="w-full">
                <SelectValue placeholder="Select item type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NO_ITEM_TYPE_VALUE}>No item type</SelectItem>
                {MARKETPLACE_ITEM_TYPES.map((itemType) => (
                  <SelectItem key={itemType} value={itemType}>
                    {itemType}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {showItemDetails ? (
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <div className="flex items-end justify-between gap-3">
                  <Label htmlFor="listing-item-size">Sizes (optional)</Label>
                  <span className="text-xs tabular-nums text-muted-foreground">
                    {form.itemSize.length}/{MAX_MARKETPLACE_ITEM_SIZE_LENGTH}
                  </span>
                </div>
                <Input
                  id="listing-item-size"
                  value={form.itemSize}
                  maxLength={MAX_MARKETPLACE_ITEM_SIZE_LENGTH}
                  disabled={isPending}
                  placeholder="S, M, L, XL, 2XL"
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, itemSize: event.target.value }))
                  }
                />
                <p className="text-xs text-muted-foreground">
                  Comma-separated sizes buyers can choose when ordering.
                </p>
              </div>
              <div className="space-y-2">
                <div className="flex items-end justify-between gap-3">
                  <Label htmlFor="listing-item-color">Colors (optional)</Label>
                  <span className="text-xs tabular-nums text-muted-foreground">
                    {form.itemColor.length}/{MAX_MARKETPLACE_ITEM_COLOR_LENGTH}
                  </span>
                </div>
                <Input
                  id="listing-item-color"
                  value={form.itemColor}
                  maxLength={MAX_MARKETPLACE_ITEM_COLOR_LENGTH}
                  disabled={isPending}
                  placeholder="Navy, Black, White"
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, itemColor: event.target.value }))
                  }
                />
                <p className="text-xs text-muted-foreground">
                  Comma-separated colors buyers can choose when ordering.
                </p>
              </div>
            </div>
          ) : null}

          <div className="space-y-2">
            <div className="flex items-end justify-between gap-3">
              <Label htmlFor="listing-location">Location</Label>
              <span className="text-xs tabular-nums text-muted-foreground">
                {form.location.length}/{MAX_MARKETPLACE_LOCATION_LENGTH}
              </span>
            </div>
            <Input
              id="listing-location"
              value={form.location}
              maxLength={MAX_MARKETPLACE_LOCATION_LENGTH}
              disabled={isPending}
              placeholder="City, court, or meet-up area"
              onChange={(event) => setForm((prev) => ({ ...prev, location: event.target.value }))}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="listing-fulfillment-method">How to get the product?</Label>
            <Select
              value={form.fulfillmentMethod}
              disabled={isPending}
              onValueChange={(value) => {
                const nextMethod = value as MarketplaceFulfillmentMethod;
                setForm((prev) => ({
                  ...prev,
                  fulfillmentMethod: nextMethod,
                  pickupLocation: nextMethod === "pickup" ? prev.pickupLocation : "",
                  deliveryFee: nextMethod === "courier" ? prev.deliveryFee : "",
                  deliveryFeeShoulderedByRecipient:
                    nextMethod === "courier" ? prev.deliveryFeeShoulderedByRecipient : false,
                }));
              }}
            >
              <SelectTrigger id="listing-fulfillment-method" className="w-full">
                <SelectValue placeholder="Select fulfillment method" />
              </SelectTrigger>
              <SelectContent>
                {MARKETPLACE_FULFILLMENT_METHODS.map((method) => (
                  <SelectItem key={method} value={method}>
                    {formatMarketplaceFulfillmentMethod(method)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {form.fulfillmentMethod === "pickup" ? (
            <div className="space-y-2">
              <div className="flex items-end justify-between gap-3">
                <Label htmlFor="listing-pickup-location">Pickup location</Label>
                <span className="text-xs tabular-nums text-muted-foreground">
                  {form.pickupLocation.length}/{MAX_MARKETPLACE_PICKUP_LOCATION_LENGTH}
                </span>
              </div>
              <Input
                id="listing-pickup-location"
                value={form.pickupLocation}
                maxLength={MAX_MARKETPLACE_PICKUP_LOCATION_LENGTH}
                disabled={isPending}
                placeholder="Where buyers can pick up the item"
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, pickupLocation: event.target.value }))
                }
              />
            </div>
          ) : (
            <div className="space-y-3">
              <label className="inline-flex cursor-pointer items-center gap-2 text-sm">
                <Checkbox
                  checked={form.deliveryFeeShoulderedByRecipient}
                  disabled={isPending}
                  onCheckedChange={(checked) =>
                    setForm((prev) => ({
                      ...prev,
                      deliveryFeeShoulderedByRecipient: checked === true,
                      ...(checked === true ? { deliveryFee: "" } : {}),
                    }))
                  }
                />
                Delivery fee shouldered by recipient
              </label>
              {!form.deliveryFeeShoulderedByRecipient ? (
                <div className="space-y-2">
                  <Label htmlFor="listing-delivery-fee">Delivery fee</Label>
                  <Input
                    id="listing-delivery-fee"
                    type="number"
                    min={0}
                    step="0.01"
                    inputMode="decimal"
                    value={form.deliveryFee}
                    disabled={isPending}
                    placeholder="0.00"
                    onChange={(event) =>
                      setForm((prev) => ({ ...prev, deliveryFee: event.target.value }))
                    }
                  />
                </div>
              ) : null}
            </div>
          )}

          <div className="space-y-3 rounded-xl border border-border/70 bg-muted/15 p-3">
            <div>
              <Label>Payment options</Label>
              <p className="mt-1 text-xs text-muted-foreground">
                Choose one or more ways buyers can pay you.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              {MARKETPLACE_PAYMENT_METHODS.map((method) => {
                const checked = form.paymentMethods.includes(method);
                return (
                  <label
                    key={method}
                    className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-border/70 bg-background px-3 py-2 text-sm"
                  >
                    <Checkbox
                      checked={checked}
                      disabled={isPending}
                      onCheckedChange={(nextChecked) => {
                        setForm((prev) => {
                          const methods = nextChecked
                            ? [...new Set([...prev.paymentMethods, method])]
                            : prev.paymentMethods.filter((item) => item !== method);
                          const nextMethods =
                            methods.length > 0 ? methods : prev.paymentMethods;
                          return {
                            ...prev,
                            paymentMethods: nextMethods,
                            ...(method === "gcash" && nextChecked
                              ? {
                                  gcashNumber: formatMarketplaceGcashNumberForForm(
                                    prev.gcashNumber,
                                  ),
                                }
                              : method === "gcash" && !nextChecked
                                ? { gcashNumber: "", gcashName: "" }
                                : {}),
                          };
                        });
                      }}
                    />
                    {formatMarketplacePaymentMethod(method)}
                  </label>
                );
              })}
            </div>

            {form.paymentMethods.includes("gcash") ? (
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="listing-gcash-name">GCash name</Label>
                  <Input
                    id="listing-gcash-name"
                    value={form.gcashName}
                    maxLength={MAX_MARKETPLACE_GCASH_NAME_LENGTH}
                    disabled={isPending}
                    onChange={(event) =>
                      setForm((prev) => ({ ...prev, gcashName: event.target.value }))
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="listing-gcash-number">GCash number</Label>
                  <Input
                    id="listing-gcash-number"
                    value={form.gcashNumber}
                    inputMode="numeric"
                    autoComplete="tel"
                    maxLength={MAX_MARKETPLACE_GCASH_NUMBER_LENGTH}
                    disabled={isPending}
                    onChange={(event) =>
                      setForm((prev) => ({
                        ...prev,
                        gcashNumber: normalizeMarketplaceGcashNumberInput(event.target.value),
                      }))
                    }
                  />
                  <p className="text-xs text-muted-foreground">
                    Starts with {MARKETPLACE_GCASH_NUMBER_PREFIX}. Enter 9 more digits (11 total).
                  </p>
                </div>
              </div>
            ) : null}

            {form.paymentMethods.includes("bank_transfer") ? (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="listing-bank-name">Bank</Label>
                  <Select
                    value={form.bankName || MARKETPLACE_BANK_PLACEHOLDER}
                    disabled={isPending}
                    onValueChange={(value) => {
                      if (value === MARKETPLACE_BANK_PLACEHOLDER) return;
                      setForm((prev) => ({ ...prev, bankName: value ?? "" }));
                    }}
                  >
                    <SelectTrigger id="listing-bank-name" className="w-full">
                      <SelectValue placeholder="Select local bank" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={MARKETPLACE_BANK_PLACEHOLDER}>
                        Select local bank
                      </SelectItem>
                      {PH_LOCAL_BANKS.map((bank) => (
                        <SelectItem key={bank} value={bank}>
                          {bank}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="listing-bank-account-name">Account name</Label>
                    <Input
                      id="listing-bank-account-name"
                      value={form.bankAccountName}
                      maxLength={MAX_MARKETPLACE_BANK_ACCOUNT_NAME_LENGTH}
                      disabled={isPending}
                      onChange={(event) =>
                        setForm((prev) => ({ ...prev, bankAccountName: event.target.value }))
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="listing-bank-account-number">Account number</Label>
                    <Input
                      id="listing-bank-account-number"
                      value={form.bankAccountNumber}
                      maxLength={MAX_MARKETPLACE_BANK_ACCOUNT_NUMBER_LENGTH}
                      disabled={isPending}
                      onChange={(event) =>
                        setForm((prev) => ({ ...prev, bankAccountNumber: event.target.value }))
                      }
                    />
                  </div>
                </div>
              </div>
            ) : null}
          </div>

          <MarketplaceListingPhotoField
            configured={photoUploadConfigured}
            currentPhotoUrl={initialPhotoUrl}
            disabled={isPending}
            required
            value={photo}
            onChange={setPhoto}
          />

          <div className="flex items-start gap-3 rounded-lg border border-border/70 bg-muted/20 px-3 py-3">
            <Checkbox
              id="listing-is-active"
              checked={form.isActive}
              disabled={isPending}
              onCheckedChange={(checked) =>
                setForm((prev) => ({ ...prev, isActive: checked === true }))
              }
            />
            <div className="space-y-1">
              <Label htmlFor="listing-is-active" className="cursor-pointer">
                Active listing
              </Label>
              <p className="text-xs text-muted-foreground">
                Inactive listings stay in your account but are hidden from buyers.
              </p>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            disabled={isPending}
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button
            type="button"
            disabled={isPending || !canSave}
            onClick={() => onSubmit({ form, photo })}
          >
            {isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
                Saving…
              </>
            ) : (
              "Save listing"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ListingCard({
  listing,
  orders,
  deletePending,
  togglePending,
  onEdit,
  onDelete,
  onToggleActive,
}: {
  listing: MarketplaceListingItem;
  orders: MarketplaceOrderItem[];
  deletePending: boolean;
  togglePending: boolean;
  onEdit: (listing: MarketplaceListingItem) => void;
  onDelete: (listing: MarketplaceListingItem) => void;
  onToggleActive: (listing: MarketplaceListingItem) => void;
}) {
  const [photoOpen, setPhotoOpen] = useState(false);
  const pendingOrderCount = orders.filter((order) => order.status === "pending").length;

  const fulfillmentDetail =
    listing.fulfillmentMethod === "pickup" && marketplaceListingPickupLocation(listing)
      ? marketplaceListingPickupLocation(listing)
      : formatMarketplaceListingCourierDeliveryLabel(listing);

  const variantLines = [
    listing.productTag ? { label: "Tag", value: listing.productTag } : null,
    listing.itemType ? { label: "Type", value: listing.itemType } : null,
    listing.itemSize && formatMarketplaceListingOptionsLabel(listing.itemSize)
      ? { label: "Sizes", value: formatMarketplaceListingOptionsLabel(listing.itemSize)! }
      : null,
    listing.itemColor && formatMarketplaceListingOptionsLabel(listing.itemColor)
      ? { label: "Colors", value: formatMarketplaceListingOptionsLabel(listing.itemColor)! }
      : null,
  ].filter((line): line is { label: string; value: string } => line !== null);

  return (
    <>
      <Card
        className={cn(
          "glass-panel overflow-hidden",
          !listing.isActive && "border-dashed opacity-80",
        )}
      >
        <div className="flex items-start">
          {listing.photoUrl ? (
            <div className="shrink-0 border-r border-border/60 bg-muted/30 p-3 pr-2 sm:p-4 sm:pr-3">
              <button
                type="button"
                className="relative block size-24 overflow-hidden rounded-md outline-none transition-opacity hover:opacity-95 focus-visible:ring-2 focus-visible:ring-ring sm:size-28"
                aria-label={`View photo of ${listing.title}`}
                onClick={() => setPhotoOpen(true)}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={listing.photoUrl}
                  alt={listing.title}
                  className="h-full w-full object-cover object-center"
                />
              </button>
            </div>
          ) : (
            <div
              className="shrink-0 border-r border-dashed border-border/60 bg-muted/20 p-3 pr-2 sm:p-4 sm:pr-3"
              aria-hidden
            >
              <div className="flex size-24 items-center justify-center rounded-md text-muted-foreground sm:size-28">
                <Package className="h-5 w-5" />
              </div>
            </div>
          )}

          <div className="min-w-0 flex-1 p-3 sm:p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
                  <h3 className="line-clamp-2 text-sm font-semibold leading-snug text-foreground sm:text-base">
                    {listing.title}
                  </h3>
                  <p className="shrink-0 text-base font-semibold tabular-nums text-foreground sm:text-lg">
                    {formatMarketplacePrice(listing.price)}
                  </p>
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-0.5 rounded-lg border border-border/60 bg-muted/20 p-0.5">
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  className="h-7 w-7"
                  aria-label={
                    listing.isActive
                      ? `Mark ${listing.title} inactive`
                      : `Mark ${listing.title} active`
                  }
                  disabled={togglePending}
                  onClick={() => onToggleActive(listing)}
                >
                  {listing.isActive ? (
                    <EyeOff className="h-3.5 w-3.5" />
                  ) : (
                    <Eye className="h-3.5 w-3.5" />
                  )}
                </Button>
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  className="h-7 w-7"
                  aria-label={`Edit ${listing.title}`}
                  onClick={() => onEdit(listing)}
                >
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  className="h-7 w-7 text-destructive hover:text-destructive"
                  aria-label={`Delete ${listing.title}`}
                  disabled={deletePending}
                  onClick={() => void onDelete(listing)}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>

            <div className="mt-2 flex flex-wrap gap-1.5">
                  <Badge
                    variant="outline"
                    className={cn(
                      "h-5 px-1.5 text-[0.625rem] font-medium",
                      listing.condition === "New"
                        ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                        : "border-amber-500/40 bg-amber-500/10 text-amber-800 dark:text-amber-200",
                    )}
                  >
                    {listing.condition}
                  </Badge>
                  <Badge
                    variant="outline"
                    className={cn(
                      "h-5 px-1.5 text-[0.625rem] font-medium",
                      listing.isActive
                        ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                        : "border-slate-500/40 bg-slate-500/10 text-slate-700 dark:text-slate-300",
                    )}
                  >
                    {listing.isActive ? "Active" : "Inactive"}
                  </Badge>
                  <Badge variant="outline" className="h-5 px-1.5 text-[0.625rem] font-medium">
                    {formatMarketplaceFulfillmentMethod(listing.fulfillmentMethod)}
                  </Badge>
                  {pendingOrderCount > 0 ? (
                    <Badge
                      variant="outline"
                      className="h-5 gap-0.5 border-amber-500/40 bg-amber-500/10 px-1.5 text-[0.625rem] font-medium text-amber-800 dark:text-amber-200"
                    >
                      <Bell className="h-2.5 w-2.5" aria-hidden />
                      {pendingOrderCount} new
                    </Badge>
                  ) : null}
                </div>

                {variantLines.length > 0 ? (
                  <dl className="mt-2 grid gap-0.5 text-xs">
                    {variantLines.map((line) => (
                      <div key={line.label} className="flex gap-2">
                        <dt className="w-10 shrink-0 font-medium text-muted-foreground">
                          {line.label}
                        </dt>
                        <dd className="min-w-0 text-foreground/85">{line.value}</dd>
                      </div>
                    ))}
                  </dl>
                ) : null}

                {listing.description.trim() ? (
                  <p className="mt-2 line-clamp-2 text-sm leading-snug text-foreground/90">
                    {listing.description}
                  </p>
                ) : null}

                <div className="mt-2.5 space-y-1.5 rounded-lg border border-border/60 bg-muted/20 px-2.5 py-2 text-xs">
                  <p className="flex items-start gap-2 text-foreground/90">
                    <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden />
                    <span>{listing.location}</span>
                  </p>
                  {fulfillmentDetail ? (
                    <p className="flex items-start gap-2 text-muted-foreground">
                      <Truck className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
                      <span>{fulfillmentDetail}</span>
                    </p>
                  ) : null}
                  <div className="flex items-start gap-2">
                    <Wallet className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden />
                    <div className="flex flex-wrap gap-1">
                      {listing.paymentMethods.map((method) => (
                        <Badge
                          key={method}
                          variant="secondary"
                          className="h-5 px-1.5 text-[0.625rem] font-normal"
                        >
                          {formatMarketplacePaymentMethod(method)}
                        </Badge>
                      ))}
                    </div>
                  </div>
                </div>

                <p className="mt-2 text-[0.6875rem] text-muted-foreground/80">
                  Listed {formatAppDateTime(listing.createdAt)}
                  {listing.updatedAt !== listing.createdAt ? (
                    <>
                      {" "}
                      · Updated {formatDistanceToNow(new Date(listing.updatedAt), { addSuffix: true })}
                    </>
                  ) : null}
                </p>
          </div>
        </div>

        <MarketplaceListingOrdersPanel listingId={listing.id} orders={orders} />
      </Card>

      {listing.photoUrl ? (
        <MarketplaceListingPhotoDialog
          photoUrl={listing.photoUrl}
          title={listing.title}
          open={photoOpen}
          onOpenChange={setPhotoOpen}
        />
      ) : null}
    </>
  );
}

export function MarketplaceListingsView() {
  const queryClient = useQueryClient();
  const [editorOpen, setEditorOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState<ListingStatusFilter>("active");
  const [editing, setEditing] = useState<MarketplaceListingItem | null>(null);
  const [draft, setDraft] = useState<ListingFormState>(emptyForm);
  const [draftPhotoUrl, setDraftPhotoUrl] = useState<string | null>(null);

  const { data, isLoading, error } = useQuery({
    queryKey: ["marketplace-listings"],
    queryFn: async () => {
      const response = await fetch("/api/marketplace/listings");
      const payload = (await response.json()) as {
        listings: MarketplaceListingItem[];
        photoUploadConfigured?: boolean;
        message?: string;
      };
      if (!response.ok) throw new Error(payload.message ?? "Failed to load listings.");
      return payload;
    },
  });

  const { data: orders = [], error: ordersError } = useQuery({
    queryKey: ownerMarketplaceOrdersQueryKey(),
    queryFn: async () => {
      const response = await fetch("/api/marketplace/orders");
      const payload = (await response.json()) as {
        orders: MarketplaceOrderItem[];
        message?: string;
      };
      if (!response.ok) throw new Error(payload.message ?? "Failed to load orders.");
      return payload.orders;
    },
  });

  const ordersByListingId = useMemo(() => {
    const map = new Map<string, MarketplaceOrderItem[]>();
    for (const order of orders) {
      const existing = map.get(order.listingId) ?? [];
      existing.push(order);
      map.set(order.listingId, existing);
    }
    return map;
  }, [orders]);

  const saveMutation = useMutation({
    mutationFn: async ({ form, photo }: ListingSubmitPayload) => {
      const price = parsePriceInput(form.price);
      if (price == null) throw new Error("Enter a valid price.");
      const deliveryFee = parsePriceInput(form.deliveryFee);
      if (
        form.fulfillmentMethod === "courier" &&
        !form.deliveryFeeShoulderedByRecipient &&
        deliveryFee == null
      ) {
        throw new Error("Enter a valid delivery fee.");
      }

      const body = new FormData();
      body.set("title", form.title.trim());
      body.set("price", String(price));
      body.set("condition", form.condition);
      body.set("description", form.description.trim());
      body.set("productTag", form.productTag.trim());
      body.set("itemType", form.itemType);
      body.set("itemSize", form.itemSize.trim());
      body.set("itemColor", form.itemColor.trim());
      body.set("location", form.location.trim());
      body.set("fulfillmentMethod", form.fulfillmentMethod);
      body.set("pickupLocation", form.pickupLocation.trim());
      body.set("deliveryFee", form.fulfillmentMethod === "courier" ? String(deliveryFee ?? "") : "");
      body.set(
        "deliveryFeeShoulderedByRecipient",
        form.deliveryFeeShoulderedByRecipient ? "true" : "false",
      );
      body.set("paymentMethods", JSON.stringify(form.paymentMethods));
      body.set("gcashName", form.gcashName.trim());
      body.set("gcashNumber", form.gcashNumber.trim());
      body.set("bankName", form.bankName.trim());
      body.set("bankAccountName", form.bankAccountName.trim());
      body.set("bankAccountNumber", form.bankAccountNumber.trim());
      body.set("isActive", form.isActive ? "true" : "false");
      if (photo.file) body.set("photo", photo.file);
      if (photo.removePhoto) body.set("removePhoto", "true");

      const response = await fetch(
        editing ? `/api/marketplace/listings/${editing.id}` : "/api/marketplace/listings",
        {
          method: editing ? "PATCH" : "POST",
          body,
        },
      );
      const payload = (await response.json()) as { message?: string };
      if (!response.ok) throw new Error(payload.message ?? "Failed to save listing.");
      return payload;
    },
    onSuccess: (payload) => {
      toast.success(payload.message ?? "Listing saved.");
      setEditorOpen(false);
      setEditing(null);
      setDraft(emptyForm);
      setDraftPhotoUrl(null);
      queryClient.invalidateQueries({ queryKey: ["marketplace-listings"] });
    },
    onError: (mutationError) => {
      toast.error(mutationError instanceof Error ? mutationError.message : "Failed to save listing.");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await fetch(`/api/marketplace/listings/${id}`, { method: "DELETE" });
      const payload = (await response.json()) as { message?: string };
      if (!response.ok) throw new Error(payload.message ?? "Failed to delete listing.");
      return payload;
    },
    onSuccess: (payload) => {
      toast.success(payload.message ?? "Listing deleted.");
      queryClient.invalidateQueries({ queryKey: ["marketplace-listings"] });
    },
    onError: (mutationError) => {
      toast.error(
        mutationError instanceof Error ? mutationError.message : "Failed to delete listing.",
      );
    },
  });

  const toggleActiveMutation = useMutation({
    mutationFn: async (listing: MarketplaceListingItem) => {
      const response = await fetch(`/api/marketplace/listings/${listing.id}`, {
        method: "PATCH",
        body: buildListingFormData(listing, { isActive: !listing.isActive }),
      });
      const payload = (await response.json()) as { message?: string };
      if (!response.ok) throw new Error(payload.message ?? "Failed to update listing status.");
      return { ...payload, isActive: !listing.isActive };
    },
    onSuccess: (payload) => {
      toast.success(
        payload.isActive ? "Listing is now active." : "Listing is now inactive.",
      );
      queryClient.invalidateQueries({ queryKey: ["marketplace-listings"] });
    },
    onError: (mutationError) => {
      toast.error(
        mutationError instanceof Error ? mutationError.message : "Failed to update listing status.",
      );
    },
  });

  const listings = data?.listings ?? [];
  const photoUploadConfigured = data?.photoUploadConfigured ?? false;
  const activeListings = listings.filter((listing) => listing.isActive);
  const inactiveListings = listings.filter((listing) => !listing.isActive);

  const openCreate = () => {
    setEditing(null);
    setDraft(emptyForm);
    setDraftPhotoUrl(null);
    setEditorOpen(true);
  };

  const openEdit = (listing: MarketplaceListingItem) => {
    setEditing(listing);
    setDraft(listingToForm(listing));
    setDraftPhotoUrl(listing.photoUrl);
    setEditorOpen(true);
  };

  const handleDelete = async (listing: MarketplaceListingItem) => {
    const result = await Swal.fire({
      ...alertOptions,
      title: "Delete listing?",
      html: `<strong>${listing.title}</strong> will be permanently removed from your marketplace.`,
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Yes, delete",
      cancelButtonText: "Cancel",
    });
    if (!result.isConfirmed) return;
    deleteMutation.mutate(listing.id);
  };

  const renderListingList = (items: MarketplaceListingItem[], emptyMessage: string) => {
    if (items.length === 0) {
      return (
        <Card className="glass-panel border-dashed">
          <CardContent className="py-10 text-center">
            <p className="text-sm text-muted-foreground">{emptyMessage}</p>
          </CardContent>
        </Card>
      );
    }

    return (
      <div className="space-y-2">
        {items.map((listing) => (
          <ListingCard
            key={listing.id}
            listing={listing}
            orders={ordersByListingId.get(listing.id) ?? []}
            deletePending={deleteMutation.isPending}
            togglePending={toggleActiveMutation.isPending}
            onEdit={openEdit}
            onDelete={handleDelete}
            onToggleActive={(item) => toggleActiveMutation.mutate(item)}
          />
        ))}
      </div>
    );
  };

  return (
    <div className="marketplace-listings space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-foreground">Your listings</p>
          <p className="text-xs text-muted-foreground">
            {activeListings.length} active · {inactiveListings.length} inactive
          </p>
        </div>
        <Button type="button" className="gap-2" onClick={openCreate}>
          <Plus className="h-4 w-4" aria-hidden />
          New listing
        </Button>
      </div>

      {ordersError ? (
        <p className="rounded-xl border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {ordersError instanceof Error ? ordersError.message : "Failed to load orders."}
        </p>
      ) : null}

      {isLoading ? (
        <p className="flex items-center gap-2 py-8 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          Loading listings…
        </p>
      ) : error ? (
        <p className="py-8 text-destructive">
          {error instanceof Error ? error.message : "Failed to load listings."}
        </p>
      ) : listings.length === 0 ? (
        <Card className="glass-panel border-dashed">
          <CardContent className="flex flex-col items-center justify-center gap-3 py-12 text-center">
            <Store className="h-10 w-10 text-muted-foreground/70" aria-hidden />
            <div>
              <p className="font-medium text-foreground">No listings yet</p>
              <p className="mt-1 max-w-sm text-sm text-muted-foreground">
                Create your first listing to sell paddles, shoes, bags, and other pickleball gear.
              </p>
            </div>
            <Button type="button" className="gap-2" onClick={openCreate}>
              <Plus className="h-4 w-4" aria-hidden />
              Create listing
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Tabs
          value={statusFilter}
          onValueChange={(value) => setStatusFilter(value as ListingStatusFilter)}
          className="gap-4"
        >
          <TabsList className="h-auto w-full flex-wrap justify-start gap-1 bg-muted/40 p-1 sm:w-auto">
            <TabsTrigger value="active" className="gap-1.5 px-3">
              Active
              {activeListings.length > 0 ? (
                <Badge variant="secondary" className="px-1.5 py-0 text-xs tabular-nums">
                  {activeListings.length}
                </Badge>
              ) : null}
            </TabsTrigger>
            <TabsTrigger value="inactive" className="gap-1.5 px-3">
              Inactive
              {inactiveListings.length > 0 ? (
                <Badge variant="secondary" className="px-1.5 py-0 text-xs tabular-nums">
                  {inactiveListings.length}
                </Badge>
              ) : null}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="active" className="mt-0 outline-none">
            {renderListingList(
              activeListings,
              "No active listings. Create one or reactivate an inactive listing.",
            )}
          </TabsContent>
          <TabsContent value="inactive" className="mt-0 outline-none">
            {renderListingList(
              inactiveListings,
              "No inactive listings. Deactivate a listing to hide it from buyers.",
            )}
          </TabsContent>
        </Tabs>
      )}

      <ListingEditorDialog
        open={editorOpen}
        onOpenChange={setEditorOpen}
        initial={draft}
        initialPhotoUrl={draftPhotoUrl}
        photoUploadConfigured={photoUploadConfigured}
        isPending={saveMutation.isPending}
        onSubmit={(values) => saveMutation.mutate(values)}
      />
    </div>
  );
}
