export const MARKETPLACE_PAYMENT_METHODS = ["cash", "gcash", "bank_transfer"] as const;
export type MarketplacePaymentMethod = (typeof MARKETPLACE_PAYMENT_METHODS)[number];

export const MAX_MARKETPLACE_GCASH_NAME_LENGTH = 120;
export const MARKETPLACE_GCASH_NUMBER_PREFIX = "09";
export const MAX_MARKETPLACE_GCASH_NUMBER_LENGTH = 11;
export const MARKETPLACE_BANK_PLACEHOLDER = "select_bank";
export const MAX_MARKETPLACE_BANK_ACCOUNT_NAME_LENGTH = 120;
export const MAX_MARKETPLACE_BANK_ACCOUNT_NUMBER_LENGTH = 40;

export const PH_LOCAL_BANKS = [
  "BDO Unibank",
  "Bank of the Philippine Islands (BPI)",
  "Metrobank",
  "Land Bank of the Philippines",
  "Philippine National Bank (PNB)",
  "Security Bank",
  "UnionBank of the Philippines",
  "China Banking Corporation",
  "RCBC",
  "EastWest Bank",
  "Philippine Savings Bank (PSBank)",
  "Asia United Bank (AUB)",
  "Development Bank of the Philippines (DBP)",
  "Robinsons Bank",
  "Maybank Philippines",
] as const;

export type PhLocalBank = (typeof PH_LOCAL_BANKS)[number];

export type MarketplaceListingPaymentDetails = {
  paymentMethods: MarketplacePaymentMethod[];
  gcashName: string | null;
  gcashNumber: string | null;
  bankName: string | null;
  bankAccountName: string | null;
  bankAccountNumber: string | null;
};

export function formatMarketplacePaymentMethod(method: MarketplacePaymentMethod) {
  switch (method) {
    case "cash":
      return "Cash";
    case "gcash":
      return "GCash";
    case "bank_transfer":
      return "Bank transfer";
  }
}

export function marketplacePaymentRequiresProof(method: MarketplacePaymentMethod) {
  return method === "gcash" || method === "bank_transfer";
}

export function formatMarketplacePaymentMethodsLabel(methods: MarketplacePaymentMethod[]) {
  return methods.map(formatMarketplacePaymentMethod).join(", ");
}

export function normalizeMarketplaceGcashNumberInput(value: string) {
  const digits = value.replace(/\D/g, "");
  if (digits.length <= 2) {
    return MARKETPLACE_GCASH_NUMBER_PREFIX;
  }
  if (!digits.startsWith("09")) {
    const withoutLeadingZero = digits.startsWith("0") ? digits.slice(1) : digits;
    const withNine = withoutLeadingZero.startsWith("9")
      ? withoutLeadingZero
      : `9${withoutLeadingZero}`;
    return `${MARKETPLACE_GCASH_NUMBER_PREFIX}${withNine.slice(1, 10)}`;
  }
  return digits.slice(0, MAX_MARKETPLACE_GCASH_NUMBER_LENGTH);
}

export function formatMarketplaceGcashNumberForForm(value: string | null | undefined) {
  const trimmed = value?.trim() ?? "";
  if (!trimmed) return MARKETPLACE_GCASH_NUMBER_PREFIX;
  return normalizeMarketplaceGcashNumberInput(trimmed);
}

export function isValidMarketplaceGcashNumber(value: string) {
  return /^09\d{9}$/.test(value.trim());
}
