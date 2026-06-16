"use client";

import { useQuery } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import { Loader2, MapPin, ShoppingBag, Store, Tag } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { PlayerMarketplaceOrderDialog } from "@/components/marketplace/player-marketplace-order-dialog";
import { MarketplaceListingPhotoDialog } from "@/components/marketplace/marketplace-listing-photo-dialog";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatAppDateTime } from "@/lib/format-datetime";
import {
  formatMarketplaceFulfillmentMethod,
  formatMarketplacePrice,
  formatMarketplaceListingOptionsLabel,
  formatMarketplaceListingCourierDeliveryLabel,
  marketplaceListingPickupLocation,
  type MarketplaceListingItem,
} from "@/lib/marketplace-listings-shared";
import { formatMarketplacePaymentMethod } from "@/lib/marketplace-payment-shared";
import { getLinkedPlayerIdForGame } from "@/lib/player-session";
import { cn } from "@/lib/utils";

function BrowseListingCard({
  listing,
  gameId,
  playerId,
}: {
  listing: MarketplaceListingItem;
  gameId: string;
  playerId: string | null;
}) {
  const [orderOpen, setOrderOpen] = useState(false);
  const [photoOpen, setPhotoOpen] = useState(false);
  const totalPhotos = listing.photoUrls.length > 0 ? listing.photoUrls.length : listing.photoUrl ? 1 : 0;

  const handleOrderClick = () => {
    if (!playerId) {
      toast.error("Register for this open play first to place an order.");
      return;
    }
    setOrderOpen(true);
  };

  return (
    <>
      <Card className="glass-panel overflow-hidden">
        <div className="border-b border-border/60 bg-muted/15 px-4 py-3 sm:px-5">
          <button
            type="button"
            className="relative mx-auto block w-full rounded-xl outline-none transition-opacity hover:opacity-90 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            aria-label={`View full photo of ${listing.title}`}
            onClick={() => setPhotoOpen(true)}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={listing.photoUrl!}
              alt={listing.title}
              className="mx-auto max-h-56 w-full cursor-pointer rounded-xl border border-border/70 bg-background object-contain"
            />
            {totalPhotos > 1 ? (
              <span className="absolute right-2 top-2 rounded-full bg-black/70 px-2 py-0.5 text-[10px] font-medium text-white">
                +{totalPhotos - 1} photos
              </span>
            ) : null}
          </button>
        </div>
        <CardHeader className="space-y-2 pb-3">
          <div className="flex flex-wrap items-center gap-2">
            <CardTitle className="text-lg">{listing.title}</CardTitle>
            <Badge
              variant="outline"
              className={cn(
                listing.condition === "New"
                  ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                  : "border-amber-500/40 bg-amber-500/10 text-amber-800 dark:text-amber-200",
              )}
            >
              {listing.condition}
            </Badge>
            {listing.productTag ? (
              <Badge variant="secondary" className="gap-1">
                <Tag className="h-3 w-3" aria-hidden />
                {listing.productTag}
              </Badge>
            ) : null}
            {listing.itemType ? <Badge variant="outline">{listing.itemType}</Badge> : null}
            {formatMarketplaceListingOptionsLabel(listing.itemSize) ? (
              <Badge variant="outline">
                Sizes: {formatMarketplaceListingOptionsLabel(listing.itemSize)}
              </Badge>
            ) : null}
            {formatMarketplaceListingOptionsLabel(listing.itemColor) ? (
              <Badge variant="outline">
                Colors: {formatMarketplaceListingOptionsLabel(listing.itemColor)}
              </Badge>
            ) : null}
          </div>
          <p className="text-xl font-semibold tabular-nums text-foreground">
            {formatMarketplacePrice(listing.price)}
          </p>
          <p className="text-xs text-muted-foreground">
            Listed {formatAppDateTime(listing.createdAt)}
            {listing.updatedAt !== listing.createdAt ? (
              <>
                {" "}
                · Updated {formatDistanceToNow(new Date(listing.updatedAt), { addSuffix: true })}
              </>
            ) : null}
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground/90">
            {listing.description}
          </p>
          <p className="inline-flex items-center gap-1.5 text-sm text-muted-foreground">
            <MapPin className="h-3.5 w-3.5 shrink-0" aria-hidden />
            {listing.location}
          </p>
          <p className="text-sm text-muted-foreground">
            {formatMarketplaceFulfillmentMethod(listing.fulfillmentMethod)}
            {listing.fulfillmentMethod === "pickup" && marketplaceListingPickupLocation(listing)
              ? ` · Pickup at ${marketplaceListingPickupLocation(listing)}`
              : null}
            {formatMarketplaceListingCourierDeliveryLabel(listing)
              ? ` · ${formatMarketplaceListingCourierDeliveryLabel(listing)}`
              : null}
          </p>
          {listing.paymentMethods.length > 0 ? (
            <p className="text-sm text-muted-foreground">
              Payment:{" "}
              {listing.paymentMethods.map(formatMarketplacePaymentMethod).join(", ")}
            </p>
          ) : null}
          <Button type="button" className="w-full gap-2 sm:w-auto" onClick={handleOrderClick}>
            <ShoppingBag className="h-4 w-4" aria-hidden />
            Order
          </Button>
        </CardContent>
      </Card>

      {playerId ? (
        <PlayerMarketplaceOrderDialog
          gameId={gameId}
          playerId={playerId}
          listing={listing}
          open={orderOpen}
          onOpenChange={setOrderOpen}
        />
      ) : null}

      <MarketplaceListingPhotoDialog
        photoUrl={listing.photoUrl}
        photoUrls={listing.photoUrls}
        title={listing.title}
        open={photoOpen}
        onOpenChange={setPhotoOpen}
      />
    </>
  );
}

