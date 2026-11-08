import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowLeft, RotateCcw } from "lucide-react";
import { DISTRICTS, NEEDS, type Profile, type Scheme } from "@/lib/data";
import { askAssistant, checkEligibility } from "@/lib/api";
import { useLang, type L } from "@/lib/i18n";
import { SchemeCard } from "@/components/SchemeCard";

export const Route = createFileRoute("/finder")({
  head: () => ({
    meta: [
      { title: "मेरी योजना खोजें — SakhiSetu" },
      {
        name: "description",
        content:
          "Answer a few simple questions to discover welfare schemes you may be eligible for.",
      },
      { property: "og:title", content: "Scheme finder — SakhiSetu" },
      {
        property: "og:description",
        content: "Simple questions, relevant government schemes for women in MP.",
      },
    ],
  }),
  component: Finder,
});

type Opt = { label: L; icon: string; apply: (p: Profile) => Profile };
type Q = { q: L; opts: Opt[] };

const YES: L = { hi: "हाँ", en: "Yes" };
const NO: L = { hi: "नहीं", en: "No" };
const SKIP: L = { hi: "पता नहीं", en: "Not sure" };

const RULE_LABELS: Record<string, L> = {
  minAge: { hi: "न्यूनतम आयु", en: "minimum age" },
  maxAge: { hi: "अधिकतम आयु", en: "maximum age" },
  married: { hi: "वैवाहिक स्थिति", en: "marital status" },
  pregnant: { hi: "गर्भावस्था", en: "pregnancy" },
  hasDaughter: { hi: "बेटी की जानकारी", en: "daughter-related condition" },
  bpl: { hi: "बीपीएल कार्ड", en: "BPL card" },
  rural: { hi: "ग्रामीण निवास", en: "rural residence" },
  widowed: { hi: "विधवा स्थिति", en: "widow status" },
  shgMember: { hi: "पंजीकृत समूह की सदस्यता", en: "registered SHG membership" },
  firstChild: { hi: "पहली संतान", en: "first child" },
  districtAvailability: { hi: "ज़िले में उपलब्धता", en: "district availability" },
  needPreference: { hi: "आपकी चुनी हुई ज़रूरत", en: "selected need" },
};

function describeRules(keys: string[], t: (value: L) => string) {
  return keys.map((key) => t(RULE_LABELS[key] ?? { hi: key, en: key })).join(", ");
}

const QUESTIONS: Q[] = [
  {
    q: { hi: "आपकी उम्र किस समूह में है?", en: "Which age group are you in?" },
    opts: [
      {
        label: { hi: "18 वर्ष से कम", en: "Under 18" },
        icon: "🌱",
        apply: (p) => ({ ...p, ageMin: 0, ageMax: 17 }),
      },
      {
        label: { hi: "18–20 वर्ष", en: "18–20 years" },
        icon: "🌿",
        apply: (p) => ({ ...p, ageMin: 18, ageMax: 20 }),
      },
      {
        label: { hi: "21–60 वर्ष", en: "21–60 years" },
        icon: "🌳",
        apply: (p) => ({ ...p, ageMin: 21, ageMax: 60 }),
      },
      {
        label: { hi: "61–79 वर्ष", en: "61–79 years" },
        icon: "🍂",
        apply: (p) => ({ ...p, ageMin: 61, ageMax: 79 }),
      },
      {
        label: { hi: "80 वर्ष या अधिक", en: "80 years or older" },
        icon: "🌾",
        apply: (p) => ({ ...p, ageMin: 80, ageMax: 120 }),
      },
    ],
  },
  {
    q: { hi: "क्या आप विधवा हैं?", en: "Are you widowed?" },
    opts: [
      { label: YES, icon: "✓", apply: (p) => ({ ...p, widowed: true }) },
      { label: NO, icon: "✖️", apply: (p) => ({ ...p, widowed: false }) },
    ],
  },
  {
    q: { hi: "क्या आपके पास बीपीएल कार्ड है?", en: "Do you have a BPL card?" },
    opts: [
      { label: YES, icon: "🪪", apply: (p) => ({ ...p, bpl: true }) },
      { label: NO, icon: "✖️", apply: (p) => ({ ...p, bpl: false }) },
    ],
  },
  {
    q: {
      hi: "क्या आप पंजीकृत स्व-सहायता समूह की सदस्य हैं?",
      en: "Are you a member of a registered self-help group?",
    },
    opts: [
      { label: YES, icon: "🤝", apply: (p) => ({ ...p, shgMember: true }) },
      { label: NO, icon: "✖️", apply: (p) => ({ ...p, shgMember: false }) },
    ],
  },
  {
    q: { hi: "क्या आप गर्भवती हैं?", en: "Are you pregnant?" },
    opts: [
      { label: YES, icon: "🤰", apply: (p) => ({ ...p, pregnant: true }) },
      { label: NO, icon: "✖️", apply: (p) => ({ ...p, pregnant: false }) },
    ],
  },
  {
    q: { hi: "क्या यह आपकी पहली संतान होगी?", en: "Is this your first child?" },
    opts: [
      { label: YES, icon: "👶", apply: (p) => ({ ...p, firstChild: true }) },
      { label: NO, icon: "✖️", apply: (p) => ({ ...p, firstChild: false }) },
    ],
  },
];

