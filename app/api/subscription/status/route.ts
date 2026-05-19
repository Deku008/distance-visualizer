import { FieldValue } from "firebase-admin/firestore";
import { ApiAuthError, getAdminDb, requireFirebaseUser } from "@/app/lib/firebaseAdmin";
import { FREE_LANE_LIMIT, FREE_SUBSCRIPTION, normalizeSubscription } from "@/app/lib/subscription";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ErrorDetails = {
  message: string;
  name?: string;
  stack?: string;
  code?: string;
};

function serializeError(error: unknown): ErrorDetails {
  if (error instanceof Error) {
    return {
      message: error.message,
      name: error.name,
      stack: error.stack,
      code:
        "code" in error && typeof (error as { code?: unknown }).code === "string"
          ? (error as { code: string }).code
          : undefined,
    };
  }

  return {
    message: typeof error === "string" ? error : "Unknown error.",
  };
}

function subscriptionResponse({
  laneCount,
  subscription,
  warning,
}: {
  laneCount: number;
  subscription: ReturnType<typeof normalizeSubscription>;
  warning?: string;
}) {
  return Response.json({
    subscription,
    laneCount,
    freeLaneLimit: FREE_LANE_LIMIT,
    remainingFreeLanes: subscription.isPro ? null : Math.max(FREE_LANE_LIMIT - laneCount, 0),
    warning,
  });
}

export async function GET(request: Request) {
  const path = new URL(request.url).pathname;

  try {
    const user = await requireFirebaseUser(request);

    if (!user?.uid || typeof user.uid !== "string") {
      console.warn("[Subscription Status] Missing Firebase user after token verification", {
        path,
        hasUser: Boolean(user),
      });

      return Response.json(
        {
          error: "Authenticated Firebase user is missing.",
          code: "AUTH_USER_MISSING",
          subscription: FREE_SUBSCRIPTION,
          laneCount: 0,
          freeLaneLimit: FREE_LANE_LIMIT,
          remainingFreeLanes: FREE_LANE_LIMIT,
        },
        { status: 401 },
      );
    }

    try {
      const db = getAdminDb();
      const userRef = db.collection("users").doc(user.uid);
      const [userSnapshot, routesSnapshot] = await Promise.allSettled([
        userRef.get(),
        userRef.collection("routes").count().get(),
      ]);

      if (userSnapshot.status === "rejected") {
        console.error("[Subscription Status] Failed to load Firestore user document", {
          path,
          uid: user.uid,
          error: serializeError(userSnapshot.reason),
        });
      }

      if (routesSnapshot.status === "rejected") {
        console.error("[Subscription Status] Failed to count saved lanes", {
          path,
          uid: user.uid,
          error: serializeError(routesSnapshot.reason),
        });
      }

      const userDoc = userSnapshot.status === "fulfilled" ? userSnapshot.value : undefined;
      const userData = userDoc?.exists ? userDoc.data() : undefined;
      const rawSubscription =
        userData && typeof userData === "object" && "subscription" in userData
          ? userData.subscription
          : userData;
      const subscription = normalizeSubscription(rawSubscription);
      const rawLaneCount = routesSnapshot.status === "fulfilled" ? routesSnapshot.value.data().count : 0;
      const laneCount = Number.isFinite(rawLaneCount) ? Math.max(Number(rawLaneCount), 0) : 0;

      if (!userDoc?.exists && userSnapshot.status === "fulfilled") {
        try {
          await userRef.set(
            {
              email: user.email ?? null,
              subscription,
              createdAt: FieldValue.serverTimestamp(),
              updatedAt: FieldValue.serverTimestamp(),
            },
            { merge: true },
          );
        } catch (error) {
          console.error("[Subscription Status] Failed to initialize missing user document", {
            path,
            uid: user.uid,
            error: serializeError(error),
          });
        }
      }

      if (userSnapshot.status === "rejected" && routesSnapshot.status === "rejected") {
        return subscriptionResponse({
          laneCount: 0,
          subscription: FREE_SUBSCRIPTION,
          warning: "Subscription status is temporarily using a fallback.",
        });
      }

      return subscriptionResponse({ laneCount, subscription });
    } catch (error) {
      console.error("[Subscription Status] Unhandled subscription status error", {
        path,
        uid: user.uid,
        error: serializeError(error),
      });

      return subscriptionResponse({
        laneCount: 0,
        subscription: FREE_SUBSCRIPTION,
        warning: "Subscription status is temporarily unavailable.",
      });
    }
  } catch (error) {
    if (error instanceof ApiAuthError) {
      console.warn("[Subscription Status] Unauthenticated subscription status request", {
        path,
        code: error.code,
        message: error.message,
      });

      return Response.json(
        {
          error: error.message,
          code: error.code,
          subscription: FREE_SUBSCRIPTION,
          laneCount: 0,
          freeLaneLimit: FREE_LANE_LIMIT,
          remainingFreeLanes: FREE_LANE_LIMIT,
        },
        { status: error.status },
      );
    }

    console.error("[Subscription Status] Request failed before subscription lookup", {
      path,
      error: serializeError(error),
    });

    return Response.json(
      {
        error: "Unable to load subscription.",
        code: "SUBSCRIPTION_STATUS_ERROR",
        details: error instanceof Error ? error.message : "Unknown error.",
        subscription: FREE_SUBSCRIPTION,
        laneCount: 0,
        freeLaneLimit: FREE_LANE_LIMIT,
        remainingFreeLanes: FREE_LANE_LIMIT,
      },
      { status: 500 },
    );
  }
}
