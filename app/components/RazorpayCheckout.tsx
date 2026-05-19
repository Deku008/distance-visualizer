"use client";

import { Crown } from "lucide-react";

type RazorpayCheckoutResponse = {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
};

type RazorpayCheckoutFailure = {
  error?: {
    description?: string;
    reason?: string;
  };
};

type RazorpayCheckoutOptions = {
  key: string;
  name: string;
  description: string;
  order_id: string;
  currency: string;
  amount: number;
  prefill: {
    name: string;
    email: string;
  };
  method: {
    upi: boolean;
    card: boolean;
    netbanking: boolean;
  };
  theme: {
    color: string;
  };
  modal: {
    ondismiss: () => void;
  };
  handler: (response: RazorpayCheckoutResponse) => void;
};

declare global {
  interface Window {
    Razorpay?: new (options: RazorpayCheckoutOptions) => {
      on: (event: "payment.failed", handler: (response: RazorpayCheckoutFailure) => void) => void;
      open: () => void;
    };
  }
}

type RazorpayCheckoutProps = {
  billingStatus: "idle" | "loading" | "redirecting" | "error";
  getAuthToken: (forceRefresh?: boolean) => Promise<string>;
  userName: string;
  userEmail: string;
  onError: (message: string) => void;
  onStart: () => void;
  onClose: () => void;
  onSuccess: () => Promise<void> | void;
};

type ApiErrorResponse = {
  error?: string;
  code?: string;
};

async function loadRazorpayCheckout() {
  if (window.Razorpay) {
    return;
  }

  await new Promise<void>((resolve, reject) => {
    const existingScript = document.querySelector<HTMLScriptElement>(
      'script[src="https://checkout.razorpay.com/v1/checkout.js"]',
    );

    if (existingScript) {
      existingScript.addEventListener("load", () => resolve(), { once: true });
      existingScript.addEventListener("error", () => reject(new Error("Razorpay checkout could not load.")), {
        once: true,
      });
      return;
    }

    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Razorpay checkout could not load."));
    document.body.appendChild(script);
  });
}

export default function RazorpayCheckout({
  billingStatus,
  getAuthToken,
  userName,
  userEmail,
  onError,
  onStart,
  onClose,
  onSuccess,
}: RazorpayCheckoutProps) {
  const fetchWithFirebaseAuth = async (input: RequestInfo | URL, init: RequestInit = {}) => {
    const run = async (forceRefresh: boolean) => {
      const token = await getAuthToken(forceRefresh);
      const headers = new Headers(init.headers);
      headers.set("Authorization", `Bearer ${token}`);

      return fetch(input, {
        ...init,
        headers,
      });
    };

    let response = await run(false);

    if (response.status !== 401) {
      return response;
    }

    const data = (await response.clone().json().catch(() => ({}))) as ApiErrorResponse;
    const refreshableTokenError = data.code === "TOKEN_EXPIRED" || data.code === "INVALID_TOKEN";

    if (!refreshableTokenError) {
      return response;
    }

    console.info("[Firebase Auth] Refreshing ID token for Razorpay API request", { code: data.code });
    response = await run(true);

    return response;
  };

  const startCheckout = async () => {
    try {
      onStart();
      console.log("[Razorpay] Loading Standard Checkout");
      await loadRazorpayCheckout();

      console.log("[Razorpay] Creating RouteVision Pro order");
      const orderResponse = await fetchWithFirebaseAuth("/api/create-order", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ amount: 10000, currency: "INR" }),
      });
      const order = (await orderResponse.json()) as {
        order_id?: string;
        amount?: number;
        currency?: string;
        error?: string;
      };

      if (!orderResponse.ok || !order.order_id || !order.amount || !order.currency) {
        throw new Error(order.error ?? "Unable to create Razorpay order.");
      }

      const key = process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID;

      if (!key) {
        throw new Error("NEXT_PUBLIC_RAZORPAY_KEY_ID is not configured.");
      }

      if (!window.Razorpay) {
        throw new Error("Razorpay checkout is unavailable.");
      }

      const checkout = new window.Razorpay({
        key,
        name: "RouteVision Pro",
        description: "₹100/month subscription-style upgrade",
        order_id: order.order_id,
        amount: order.amount,
        currency: order.currency,
        prefill: {
          name: userName,
          email: userEmail,
        },
        method: {
          upi: true,
          card: true,
          netbanking: true,
        },
        theme: {
          color: "#2563eb",
        },
        modal: {
          ondismiss: () => {
            console.log("[Razorpay] Checkout modal closed");
            onClose();
          },
        },
        handler: async (paymentResponse) => {
          try {
            console.log("[Razorpay] Payment success callback received", {
              orderId: paymentResponse.razorpay_order_id,
              paymentId: paymentResponse.razorpay_payment_id,
            });
            const verifyResponse = await fetchWithFirebaseAuth("/api/verify-payment", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
              },
              body: JSON.stringify(paymentResponse),
            });
            const verifyResult = (await verifyResponse.json()) as {
              success?: boolean;
              error?: string;
            };

            if (!verifyResponse.ok || !verifyResult.success) {
              throw new Error(verifyResult.error ?? "Unable to verify Razorpay payment.");
            }

            console.log("[Razorpay] Payment verified and premium unlocked");
            await onSuccess();
          } catch (error) {
            onError(error instanceof Error ? error.message : "Unable to verify Razorpay payment.");
          }
        },
      });

      checkout.on("payment.failed", (failure) => {
        console.warn("[Razorpay] Payment failed", failure);
        onError(failure.error?.description ?? failure.error?.reason ?? "Razorpay payment failed.");
      });
      checkout.open();
    } catch (error) {
      onError(error instanceof Error ? error.message : "Unable to open Razorpay checkout.");
    }
  };

  return (
    <button
      type="button"
      onClick={() => void startCheckout()}
      disabled={billingStatus === "redirecting" || billingStatus === "loading"}
      className="liquid-button-primary flex h-12 items-center justify-center gap-2 rounded-[1.15rem] text-sm font-semibold text-white transition hover:-translate-y-0.5 disabled:cursor-wait disabled:opacity-60"
    >
      <Crown className="size-4" />
      {billingStatus === "redirecting" || billingStatus === "loading"
        ? "Opening Razorpay..."
        : "Upgrade with Razorpay"}
    </button>
  );
}
