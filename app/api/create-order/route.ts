import { FieldValue } from "firebase-admin/firestore";
import { getAdminDb, requireFirebaseUser } from "@/app/lib/firebaseAdmin";
import {
  getRazorpay,
  PRO_MONTHLY_AMOUNT_PAISE,
  PRO_MONTHLY_CURRENCY,
} from "@/app/lib/razorpayOrder";

export async function POST(request: Request) {
  try {
    const user = await requireFirebaseUser(request);
    const body = (await request.json().catch(() => ({}))) as {
      amount?: number;
      currency?: string;
    };
    const amount = Number(body.amount ?? PRO_MONTHLY_AMOUNT_PAISE);

    if (!Number.isInteger(amount) || amount < 100) {
      return Response.json({ error: "Amount must be at least 100 paise." }, { status: 400 });
    }

    const currency = body.currency ?? PRO_MONTHLY_CURRENCY;
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

    await getAdminDb()
      .collection("users")
      .doc(user.uid)
      .set(
        {
          email: user.email ?? null,
          pendingRazorpayOrderId: order.id,
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
    return Response.json(
      { error: error instanceof Error ? error.message : "Unable to create Razorpay order." },
      { status: 500 },
    );
  }
}
