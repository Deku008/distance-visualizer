import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import LandingMapShowcase from "@/app/components/LandingMapShowcase";
import {
  ArrowRight,
  BarChart3,
  BriefcaseBusiness,
  CheckCircle2,
  Cloud,
  Compass,
  Download,
  Factory,
  GitCompare,
  Home,
  MapPin,
  Navigation,
  Route,
} from "lucide-react";
import {
  absoluteUrl,
  featureList,
  homeDescription,
  homeTitle,
  ogImage,
  seoKeywords,
  siteName,
  siteUrl,
} from "@/app/lib/seo";

const features = [
  {
    icon: Route,
    title: "Lane visualization",
    text: "Map every active logistics lane with clear labels, colors, and route geometry built for operational scanning.",
  },
  {
    icon: Navigation,
    title: "Live route planning",
    text: "Create source-to-destination plans quickly and keep teams aligned around the route that matters now.",
  },
  {
    icon: GitCompare,
    title: "Distance and ETA comparison",
    text: "Compare travel distance, estimated time, and route tradeoffs before committing to a lane plan.",
  },
  {
    icon: Factory,
    title: "Facility planning",
    text: "Plan routes around warehouses, hubs, factories, service points, and field operations.",
  },
  {
    icon: Download,
    title: "Export support",
    text: "Export map snapshots and route spreadsheets for reporting, handoffs, and planning reviews.",
  },
  {
    icon: Cloud,
    title: "Cloud sync",
    text: "Keep saved lanes, route history, and premium status synced across devices.",
  },
];

const useCases = [
  {
    icon: BriefcaseBusiness,
    eyebrow: "Enterprise logistics",
    title: "Enterprise Logistics & Operations",
    description:
      "Logistics companies and enterprise teams can visualize delivery lanes, estimate travel times, compare distances, and optimize operational planning across multiple facilities and routes.",
    highlights: [
      "ETA estimation",
      "lane comparison",
      "facility planning",
      "operational visibility",
      "route optimization",
    ],
    tone: "enterprise",
  },
  {
    icon: Home,
    eyebrow: "Family relocation",
    title: "Family Relocation & Shifting",
    description:
      "Families planning to move can compare locations intelligently by checking how far schools, grocery stores, gyms, parks, hospitals, and daily essentials are from their new home.",
    highlights: [
      "smarter relocation decisions",
      "nearby essentials",
      "daily commute planning",
      "neighborhood comparison",
    ],
    tone: "family",
  },
  {
    icon: Compass,
    eyebrow: "Trip planning",
    title: "Trip & Outing Planning",
    description:
      "Plan outings and road trips more efficiently by organizing destinations, comparing travel times, and maximizing the number of places you can explore in a single trip.",
    highlights: [
      "smarter trip planning",
      "multi-stop optimization",
      "sightseeing organization",
      "travel efficiency",
    ],
    tone: "travel",
  },
];

const comparisonRows = [
  ["North hub to Pune", "148 km", "3h 12m", "Moderate"],
  ["Warehouse to Chennai Port", "318 km", "6h 45m", "Clear"],
  ["Plant to Jaipur DC", "265 km", "5h 28m", "Heavy"],
];

const faqs = [
  {
    question: "What is RouteVision used for?",
    answer:
      "RouteVision helps planners and logistics teams visualize lanes, compare route distances and ETAs, save route history, and coordinate map-based planning workflows.",
  },
  {
    question: "Is there a free plan?",
    answer:
      "Yes. The first 10 saved lanes are free. RouteVision Pro unlocks unlimited lanes and premium planning capabilities.",
  },
  {
    question: "Does RouteVision support exports?",
    answer:
      "Yes. Pro workflows include export support for map snapshots and route spreadsheets so plans can be shared outside the dashboard.",
  },
  {
    question: "How do I open the planner?",
    answer: "Use any Get Started button on the homepage to open the RouteVision planner at /app.",
  },
];

export const metadata: Metadata = {
  title: homeTitle,
  description: homeDescription,
  keywords: seoKeywords,
  alternates: {
    canonical: siteUrl,
  },
  openGraph: {
    title: homeTitle,
    description: homeDescription,
    url: siteUrl,
    siteName,
    type: "website",
    locale: "en_US",
    images: [ogImage],
  },
  twitter: {
    card: "summary_large_image",
    title: homeTitle,
    description: homeDescription,
    images: [ogImage.url],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1,
    },
  },
};

