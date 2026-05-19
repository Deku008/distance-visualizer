import { FieldValue } from "firebase-admin/firestore";
import { withFirebaseUser } from "@/app/lib/apiAuth";
import { getAdminDb } from "@/app/lib/firebaseAdmin";
import {
  getRazorpay,
  PRO_MONTHLY_AMOUNT_PAISE,
  PRO_MONTHLY_CURRENCY,
} from "@/app/lib/razorpayOrder";
import { validatePromoCode } from "@/app/lib/promoCodes";
import { normalizeSubscription } from "@/app/lib/subscription";

export const runtime = "nodejs";

export async function POST(request: Request) {
  return withFirebaseUser(request, async (user) => {
    const body = (await request.json().catch(() => ({}))) as {
      amount?: number;
      currency?: string;
      promoCode?: string;
    };
    const promo = body.promoCode ? validatePromoCode(body.promoCode) : undefined;

    if (promo && (!promo.valid || !promo.code)) {
      console.warn("[Razorpay] Rejected order for invalid promo code", {
        uid: user.uid,
        codeLength: body.promoCode?.length ?? 0,
      });
      return Response.json({ error: promo.error ?? "Invalid promo code." }, { status: 400 });
    }

    if (promo?.freePro) {
      return Response.json({ error: "Free Pro promos must be applied before checkout." }, { status: 400 });
    }

    const requestedAmount = Number(body.amount ?? PRO_MONTHLY_AMOUNT_PAISE);

    if (!Number.isInteger(requestedAmount) || requestedAmount < 100) {
      return Response.json({ error: "Amount must be at least 100 paise." }, { status: 400 });
    }

    const amount = promo ? promo.finalAmount : PRO_MONTHLY_AMOUNT_PAISE;

    const currency = body.currency ?? PRO_MONTHLY_CURRENCY;
    const db = getAdminDb();
    const userRef = db.collection("users").doc(user.uid);
    const userSnapshot = await userRef.get();
    const userData = userSnapshot.data();
    const subscription = normalizeSubscription(userData?.subscription ?? userData);

    if (subscription.isPro) {
      console.info("[Razorpay] Skipped order creation for existing Pro user", {
        uid: user.uid,
        plan: subscription.plan,
        status: subscription.status,
      });
      return Response.json(
        {
          error: "RouteVision Pro is already active for this account.",
          code: "ALREADY_PREMIUM",
        },
        { status: 409 },
      );
    }

    try {
      const order = await getRazorpay().orders.create({
        amount,
        currency,
        receipt: `rv_${user.uid.slice(0, 16)}_${Date.now()}`,
        notes: {
          firebaseUid: user.uid,
          plan: "pro",
          product: "routevision-pro",
          promoCode: promo?.code ?? "",
          discountPercentage: promo ? String(promo.discountPercentage) : "0",
          originalAmount: String(PRO_MONTHLY_AMOUNT_PAISE),
        },
      });

      await userRef.set(
        {
          email: user.email ?? null,
          pendingRazorpayOrderId: order.id,
          pendingRazorpayAmount: order.amount,
          pendingRazorpayCurrency: order.currency,
          pendingPromoCode: promo?.code ?? null,
          pendingPromoDiscountPercentage: promo?.discountPercentage ?? 0,
          pendingPromoFinalAmount: promo?.finalAmount ?? order.amount,
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true },
      );

      console.log("[Razorpay] Created RouteVision Pro order", {
        uid: user.uid,
        orderId: order.id,
        amount: order.amount,
        currency: order.currency,
        promoCode: promo?.code ?? null,
        discountPercentage: promo?.discountPercentage ?? 0,
      });

      return Response.json({
        order_id: order.id,
        amount: order.amount,
        currency: order.currency,
      });
    } catch (error) {
      console.error("[Razorpay] Failed to create RouteVision Pro order", {
        uid: user.uid,
        amount,
        currency,
        error: error instanceof Error ? error.message : "Unknown Razorpay order error.",
      });
      return Response.json({ error: "Unable to create Razorpay order." }, { status: 500 });
    }
  }).catch((error) =>
    Response.json(
      { error: error instanceof Error ? error.message : "Unable to create Razorpay order." },
      { status: 500 },
    ),
  );
}
