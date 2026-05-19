export const FREE_LANE_LIMIT = 10;
export const PRO_PRICE_DISPLAY = "₹100/month";

export type SubscriptionPlan = "free" | "pro";
export type SubscriptionStatus =
  | "active"
  | "authenticated"
  | "created"
  | "pending"
  | "halted"
  | "cancelled"
  | "completed"
  | "expired"
  | "none";

export type SubscriptionSnapshot = {
  plan: SubscriptionPlan;
  status: SubscriptionStatus;
  isPro: boolean;
  laneLimit: number | null;
  provider?: "razorpay";
  razorpayCustomerId?: string;
  razorpayPlanId?: string;
  razorpayOrderId?: string;
  razorpaySubscriptionId?: string;
  razorpayPaymentId?: string;
  shortUrl?: string;
  paymentDate?: string;
  premiumActivatedAt?: string;
  currentPeriodStart?: number;
  currentPeriodEnd?: number;
};

export const FREE_SUBSCRIPTION: SubscriptionSnapshot = {
  plan: "free",
  status: "none",
  isPro: false,
  laneLimit: FREE_LANE_LIMIT,
};

export function isProStatus(status: unknown) {
  return status === "active" || status === "authenticated";
}

export function normalizeSubscription(value: unknown): SubscriptionSnapshot {
  if (!value || typeof value !== "object") {
    return FREE_SUBSCRIPTION;
  }

  const data = value as Record<string, unknown>;
  const status = typeof data.status === "string" ? data.status : "none";
  const plan = data.plan ?? data.subscriptionPlan;
  const isPro = data.isPremium === true || data.isPro === true || (plan === "pro" && isProStatus(status));

  return {
    plan: isPro ? "pro" : "free",
    status: status as SubscriptionStatus,
    isPro,
    laneLimit: isPro ? null : FREE_LANE_LIMIT,
    provider: data.provider === "razorpay" ? "razorpay" : undefined,
    razorpayCustomerId: typeof data.razorpayCustomerId === "string" ? data.razorpayCustomerId : undefined,
    razorpayPlanId: typeof data.razorpayPlanId === "string" ? data.razorpayPlanId : undefined,
    razorpayOrderId: typeof data.razorpayOrderId === "string" ? data.razorpayOrderId : undefined,
    razorpaySubscriptionId:
      typeof data.razorpaySubscriptionId === "string" ? data.razorpaySubscriptionId : undefined,
    razorpayPaymentId: typeof data.razorpayPaymentId === "string" ? data.razorpayPaymentId : undefined,
    shortUrl: typeof data.shortUrl === "string" ? data.shortUrl : undefined,
    paymentDate: typeof data.paymentDate === "string" ? data.paymentDate : undefined,
    premiumActivatedAt: typeof data.premiumActivatedAt === "string" ? data.premiumActivatedAt : undefined,
    currentPeriodStart: typeof data.currentPeriodStart === "number" ? data.currentPeriodStart : undefined,
    currentPeriodEnd: typeof data.currentPeriodEnd === "number" ? data.currentPeriodEnd : undefined,
  };
}
