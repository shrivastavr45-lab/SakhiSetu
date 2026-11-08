import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { DISTRICTS, NEEDS, type Need, type Scheme } from "@/lib/data";
import { getSchemes } from "@/lib/api";
import { useLang } from "@/lib/i18n";
import { SchemeCard } from "@/components/SchemeCard";

type Search = { need?: Need };

const LEVEL_OPTIONS = [
  { value: "", labelHi: "सभी स्तर", labelEn: "All levels" },
  { value: "Central Government", labelHi: "केंद्र सरकार", labelEn: "Central Govt" },
  { value: "State Government", labelHi: "राज्य सरकार (MP)", labelEn: "State Govt (MP)" },
];

const PAGE_SIZE = 48; // schemes per page

export const Route = createFileRoute("/schemes/")({
  validateSearch: (s: Record<string, unknown>): Search =>
    NEEDS.some((n) => n.id === s["need"]) ? { need: s["need"] as Need } : {},
  head: () => ({
    meta: [
      { title: "सभी योजनाएँ — SakhiSetu" },
      {
        name: "description",
        content:
          "Browse government welfare schemes for women in Madhya Pradesh by need and district.",
      },
      { property: "og:title", content: "All welfare schemes — SakhiSetu" },
      {
        property: "og:description",
        content: "Benefits, eligibility, documents and steps for each scheme.",
      },
    ],
  }),
  component: SchemesPage,
});

function SchemesPage() {
  const { t } = useLang();
  const { need } = Route.useSearch();
  const [district, setDistrict] = useState("");
  const [level, setLevel] = useState("");
  const [q, setQ] = useState("");
  const [page, setPage] = useState(0);

  const [list, setList] = useState<Scheme[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Reset to first page whenever filters change
  useEffect(() => {
    setPage(0);
  }, [need, district, level, q]);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    getSchemes({
      ...(need !== undefined ? { need } : {}),
      ...(district ? { district } : {}),
      ...(level ? { level } : {}),
      ...(q.trim() ? { q: q.trim() } : {}),
      limit: PAGE_SIZE,
      offset: page * PAGE_SIZE,
    })
      .then((result) => {
        if (!active) return;
        setList(result.schemes);
        setTotal(result.total);
      })
      .catch((reason: unknown) => {
        if (active)
          setError(
            reason instanceof Error
              ? reason.message
              : t({ hi: "योजनाएँ लोड नहीं हो सकीं।", en: "Could not load schemes." }),
          );
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [need, district, level, q, page, t]);

  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <h1 className="text-4xl">{t({ hi: "सभी योजनाएँ", en: "All schemes" })}</h1>
      <p className="text-muted-foreground mt-2">
        {t({ hi: "ज़रूरत, स्तर या ज़िला चुनें।", en: "Pick a need, level or district." })}
      </p>

      {/* Need filter pills */}
      <div className="mt-6 flex gap-2 overflow-x-auto pb-2" role="group" aria-label="Need">
        <Link
          to="/schemes"
          search={{}}
          className={`btn-big !min-h-11 shrink-0 border ${!need ? "bg-ink text-ink-foreground" : "bg-card"}`}
        >
          {t({ hi: "सभी", en: "All" })}
        </Link>
        {NEEDS.map((n) => (
          <Link
            key={n.id}
            to="/schemes"
            search={{ need: n.id }}
            className={`btn-big !min-h-11 shrink-0 border ${need === n.id ? "bg-ink text-ink-foreground" : "bg-card"}`}
          >
            <span aria-hidden>{n.icon}</span> {t(n.name)}
          </Link>
        ))}
      </div>

      {/* Secondary filters: district + level + text search */}
      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <label className="flex flex-col gap-1 font-medium">
          {t({ hi: "ज़िला", en: "District" })}
          <select
            value={district}
            onChange={(e) => setDistrict(e.target.value)}
            className="h-12 rounded-xl border bg-card px-3"
          >
            <option value="">{t({ hi: "सभी 9 ज़िले", en: "All 9 districts" })}</option>
            {DISTRICTS.map((d) => (
              <option key={d.id} value={d.id}>
                {t(d.name)}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1 font-medium">
          {t({ hi: "सरकार का स्तर", en: "Government level" })}
          <select
            value={level}
            onChange={(e) => setLevel(e.target.value)}
            className="h-12 rounded-xl border bg-card px-3"
          >
            {LEVEL_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {t({ hi: opt.labelHi, en: opt.labelEn })}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1 font-medium">
          {t({ hi: "नाम से खोजें", en: "Search by name" })}
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={t({ hi: "जैसे: लाड़ली, पेंशन…", en: "e.g. Ladli, pension…" })}
            className="h-12 rounded-xl border bg-card px-3"
          />
        </label>
      </div>

      {/* Result count */}
      <p className="mt-6 text-sm text-muted-foreground" aria-live="polite">
        {loading
          ? t({ hi: "योजनाएँ खोजी जा रही हैं…", en: "Searching schemes…" })
          : t({ hi: `${total} योजनाएँ मिलीं`, en: `${total} schemes found` })}
        {!loading && totalPages > 1 && (
          <span className="ml-2 text-xs">
            {t({
              hi: `(पृष्ठ ${page + 1} / ${totalPages})`,
              en: `(page ${page + 1} of ${totalPages})`,
            })}
          </span>
        )}
      </p>

      {error && (
        <p role="alert" className="mt-3 rounded-xl bg-destructive/10 text-destructive p-4">
          {error}
        </p>
      )}

      {!loading && !error && (
        <>
          <div className="mt-3 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {list.map((s) => (
              <SchemeCard key={s.id} s={s} />
            ))}
            {list.length === 0 && (
              <p className="text-muted-foreground col-span-full">
                {t({
                  hi: "इन फ़िल्टर से कोई योजना नहीं मिली।",
                  en: "No schemes match these filters.",
                })}
              </p>
            )}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="mt-8 flex items-center justify-center gap-3">
              <button
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                disabled={page === 0}
                className="btn-big border bg-card disabled:opacity-40"
              >
                {t({ hi: "← पिछला", en: "← Prev" })}
              </button>
              <span className="text-sm text-muted-foreground">
                {t({ hi: `${page + 1} / ${totalPages}`, en: `${page + 1} / ${totalPages}` })}
              </span>
              <button
                onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                disabled={page >= totalPages - 1}
                className="btn-big border bg-card disabled:opacity-40"
              >
                {t({ hi: "अगला →", en: "Next →" })}
              </button>
            </div>
          )}
        </>
      )}

      <div className="mt-10 card-soft p-6 bg-leaf-soft flex flex-col sm:flex-row gap-4 items-center justify-between">
        <p className="font-semibold">
          {t({
            hi: "समझ नहीं आ रहा कौन सी योजना? हम मदद करेंगे।",
            en: "Not sure which scheme fits? We'll help.",
          })}
        </p>
        <Link to="/finder" className="btn-big bg-accent text-accent-foreground">
          {t({ hi: "सवाल-जवाब से खोजें", en: "Use the guided finder" })}
        </Link>
      </div>
    </div>
  );
}
