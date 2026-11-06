import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { CheckCircle2, FileText, Volume2, ArrowLeft } from "lucide-react";
import { districtName, type Scheme } from "@/lib/data";
import { getScheme } from "@/lib/api";
import { useLang } from "@/lib/i18n";

export const Route = createFileRoute("/schemes/$id")({
  head: () => ({ meta: [{ title: "योजना विवरण — SakhiSetu" }, { name: "robots", content: "noindex" }] }),
  component: SchemeDetail,
});

function SchemeDetail() {
  const { id } = Route.useParams();
  const { t, lang } = useLang();
  const [s, setScheme] = useState<Scheme | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let active = true;
    setLoading(true);
    getScheme(id).then((scheme) => { if (active) setScheme(scheme); })
      .catch((reason: unknown) => { if (active) setError(reason instanceof Error ? reason.message : "Scheme unavailable."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [id]);

  if (loading) return <div className="mx-auto max-w-3xl px-4 py-12 text-muted-foreground">{t({ hi: "योजना विवरण लोड हो रहा है…", en: "Loading scheme details…" })}</div>;
  if (error || !s) return <div className="mx-auto max-w-3xl px-4 py-12"><p role="alert" className="text-destructive">{error ?? t({ hi: "योजना नहीं मिली।", en: "Scheme not found." })}</p><Link to="/schemes" className="btn-big border bg-card mt-4">{t({ hi: "सभी योजनाएँ", en: "All schemes" })}</Link></div>;
  const speak = () => {
    const text = [t(s.name), t(s.benefit), ...s.eligibility.map(t), ...s.steps.map(t)].join(". ");
    const u = new SpeechSynthesisUtterance(text);
    u.lang = lang === "hi" ? "hi-IN" : "en-IN";
    speechSynthesis.cancel();
    speechSynthesis.speak(u);
  };
  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <Link to="/schemes" className="inline-flex items-center gap-1 text-primary font-semibold"><ArrowLeft className="size-4" /> {t({ hi: "सभी योजनाएँ", en: "All schemes" })}</Link>
      <p className="mt-4 text-sm text-muted-foreground">{t(s.dept)}</p>
      <h1 className="text-4xl mt-1">{t(s.name)}</h1>
      <p className="text-lg mt-3">{t(s.short)}</p>
      <button onClick={speak} className="btn-big border bg-card mt-4"><Volume2 className="size-5" /> {t({ hi: "सुनें", en: "Listen" })}</button>

      <div className="mt-6 rounded-2xl bg-leaf text-accent-foreground p-6">
        <p className="text-sm opacity-90">{t({ hi: "आपको क्या मिलेगा", en: "What you get" })}</p>
        <p className="font-display text-2xl mt-1">{t(s.benefit)}</p>
      </div>

      <Section n={1} title={t({ hi: "कौन ले सकता है?", en: "Who can apply?" })}>
        <ul className="space-y-2">
          {s.eligibility.map((e, i) => (
            <li key={i} className="flex gap-2"><CheckCircle2 className="size-5 text-leaf shrink-0 mt-1" /> {t(e)}</li>
          ))}
        </ul>
      </Section>
      <Section n={2} title={t({ hi: "कौन से कागज़ चाहिए?", en: "Documents needed" })}>
        <ul className="grid sm:grid-cols-2 gap-2">
          {s.documents.map((d, i) => (
            <li key={i} className="flex gap-2 items-center rounded-xl bg-muted p-3"><FileText className="size-5 text-primary" /> {t(d)}</li>
          ))}
          {s.documents.length === 0 && <li className="text-sm text-muted-foreground">{t({ hi: "इस नमूना रिकॉर्ड में दस्तावेज़ों की सूची नहीं दी गई है। कृपया आधिकारिक सूचना से पुष्टि करें।", en: "No document list was supplied for this sample record. Confirm requirements from the official notice." })}</li>}
        </ul>
      </Section>
      <Section n={3} title={t({ hi: "आवेदन कैसे करें?", en: "How to apply" })}>
        <ol className="space-y-3">
          {s.steps.map((st, i) => (
            <li key={i} className="flex gap-3">
              <span className="grid place-items-center size-8 rounded-full bg-secondary text-secondary-foreground font-bold shrink-0">{i + 1}</span>
              <span className="pt-1">{t(st)}</span>
            </li>
          ))}
          {s.steps.length === 0 && <li className="text-sm text-muted-foreground">{t({ hi: "आवेदन के चरण इस नमूना रिकॉर्ड में नहीं दिए गए हैं। आधिकारिक स्रोत से प्रक्रिया की पुष्टि करें।", en: "Application steps were not supplied for this sample record. Confirm the process from the official source." })}</li>}
        </ol>
      </Section>
      <p className="mt-6 text-sm text-muted-foreground">
        {t({ hi: "उपलब्ध ज़िले: ", en: "Available in: " })}
        {s.districts === "all" ? t({ hi: "सभी 9 ज़िले", en: "all 9 districts" }) : s.districts.map((d) => t(districtName(d))).join(", ")}
      </p>
      <div className="mt-8 card-soft p-6 bg-clay-soft">
        <p className="font-semibold text-lg">{t({ hi: "फॉर्म भरने में मदद चाहिए?", en: "Need help with the form?" })}</p>
        <p className="text-muted-foreground">{t({ hi: "इस डेमो में निकटतम सहायता केंद्र का पता उपलब्ध नहीं है। अपने ज़िले की सहायता जानकारी ट्रस्ट से सत्यापित करें।", en: "The nearest help-centre address is not included in this demo. Please verify local assistance details with the trust." })}</p>
        <Link to="/finder" className="btn-big bg-primary text-primary-foreground mt-4">{t({ hi: "योजना खोजक खोलें", en: "Open scheme finder" })}</Link>
      </div>
      <div className="mt-4 text-xs text-muted-foreground space-y-1">
        <p>{t({ hi: "जानकारी केवल मार्गदर्शन हेतु है। अंतिम पात्रता सरकारी विभाग तय करता है।", en: "Information is for guidance only. Final eligibility is decided by the government department." })}</p>
        <p>{t({ hi: "ज़िला कवरेज डेमो मान्यता पर आधारित है; वास्तविक उपलब्धता की पुष्टि आवश्यक है।", en: "District coverage is an illustrative assumption and must be verified before use." })}</p>
        {s.lastCheckedAt && <p>{t({ hi: "अंतिम जाँच तिथि: ", en: "Last verified: " })}{new Date(s.lastCheckedAt).toLocaleDateString(lang === "hi" ? "hi-IN" : "en-IN")}</p>}
        {s.sourceUrl
          ? <a href={s.sourceUrl} target="_blank" rel="noreferrer" className="underline text-primary">{t({ hi: "आधिकारिक स्रोत देखें", en: "View official source" })}</a>
          : <p>{t({ hi: "आधिकारिक स्रोत URL उपलब्ध नहीं। सत्यापन के लिए ट्रस्ट से संपर्क करें।", en: "No official source URL available. Contact the trust for verification." })}</p>}
        {!s.documents.length && !s.steps.length && (
          <p>{t({ hi: "दस्तावेज़ और आवेदन चरण इस रिकॉर्ड में उपलब्ध नहीं हैं। आधिकारिक स्रोत से पुष्टि करें।", en: "Document requirements and application steps are not available for this record. Confirm from the official source." })}</p>
        )}
      </div>
    </div>
  );
}

function Section({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <section className="mt-8">
      <h2 className="text-2xl flex items-center gap-3"><span className="text-primary font-sans text-base font-bold">0{n}</span>{title}</h2>
      <div className="mt-3">{children}</div>
    </section>
  );
}