function Finder() {
  const { t, lang } = useLang();
  const [step, setStep] = useState(0);
  const [profile, setProfile] = useState<Profile>({});
  const [results, setResults] = useState<Scheme[]>([]);
  const [loadingResults, setLoadingResults] = useState(false);
  const [resultError, setResultError] = useState<string | null>(null);
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState<string | null>(null);
  const [asking, setAsking] = useState(false);
  const [assistantError, setAssistantError] = useState<string | null>(null);
  const total = QUESTIONS.length + 2; // Six eligibility questions, followed by need and district preferences.
  const done = step >= total;
  const next = (p: Profile) => {
    setProfile(p);
    setStep((s) => s + 1);
  };

  useEffect(() => {
    if (!done) return;
    let active = true;
    setLoadingResults(true);
    setResultError(null);
    checkEligibility(profile)
      .then((payload) => {
        if (active) setResults(payload.results);
      })
      .catch((error: unknown) => {
        if (active)
          setResultError(
            error instanceof Error
              ? error.message
              : t({
                  hi: "योजना नियमों की जाँच नहीं की जा सकी।",
                  en: "Could not check scheme rules.",
                }),
          );
      })
      .finally(() => {
        if (active) setLoadingResults(false);
      });
    return () => {
      active = false;
    };
  }, [done, profile, t]);

  const askQuestion = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!question.trim()) return;
    setAsking(true);
    setAssistantError(null);
    setAnswer(null);
    try {
      const result = await askAssistant(question.trim(), lang);
      setAnswer(result.answer);
    } catch (error) {
      setAssistantError(
        error instanceof Error
          ? error.message
          : t({
              hi: "सहायक इस समय उपलब्ध नहीं है।",
              en: "The assistant is unavailable right now.",
            }),
      );
    } finally {
      setAsking(false);
    }
  };

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      {!done && (
        <>
          <div className="flex items-center justify-between">
            <button
              onClick={() => setStep((s) => Math.max(0, s - 1))}
              disabled={step === 0}
              className="inline-flex items-center gap-1 font-semibold text-primary disabled:opacity-30"
            >
              <ArrowLeft className="size-4" /> {t({ hi: "पीछे", en: "Back" })}
            </button>
            <span className="text-muted-foreground">
              {t({ hi: "सवाल", en: "Question" })} {step + 1} / {total}
            </span>
          </div>
          <div className="mt-3 h-2 rounded-full bg-muted overflow-hidden" aria-hidden>
            <div
              className="h-full bg-primary transition-all"
              style={{ width: `${(step / total) * 100}%` }}
            />
          </div>
        </>
      )}

      {step < QUESTIONS.length && (
        <Question title={t(QUESTIONS[step]!.q)}>
          {QUESTIONS[step]!.opts.map((o, i) => (
            <Choice
              key={i}
              icon={o.icon}
              label={t(o.label)}
              onClick={() => next(o.apply(profile))}
            />
          ))}
          <Choice icon="🤷‍♀️" label={t(SKIP)} onClick={() => next(profile)} muted />
        </Question>
      )}

      {step === QUESTIONS.length && (
        <Question
          title={t({
            hi: "आपको सबसे ज़्यादा किस मदद की ज़रूरत है?",
            en: "What help do you need most?",
          })}
        >
          {NEEDS.map((n) => (
            <Choice
              key={n.id}
              icon={n.icon}
              label={t(n.name)}
              onClick={() => next({ ...profile, need: n.id })}
            />
          ))}
        </Question>
      )}

      {step === QUESTIONS.length + 1 && (
        <Question title={t({ hi: "आपका ज़िला कौन सा है?", en: "Which is your district?" })}>
          {DISTRICTS.map((d) => (
            <Choice
              key={d.id}
              icon="📍"
              label={t(d.name)}
              onClick={() => next({ ...profile, district: d.id })}
            />
          ))}
        </Question>
      )}

      {done && (
        <FinderResults
          results={results}
          loading={loadingResults}
          error={resultError}
          t={t}
          onRestart={() => {
            setStep(0);
            setProfile({});
            setResults([]);
            setResultError(null);
            setAnswer(null);
          }}
        />
      )}

      <section className="mt-10 card-soft p-5 md:p-6" aria-labelledby="scheme-question-title">
        <h2 id="scheme-question-title" className="font-display text-2xl">
          {t({ hi: "योजना के बारे में अपना सवाल पूछें", en: "Ask a question about schemes" })}
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {t({
            hi: "सहायक उपलब्ध प्रकाशित योजना जानकारी के आधार पर जवाब देगा। जहाँ जानकारी उपलब्ध नहीं है, वहाँ वह इसकी पुष्टि नहीं कर सकेगा।",
            en: "The assistant answers from published scheme information. It will say when the available information cannot confirm an answer.",
          })}
        </p>
        <form onSubmit={askQuestion} className="mt-4 grid gap-3 sm:grid-cols-[1fr_auto]">
          <input
            value={question}
            onChange={(event) => setQuestion(event.target.value)}
            maxLength={2000}
            required
            placeholder={t({
              hi: "जैसे: विधवा पेंशन के लिए कौन से कागज़ चाहिए?",
              en: "e.g. Which documents are needed for widow pension?",
            })}
            className="h-12 rounded-xl border bg-card px-3"
          />
          <button
            disabled={asking || !question.trim()}
            className="btn-big bg-primary text-primary-foreground disabled:opacity-60"
          >
            {asking
              ? t({ hi: "जवाब तैयार हो रहा है…", en: "Thinking…" })
              : t({ hi: "पूछें", en: "Ask" })}
          </button>
        </form>
        {assistantError && (
          <div
            role="alert"
            className="mt-3 rounded-xl bg-destructive/10 p-4 text-sm text-destructive space-y-2"
          >
            <p>{assistantError}</p>
            <p className="text-muted-foreground text-xs">
              {t({
                hi: "सहायता के लिए MP CM हेल्पलाइन 181 (निःशुल्क) पर कॉल करें या ट्रस्ट के सत्यापित संपर्क विवरण से जानकारी लें।",
                en: "For help, call MP CM Helpline 181 (toll-free) or refer to the trust's verified contact details.",
              })}
            </p>
          </div>
        )}
        {answer && (
          <div className="mt-4 rounded-xl bg-secondary p-4 whitespace-pre-wrap" aria-live="polite">
            {answer}
          </div>
        )}
      </section>
    </div>
  );
}

