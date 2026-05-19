import { FieldValue } from "firebase-admin/firestore";
import { withFirebaseUser } from "@/app/lib/apiAuth";
import { getAdminDb } from "@/app/lib/firebaseAdmin";
import { FREE_LANE_LIMIT, normalizeSubscription } from "@/app/lib/subscription";

export const runtime = "nodejs";

export async function GET(request: Request) {
  return withFirebaseUser(request, async (user) => {
    const db = getAdminDb();
    const userRef = db.collection("users").doc(user.uid);
    const [userSnapshot, routesSnapshot] = await Promise.all([
      userRef.get(),
      userRef.collection("routes").count().get(),
    ]);
    const userData = userSnapshot.data();
    const subscription = normalizeSubscription(userData?.subscription ?? userData);
    const laneCount = routesSnapshot.data().count;

    if (!userSnapshot.exists) {
      await userRef.set(
        {
          email: user.email ?? null,
          subscription,
          createdAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true },
      );
    }

    return Response.json({
      subscription,
      laneCount,
      freeLaneLimit: FREE_LANE_LIMIT,
      remainingFreeLanes: subscription.isPro ? null : Math.max(FREE_LANE_LIMIT - laneCount, 0),
    });
  }).catch((error) =>
    Response.json(
      { error: error instanceof Error ? error.message : "Unable to load subscription." },
      { status: 500 },
    ),
  );
}
