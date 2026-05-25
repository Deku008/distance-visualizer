"use client";

import posthog from "posthog-js";

type AnalyticsProperties = Record<string, string | number | boolean | null | undefined>;

type AnalyticsEvent =
  | "homepage_visit"
  | "get_started_clicked"
  | "google_signin_started"
  | "google_signin_success"
  | "lane_created"
  | "lane_saved"
  | "upgrade_popup_opened"
  | "payment_started"
  | "payment_success"
  | "premium_activated"
  | "promo_applied"
  | "logout";

type AnalyticsUser = {
  uid: string;
  email?: string | null;
  name?: string | null;
};

let initialized = false;
const capturedOnce = new Set<string>();

function isDevelopment() {
  return process.env.NODE_ENV === "development";
}

function getPostHog() {
  if (typeof window === "undefined") {
    return null;
  }

  const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;

  if (!key) {
    if (isDevelopment()) {
      console.info("[Analytics] NEXT_PUBLIC_POSTHOG_KEY is not configured. Skipping PostHog event.");
    }

    return null;
  }

  if (!initialized) {
    posthog.init(key, {
      api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST || "https://us.i.posthog.com",
      capture_pageview: false,
      loaded: () => {
        if (isDevelopment()) {
          console.info("[Analytics] PostHog initialized");
        }
      },
    });
    initialized = true;
  }

  return posthog;
}

export function trackEvent(event: AnalyticsEvent, properties: AnalyticsProperties = {}) {
  const client = getPostHog();

  if (isDevelopment()) {
    console.info("[Analytics]", event, properties);
  }

  client?.capture(event, properties);
}

export function trackEventOnce(event: AnalyticsEvent, key = event, properties: AnalyticsProperties = {}) {
  if (capturedOnce.has(key)) {
    return;
  }

  capturedOnce.add(key);
  trackEvent(event, properties);
}

export function identifyUser(user: AnalyticsUser) {
  const client = getPostHog();

  if (!client) {
    return;
  }

  client.identify(user.uid, {
    email: user.email ?? undefined,
    name: user.name ?? undefined,
  });

  if (isDevelopment()) {
    console.info("[Analytics] Identified user", {
      uid: user.uid,
      hasEmail: Boolean(user.email),
      hasName: Boolean(user.name),
    });
  }
}

export function resetAnalytics() {
  getPostHog()?.reset();
}