export function PlayerMarketplaceListingsView({ gameId }: { gameId: string }) {
  const [playerId, setPlayerId] = useState<string | null>(null);

  useEffect(() => {
    const readSession = () => setPlayerId(getLinkedPlayerIdForGame(gameId));
    readSession();
    window.addEventListener("focus", readSession);
    return () => window.removeEventListener("focus", readSession);
  }, [gameId]);

  const { data, isLoading, error } = useQuery({
    queryKey: ["spectate-marketplace-listings", gameId],
    queryFn: async () => {
      const response = await fetch(`/api/games/${gameId}/spectate/marketplace`);
      const payload = (await response.json()) as {
        listings: MarketplaceListingItem[];
        message?: string;
      };
      if (!response.ok) throw new Error(payload.message ?? "Failed to load listings.");
      return payload.listings;
    },
  });

  const listings = data ?? [];

  if (isLoading) {
    return (
      <p className="flex items-center gap-2 py-8 text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
        Loading marketplace…
      </p>
    );
  }

  if (error) {
    return (
      <p className="py-8 text-destructive">
        {error instanceof Error ? error.message : "Failed to load listings."}
      </p>
    );
  }

  if (listings.length === 0) {
    return (
      <Card className="glass-panel border-dashed">
        <CardContent className="flex flex-col items-center justify-center gap-3 py-12 text-center">
          <Store className="h-10 w-10 text-muted-foreground/70" aria-hidden />
          <div>
            <p className="font-medium text-foreground">No listings available</p>
            <p className="mt-1 max-w-sm text-sm text-muted-foreground">
              Check back later for paddles, apparel, and other pickleball gear from your club.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      {!playerId ? (
        <Card className="glass-panel border-dashed">
          <CardContent className="py-4 text-sm text-muted-foreground">
            <Link
              href={`/register/${gameId}`}
              className={cn(buttonVariants({ variant: "link" }), "h-auto p-0")}
            >
              Register for this open play
            </Link>{" "}
            to place orders.
          </CardContent>
        </Card>
      ) : null}
      <p className="text-xs text-muted-foreground">
        {listings.length} active {listings.length === 1 ? "listing" : "listings"}
      </p>
      {listings.map((listing) => (
        <BrowseListingCard key={listing.id} listing={listing} gameId={gameId} playerId={playerId} />
      ))}
    </div>
  );
}
