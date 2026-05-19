import { FieldValue } from "firebase-admin/firestore";
import { withFirebaseUser } from "@/app/lib/apiAuth";
import { getAdminDb } from "@/app/lib/firebaseAdmin";
import {
  getRazorpay,
  isValidRazorpaySignature,
  PRO_MONTHLY_AMOUNT_PAISE,
} from "@/app/lib/razorpayOrder";

export const runtime = "nodejs";

export async function POST(request: Request) {
  return withFirebaseUser(request, async (user) => {
    const body = (await request.json()) as {
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
      });
      return Response.json({ error: "Invalid Razorpay payment signature." }, { status: 400 });
    }

    const [order, payment] = await Promise.all([
      getRazorpay().orders.fetch(body.razorpay_order_id),
      getRazorpay().payments.fetch(body.razorpay_payment_id),
    ]);

    if (order.notes?.firebaseUid !== user.uid) {
      return Response.json({ error: "Razorpay order does not belong to this user." }, { status: 403 });
    }

    const successfulPayment = payment.status === "captured" || payment.status === "authorized";

    if (Number(order.amount) < PRO_MONTHLY_AMOUNT_PAISE || !successfulPayment) {
      return Response.json({ error: "Payment is not successful for the Pro amount." }, { status: 400 });
    }

    const premiumActivatedAt = new Date().toISOString();

    await getAdminDb()
      .collection("users")
      .doc(user.uid)
      .set(
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

    console.log("[Razorpay] Verified RouteVision Pro payment", {
      uid: user.uid,
      orderId: body.razorpay_order_id,
      paymentId: body.razorpay_payment_id,
    });

    return Response.json({ success: true });
  }).catch((error) =>
    Response.json(
      { error: error instanceof Error ? error.message : "Unable to verify Razorpay payment." },
      { status: 500 },
    ),
  );
}