function Question({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <fieldset className="mt-8">
      <legend className="font-display text-3xl md:text-4xl">{title}</legend>
      <div className="mt-6 grid gap-3 sm:grid-cols-2">{children}</div>
    </fieldset>
  );
}

function Choice({
  icon,
  label,
  onClick,
  muted,
}: {
  icon: string;
  label: string;
  onClick: () => void;
  muted?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={`card-soft flex items-center gap-4 p-5 text-left text-xl font-semibold min-h-20 hover:border-primary hover:bg-clay-soft ${muted ? "opacity-75" : ""}`}
    >
      <span className="text-3xl" aria-hidden>
        {icon}
      </span>
      {label}
    </button>
  );
}

// ── FinderResults ────────────────────────────────────────────────────────────
// Separates results into two tiers:
//   1. Rule-verified — schemes with structured rules where at least one rule matched.
//   2. Also check — schemes without structured rules (hasStructuredRules===false);
//      they appear as possible matches but cannot be machine-verified.

type FinderResultsProps = {
  results: Scheme[];
  loading: boolean;
  error: string | null;
  t: (s: L) => string;
  onRestart: () => void;
};

function SchemeResult({ s, t }: { s: Scheme; t: (value: L) => string }) {
  return (
    <div>
      <SchemeCard s={s} />
      {s.match?.rulesApplied.length ? (
        <p className="mt-2 text-xs text-muted-foreground">
          ✓ {t({ hi: "मिले नियम: ", en: "Rules matched: " })}
          {describeRules(s.match.rulesApplied, t)}
        </p>
      ) : null}
      {s.match?.unansweredRules.length ? (
        <p className="mt-1 text-xs text-muted-foreground">
          ? {t({ hi: "पुष्टि बाकी: ", en: "Still to confirm: " })}
          {describeRules(s.match.unansweredRules, t)}
        </p>
      ) : null}
    </div>
  );
}

