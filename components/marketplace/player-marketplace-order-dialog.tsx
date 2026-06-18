"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2, Plus, ShoppingBag, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
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
import { NumberStepper } from "@/components/ui/number-stepper";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  formatMarketplaceFulfillmentMethod,
  formatMarketplacePrice,
  marketplaceListingPickupLocation,
  marketplaceListingDeliveryFeeAmount,
  formatMarketplaceListingCourierDeliveryLabel,
  parseMarketplaceListingOptions,
  type MarketplaceListingItem,
} from "@/lib/marketplace-listings-shared";
import {
  marketplaceOrderItemSubtotal,
  marketplaceOrderLineTotalQuantity,
  MAX_MARKETPLACE_ORDER_LINES,
  MAX_MARKETPLACE_ORDER_QUANTITY,
  spectateMarketplaceOrdersQueryKey,
} from "@/lib/marketplace-orders-shared";
import {
  formatMarketplacePaymentMethod,
  marketplacePaymentRequiresProof,
  type MarketplacePaymentMethod,
} from "@/lib/marketplace-payment-shared";

import {
  MarketplacePaymentProofField,
  type MarketplacePaymentProofValue,
} from "@/components/marketplace/marketplace-payment-proof-field";
import { createClientKey } from "@/lib/create-client-key";

const SELECT_SIZE_VALUE = "Select Size";
const SELECT_COLOR_VALUE = "Select Color";

type OrderLineDraft = {
  key: string;
  size: string;
  color: string;
  quantity: number;
};

type DeliveryDraft = {
  deliveryAddress: string;
  landmark: string;
  contactPerson: string;
  contactNumber: string;
  deliveryNotes: string;
};

const emptyDelivery: DeliveryDraft = {
  deliveryAddress: "",
  landmark: "",
  contactPerson: "",
  contactNumber: "",
  deliveryNotes: "",
};

const emptyPaymentProof: MarketplacePaymentProofValue = { file: null };

function createOrderLine(): OrderLineDraft {
  return {
    key: createClientKey(),
    size: "",
    color: "",
    quantity: 1,
  };
}

function orderLineLabel(listing: MarketplaceListingItem, index: number) {
  const name = listing.itemType?.trim() || listing.title.trim() || "Item";
  return `${name} ${index + 1}`;
}

