import { FieldValue } from "firebase-admin/firestore";
import { withFirebaseUser } from "@/app/lib/apiAuth";
import { getAdminDb } from "@/app/lib/firebaseAdmin";
import { FREE_LANE_LIMIT, normalizeSubscription } from "@/app/lib/subscription";

export const runtime = "nodejs";

function isRoutePayload(value: unknown): value is Record<string, unknown> {
  if (!value || typeof value !== "object") {
    return false;
  }

  const route = value as Record<string, unknown>;
  return (
    typeof route.id === "number" &&
    typeof route.name === "string" &&
    typeof route.start === "object" &&
    typeof route.end === "object" &&
    typeof route.startLabel === "string" &&
    typeof route.endLabel === "string"
  );
}

export async function POST(request: Request) {
  return withFirebaseUser(request, async (user) => {
    const body = (await request.json()) as { route?: unknown };

    if (!isRoutePayload(body.route)) {
      return Response.json({ error: "A valid lane payload is required." }, { status: 400 });
    }

    const route = body.route;
    const db = getAdminDb();
    const userRef = db.collection("users").doc(user.uid);
    const routeRef = userRef.collection("routes").doc(String(route.id));
    const result = await db.runTransaction(async (transaction) => {
      const [userSnapshot, routesSnapshot, routeSnapshot] = await Promise.all([
        transaction.get(userRef),
        transaction.get(userRef.collection("routes")),
        transaction.get(routeRef),
      ]);
      const userData = userSnapshot.data();
      const subscription = normalizeSubscription(userData?.subscription ?? userData);
      const laneCount = routesSnapshot.size;
      const createsNewLane = !routeSnapshot.exists;

      if (!subscription.isPro && createsNewLane && laneCount >= FREE_LANE_LIMIT) {
        return {
          allowed: false,
          subscription,
          laneCount,
        };
      }

      transaction.set(
        routeRef,
        {
          ...route,
          timestamp: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true },
      );
      transaction.set(
        userRef,
        {
          email: user.email ?? null,
          lastLaneSavedAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true },
      );

      return {
        allowed: true,
        subscription,
        laneCount: createsNewLane ? laneCount + 1 : laneCount,
      };
    });

    if (!result.allowed) {
      return Response.json(
        {
          error: "Free lane limit reached.",
          code: "LANE_LIMIT_REACHED",
          subscription: result.subscription,
          laneCount: result.laneCount,
          freeLaneLimit: FREE_LANE_LIMIT,
        },
        { status: 402 },
      );
    }

    return Response.json({
      ok: true,
      subscription: result.subscription,
      laneCount: result.laneCount,
      freeLaneLimit: FREE_LANE_LIMIT,
      remainingFreeLanes: result.subscription.isPro ? null : Math.max(FREE_LANE_LIMIT - result.laneCount, 0),
    });
  }).catch((error) =>
    Response.json(
      { error: error instanceof Error ? error.message : "Unable to save lane." },
      { status: 500 },
    ),
  );
}
