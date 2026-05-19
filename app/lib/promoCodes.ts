import { PRO_PRICE_PAISE } from "@/app/lib/subscription";

export type PromoCodeConfig = {
  code: string;
  discountPercentage: number;
  freePro: boolean;
  label: string;
};

export type PromoValidationResult = {
  valid: boolean;
  code?: string;
  label?: string;
  discountPercentage: number;
  freePro: boolean;
  finalAmount: number;
  error?: string;
};

export const PROMO_CODES: Record<string, PromoCodeConfig> = {
  SURAJISKING: {
    code: "SURAJISKING",
    discountPercentage: 100,
    freePro: true,
    label: "Free Pro access",
  },
  EARLYBIRD50: {
    code: "EARLYBIRD50",
    discountPercentage: 50,
    freePro: false,
    label: "50% off Pro",
  },
};

export function normalizePromoCode(code: unknown) {
  return typeof code === "string" ? code.trim().toUpperCase() : "";
}

export function validatePromoCode(code: unknown): PromoValidationResult {
  const normalizedCode = normalizePromoCode(code);
  const promo = PROMO_CODES[normalizedCode];

  if (!normalizedCode || !promo) {
    return {
      valid: false,
      discountPercentage: 0,
      freePro: false,
      finalAmount: PRO_PRICE_PAISE,
      error: "Invalid promo code.",
    };
  }

  const discountAmount = Math.round((PRO_PRICE_PAISE * promo.discountPercentage) / 100);
  const discountedAmount = Math.max(PRO_PRICE_PAISE - discountAmount, 0);
  const finalAmount = promo.freePro ? 0 : Math.max(discountedAmount, 100);

  return {
    valid: true,
    code: promo.code,
    label: promo.label,
    discountPercentage: promo.discountPercentage,
    freePro: promo.freePro,
    finalAmount,
  };
}