function OrderLineFields({
  line,
  lineLabel,
  showVariantFields,
  sizeOptions,
  colorOptions,
  showSizeSelect,
  showColorSelect,
  disabled,
  canRemove,
  onChange,
  onRemove,
}: {
  line: OrderLineDraft;
  lineLabel: string;
  showVariantFields: boolean;
  sizeOptions: readonly string[];
  colorOptions: readonly string[];
  showSizeSelect: boolean;
  showColorSelect: boolean;
  disabled: boolean;
  canRemove: boolean;
  onChange: (next: OrderLineDraft) => void;
  onRemove: () => void;
}) {
  return (
    <div className="rounded-xl border border-border/70 bg-muted/15 p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <p className="text-sm font-medium text-foreground">{lineLabel}</p>
        {canRemove ? (
          <Button
            type="button"
            size="icon"
            variant="ghost"
            className="h-8 w-8 text-destructive hover:text-destructive"
            disabled={disabled}
            aria-label={`Remove ${lineLabel}`}
            onClick={onRemove}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        ) : null}
      </div>

      <div className="space-y-4">
        {showVariantFields && (showSizeSelect || showColorSelect) ? (
          <div className="grid gap-4 sm:grid-cols-2">
            {showSizeSelect ? (
              <div className="space-y-2">
                <Label htmlFor={`order-size-${line.key}`}>Size</Label>
                <Select
                  value={line.size || SELECT_SIZE_VALUE}
                  disabled={disabled}
                  onValueChange={(value) =>
                    onChange({
                      ...line,
                      size: !value || value === SELECT_SIZE_VALUE ? "" : value,
                    })
                  }
                >
                  <SelectTrigger id={`order-size-${line.key}`} className="w-full">
                    <SelectValue placeholder="Select size" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={SELECT_SIZE_VALUE}>Select Size</SelectItem>
                    {sizeOptions.map((size) => (
                      <SelectItem key={size} value={size}>
                        {size}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : null}
            {showColorSelect ? (
              <div className="space-y-2">
                <Label htmlFor={`order-color-${line.key}`}>Color</Label>
                <Select
                  value={line.color || SELECT_COLOR_VALUE}
                  disabled={disabled}
                  onValueChange={(value) =>
                    onChange({
                      ...line,
                      color: !value || value === SELECT_COLOR_VALUE ? "" : value,
                    })
                  }
                >
                  <SelectTrigger id={`order-color-${line.key}`} className="w-full">
                    <SelectValue placeholder="Select color" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={SELECT_COLOR_VALUE}>Select Color</SelectItem>
                    {colorOptions.map((color) => (
                      <SelectItem key={color} value={color}>
                        {color}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : null}
          </div>
        ) : null}

        <div className="space-y-2">
          <Label htmlFor={`order-quantity-${line.key}`}>Quantity</Label>
          <NumberStepper
            id={`order-quantity-${line.key}`}
            value={line.quantity}
            min={1}
            max={MAX_MARKETPLACE_ORDER_QUANTITY}
            onChange={(quantity) => onChange({ ...line, quantity })}
          />
        </div>
      </div>
    </div>
  );
}

export function PlayerMarketplaceOrderDialog({
  gameId,
  playerId,
  listing,
  open,
  onOpenChange,
}: {
  gameId: string;
  playerId: string;
  listing: MarketplaceListingItem;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const queryClient = useQueryClient();
  const showVariantFields = Boolean(listing.itemType);
  const sizeOptions = useMemo(
    () => parseMarketplaceListingOptions(listing.itemSize),
    [listing.itemSize],
  );
  const colorOptions = useMemo(
    () => parseMarketplaceListingOptions(listing.itemColor),
    [listing.itemColor],
  );
  const showSizeSelect = sizeOptions.length > 0;
  const showColorSelect = colorOptions.length > 0;
  const paymentOptions = useMemo<MarketplacePaymentMethod[]>(
    () => (listing.paymentMethods.length > 0 ? listing.paymentMethods : ["cash"]),
    [listing.paymentMethods],
  );

  const [lines, setLines] = useState<OrderLineDraft[]>(() => [createOrderLine()]);
  const [delivery, setDelivery] = useState<DeliveryDraft>(emptyDelivery);
  const [paymentMethod, setPaymentMethod] = useState<MarketplacePaymentMethod>(
    () => listing.paymentMethods[0] ?? "cash",
  );
  const [paymentProof, setPaymentProof] = useState<MarketplacePaymentProofValue>(emptyPaymentProof);
  const isCourier = listing.fulfillmentMethod === "courier";
  const deliveryFee = marketplaceListingDeliveryFeeAmount(listing);
  const courierDeliveryLabel = formatMarketplaceListingCourierDeliveryLabel(listing);
  const requiresPaymentProof = marketplacePaymentRequiresProof(paymentMethod);

  useEffect(() => {
    if (open) {
      setLines([createOrderLine()]);
      setDelivery(emptyDelivery);
      setPaymentMethod(paymentOptions[0] ?? "cash");
      setPaymentProof(emptyPaymentProof);
    }
  }, [open, listing, paymentOptions]);

  const totalQuantity = useMemo(
    () =>
      marketplaceOrderLineTotalQuantity(
        lines.map((line) => ({
          ...line,
          size: line.size || null,
          color: line.color || null,
        })),
      ),
    [lines],
  );
  const itemSubtotal = marketplaceOrderItemSubtotal(
    listing.price,
    lines.map((line) => ({
      size: line.size || null,
      color: line.color || null,
      quantity: line.quantity,
    })),
  );
  const orderTotal = itemSubtotal + deliveryFee;

  const submitMutation = useMutation({
    mutationFn: async () => {
      const body = new FormData();
      body.set("playerId", playerId);
      body.set("listingId", listing.id);
      body.set("paymentMethod", paymentMethod);
      body.set(
        "lines",
        JSON.stringify(
          lines.map((line) => ({
            size: line.size.trim(),
            color: line.color.trim(),
            quantity: line.quantity,
          })),
        ),
      );
      if (isCourier) {
        body.set(
          "delivery",
          JSON.stringify({
            deliveryAddress: delivery.deliveryAddress.trim(),
            landmark: delivery.landmark.trim(),
            contactPerson: delivery.contactPerson.trim(),
            contactNumber: delivery.contactNumber.trim(),
            deliveryNotes: delivery.deliveryNotes.trim(),
          }),
        );
      }
      if (paymentProof.file) {
        body.set("paymentProof", paymentProof.file);
      }

      const response = await fetch(`/api/games/${gameId}/spectate/player/marketplace/orders`, {
        method: "POST",
        body,
      });
      const payload = (await response.json()) as { message?: string };
      if (!response.ok) throw new Error(payload.message ?? "Failed to submit order.");
      return payload;
    },
    onSuccess: (payload) => {
      toast.success(payload.message ?? "Order submitted.");
      void queryClient.invalidateQueries({
        queryKey: spectateMarketplaceOrdersQueryKey(gameId, playerId),
      });
      onOpenChange(false);
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Failed to submit order.");
    },
  });

  const canAddLine = lines.length < MAX_MARKETPLACE_ORDER_LINES;
  const linesValid = lines.every((line) => {
    if (line.quantity < 1) return false;
    if (!showVariantFields) return true;
    if (showSizeSelect && !line.size.trim()) return false;
    if (showColorSelect && !line.color.trim()) return false;
    return true;
  });
  const deliveryValid =
    !isCourier ||
    (delivery.deliveryAddress.trim().length > 0 &&
      delivery.landmark.trim().length > 0 &&
      delivery.contactPerson.trim().length > 0 &&
      delivery.contactNumber.trim().length > 0);
  const paymentValid =
    paymentOptions.includes(paymentMethod) &&
    (!requiresPaymentProof || Boolean(paymentProof.file));
  const canSubmit = linesValid && deliveryValid && paymentValid;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] w-full max-w-[calc(100%-2rem)] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Place order</DialogTitle>
          <DialogDescription>
            {listing.title} · {formatMarketplacePrice(listing.price)} each
          </DialogDescription>
        </DialogHeader>

        {listing.photoUrl ? (
          <div className="overflow-hidden rounded-xl border border-border/70 bg-muted/15 p-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={listing.photoUrl}
              alt={listing.title}
              className="mx-auto max-h-44 w-full rounded-lg object-contain"
            />
          </div>
        ) : null}

        <div className="rounded-xl border border-border/70 bg-muted/15 px-3 py-2 text-sm text-muted-foreground">
          <p>{formatMarketplaceFulfillmentMethod(listing.fulfillmentMethod)}</p>
          {listing.fulfillmentMethod === "pickup" && marketplaceListingPickupLocation(listing) ? (
            <p className="mt-1">Pickup at {marketplaceListingPickupLocation(listing)}</p>
          ) : null}
          {isCourier && courierDeliveryLabel ? (
            <p className="mt-1">{courierDeliveryLabel}</p>
          ) : null}
        </div>

        <div className="space-y-4 py-2">
          {showVariantFields ? (
            <p className="text-sm text-muted-foreground">
              Add one line per size and color combination you want to order.
            </p>
          ) : (
            <p className="text-sm text-muted-foreground">
              Choose how many you want to order. Add another line if you need separate quantities.
            </p>
          )}

          <div className="space-y-3">
            {lines.map((line, index) => (
              <OrderLineFields
                key={line.key}
                line={line}
                lineLabel={orderLineLabel(listing, index)}
                showVariantFields={showVariantFields}
                sizeOptions={sizeOptions}
                colorOptions={colorOptions}
                showSizeSelect={showSizeSelect}
                showColorSelect={showColorSelect}
                disabled={submitMutation.isPending}
                canRemove={lines.length > 1}
                onChange={(next) =>
                  setLines((prev) => prev.map((item) => (item.key === line.key ? next : item)))
                }
                onRemove={() => setLines((prev) => prev.filter((item) => item.key !== line.key))}
              />
            ))}
          </div>

          <Button
            type="button"
            variant="outline"
            className="w-full"
            disabled={!canAddLine || submitMutation.isPending}
            onClick={() => setLines((prev) => [...prev, createOrderLine()])}
          >
            <Plus className="mr-2 h-4 w-4" aria-hidden />
            Add another {showVariantFields ? "size / color" : "quantity"}
          </Button>

          <p className="text-sm text-muted-foreground">
            Total quantity: <span className="font-medium text-foreground">{totalQuantity}</span>
          </p>

          <div className="space-y-1 rounded-xl border border-border/70 bg-muted/15 px-3 py-2 text-sm">
            <div className="flex items-center justify-between gap-3">
              <span className="text-muted-foreground">Items</span>
              <span className="font-medium tabular-nums">{formatMarketplacePrice(itemSubtotal)}</span>
            </div>
            {isCourier ? (
              <div className="flex items-center justify-between gap-3">
                <span className="text-muted-foreground">Delivery fee</span>
                {listing.deliveryFeeShoulderedByRecipient ? (
                  <span className="text-right text-xs text-muted-foreground">
                    Shouldered by recipient
                  </span>
                ) : (
                  <span className="font-medium tabular-nums">
                    {formatMarketplacePrice(deliveryFee)}
                  </span>
                )}
              </div>
            ) : null}
            <div className="flex items-center justify-between gap-3 border-t border-border/60 pt-2">
              <span className="font-medium text-foreground">Total</span>
              <span className="font-semibold tabular-nums">{formatMarketplacePrice(orderTotal)}</span>
            </div>
          </div>

          {isCourier ? (
            <div className="space-y-3 rounded-xl border border-border/70 p-3">
              <p className="text-sm font-medium text-foreground">Delivery details</p>
              <div className="space-y-2">
                <Label htmlFor="order-delivery-address">Delivery address</Label>
                <Input
                  id="order-delivery-address"
                  value={delivery.deliveryAddress}
                  disabled={submitMutation.isPending}
                  onChange={(event) =>
                    setDelivery((prev) => ({ ...prev, deliveryAddress: event.target.value }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="order-landmark">Landmark</Label>
                <Input
                  id="order-landmark"
                  value={delivery.landmark}
                  disabled={submitMutation.isPending}
                  onChange={(event) =>
                    setDelivery((prev) => ({ ...prev, landmark: event.target.value }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="order-contact-person">Contact person</Label>
                <Input
                  id="order-contact-person"
                  value={delivery.contactPerson}
                  disabled={submitMutation.isPending}
                  onChange={(event) =>
                    setDelivery((prev) => ({ ...prev, contactPerson: event.target.value }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="order-contact-number">Contact number</Label>
                <Input
                  id="order-contact-number"
                  value={delivery.contactNumber}
                  disabled={submitMutation.isPending}
                  onChange={(event) =>
                    setDelivery((prev) => ({ ...prev, contactNumber: event.target.value }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="order-delivery-notes">Delivery notes (optional)</Label>
                <Input
                  id="order-delivery-notes"
                  value={delivery.deliveryNotes}
                  disabled={submitMutation.isPending}
                  onChange={(event) =>
                    setDelivery((prev) => ({ ...prev, deliveryNotes: event.target.value }))
                  }
                />
              </div>
            </div>
          ) : null}

          <div className="space-y-3 rounded-xl border border-border/70 bg-muted/15 p-3">
            <div className="space-y-2">
              <Label htmlFor="order-payment-method">Payment method</Label>
              {paymentOptions.length > 1 ? (
                <Select
                  value={paymentMethod}
                  disabled={submitMutation.isPending}
                  onValueChange={(value) => {
                    const next = value as MarketplacePaymentMethod;
                    setPaymentMethod(next);
                    if (!marketplacePaymentRequiresProof(next)) {
                      setPaymentProof(emptyPaymentProof);
                    }
                  }}
                >
                  <SelectTrigger id="order-payment-method" className="w-full">
                    <span className="flex flex-1 truncate text-left">
                      {formatMarketplacePaymentMethod(paymentMethod)}
                    </span>
                  </SelectTrigger>
                  <SelectContent>
                    {paymentOptions.map((method) => (
                      <SelectItem key={method} value={method}>
                        {formatMarketplacePaymentMethod(method)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <p className="text-sm text-foreground">
                  {formatMarketplacePaymentMethod(paymentMethod)}
                </p>
              )}
            </div>

            {paymentMethod === "gcash" && listing.gcashName && listing.gcashNumber ? (
              <div className="space-y-1 text-sm">
                <p className="font-medium text-foreground">Send payment via GCash</p>
                <p>{listing.gcashName}</p>
                <p className="tabular-nums text-muted-foreground">{listing.gcashNumber}</p>
              </div>
            ) : null}

            {paymentMethod === "bank_transfer" &&
            listing.bankName &&
            listing.bankAccountName &&
            listing.bankAccountNumber ? (
              <div className="space-y-1 text-sm">
                <p className="font-medium text-foreground">Send payment via bank transfer</p>
                <p>{listing.bankName}</p>
                <p>{listing.bankAccountName}</p>
                <p className="tabular-nums text-muted-foreground">{listing.bankAccountNumber}</p>
              </div>
            ) : null}

            {requiresPaymentProof ? (
              <MarketplacePaymentProofField
                required
                disabled={submitMutation.isPending}
                value={paymentProof}
                onChange={setPaymentProof}
              />
            ) : null}
          </div>
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            disabled={submitMutation.isPending}
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button
            type="button"
            disabled={submitMutation.isPending || !canSubmit}
            onClick={() => submitMutation.mutate()}
          >
            {submitMutation.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
                Submitting…
              </>
            ) : (
              <>
                <ShoppingBag className="mr-2 h-4 w-4" aria-hidden />
                Submit order
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
