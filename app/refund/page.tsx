import type { Metadata } from "next";
import LegalPage from "@/app/components/LegalPage";
import { absoluteUrl, ogImage, siteName } from "@/app/lib/seo";

const title = "Refund Policy";
const description =
  "Understand RouteVision refund, cancellation, duplicate payment, failed payment, and subscription access policies.";

export const metadata: Metadata = {
  title,
  description,
  alternates: {
    canonical: absoluteUrl("/refund"),
  },
  openGraph: {
    title: `${title} | ${siteName}`,
    description,
    url: absoluteUrl("/refund"),
    siteName,
    type: "website",
    images: [ogImage],
  },
  twitter: {
    card: "summary_large_image",
    title: `${title} | ${siteName}`,
    description,
    images: [ogImage.url],
  },
};

const sections = [
  {
    title: "General Refund Approach",
    body: [
      "RouteVision Pro is a digital subscription-style upgrade that unlocks premium route planning features after payment verification. Because access is delivered digitally, completed payments are generally non-refundable except as described in this policy or where required by law.",
    ],
  },
  {
    title: "Duplicate or Incorrect Charges",
    body: [
      "If you believe you were charged more than once for the same RouteVision Pro access period, contact support with the payment date, amount, and payment reference. Verified duplicate charges may be refunded or adjusted.",
      "If a payment succeeds but premium access does not activate, we will first try to restore premium access. If access cannot be restored after verification, a refund or equivalent remedy may be provided.",
    ],
  },
  {
    title: "Failed, Pending, or Cancelled Payments",
    body: [
      "If a payment fails, remains pending, or is cancelled before completion, RouteVision Pro access will not be activated. Any temporary bank holds are usually released by the payment provider or bank according to their timelines.",
    ],
  },
  {
    title: "Cancellation",
    body: [
      "You may stop using RouteVision Pro or manage cancellation where billing management is available. Cancellation prevents future access renewal where recurring billing is active, but it does not automatically refund prior completed payments.",
    ],
  },
  {
    title: "Promotions and Free Pro Access",
    body: [
      "Promo codes that grant free Pro access do not create cash value and cannot be exchanged for money. Discounted payments are evaluated based on the final amount actually paid.",
    ],
  },
  {
    title: "Refund Review",
    body: [
      "Refund requests are reviewed case by case. We may decline requests involving misuse, attempts to bypass limits, completed digital access, or requests outside reasonable billing review windows.",
    ],
  },
];

export default function RefundPolicyPage() {
  return <LegalPage title={title} description={description} sections={sections} />;
}
