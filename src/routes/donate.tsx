import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { Download, ShieldCheck, Award, Receipt } from "lucide-react";
import { districtName, inr, type Campaign } from "@/lib/data";
import { useLang } from "@/lib/i18n";
import { createDonation, createIdempotencyKey, downloadReceipt, getCampaigns, type DonationResult } from "@/lib/api";

export const Route = createFileRoute("/donate")({
  validateSearch: (s: Record<string, unknown>): { c?: string } => (typeof s["c"] === "string" ? { c: s["c"] } : {}),
  head: () => ({
    meta: [
      { title: "दान करें — SakhiSetu" },
      { name: "description", content: "Support women's livelihoods and health in Madhya Pradesh. One-time or monthly test donations." },
      { property: "og:title", content: "Donate to SakhiSetu campaigns" },
      { property: "og:description", content: "Test-mode donations with instant receipt previews." },
    ],
  }),
  component: Donate,
});

const AMOUNTS = [500, 1500, 3000, 8000];

type Done = {
  result: DonationResult;
  campaign: Campaign;
};

function Donate() {
  const { t } = useLang();
  const { c } = Route.useSearch();
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loadingCampaigns, setLoadingCampaigns] = useState(true);
  const [campaignError, setCampaignError] = useState<string | null>(null);
  const [cid, setCid] = useState(c ?? "");
  const [monthly, setMonthly] = useState(false);
  const [amount, setAmount] = useState(1500);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [pan, setPan] = useState("");
  const [done, setDone] = useState<Done | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const idempotencyKey = useRef(createIdempotencyKey());
  const submittedFingerprint = useRef<string | null>(null);

  useEffect(() => {
    let active = true;
    getCampaigns()
      .then((rows) => {
        if (!active) return;
        setCampaigns(rows);
        setCid((current) => current || c || rows[0]?.id || "");
      })
      .catch((reason: unknown) => { if (active) setCampaignError(reason instanceof Error ? reason.message : "Could not load campaigns."); })
      .finally(() => { if (active) setLoadingCampaigns(false); });
    return () => { active = false; };
  }, [c]);

  const campaign = campaigns.find((item) => item.id === cid) ?? null;

  const processDonation = async (simulateFailure = false) => {
    if (!campaign) return;
    setSubmitting(true);
    setError(null);
    try {
      const payload: Parameters<typeof createDonation>[0] = {
        campaignId: campaign.id,
        amount,
        frequency: monthly ? "MONTHLY" : "ONE_TIME",
        donorName: name.trim(),
        donorEmail: email.trim(),
        pan: pan.trim().toUpperCase(),
      };
      // Reuse the key only for an identical submission (safe retry after a lost response).
      // If the donor changes any field, use a fresh key rather than reusing a prior donation key.
      const fingerprint = JSON.stringify(payload);
      if (submittedFingerprint.current !== fingerprint) {
        idempotencyKey.current = createIdempotencyKey();
        submittedFingerprint.current = fingerprint;
      }
      const result = await createDonation(payload, idempotencyKey.current, simulateFailure);
      if (result.status !== "SUCCEEDED" || !result.receipt) {
        setError(t({ hi: "टेस्ट भुगतान असफल रहा। कोई रसीद जारी नहीं की गई। आप नया प्रयास कर सकते हैं।", en: "The test payment failed. No receipt was issued. You can retry." }));
        idempotencyKey.current = createIdempotencyKey();
        submittedFingerprint.current = null;
        return;
      }
      setDone({ result, campaign });
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Donation could not be processed.");
    } finally {
      setSubmitting(false);
    }
  };

  const submitDonation = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void processDonation(false);
  };

  if (done) return <Success d={done} onBack={() => {
    setDone(null);
    setName("");
    setEmail("");
    setPan("");
    idempotencyKey.current = createIdempotencyKey();
    submittedFingerprint.current = null;
  }} />;

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <h1 className="text-4xl">{t({ hi: "एक दीदी का सपना पूरा करें", en: "Help a woman build her future" })}</h1>
      <p className="text-muted-foreground mt-2">{t({ hi: "अभियान चुनें, राशि तय करें। यह केवल परीक्षण भुगतान है।", en: "Choose a campaign and amount. This is a test payment only." })}</p>

      {campaignError && <p role="alert" className="mt-5 rounded-xl bg-destructive/10 text-destructive p-4">{campaignError}</p>}
      {loadingCampaigns ? <p role="status" className="mt-6 text-muted-foreground">{t({ hi: "अभियान लोड हो रहे हैं…", en: "Loading campaigns…" })}</p> : campaigns.length === 0 ? <p className="mt-6 text-muted-foreground">{t({ hi: "अभी कोई सक्रिय अभियान उपलब्ध नहीं है।", en: "No active campaigns are available right now." })}</p> : (
        <>
        <p className="mt-5 text-xs text-muted-foreground">{t({ hi: "अभियान के नाम, लक्ष्य और शुरुआती आँकड़े केवल डेमो नमूने हैं; इन्हें ट्रस्ट के सत्यापित आँकड़ों से बदलना होगा।", en: "Campaign names, targets and starting figures are illustrative demo data and must be replaced with verified trust figures." })}</p>
        <div className="mt-4 grid lg:grid-cols-[1.2fr_1fr] gap-8 items-start">
          <div className="grid gap-4" role="radiogroup" aria-label="Campaign">
            {campaigns.map((x) => {
              const pct = x.goal > 0 ? Math.min(100, Math.round((x.raised / x.goal) * 100)) : 0;
              const sel = x.id === cid;
              return (
                <button key={x.id} type="button" role="radio" aria-checked={sel} onClick={() => setCid(x.id)} className={`card-soft p-5 text-left flex gap-4 ${sel ? "ring-3 ring-primary" : ""}`}>
                  <span className="text-4xl" aria-hidden>{x.emoji}</span>
                  <span className="flex-1">
                    <span className="text-xs uppercase tracking-wide text-muted-foreground">📍 {t(districtName(x.district))}</span>
                    <span className="block font-display text-xl">{t(x.title)}</span>
                    <span className="block text-muted-foreground mt-1">{t(x.story)}</span>
                    <span className="block mt-3 h-2.5 rounded-full bg-muted overflow-hidden"><span className="block h-full bg-leaf" style={{ width: `${pct}%` }} /></span>
                    <span className="block text-sm mt-1">{inr(x.raised)} {t({ hi: "जुटाए", en: "raised of" })} {inr(x.goal)} · {x.donors} {t({ hi: "दानदाता", en: "donors" })}</span>
                    <span className="block text-sm mt-2 font-semibold text-leaf">{t(x.impact)}</span>
                  </span>
                </button>
              );
            })}
          </div>

          <form className="card-soft p-6 lg:sticky lg:top-24" onSubmit={submitDonation}>
            <div className="grid grid-cols-2 rounded-full bg-muted p-1" role="group" aria-label="Frequency">
              {[false, true].map((m) => (
                <button type="button" key={String(m)} aria-pressed={monthly === m} onClick={() => setMonthly(m)} className={`h-11 rounded-full font-semibold ${monthly === m ? "bg-card shadow" : "text-muted-foreground"}`}>
                  {m ? t({ hi: "हर महीने", en: "Monthly" }) : t({ hi: "एक बार", en: "One-time" })}
                </button>
              ))}
            </div>
            <div className="mt-5 grid grid-cols-2 gap-2">
              {AMOUNTS.map((a) => (
                <button type="button" key={a} aria-pressed={amount === a} onClick={() => setAmount(a)} className={`h-14 rounded-xl border text-lg font-bold ${amount === a ? "bg-primary text-primary-foreground border-primary" : "bg-card"}`}>
                  {inr(a)}
                </button>
              ))}
            </div>
            <label className="mt-3 flex flex-col gap-1 font-medium">
              {t({ hi: "अन्य राशि", en: "Other amount" })}
              <input type="number" min={100} max={10000000} required value={amount} onChange={(e) => setAmount(Number(e.target.value))} className="h-12 rounded-xl border bg-card px-3" />
            </label>
            <label className="mt-3 flex flex-col gap-1 font-medium">
              {t({ hi: "पूरा नाम", en: "Full name" })}
              <input required value={name} maxLength={120} onChange={(e) => setName(e.target.value)} className="h-12 rounded-xl border bg-card px-3" />
            </label>
            <label className="mt-3 flex flex-col gap-1 font-medium">
              {t({ hi: "ईमेल", en: "Email" })}
              <input type="email" required value={email} maxLength={254} onChange={(e) => setEmail(e.target.value)} className="h-12 rounded-xl border bg-card px-3" />
            </label>
            <label className="mt-3 flex flex-col gap-1 font-medium">
              {t({ hi: "PAN (80G प्रीव्यू के लिए आवश्यक)", en: "PAN (required for the 80G preview)" })}
              <input required value={pan} onChange={(e) => setPan(e.target.value.toUpperCase())} maxLength={10} minLength={10} pattern="[A-Z]{5}[0-9]{4}[A-Z]" className="h-12 rounded-xl border bg-card px-3 uppercase" />
            </label>
            <p className="mt-1 text-xs text-muted-foreground">{t({ hi: "PAN केवल इस टेस्ट PDF प्रीव्यू के लिए लिया जाता है और डेटाबेस में एन्क्रिप्टेड रखा जाता है।", en: "PAN is collected for this test PDF preview and stored encrypted in the database." })}</p>
            {error && <p role="alert" className="mt-4 rounded-xl bg-destructive/10 text-destructive p-3 text-sm">{error}</p>}
            <button type="submit" disabled={!campaign || submitting || amount < 100} className="btn-big w-full mt-5 bg-primary text-primary-foreground text-lg disabled:opacity-60">
              {submitting ? t({ hi: "प्रक्रिया हो रही है…", en: "Processing…" }) : <>{t({ hi: "टेस्ट दान करें", en: "Make test donation" })} {inr(amount)}{monthly ? t({ hi: " / माह", en: " / month" }) : ""}</>}
            </button>
            <p className="mt-3 text-xs text-muted-foreground flex items-center gap-1.5"><ShieldCheck className="size-4 text-leaf" /> {t({ hi: "टेस्ट मोड — कोई असली भुगतान नहीं होगा। मासिक चयन केवल इरादा दर्ज करता है, ऑटो-डेबिट नहीं।", en: "Test mode — no real payment. Monthly records an intention only; no automatic debit is created." })}</p>
            <p className="mt-2 text-xs text-muted-foreground">{t({ hi: "केवल INR का स्थानीय टेस्ट रिकॉर्ड बनाया जाता है। विदेशी कार्ड और FCRA योगदान इस डेमो में उपलब्ध नहीं हैं।", en: "Only local INR test records are supported. Foreign cards and FCRA contributions are not available in this demo." })}</p>
            {import.meta.env.DEV && <button type="button" onClick={() => void processDonation(true)} disabled={!campaign || submitting || amount < 100} className="mt-3 text-sm underline text-destructive disabled:opacity-50">{t({ hi: "डेवलपर टेस्ट: भुगतान असफल दिखाएँ", en: "Developer test: simulate failed payment" })}</button>}
            {campaign && <p className="mt-1 text-sm text-leaf font-semibold">{t(campaign.impact)}</p>}
          </form>
        </div>
        </>
      )}
    </div>
  );
}

