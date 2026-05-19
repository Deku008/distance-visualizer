import { FieldValue } from "firebase-admin/firestore";
import { withFirebaseUser } from "@/app/lib/apiAuth";
import { getAdminDb } from "@/app/lib/firebaseAdmin";
import {
  getRazorpay,
  PRO_MONTHLY_AMOUNT_PAISE,
  PRO_MONTHLY_CURRENCY,
} from "@/app/lib/razorpayOrder";
import { normalizeSubscription } from "@/app/lib/subscription";

export const runtime = "nodejs";

export async function POST(request: Request) {
  return withFirebaseUser(request, async (user) => {
    const body = (await request.json().catch(() => ({}))) as {
      amount?: number;
      currency?: string;
    };
    const amount = Number(body.amount ?? PRO_MONTHLY_AMOUNT_PAISE);

    if (!Number.isInteger(amount) || amount < 100) {
      return Response.json({ error: "Amount must be at least 100 paise." }, { status: 400 });
    }

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
        },
      });

      await userRef.set(
        {
          email: user.email ?? null,
          pendingRazorpayOrderId: order.id,
          pendingRazorpayAmount: order.amount,
          pendingRazorpayCurrency: order.currency,
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true },
      );

      console.log("[Razorpay] Created RouteVision Pro order", {
        uid: user.uid,
        orderId: order.id,
        amount: order.amount,
        currency: order.currency,
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
