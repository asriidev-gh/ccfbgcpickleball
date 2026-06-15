import { spectateMarketplaceOrderSchema } from "@/lib/validations";

function formString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

function parseJsonField<T>(raw: string): T | undefined {
  if (!raw.trim()) return undefined;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return undefined;
  }
}

export function parseMarketplaceOrderFormData(formData: FormData) {
  const lines = parseJsonField<Array<{ size?: string; color?: string; quantity: number }>>(
    formString(formData, "lines"),
  );
  const delivery = parseJsonField<{
    deliveryAddress: string;
    landmark: string;
    contactPerson: string;
    contactNumber: string;
    deliveryNotes?: string;
  }>(formString(formData, "delivery"));

  const parsed = spectateMarketplaceOrderSchema.safeParse({
    playerId: formString(formData, "playerId"),
    listingId: formString(formData, "listingId"),
    lines: lines ?? [],
    delivery,
    paymentMethod: formString(formData, "paymentMethod"),
  });

  const proofEntry = formData.get("paymentProof");
  const paymentProofFile =
    proofEntry instanceof File && proofEntry.size > 0 ? proofEntry : null;

  return { parsed, paymentProofFile };
}
