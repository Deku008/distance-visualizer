import { FieldValue } from "firebase-admin/firestore";
import { withFirebaseUser } from "@/app/lib/apiAuth";
import { getAdminDb } from "@/app/lib/firebaseAdmin";
import { validatePromoCode } from "@/app/lib/promoCodes";
import { normalizeSubscription } from "@/app/lib/subscription";

export const runtime = "nodejs";

export async function POST(request: Request) {
  return withFirebaseUser(request, async (user) => {
    const body = (await request.json().catch(() => ({}))) as {
      code?: string;
    };
    const promo = validatePromoCode(body.code);

    if (!promo.valid || !promo.code) {
      console.warn("[Promo] Invalid promo code rejected", {
        uid: user.uid,
        codeLength: body.code?.length ?? 0,
      });
      return Response.json(promo, { status: 400 });
    }

    const db = getAdminDb();
    const userRef = db.collection("users").doc(user.uid);
    const userSnapshot = await userRef.get();
    const userData = userSnapshot.data();
    const subscription = normalizeSubscription(userData?.subscription ?? userData);

    if (subscription.isPro) {
      console.info("[Promo] Promo validated for existing Pro user", {
        uid: user.uid,
        code: promo.code,
      });
      return Response.json({
        ...promo,
        alreadyPremium: true,
      });
    }

    if (!promo.freePro) {
      await userRef.set(
        {
          pendingPromoCode: promo.code,
          pendingPromoDiscountPercentage: promo.discountPercentage,
          pendingPromoFinalAmount: promo.finalAmount,
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true },
      );

      console.log("[Promo] Discount promo validated", {
        uid: user.uid,
        code: promo.code,
        discountPercentage: promo.discountPercentage,
        finalAmount: promo.finalAmount,
      });

      return Response.json(promo);
    }

    const redemptionRef = db.collection("promoRedemptions").doc(`${promo.code}_${user.uid}`);
    const premiumActivatedAt = new Date().toISOString();

    try {
      await db.runTransaction(async (transaction) => {
        const redemptionSnapshot = await transaction.get(redemptionRef);

        if (redemptionSnapshot.exists) {
          throw new Error("PROMO_ALREADY_REDEEMED");
        }

        transaction.set(redemptionRef, {
          code: promo.code,
          uid: user.uid,
          email: user.email ?? null,
          redeemedAt: FieldValue.serverTimestamp(),
        });

        transaction.set(
          userRef,
          {
            isPremium: true,
            subscriptionPlan: "pro",
            premiumActivatedAt,
            paymentDate: premiumActivatedAt,
            subscription: {
              provider: "promo",
              plan: "pro",
              status: "active",
              isPro: true,
              laneLimit: null,
              promoCode: promo.code,
              discountPercentage: promo.discountPercentage,
              premiumActivatedAt,
              paymentDate: premiumActivatedAt,
              updatedAt: FieldValue.serverTimestamp(),
            },
            updatedAt: FieldValue.serverTimestamp(),
          },
          { merge: true },
        );
      });
    } catch (error) {
      if (error instanceof Error && error.message === "PROMO_ALREADY_REDEEMED") {
        console.warn("[Promo] Free Pro promo duplicate redemption blocked", {
          uid: user.uid,
          code: promo.code,
        });
        return Response.json({ ...promo, valid: false, error: "This promo code was already used." }, { status: 409 });
      }

      console.error("[Promo] Failed to activate free Pro promo", {
        uid: user.uid,
        code: promo.code,
        error: error instanceof Error ? error.message : "Unknown promo activation error.",
      });
      return Response.json({ error: "Unable to apply promo code." }, { status: 500 });
    }

    console.log("[Promo] Free Pro promo activated", {
      uid: user.uid,
      code: promo.code,
    });

    return Response.json({
      ...promo,
      premiumActivated: true,
    });
  }).catch((error) =>
    Response.json(
      { error: error instanceof Error ? error.message : "Unable to validate promo code." },
      { status: 500 },
    ),
  );
}
