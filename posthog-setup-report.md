<wizard-report>
# PostHog post-wizard report

The wizard has completed a deep integration of PostHog analytics into the RouteVision distance visualizer project. Here is a summary of all changes made:

**New files created:**
- `instrumentation-client.ts` — PostHog client-side initialization using the Next.js 15.3+ instrumentation hook. Enables autocapture, session replay, and exception tracking via `capture_exceptions: true`. Routes ingestion through `/ingest` reverse proxy.
- `app/lib/posthog-server.ts` — Singleton `getPostHogClient()` helper for server-side PostHog event capture using `posthog-node`.
- `app/components/GetStartedLink.tsx` — Client component wrapping landing page CTA links to fire `get_started_clicked` with a `location` property.

**Modified files:**
- `next.config.ts` — Added PostHog reverse proxy rewrites (`/ingest/*` → `us.i.posthog.com`) and `skipTrailingSlashRedirect: true`.
- `app/page.tsx` — Replaced four `<Link href="/app">` CTAs with `<GetStartedLink>` to track landing page conversions by location (nav, hero, pricing, final_cta).
- `app/components/DistanceVisualizerMap.tsx` — Added `posthog-js` import and 10 client-side event captures including user `identify` on sign-in and `posthog.reset()` on sign-out.
- `app/api/lanes/route.ts` — Added server-side `lane_saved` and `lane_limit_reached` events.
- `app/api/create-order/route.ts` — Added server-side `order_created` event with order metadata.
- `app/api/verify-payment/route.ts` — Added server-side `payment_completed` event — the most critical conversion event.
- `app/api/validate-promo/route.ts` — Added server-side `promo_redeemed` event for free Pro promo activations.
- `.env.local` — Added `NEXT_PUBLIC_POSTHOG_KEY` and `NEXT_PUBLIC_POSTHOG_HOST`.

---

## Event tracking summary

| Event | Description | File |
|---|---|---|
| `get_started_clicked` | User clicks a "Get Started" CTA on the landing page | `app/components/GetStartedLink.tsx` |
| `sign_in_clicked` | User clicks the sign-in button in the app | `app/components/DistanceVisualizerMap.tsx` |
| `sign_in_completed` | User successfully completes Google sign-in | `app/components/DistanceVisualizerMap.tsx` |
| `sign_out_clicked` | User signs out of the app | `app/components/DistanceVisualizerMap.tsx` |
| `route_added` | User adds a new route/lane to the map | `app/components/DistanceVisualizerMap.tsx` |
| `route_deleted` | User deletes a route from history | `app/components/DistanceVisualizerMap.tsx` |
| `map_exported` | User exports the map as a PNG image (Pro) | `app/components/DistanceVisualizerMap.tsx` |
| `spreadsheet_exported` | User exports routes as a CSV spreadsheet (Pro) | `app/components/DistanceVisualizerMap.tsx` |
| `upgrade_modal_opened` | User opens the RouteVision Pro upgrade modal | `app/components/DistanceVisualizerMap.tsx` |
| `promo_code_applied` | User successfully applies a promo code | `app/components/DistanceVisualizerMap.tsx` |
| `lane_saved` | Server: lane saved to Firestore | `app/api/lanes/route.ts` |
| `lane_limit_reached` | Server: free lane limit hit, save blocked | `app/api/lanes/route.ts` |
| `order_created` | Server: Razorpay order created for Pro | `app/api/create-order/route.ts` |
| `payment_completed` | Server: payment verified, Pro subscription activated | `app/api/verify-payment/route.ts` |
| `promo_redeemed` | Server: free-Pro promo code redeemed | `app/api/validate-promo/route.ts` |

## Next steps

We've built some insights and a dashboard for you to keep an eye on user behavior, based on the events we just instrumented:

- [Analytics basics dashboard](https://us.posthog.com/project/439193/dashboard/1625774)
- [Upgrade-to-payment conversion funnel](https://us.posthog.com/project/439193/insights/nmJiQGR3) — tracks how many users who open the upgrade modal go on to create an order and complete payment
- [Sign-in to first route saved funnel](https://us.posthog.com/project/439193/insights/4loe6PKY) — tracks onboarding conversion from sign-in click through to first lane saved
- [Routes saved over time](https://us.posthog.com/project/439193/insights/GTPNsKU5) — daily trend of lanes being saved, a core engagement metric
- [Payment completions over time](https://us.posthog.com/project/439193/insights/9wj95VhH) — weekly Pro subscription revenue trend
- [Lane limit reached (churn risk)](https://us.posthog.com/project/439193/insights/Y0IXeXyO) — compares users hitting the free tier limit vs those who convert to Pro, surfaces conversion gaps

### Agent skill

We've left an agent skill folder in your project. You can use this context for further agent development when using Claude Code. This will help ensure the model provides the most up-to-date approaches for integrating PostHog.

</wizard-report>
