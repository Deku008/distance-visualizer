import { FieldValue } from "firebase-admin/firestore";
import { withFirebaseUser } from "@/app/lib/apiAuth";
import { getAdminDb } from "@/app/lib/firebaseAdmin";
import {
  getRazorpay,
  isValidRazorpaySignature,
  PRO_MONTHLY_AMOUNT_PAISE,
} from "@/app/lib/razorpayOrder";
import { normalizeSubscription } from "@/app/lib/subscription";

export const runtime = "nodejs";

export async function POST(request: Request) {
  return withFirebaseUser(request, async (user) => {
    const body = (await request.json().catch(() => ({}))) as {
      razorpay_order_id?: string;
      razorpay_payment_id?: string;
      razorpay_signature?: string;
    };

    if (!body.razorpay_order_id || !body.razorpay_payment_id || !body.razorpay_signature) {
      return Response.json({ error: "Missing Razorpay payment verification fields." }, { status: 400 });
    }

    const validSignature = isValidRazorpaySignature(
      body.razorpay_order_id,
      body.razorpay_payment_id,
      body.razorpay_signature,
    );

    if (!validSignature) {
      console.warn("[Razorpay] Rejected invalid payment signature", {
        uid: user.uid,
        orderId: body.razorpay_order_id,
        paymentId: body.razorpay_payment_id,
        signatureLength: body.razorpay_signature.length,
      });
      return Response.json({ error: "Invalid Razorpay payment signature." }, { status: 400 });
    }

    let order;
    let payment;

    try {
      [order, payment] = await Promise.all([
        getRazorpay().orders.fetch(body.razorpay_order_id),
        getRazorpay().payments.fetch(body.razorpay_payment_id),
      ]);
    } catch (error) {
      console.error("[Razorpay] Failed to fetch order or payment during verification", {
        uid: user.uid,
        orderId: body.razorpay_order_id,
        paymentId: body.razorpay_payment_id,
        error: error instanceof Error ? error.message : "Unknown Razorpay verification fetch error.",
      });
      return Response.json({ error: "Unable to verify Razorpay payment." }, { status: 500 });
    }

    if (order.notes?.firebaseUid !== user.uid) {
      console.warn("[Razorpay] Rejected payment for mismatched Firebase user", {
        uid: user.uid,
        orderUid: order.notes?.firebaseUid ?? null,
        orderId: body.razorpay_order_id,
      });
      return Response.json({ error: "Razorpay order does not belong to this user." }, { status: 403 });
    }

    const successfulPayment = payment.status === "captured" || payment.status === "authorized";

    if (Number(order.amount) < PRO_MONTHLY_AMOUNT_PAISE || !successfulPayment) {
      console.warn("[Razorpay] Rejected unsuccessful or under-amount payment", {
        uid: user.uid,
        orderId: body.razorpay_order_id,
        paymentId: body.razorpay_payment_id,
        orderAmount: order.amount,
        paymentStatus: payment.status,
      });
      return Response.json({ error: "Payment is not successful for the Pro amount." }, { status: 400 });
    }

    const premiumActivatedAt = new Date().toISOString();
    const db = getAdminDb();
    const userRef = db.collection("users").doc(user.uid);
    const userSnapshot = await userRef.get();
    const userData = userSnapshot.data();
    const subscription = normalizeSubscription(userData?.subscription ?? userData);

    if (subscription.isPro) {
      console.info("[Razorpay] Payment verified for already active Pro user", {
        uid: user.uid,
        orderId: body.razorpay_order_id,
        paymentId: body.razorpay_payment_id,
        existingPaymentId: subscription.razorpayPaymentId ?? null,
      });
      return Response.json({ success: true, alreadyPremium: true });
    }

    try {
      await userRef.set(
        {
          isPremium: true,
          subscriptionPlan: "pro",
          premiumActivatedAt,
          paymentDate: premiumActivatedAt,
          subscription: {
            provider: "razorpay",
            plan: "pro",
            status: "active",
            isPro: true,
            laneLimit: null,
            razorpayOrderId: body.razorpay_order_id,
            razorpayPaymentId: body.razorpay_payment_id,
            premiumActivatedAt,
            paymentDate: premiumActivatedAt,
            updatedAt: FieldValue.serverTimestamp(),
          },
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true },
      );
    } catch (error) {
      console.error("[Razorpay] Failed to persist premium subscription", {
        uid: user.uid,
        orderId: body.razorpay_order_id,
        paymentId: body.razorpay_payment_id,
        error: error instanceof Error ? error.message : "Unknown Firestore subscription update error.",
      });
      return Response.json({ error: "Payment verified, but premium activation failed." }, { status: 500 });
    }

    console.log("[Razorpay] Verified RouteVision Pro payment", {
      uid: user.uid,
      orderId: body.razorpay_order_id,
      paymentId: body.razorpay_payment_id,
      paymentStatus: payment.status,
    });

    return Response.json({ success: true });
  }).catch((error) =>
    Response.json(
      { error: error instanceof Error ? error.message : "Unable to verify Razorpay payment." },
      { status: 500 },
    ),
  );
}