export default function LandingPage() {
  const organizationSchema = {
    "@context": "https://schema.org",
    "@type": "Organization",
    "@id": absoluteUrl("/#organization"),
    name: siteName,
    url: siteUrl,
    logo: absoluteUrl("/routevision-map-icon.png"),
    description: homeDescription,
  };

  const websiteSchema = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "@id": absoluteUrl("/#website"),
    name: siteName,
    url: siteUrl,
    description: homeDescription,
    publisher: {
      "@id": absoluteUrl("/#organization"),
    },
    inLanguage: "en",
  };

  const softwareSchema = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    "@id": absoluteUrl("/#software"),
    name: siteName,
    applicationCategory: "BusinessApplication",
    softwareCategory: "Route planning software",
    operatingSystem: "Web",
    url: siteUrl,
    image: ogImage.url,
    description: homeDescription,
    publisher: {
      "@id": absoluteUrl("/#organization"),
    },
    offers: [
      {
        "@type": "Offer",
        name: "Free",
        price: "0",
        priceCurrency: "INR",
        description: "Save up to 10 lanes for free.",
      },
      {
        "@type": "Offer",
        name: "RouteVision Pro",
        price: "100",
        priceCurrency: "INR",
        description: "Unlimited lanes, premium analytics, exports, and priority cloud sync.",
      },
    ],
    featureList,
  };

  const faqSchema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqs.map((faq) => ({
      "@type": "Question",
      name: faq.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: faq.answer,
      },
    })),
  };

  return (
    <main className="landing-page min-h-dvh overflow-x-hidden bg-[#081225] text-white">
      <script
        type="application/ld+json"
        suppressHydrationWarning
        dangerouslySetInnerHTML={{
          __html: JSON.stringify([organizationSchema, websiteSchema, softwareSchema, faqSchema]),
        }}
      />
      <div className="landing-aurora fixed inset-0 -z-10" />
      <div className="landing-grid fixed inset-0 -z-10 opacity-35" />
      <div className="landing-light-sweep fixed inset-x-0 top-0 -z-10 h-[44rem]" />

      <header className="sticky top-0 z-50 border-b border-white/10 bg-[#071225]/70 backdrop-blur-2xl">
        <nav className="mx-auto flex h-16 w-full max-w-[96rem] items-center justify-between px-4 sm:px-6 lg:px-8">
          <Link href="/" className="flex items-center gap-2 text-sm font-semibold tracking-tight">
            <span className="grid size-10 place-items-center">
              <Image
                src="/routevision-map-icon.png"
                alt=""
                width={40}
                height={40}
                className="size-full object-contain"
                priority
              />
            </span>
            <span>RouteVision</span>
          </Link>
          <div className="hidden items-center gap-8 text-sm font-medium text-slate-300 md:flex">
            <a href="#features" className="transition hover:text-white">Features</a>
            <a href="#pricing" className="transition hover:text-white">Pricing</a>
            <a href="#faq" className="transition hover:text-white">FAQ</a>
          </div>
          <Link
            href="/app"
            className="landing-primary-button rounded-full px-4 py-2 text-sm font-semibold text-white transition hover:-translate-y-0.5"
          >
            Get Started
          </Link>
        </nav>
      </header>

      <section className="landing-hero relative mx-auto flex min-h-[calc(100dvh-4rem)] w-full max-w-[96rem] flex-col px-4 pb-12 pt-0 text-left sm:px-6 sm:pb-16 lg:px-8 lg:pb-20">
        <div className="landing-hero-preview relative aspect-[3/2] overflow-hidden">
          <Image
            src="/routevision-platform-preview.png"
            alt="RouteVision intelligent route planning platform preview"
            fill
            priority
            className="object-contain object-center"
            sizes="100vw"
          />
        </div>

        <div className="max-w-4xl 2xl:max-w-5xl">
          <h1 className="mt-8 max-w-4xl text-5xl font-semibold leading-[0.95] tracking-tight text-white sm:text-6xl lg:text-7xl 2xl:max-w-5xl 2xl:text-8xl">
            <span className="landing-title-gradient">Visualize</span> Routes. Plan <span className="landing-title-gradient-alt">Smarter.</span>
          </h1>
          <p className="mt-6 max-w-2xl text-lg font-medium leading-8 text-slate-300 sm:text-xl 2xl:max-w-3xl">
            RouteVision helps logistics teams, relocation planners, and travelers visualize route planning decisions, compare distances and ETAs, and understand nearby facilities with an intelligent interactive map experience.
          </p>
        </div>

        <div className="mt-7 flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
          <Link
            href="/app"
            className="landing-primary-button inline-flex h-12 w-full items-center justify-center gap-2 rounded-full px-6 text-sm font-semibold text-white transition hover:-translate-y-0.5 sm:w-auto"
          >
            Get Started
            <ArrowRight className="size-4" />
          </Link>
          <a
            href="#features"
            className="landing-secondary-button inline-flex h-12 w-full items-center justify-center gap-2 rounded-full px-6 text-sm font-semibold text-slate-100 transition hover:-translate-y-0.5 sm:w-auto"
          >
            View Features
          </a>
        </div>
        <div className="mt-10 grid w-full max-w-xl grid-cols-1 gap-3 text-center text-sm sm:grid-cols-3 2xl:max-w-2xl">
          {["10 free lanes", "Cloud synced", "Pro exports"].map((item) => (
            <div key={item} className="landing-mini-card rounded-2xl px-3 py-3 text-slate-100">
              {item}
            </div>
          ))}
        </div>

        <div className="landing-float relative mt-10 w-full max-w-xl 2xl:max-w-2xl">
          <div className="landing-product-shell overflow-hidden rounded-[1.5rem] p-2 sm:rounded-[2rem] sm:p-3">
            <div className="rounded-[1.15rem] border border-white/12 bg-[#071225]/82 p-3 text-left shadow-2xl shadow-cyan-950/40 sm:rounded-[1.5rem] sm:p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-200">Live planner</p>
                  <p className="mt-1 text-xl font-semibold">Lane network</p>
                </div>
                <span className="rounded-full border border-emerald-300/30 bg-emerald-400/15 px-3 py-1.5 text-xs font-semibold text-emerald-200 shadow-lg shadow-emerald-500/10">
                  Optimizing
                </span>
              </div>
              <LandingMapShowcase />
            </div>
          </div>
        </div>
      </section>

      <section id="features" className="landing-section landing-section-cyan mx-auto w-full max-w-[96rem] px-4 py-24 sm:px-6 lg:px-8">
        <div className="max-w-3xl">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-cyan-200">Feature showcase</p>
          <h2 className="mt-3 text-4xl font-semibold tracking-tight sm:text-5xl">Everything needed to plan route lanes with clarity.</h2>
          <p className="mt-5 text-base leading-8 text-slate-300">
            Use RouteVision as a smart route visualization platform for logistics planning, lane planning, distance calculator workflows, ETA planning, facility planning, and route intelligence.
          </p>
        </div>
        <div className="mt-10 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {features.map((feature, index) => {
            const Icon = feature.icon;
            return (
              <article
                key={feature.title}
                className="landing-feature-card landing-reveal rounded-[1.5rem] p-5 transition hover:-translate-y-1"
                style={{ animationDelay: `${index * 70}ms` }}
              >
                <span className="landing-icon-tile grid size-11 place-items-center rounded-2xl text-cyan-100">
                  <Icon className="size-5" />
                </span>
                <h3 className="mt-5 text-lg font-semibold">{feature.title}</h3>
                <p className="mt-2 text-sm leading-6 text-slate-300">{feature.text}</p>
              </article>
            );
          })}
        </div>
      </section>

      <section className="landing-section landing-section-usecases mx-auto w-full max-w-[96rem] px-4 py-24 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-4xl text-center">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-pink-200">Who is RouteVision for?</p>
          <h2 className="mt-3 text-4xl font-semibold tracking-tight sm:text-5xl">Built for Real-World Planning</h2>
          <p className="mx-auto mt-5 max-w-3xl text-base leading-8 text-slate-300 sm:text-lg">
            From enterprise logistics route optimization to family relocation planning and trip route planning, RouteVision helps people make smarter location and route decisions.
          </p>
        </div>

        <div className="mt-12 grid gap-5 lg:grid-cols-3">
          {useCases.map((useCase) => {
            const Icon = useCase.icon;

            return (
              <article
                key={useCase.title}
                className={`landing-usecase-card landing-usecase-${useCase.tone} rounded-[2rem] p-5 transition duration-300 hover:-translate-y-1 sm:p-6`}
              >
                <span className="landing-icon-tile grid size-12 place-items-center rounded-2xl text-cyan-100">
                  <Icon className="size-5" />
                </span>
                <p className="mt-5 inline-flex items-center rounded-full border border-white/15 bg-white/[0.08] px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.18em] text-cyan-100">
                  {useCase.eyebrow}
                </p>
                <h3 className="mt-5 text-2xl font-semibold tracking-tight text-white">
                  {useCase.title}
                </h3>
                <p className="mt-4 text-sm leading-7 text-slate-300">
                  {useCase.description}
                </p>
                <div className="mt-6 flex flex-wrap gap-2">
                  {useCase.highlights.map((highlight) => (
                    <span
                      key={highlight}
                      className="rounded-full border border-white/12 bg-white/[0.08] px-3 py-1.5 text-xs font-semibold text-slate-100 shadow-lg shadow-slate-950/10"
                    >
                      {highlight}
                    </span>
                  ))}
                </div>
              </article>
            );
          })}
        </div>
      </section>

      <section className="landing-section landing-section-purple mx-auto grid w-full max-w-[96rem] gap-6 px-4 py-20 sm:px-6 lg:grid-cols-2 lg:px-8">
        <div className="landing-panel rounded-[2rem] p-6">
          <p className="flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.18em] text-cyan-200">
            <GitCompare className="size-4" />
            Route comparison
          </p>
          <h2 className="mt-4 text-3xl font-semibold tracking-tight sm:text-4xl">Compare lanes before the team commits.</h2>
          <p className="mt-4 text-sm leading-7 text-slate-300">
            Review multiple route options side-by-side with distance comparison, ETA comparison, and traffic signals that make planning conversations faster and more precise.
          </p>
          <div className="mt-6 overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03]">
            {comparisonRows.map(([lane, distance, eta, traffic]) => (
              <div key={lane} className="grid grid-cols-[1.4fr_0.7fr_0.7fr_0.8fr] gap-2 border-b border-white/10 px-4 py-3 text-xs last:border-b-0 sm:text-sm">
                <span className="font-semibold text-white">{lane}</span>
                <span className="text-slate-300">{distance}</span>
                <span className="text-slate-300">{eta}</span>
                <span className="text-cyan-200">{traffic}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="grid gap-6">
          <div className="landing-panel landing-panel-emerald rounded-[2rem] p-6">
            <p className="flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.18em] text-emerald-200">
              <MapPin className="size-4" />
              Smart lane planning
            </p>
            <h2 className="mt-4 text-3xl font-semibold tracking-tight">Build route infrastructure around real operations.</h2>
            <p className="mt-4 text-sm leading-7 text-slate-300">
              Plan around hubs, facilities, service regions, and operational lanes while keeping the interface focused on map interaction.
            </p>
          </div>
          <div className="landing-panel landing-panel-violet rounded-[2rem] p-6">
            <p className="flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.18em] text-violet-200">
              <BarChart3 className="size-4" />
              Analytics and insights
            </p>
            <h2 className="mt-4 text-3xl font-semibold tracking-tight">Turn saved lanes into planning intelligence.</h2>
            <p className="mt-4 text-sm leading-7 text-slate-300">
              Premium logistics analytics help teams understand route distance, ETA planning, fastest lanes, shortest lanes, and active planning coverage.
            </p>
          </div>
        </div>
      </section>

      <section className="landing-section landing-section-premium mx-auto w-full max-w-[96rem] px-4 py-20 sm:px-6 lg:px-8">
        <div className="grid gap-6 lg:grid-cols-[0.85fr_1.15fr]">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-cyan-200">Premium features</p>
            <h2 className="mt-3 text-4xl font-semibold tracking-tight sm:text-5xl">Scale beyond the first 10 lanes.</h2>
            <p className="mt-5 text-base leading-8 text-slate-300">
              RouteVision Pro gives growing teams unlimited lane storage, analytics, exports, and priority cloud sync.
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            {["Unlimited lanes", "Advanced analytics", "Exports", "Priority cloud sync"].map((benefit) => (
              <div key={benefit} className="landing-premium-card rounded-[1.5rem] p-5">
                <CheckCircle2 className="size-5 text-emerald-200" />
                <p className="mt-4 text-lg font-semibold">{benefit}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="pricing" className="landing-section landing-section-pricing mx-auto w-full max-w-[96rem] px-4 py-20 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-3xl text-center">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-cyan-200">Pricing</p>
          <h2 className="mt-3 text-4xl font-semibold tracking-tight sm:text-5xl">Start free. Upgrade when your lane network grows.</h2>
        </div>
        <div className="mx-auto mt-10 grid max-w-5xl gap-5 md:grid-cols-2">
          <article className="landing-panel rounded-[2rem] p-6">
            <p className="text-sm font-semibold text-slate-300">Free</p>
            <p className="mt-4 text-4xl font-semibold">₹0</p>
            <p className="mt-3 text-sm text-slate-300">For first planning workflows and small route networks.</p>
            <ul className="mt-6 space-y-3 text-sm text-slate-200">
              {["10 saved lanes", "Route visualization", "Distance and ETA review"].map((item) => (
                <li key={item} className="flex gap-2"><CheckCircle2 className="size-4 text-cyan-200" />{item}</li>
              ))}
            </ul>
          </article>
          <article className="landing-premium-card rounded-[2rem] p-6">
            <p className="text-sm font-semibold text-emerald-200">Pro</p>
            <p className="mt-4 text-4xl font-semibold">₹100<span className="text-base text-slate-300">/month</span></p>
            <p className="mt-3 text-sm text-slate-300">For planners who need unlimited saved lanes and reporting support.</p>
            <ul className="mt-6 space-y-3 text-sm text-slate-200">
              {["Unlimited lanes", "Premium analytics", "Exports", "Priority cloud sync"].map((item) => (
                <li key={item} className="flex gap-2"><CheckCircle2 className="size-4 text-emerald-200" />{item}</li>
              ))}
            </ul>
            <Link href="/app" className="landing-primary-button mt-7 inline-flex h-12 w-full items-center justify-center rounded-full text-sm font-semibold text-white">
              Open RouteVision
            </Link>
          </article>
        </div>
      </section>

      <section id="faq" className="landing-section landing-section-faq mx-auto w-full max-w-4xl px-4 py-20 sm:px-6 lg:px-8">
        <p className="text-center text-sm font-semibold uppercase tracking-[0.2em] text-cyan-200">FAQ</p>
        <h2 className="mt-3 text-center text-4xl font-semibold tracking-tight sm:text-5xl">Questions planners ask first.</h2>
        <div className="mt-10 grid gap-4">
          {faqs.map((faq) => (
            <article key={faq.question} className="landing-panel rounded-[1.5rem] p-5">
              <h3 className="text-lg font-semibold">{faq.question}</h3>
              <p className="mt-2 text-sm leading-7 text-slate-300">{faq.answer}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="mx-auto w-full max-w-[96rem] px-4 py-20 sm:px-6 lg:px-8">
        <div className="landing-final-cta overflow-hidden rounded-[2rem] p-8 text-center sm:p-12">
          <div className="mx-auto grid size-16 place-items-center">
            <Image
              src="/routevision-map-icon.png"
              alt=""
              width={64}
              height={64}
              className="size-full object-contain"
            />
          </div>
          <h2 className="mx-auto mt-6 max-w-3xl text-4xl font-semibold tracking-tight sm:text-5xl">Bring route planning out of spreadsheets and into an intelligent map.</h2>
          <p className="mx-auto mt-5 max-w-2xl text-base leading-8 text-slate-300">
            Open RouteVision, create your first lane, and start comparing the route decisions that shape daily operations.
          </p>
          <Link href="/app" className="landing-primary-button mt-8 inline-flex h-12 items-center justify-center gap-2 rounded-full px-7 text-sm font-semibold text-white">
            Get Started
            <ArrowRight className="size-4" />
          </Link>
        </div>
      </section>

      <footer className="border-t border-white/10 px-4 py-10 sm:px-6 lg:px-8">
        <div className="mx-auto flex w-full max-w-[96rem] flex-col gap-4 text-sm text-slate-400 sm:flex-row sm:items-center sm:justify-between">
          <p>RouteVision. Smart route and lane planning for modern teams.</p>
          <div className="flex flex-wrap gap-4">
            <a href="#features" className="hover:text-white">Features</a>
            <a href="#pricing" className="hover:text-white">Pricing</a>
            <Link href="/app" className="hover:text-white">App</Link>
            <Link href="/privacy" className="hover:text-white">Privacy</Link>
            <Link href="/terms" className="hover:text-white">Terms</Link>
            <Link href="/refund" className="hover:text-white">Refunds</Link>
          </div>
        </div>
      </footer>
    </main>
  );
}
