import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { DISTRICTS, NEEDS, type Need, type Scheme } from "@/lib/data";
import { getSchemes } from "@/lib/api";
import { useLang } from "@/lib/i18n";
import { SchemeCard } from "@/components/SchemeCard";

type Search = { need?: Need };

export const Route = createFileRoute("/schemes/")({
  validateSearch: (s: Record<string, unknown>): Search =>
    NEEDS.some((n) => n.id === s["need"]) ? { need: s["need"] as Need } : {},
  head: () => ({
    meta: [
      { title: "सभी योजनाएँ — SakhiSetu" },
      { name: "description", content: "Browse government welfare schemes for women in Madhya Pradesh by need and district." },
      { property: "og:title", content: "All welfare schemes — SakhiSetu" },
      { property: "og:description", content: "Benefits, eligibility, documents and steps for each scheme." },
    ],
  }),
  component: SchemesPage,
});

function SchemesPage() {
  const { t } = useLang();
  const { need } = Route.useSearch();
  const [district, setDistrict] = useState("");
  const [q, setQ] = useState("");
  const [list, setList] = useState<Scheme[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    getSchemes({ need, district: district || undefined, q: q.trim() || undefined })
      .then((rows) => { if (active) setList(rows); })
      .catch((reason: unknown) => { if (active) setError(reason instanceof Error ? reason.message : "Could not load schemes."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [need, district, q]);
  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <h1 className="text-4xl">{t({ hi: "सभी योजनाएँ", en: "All schemes" })}</h1>
      <p className="text-muted-foreground mt-2">{t({ hi: "ज़रूरत या ज़िला चुनें।", en: "Pick a need or district." })}</p>

      <div className="mt-6 flex gap-2 overflow-x-auto pb-2" role="group" aria-label="Need">
        <Link to="/schemes" search={{}} className={`btn-big !min-h-11 shrink-0 border ${!need ? "bg-ink text-ink-foreground" : "bg-card"}`}>
          {t({ hi: "सभी", en: "All" })}
        </Link>
        {NEEDS.map((n) => (
          <Link key={n.id} to="/schemes" search={{ need: n.id }} className={`btn-big !min-h-11 shrink-0 border ${need === n.id ? "bg-ink text-ink-foreground" : "bg-card"}`}>
            <span aria-hidden>{n.icon}</span> {t(n.name)}
          </Link>
        ))}
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1 font-medium">
          {t({ hi: "ज़िला", en: "District" })}
          <select value={district} onChange={(e) => setDistrict(e.target.value)} className="h-12 rounded-xl border bg-card px-3">
            <option value="">{t({ hi: "सभी 9 ज़िले", en: "All 9 districts" })}</option>
            {DISTRICTS.map((d) => <option key={d.id} value={d.id}>{t(d.name)}</option>)}
          </select>
        </label>
        <label className="flex flex-col gap-1 font-medium">
          {t({ hi: "नाम से खोजें", en: "Search by name" })}
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t({ hi: "जैसे: लाड़ली", en: "e.g. Ladli" })} className="h-12 rounded-xl border bg-card px-3" />
        </label>
      </div>

      <p className="mt-6 text-sm text-muted-foreground" aria-live="polite">{loading ? t({ hi: "योजनाएँ खोजी जा रही हैं…", en: "Searching schemes…" }) : `${list.length} ${t({ hi: "योजनाएँ मिलीं", en: "schemes found" })}`}</p>
      {error && <p role="alert" className="mt-3 rounded-xl bg-destructive/10 text-destructive p-4">{error}</p>}
      {!loading && !error && <div className="mt-3 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {list.map((s) => <SchemeCard key={s.id} s={s} />)}
        {list.length === 0 && <p className="text-muted-foreground">{t({ hi: "इन फ़िल्टर से कोई योजना नहीं मिली।", en: "No schemes match these filters." })}</p>}
      </div>}
      <div className="mt-10 card-soft p-6 bg-leaf-soft flex flex-col sm:flex-row gap-4 items-center justify-between">
        <p className="font-semibold">{t({ hi: "समझ नहीं आ रहा कौन सी योजना? हम मदद करेंगे।", en: "Not sure which scheme fits? We'll help." })}</p>
        <Link to="/finder" className="btn-big bg-accent text-accent-foreground">{t({ hi: "सवाल-जवाब से खोजें", en: "Use the guided finder" })}</Link>
      </div>
    </div>
  );
}