function Success({ d, onBack }: { d: Done; onBack: () => void }) {
  const { t } = useLang();
  const [downloading, setDownloading] = useState(false);
  const { donation, receipt } = d.result;
  const download = async () => {
    if (!receipt) return;
    setDownloading(true);
    try {
      const blob = await downloadReceipt(receipt.id, receipt.downloadToken);
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `SakhiSetu-${receipt.receiptNumber.replaceAll("/", "-")}.pdf`;
      anchor.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      window.alert(error instanceof Error ? error.message : "Could not download the PDF.");
    } finally {
      setDownloading(false);
    }
  };
  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <p className="text-5xl" aria-hidden>🙏</p>
      <h1 className="text-4xl mt-2">{t({ hi: "धन्यवाद", en: "Thank you" })}, {donation.donorName}!</h1>
      <p className="text-muted-foreground mt-2" role="status">
        {inr(donation.amount)} {donation.frequency === "MONTHLY" ? t({ hi: "हर महीने देने का इरादा", en: "monthly giving intention" }) : ""} — {t(d.campaign.title)}
      </p>
      <p className="mt-3 text-xs font-semibold text-destructive">{t({ hi: "टेस्ट भुगतान सफल — पैसा नहीं लिया गया। नीचे का PDF कानूनी 80G प्रमाणपत्र नहीं है।", en: "Test payment succeeded — no money was collected. The PDF below is not a legal 80G certificate." })}</p>

      <div className="mt-8 grid md:grid-cols-2 gap-6">
        <section className="card-soft p-6" aria-labelledby="rc">
          <h2 id="rc" className="text-xl flex items-center gap-2"><Receipt className="size-5 text-primary" /> {t({ hi: "रसीद प्रीव्यू", en: "Receipt preview" })}</h2>
          <dl className="mt-4 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
            <dt className="text-muted-foreground">{t({ hi: "रसीद नं.", en: "Receipt no." })}</dt><dd className="font-mono">{receipt?.receiptNumber ?? "—"}</dd>
            <dt className="text-muted-foreground">{t({ hi: "दिनांक", en: "Date" })}</dt><dd>{new Date(donation.createdAt).toLocaleDateString("en-IN")}</dd>
            <dt className="text-muted-foreground">{t({ hi: "राशि", en: "Amount" })}</dt><dd className="font-bold">{inr(donation.amount)}</dd>
            <dt className="text-muted-foreground">{t({ hi: "संदर्भ", en: "Reference" })}</dt><dd className="font-mono break-all">{donation.id}</dd>
          </dl>
          <button onClick={download} disabled={!receipt || downloading} className="btn-big w-full mt-6 bg-ink text-ink-foreground disabled:opacity-60"><Download className="size-5" /> {downloading ? t({ hi: "डाउनलोड हो रहा है…", en: "Downloading…" }) : t({ hi: "PDF प्रीव्यू डाउनलोड करें", en: "Download PDF preview" })}</button>
        </section>

        <section aria-labelledby="ct" className="rounded-2xl p-2 bg-secondary">
          <div className="rounded-xl border-2 border-primary bg-card p-6 text-center pattern-bandhani h-full">
            <div className="bg-card/90 rounded-lg p-4">
              <Award className="size-10 mx-auto text-primary" />
              <h2 id="ct" className="text-sm uppercase tracking-widest text-muted-foreground mt-2">{t({ hi: "आभार प्रमाण पत्र — प्रीव्यू", en: "Certificate of gratitude — preview" })}</h2>
              <p className="font-display text-3xl mt-3">{donation.donorName}</p>
              <p className="mt-3 text-sm">{t({ hi: "को सखीसेतु परिवार की ओर से धन्यवाद।", en: "with thanks from the SakhiSetu family." })}</p>
              <p className="font-semibold mt-1">{t(d.campaign.title)}</p>
              <p className="text-xs text-muted-foreground mt-4">{new Date(donation.createdAt).toLocaleDateString("en-IN")} · {receipt?.receiptNumber}</p>
              <p className="text-xs text-destructive font-semibold mt-4">TEST / PREVIEW — NOT VALID FOR TAX CLAIMS</p>
            </div>
          </div>
        </section>
      </div>
      <button onClick={onBack} className="btn-big border bg-card mt-8">{t({ hi: "एक और दान करें", en: "Make another gift" })}</button>
    </div>
  );
}
