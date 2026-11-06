import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Sparkles, HeartHandshake } from "lucide-react";
import { NEEDS, STATS, inr, type Campaign, type Scheme } from "@/lib/data";
import { getCampaigns, getHomepageBanner, getSchemes } from "@/lib/api";
import { useLang } from "@/lib/i18n";
import { SchemeCard } from "@/components/SchemeCard";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "सखीसेतु — महिलाओं के लिए योजनाएँ | SakhiSetu" },
      { name: "description", content: "Find government welfare schemes for women in Madhya Pradesh, and support women's livelihoods across 9 districts." },
      { property: "og:title", content: "SakhiSetu — a bridge to every scheme" },
      { property: "og:description", content: "Welfare scheme finder and donations for women in Madhya Pradesh." },
    ],
  }),
  component: Index,
});

function Index() {
  const { t } = useLang();
  const [schemes, setSchemes] = useState<Scheme[]>([]);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [banner, setBanner] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    Promise.all([getSchemes(), getCampaigns(), getHomepageBanner()])
      .then(([schemeRows, campaignRows, setting]) => {
        if (!active) return;
        setSchemes(schemeRows.schemes);
        setCampaigns(campaignRows);
        setBanner(setting.text);
      })
      .catch((error: unknown) => {
        if (!active) return;
        setLoadError(error instanceof Error ? error.message : "Could not load SakhiSetu data.");
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  return (
    <>
      {banner && <div className="bg-turmeric text-ink text-center font-semibold px-4 py-2">{banner}</div>}
      <section className="bg-ink text-ink-foreground pattern-bandhani">
        <div className="mx-auto max-w-6xl px-4 py-14 md:py-20 grid md:grid-cols-[1.3fr_1fr] gap-10 items-center">
          <div>
            <p className="text-turmeric font-semibold">{t({ hi: "नमस्ते दीदी 🙏", en: "Namaste, sister 🙏" })}</p>
            <h1 className="text-4xl md:text-6xl mt-3">
              {t({ hi: "आपके हक़ की हर योजना, एक पुल की दूरी पर।", en: "Every scheme you deserve, just a bridge away." })}
            </h1>
            <p className="mt-5 text-lg opacity-90 max-w-xl">
              {t({ hi: "6 आसान पात्रता सवालों के जवाब दें — फिर ज़रूरत और ज़िला चुनें।", en: "Answer 6 simple eligibility questions, then choose your need and district." })}
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link to="/finder" className="btn-big bg-secondary text-secondary-foreground text-lg">
                <Sparkles className="size-5" /> {t({ hi: "मेरी योजना खोजें", en: "Find my schemes" })}
              </Link>
              <Link to="/schemes" className="btn-big border border-ink-foreground/40">
                {t({ hi: "योजनाएँ देखें", en: "Browse schemes" })}
              </Link>
            </div>
          </div>
          <div className="card-soft text-card-foreground p-6">
            <p className="font-semibold">{t({ hi: "आपको किस चीज़ की ज़रूरत है?", en: "What do you need help with?" })}</p>
            <div className="mt-4 grid grid-cols-2 gap-3">
              {NEEDS.map((n) => (
                <Link key={n.id} to="/schemes" search={{ need: n.id }} className="rounded-xl bg-muted p-4 hover:bg-clay-soft min-h-24 flex flex-col gap-1">
                  <span className="text-3xl" aria-hidden>{n.icon}</span>
                  <span className="font-semibold">{t(n.name)}</span>
                </Link>
              ))}
              <Link to="/schemes" className="rounded-xl border-2 border-dashed p-4 grid place-items-center font-semibold text-primary">
                {t({ hi: "सभी देखें →", en: "See all →" })}
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 -mt-px">
        <dl className="grid grid-cols-2 md:grid-cols-4 gap-px bg-border rounded-b-2xl overflow-hidden">
          {STATS.map((s) => (
            <div key={s.value} className="bg-card p-5 text-center">
              <dt className="sr-only">{t(s.label)}</dt>
              <dd className="font-display text-3xl text-primary">{s.value}</dd>
              <dd className="text-muted-foreground text-sm">{t(s.label)}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section className="mx-auto max-w-6xl px-4 mt-16">
        <div className="flex items-end justify-between gap-4">
          <h2 className="text-3xl">{t({ hi: "सबसे ज़्यादा पूछी जाने वाली योजनाएँ", en: "Most asked-about schemes" })}</h2>
          <Link to="/schemes" className="font-semibold text-primary shrink-0">{t({ hi: "सभी →", en: "All →" })}</Link>
        </div>
        {loadError && <p role="alert" className="mt-4 rounded-xl bg-destructive/10 text-destructive p-4">{loadError}</p>}
        {loading ? <p className="mt-6 text-muted-foreground">{t({ hi: "योजनाएँ लोड हो रही हैं…", en: "Loading schemes…" })}</p> : (
          <div className="mt-6 grid gap-5 md:grid-cols-3">
            {schemes.slice(0, 3).map((s) => <SchemeCard key={s.id} s={s} />)}
            {schemes.length === 0 && !loadError && <p className="text-muted-foreground">{t({ hi: "अभी कोई प्रकाशित योजना उपलब्ध नहीं है।", en: "No published schemes are available yet." })}</p>}
          </div>
        )}
      </section>

      <section className="mx-auto max-w-6xl px-4 mt-16 grid md:grid-cols-[1fr_1.4fr] gap-8 items-start">
        <div>
          <p className="text-primary font-semibold">{t({ hi: "दानदाताओं के लिए", en: "For donors" })}</p>
          <h2 className="text-3xl mt-2">{t({ hi: "एक दीदी को सहारा दें — वो पूरे गाँव को देगी।", en: "Support one woman — she'll lift a whole village." })}</h2>
          <p className="mt-3 text-muted-foreground">{t({ hi: "टेस्ट दान के बाद रसीद PDF का प्रीव्यू तुरंत उपलब्ध।", en: "A receipt PDF preview is available immediately after a test donation." })}</p>
          <p className="mt-2 text-xs text-muted-foreground">{t({ hi: "अभियान की जानकारी और शुरुआती आँकड़े उदाहरण के लिए हैं।", en: "Campaign descriptions and starting figures are illustrative demo data." })}</p>
          <Link to="/donate" className="btn-big bg-primary text-primary-foreground mt-6">
            <HeartHandshake className="size-5" /> {t({ hi: "अभियान देखें", en: "See campaigns" })}
          </Link>
        </div>
        <div className="grid gap-4">
          <p className="text-xs text-muted-foreground">{t({ hi: "अभियान और शुरुआती आँकड़े डेमो नमूने हैं।", en: "Campaigns and starting figures are illustrative demo data." })}</p>
          {campaigns.slice(0, 2).map((c) => {
            const pct = Math.round((c.raised / c.goal) * 100);
            return (
              <Link key={c.id} to="/donate" search={{ c: c.id }} className="card-soft p-5 flex gap-4 items-center">
                <span className="text-4xl" aria-hidden>{c.emoji}</span>
                <div className="flex-1">
                  <h3 className="text-lg">{t(c.title)}</h3>
                  <div className="mt-2 h-2.5 rounded-full bg-muted overflow-hidden" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
                    <div className="h-full bg-leaf" style={{ width: `${pct}%` }} />
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">{inr(c.raised)} / {inr(c.goal)} · {pct}%</p>
                </div>
              </Link>
            );
          })}
          {!loading && campaigns.length === 0 && <p className="text-muted-foreground">{t({ hi: "अभी कोई सक्रिय अभियान नहीं है।", en: "There are no active campaigns right now." })}</p>}
        </div>
      </section>


    </>
  );
}
