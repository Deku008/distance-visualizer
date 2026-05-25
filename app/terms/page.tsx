import type { Metadata } from "next";
import LegalPage from "@/app/components/LegalPage";
import { absoluteUrl, ogImage, siteName } from "@/app/lib/seo";

const title = "Terms of Service";
const description =
  "Review the terms for using RouteVision route planning, saved lanes, subscriptions, premium features, and payment-based access.";

export const metadata: Metadata = {
  title,
  description,
  alternates: {
    canonical: absoluteUrl("/terms"),
  },
  openGraph: {
    title: `${title} | ${siteName}`,
    description,
    url: absoluteUrl("/terms"),
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
    title: "Using RouteVision",
    body: [
      "RouteVision provides route planning, lane visualization, distance comparison, ETA planning, facility planning, analytics, exports, and cloud sync features for personal, travel, relocation, and logistics planning workflows.",
      "You are responsible for the accuracy of information you enter and for how you use route planning outputs in real-world decisions.",
    ],
  },
  {
    title: "Accounts and Access",
    body: [
      "Some features require authentication. You are responsible for maintaining access to your account and for activity that occurs through your account.",
      "We may restrict or suspend access if we detect abuse, security risks, payment issues, or activity that harms RouteVision or other users.",
    ],
  },
  {
    title: "Free and Pro Plans",
    body: [
      "The free plan allows up to 10 saved lanes. RouteVision Pro unlocks unlimited lanes and premium features such as advanced analytics, exports, and priority cloud sync.",
      "Pro pricing is shown in the product before checkout. Subscription-style access is activated only after successful payment verification or a valid approved promotion.",
    ],
  },
  {
    title: "Payments and Billing",
    body: [
      "Payments may be processed through Razorpay or another supported payment provider. By purchasing RouteVision Pro, you authorize the applicable payment provider to process the selected payment method.",
      "Billing availability, supported payment methods, and payment confirmations may depend on the payment provider and your location.",
    ],
  },
  {
    title: "Route Data and Accuracy",
    body: [
      "RouteVision may use third-party maps, location services, directions, and infrastructure data. Distances, ETAs, facility details, and route conditions are estimates and may change.",
      "RouteVision is a planning tool and should not be used as the sole basis for safety-critical, emergency, legal, or high-risk operational decisions.",
    ],
  },
  {
    title: "Acceptable Use",
    body: [
      "You agree not to misuse RouteVision, attempt to bypass subscription limits, interfere with APIs, scrape the service at scale, reverse engineer protected functionality, or use the service for unlawful activity.",
    ],
  },
  {
    title: "Changes to Service or Terms",
    body: [
      "We may update RouteVision features, pricing, policies, or these terms as the product evolves. Continued use after changes means you accept the updated terms.",
    ],
  },
];

export default function TermsPage() {
  return <LegalPage title={title} description={description} sections={sections} />;
}
