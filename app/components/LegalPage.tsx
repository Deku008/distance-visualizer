import Link from "next/link";

type LegalSection = {
  title: string;
  body: string[];
};

type LegalPageProps = {
  title: string;
  description: string;
  sections: LegalSection[];
};

export default function LegalPage({ title, description, sections }: LegalPageProps) {
  return (
    <main className="landing-page min-h-dvh overflow-x-hidden bg-[#081225] text-white">
      <div className="landing-aurora fixed inset-0 -z-10" />
      <header className="border-b border-white/10 bg-[#071225]/70 backdrop-blur-2xl">
        <nav className="mx-auto flex h-16 w-full max-w-[96rem] items-center justify-between px-4 sm:px-6 lg:px-8">
          <Link href="/" className="text-sm font-semibold tracking-tight">
            RouteVision
          </Link>
          <Link
            href="/app"
            className="landing-primary-button rounded-full px-4 py-2 text-sm font-semibold text-white"
          >
            Open App
          </Link>
        </nav>
      </header>

      <article className="mx-auto w-full max-w-4xl px-4 py-16 sm:px-6 lg:px-8">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-cyan-200">Legal</p>
        <h1 className="mt-4 text-4xl font-semibold tracking-tight sm:text-5xl">{title}</h1>
        <p className="mt-5 text-base leading-8 text-slate-300">{description}</p>
        <p className="mt-4 text-sm text-slate-400">Last updated: May 25, 2026</p>

        <div className="mt-10 grid gap-5">
          {sections.map((section) => (
            <section key={section.title} className="landing-panel rounded-[1.5rem] p-5 sm:p-6">
              <h2 className="text-2xl font-semibold tracking-tight">{section.title}</h2>
              <div className="mt-4 space-y-4 text-sm leading-7 text-slate-300">
                {section.body.map((paragraph) => (
                  <p key={paragraph}>{paragraph}</p>
                ))}
              </div>
            </section>
          ))}
        </div>
      </article>

      <footer className="border-t border-white/10 px-4 py-8 sm:px-6 lg:px-8">
        <div className="mx-auto flex w-full max-w-[96rem] flex-col gap-4 text-sm text-slate-400 sm:flex-row sm:items-center sm:justify-between">
          <p>RouteVision legal information for payments, subscriptions, and route planning services.</p>
          <div className="flex flex-wrap gap-4">
            <Link href="/" className="hover:text-white">Home</Link>
            <Link href="/privacy" className="hover:text-white">Privacy</Link>
            <Link href="/terms" className="hover:text-white">Terms</Link>
            <Link href="/refund" className="hover:text-white">Refunds</Link>
          </div>
        </div>
      </footer>
    </main>
  );
}
