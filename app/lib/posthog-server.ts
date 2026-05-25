import { PostHog } from "posthog-node";

let posthogClient: PostHog | null = null;

export function getPostHogClient() {
  const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;

  if (!key) {
    return null;
  }

  if (!posthogClient) {
    posthogClient = new PostHog(key, {
      host: process.env.NEXT_PUBLIC_POSTHOG_HOST,
      flushAt: 1,
      flushInterval: 0,
    });
  }
  return posthogClient;
}

type ServerAnalyticsProperties = Record<string, string | number | boolean | null | undefined>;

export function captureServerEvent(
  distinctId: string,
  event: string,
  properties: ServerAnalyticsProperties = {},
) {
  const client = getPostHogClient();

  if (!client) {
    if (process.env.NODE_ENV === "development") {
      console.info("[Analytics] NEXT_PUBLIC_POSTHOG_KEY is not configured. Skipping server event.", {
        event,
      });
    }

    return;
  }

  client.capture({
    distinctId,
    event,
    properties,
  });
}