function FinderResults({ results, loading, error, t, onRestart }: FinderResultsProps) {
  const verified = results.filter((s) => s.match?.hasStructuredRules === true);
  const unverified = results.filter((s) => s.match?.hasStructuredRules !== true);

  return (
    <div>
      <p className="text-primary font-semibold">
        {t({ hi: "बहुत बढ़िया! 🎉", en: "Well done! 🎉" })}
      </p>

      {/* Heading: count only the rule-verified matches prominently */}
      <h1 className="text-3xl md:text-4xl mt-1">
        {loading
          ? t({ hi: "जाँच की जा रही है…", en: "Checking…" })
          : verified.length > 0
            ? `${verified.length} ${t({ hi: "योजनाएँ आपके नियमों से मेल खाती हैं", en: "schemes matched your answers" })}`
            : results.length > 0
              ? t({ hi: "कोई नियम-आधारित मेल नहीं मिला", en: "No rule-based matches found" })
              : t({ hi: "कोई संभावित योजना नहीं मिली", en: "No possible matches found" })}
      </h1>
      <p className="text-muted-foreground mt-2 text-sm">
        {t({
          hi: "यह संभावित मिलान है — अंतिम पात्रता सरकारी विभाग तय करता है।",
          en: "These are possible matches only — the government department decides final eligibility.",
        })}
      </p>

      {loading && (
        <p role="status" className="mt-5 text-muted-foreground">
          {t({ hi: "आपके जवाब जाँचे जा रहे हैं…", en: "Checking your answers…" })}
        </p>
      )}
      {error && (
        <p role="alert" className="mt-5 rounded-xl bg-destructive/10 text-destructive p-4">
          {error}
        </p>
      )}

      {!loading && !error && (
        <>
          {/* ── Tier 1: rule-verified matches ─────────────────────────── */}
          {verified.length > 0 && (
            <section className="mt-6" aria-labelledby="verified-heading">
              <h2 id="verified-heading" className="text-lg font-semibold flex items-center gap-2">
                <span className="inline-block size-2.5 rounded-full bg-leaf shrink-0" aria-hidden />
                {t({ hi: "नियम-सत्यापित संभावित मेल", en: "Rule-verified possible matches" })}
              </h2>
              <p className="text-xs text-muted-foreground mt-1">
                {t({
                  hi: "इन योजनाओं के लिए आपके जवाब पात्रता नियमों से मेल खाते हैं।",
                  en: "Your answers match the eligibility rules encoded for these schemes.",
                })}
              </p>
              <div className="mt-4 grid gap-5 sm:grid-cols-2">
                {verified.map((s) => (
                  <SchemeResult key={s.id} s={s} t={t} />
                ))}
              </div>
            </section>
          )}

          {/* ── Tier 2: unverified / no structured rules ──────────────── */}
          {unverified.length > 0 && (
            <section className="mt-8" aria-labelledby="unverified-heading">
              <h2 id="unverified-heading" className="text-lg font-semibold flex items-center gap-2">
                <span
                  className="inline-block size-2.5 rounded-full bg-muted-foreground/50 shrink-0"
                  aria-hidden
                />
                {t({
                  hi: "भी देखें — पात्रता नियम अभी उपलब्ध नहीं",
                  en: "Also check — eligibility rules not yet available",
                })}
              </h2>
              <p className="text-xs text-muted-foreground mt-1">
                {t({
                  hi: "इन योजनाओं के लिए हमारे पास अभी संरचित पात्रता नियम नहीं हैं। ये आपकी ज़रूरत के लिए प्रासंगिक हो सकती हैं — आधिकारिक स्रोत या ट्रस्ट सहायता केंद्र से पुष्टि करें।",
                  en: "We don't yet have structured eligibility rules for these schemes. They may still be relevant — verify with the official source or a trust help centre.",
                })}
              </p>
              <div className="mt-4 grid gap-5 sm:grid-cols-2">
                {unverified.map((s) => (
                  <div key={s.id} className="opacity-85">
                    <SchemeCard s={s} />
                    <p className="mt-1.5 text-xs text-muted-foreground italic">
                      {t({
                        hi: "आधिकारिक स्रोत से पात्रता की पुष्टि करें।",
                        en: "Confirm eligibility from the official source.",
                      })}
                    </p>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* ── Zero results ──────────────────────────────────────────── */}
          {results.length === 0 && (
            <div className="mt-6 col-span-full space-y-3">
              <p className="text-muted-foreground">
                {t({
                  hi: "दिए गए जवाबों से कोई संभावित योजना नहीं मिली।",
                  en: "No possible matches were found for these answers.",
                })}
              </p>
              <div className="rounded-xl bg-muted/60 p-4 text-sm space-y-1">
                <p className="font-semibold">{t({ hi: "सहायता के लिए:", en: "For help:" })}</p>
                <p>
                  {t({
                    hi: "• मध्य प्रदेश CM हेल्पलाइन: 181 (निःशुल्क)",
                    en: "• Madhya Pradesh CM Helpline: 181 (toll-free)",
                  })}
                </p>
                <p>
                  {t({
                    hi: "• अपने ज़िले के ट्रस्ट सहायता केंद्र से संपर्क करें।",
                    en: "• Contact a trust help centre in your district.",
                  })}
                </p>
                <p className="text-xs text-muted-foreground">
                  {t({ hi: "या नीचे 'सभी योजनाएँ' देखें।", en: "Or browse all schemes below." })}
                </p>
              </div>
            </div>
          )}
        </>
      )}

      <div className="mt-8 flex flex-wrap gap-3">
        <button onClick={onRestart} className="btn-big border bg-card">
          <RotateCcw className="size-5" /> {t({ hi: "फिर से शुरू करें", en: "Start again" })}
        </button>
        <Link to="/schemes" className="btn-big bg-ink text-ink-foreground">
          {t({ hi: "सभी योजनाएँ", en: "All schemes" })}
        </Link>
      </div>
    </div>
  );
}
