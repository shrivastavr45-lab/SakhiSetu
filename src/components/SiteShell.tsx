import { Link } from "@tanstack/react-router";
import { Home, Search, Sparkles, HeartHandshake, UserRound } from "lucide-react";
import type { ReactNode } from "react";
import { useLang } from "@/lib/i18n";

const NAV = [
  { to: "/", icon: Home, label: { hi: "मुख्य", en: "Home" } },
  { to: "/finder", icon: Sparkles, label: { hi: "योजना खोजें", en: "Find schemes" } },
  { to: "/schemes", icon: Search, label: { hi: "सभी योजनाएँ", en: "All schemes" } },
  { to: "/donate", icon: HeartHandshake, label: { hi: "दान करें", en: "Donate" } },
  { to: "/account", icon: UserRound, label: { hi: "खाता", en: "Account" } },
] as const;

export function SiteShell({ children }: { children: ReactNode }) {
  const { lang, setLang, t } = useLang();
  return (
    <div className="min-h-screen flex flex-col pb-20 md:pb-0">
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:p-3 focus:bg-card">
        {t({ hi: "सामग्री पर जाएँ", en: "Skip to content" })}
      </a>
      <div className="weave-strip" aria-hidden />
      <header className="sticky top-0 z-30 bg-background/95 backdrop-blur border-b">
        <div className="mx-auto max-w-6xl px-4 h-16 flex items-center gap-4">
          <Link to="/" className="flex items-center gap-2" aria-label="SakhiSetu home">
            <span className="grid place-items-center size-10 rounded-full bg-primary text-primary-foreground font-display text-xl">स</span>
            <span className="leading-tight">
              <span className="block font-display text-xl">सखीसेतु</span>
              <span className="block text-xs text-muted-foreground -mt-0.5">SakhiSetu</span>
            </span>
          </Link>
          <nav className="hidden md:flex items-center gap-1 ml-6" aria-label="Main">
            {NAV.map((n) => (
              <Link
                key={n.to}
                to={n.to}
                activeOptions={{ exact: n.to === "/" }}
                className="px-3 py-2 rounded-full font-medium hover:bg-muted"
                activeProps={{ className: "bg-muted text-primary" }}
              >
                {t(n.label)}
              </Link>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-2">
            <div role="group" aria-label="Language" className="flex rounded-full border bg-card p-1">
              {(["hi", "en"] as const).map((l) => (
                <button
                  key={l}
                  onClick={() => setLang(l)}
                  aria-pressed={lang === l}
                  className={`px-3 h-9 rounded-full text-sm font-semibold ${lang === l ? "bg-ink text-ink-foreground" : "text-muted-foreground"}`}
                >
                  {l === "hi" ? "हिंदी" : "English"}
                </button>
              ))}
            </div>
          </div>
        </div>
      </header>

      <main id="main" className="flex-1">{children}</main>

      <footer className="bg-ink text-ink-foreground mt-16">
        <div className="mx-auto max-w-6xl px-4 py-10 grid gap-8 md:grid-cols-3">
          <div>
            <p className="font-display text-2xl">सखीसेतु</p>
            <p className="opacity-80 mt-2 text-sm">
              {t({ hi: "भोपाल, मध्य प्रदेश में महिलाओं की आजीविका और स्वास्थ्य पर काम करने वाला पंजीकृत धर्मार्थ ट्रस्ट।", en: "A registered charitable trust working on women's livelihoods and health in Bhopal, Madhya Pradesh." })}
            </p>
          </div>
          <div className="text-sm space-y-2">
            <p className="font-semibold">{t({ hi: "योजना की जानकारी चाहिए?", en: "Need help with a scheme?" })}</p>
            <Link to="/finder" className="underline text-turmeric">{t({ hi: "योजना खोजक खोलें", en: "Open the scheme finder" })}</Link>
            <p className="opacity-80">{t({ hi: "सहायता केंद्रों के संपर्क विवरण इस डेमो डेटा में उपलब्ध नहीं हैं।", en: "Help-centre contact details are not included in this demo data." })}</p>
          </div>
          <div className="text-sm flex flex-col gap-1">
            <Link to="/admin" className="underline opacity-80">{t({ hi: "ट्रस्ट प्रशासन", en: "Trust admin" })}</Link>
            <span className="opacity-60">{t({ hi: "यह एक डेमो प्रीव्यू है — भुगतान असली नहीं हैं।", en: "Demo preview — payments are not real." })}</span>
          </div>
        </div>
      </footer>

      {/* Mobile bottom nav — big targets with icon + label */}
      <nav aria-label="Main mobile" className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-card border-t grid grid-cols-5">
        {NAV.map((n) => (
          <Link
            key={n.to}
            to={n.to}
            activeOptions={{ exact: n.to === "/" }}
            className="flex flex-col items-center justify-center gap-0.5 py-2 text-xs font-medium text-muted-foreground min-h-16"
            activeProps={{ className: "text-primary" }}
          >
            <n.icon className="size-6" aria-hidden />
            {t(n.label)}
          </Link>
        ))}
      </nav>
    </div>
  );
}
