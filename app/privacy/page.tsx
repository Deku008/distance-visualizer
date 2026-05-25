import type { Metadata } from "next";
import LegalPage from "@/app/components/LegalPage";
import { absoluteUrl, ogImage, siteName } from "@/app/lib/seo";

const title = "Privacy Policy";
const description =
  "Learn how RouteVision collects, uses, and protects account, route planning, subscription, and payment-related information.";

export const metadata: Metadata = {
  title,
  description,
  alternates: {
    canonical: absoluteUrl("/privacy"),
  },
  openGraph: {
    title: `${title} | ${siteName}`,
    description,
    url: absoluteUrl("/privacy"),
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
    title: "Information We Collect",
    body: [
      "RouteVision may collect account information such as your name, email address, authentication profile, saved lane data, route locations, distances, ETAs, subscription status, and usage activity needed to provide the route planning service.",
      "When you upgrade to RouteVision Pro, payment details are processed by our payment provider. RouteVision does not store full card, UPI, or netbanking credentials on its own servers.",
    ],
  },
  {
    title: "How We Use Information",
    body: [
      "We use information to provide route planning, lane visualization, distance comparison, ETA planning, cloud sync, premium access, billing verification, fraud prevention, support, and service improvement.",
      "Route and facility information may be used to display saved lanes across your devices and keep subscription limits synchronized with your account.",
    ],
  },
  {
    title: "Authentication, Storage, and Payments",
    body: [
      "RouteVision uses Firebase services for authentication, account sessions, and Firestore data storage. Subscription and payment events may be verified server-side before premium access is activated.",
      "Payments are handled through Razorpay or other supported payment providers. Their policies may also apply when you complete a payment or manage billing.",
    ],
  },
  {
    title: "Data Sharing",
    body: [
      "We do not sell your personal information. We may share limited information with infrastructure, authentication, analytics, hosting, or payment providers only as needed to operate RouteVision and comply with legal or security requirements.",
      "We may disclose information if required by law, to prevent abuse, or to protect RouteVision, users, and the service.",
    ],
  },
  {
    title: "Security and Retention",
    body: [
      "We use reasonable technical and organizational measures to protect account and route planning data. No online system can be guaranteed to be completely secure.",
      "We retain information while your account is active or as needed for billing, legal, security, and operational purposes.",
    ],
  },
  {
    title: "Your Choices",
    body: [
      "You may manage your account, sign out, cancel subscriptions where supported, or request assistance with account data. Some information may be retained where required for billing, fraud prevention, or legal compliance.",
    ],
  },
];

export default function PrivacyPolicyPage() {
  return <LegalPage title={title} description={description} sections={sections} />;
}
