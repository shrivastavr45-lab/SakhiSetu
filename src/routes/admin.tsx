import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Eye, EyeOff, Trash2, Plus, LogOut, Sparkles, Save, CheckCircle2 } from "lucide-react";
import { NEEDS, inr, type Need, type Scheme, type Campaign } from "@/lib/data";
import { useLang } from "@/lib/i18n";
import {
  approveSchemeSummary,
  createAdminScheme,
  deleteAdminScheme,
  draftSchemeSummary,
  dismissSchemeSummary,
  getAdminDonations,
  getCampaigns,
  getMe,
  getHomepageBanner,
  getSchemes,
  login,
  logout,
  updateAdminCampaign,
  updateAdminScheme,
  updateHomepageBanner,
  type AdminDonation,
  type SessionUser,
} from "@/lib/api";

export const Route = createFileRoute("/admin")({
  head: () => ({
    meta: [
      { title: "ट्रस्ट प्रशासन — SakhiSetu" },
      { name: "description", content: "Manage SakhiSetu schemes, campaigns and test donations." },
      { property: "og:title", content: "SakhiSetu admin" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: Admin,
});

const TABS = [
  { id: "schemes", label: { hi: "योजनाएँ", en: "Schemes" } },
  { id: "campaigns", label: { hi: "अभियान", en: "Campaigns" } },
  { id: "donations", label: { hi: "दान", en: "Donations" } },
  { id: "content", label: { hi: "सामग्री", en: "Content" } },
] as const;

type SchemeEditor = {
  nameHi: string; nameEn: string; need: string; deptHi: string; deptEn: string; shortHi: string; shortEn: string;
  benefitHi: string; benefitEn: string; eligibilityHi: string; eligibilityEn: string;
  documentsHi: string; documentsEn: string; stepsHi: string; stepsEn: string; rulesJson: string; districtsJson: string;
};

function createSchemeEditor(scheme: Scheme): SchemeEditor {
  const lines = (items: { hi: string; en: string }[], lang: "hi" | "en") => items.map((item) => item[lang]).join("\n");
  return {
    nameHi: scheme.name.hi, nameEn: scheme.name.en, need: scheme.need, deptHi: scheme.dept.hi, deptEn: scheme.dept.en,
    shortHi: scheme.short.hi, shortEn: scheme.short.en, benefitHi: scheme.benefit.hi, benefitEn: scheme.benefit.en,
    eligibilityHi: lines(scheme.eligibility, "hi"), eligibilityEn: lines(scheme.eligibility, "en"),
    documentsHi: lines(scheme.documents, "hi"), documentsEn: lines(scheme.documents, "en"),
    stepsHi: lines(scheme.steps, "hi"), stepsEn: lines(scheme.steps, "en"),
    rulesJson: JSON.stringify(scheme.rules ?? {}, null, 2),
    districtsJson: scheme.districts === "all" ? '"all"' : JSON.stringify(scheme.districts, null, 2),
  };
}

function pairLines(hiText: string, enText: string) {
  const hi = hiText.split(/\r?\n/).map((value) => value.trim()).filter(Boolean);
  const en = enText.split(/\r?\n/).map((value) => value.trim()).filter(Boolean);
  return Array.from({ length: Math.max(hi.length, en.length) }, (_, index) => ({
    hi: hi[index] ?? en[index] ?? "",
    en: en[index] ?? hi[index] ?? "",
  }));
}

function EditorField({ label, value, onChange, multiline = false }: { label: string; value: string; onChange: (value: string) => void; multiline?: boolean }) {
  return <label className="flex flex-col gap-1 text-sm font-medium">{label}{multiline
    ? <textarea rows={3} value={value} onChange={(event) => onChange(event.target.value)} className="rounded-lg border bg-card p-3" />
    : <input value={value} onChange={(event) => onChange(event.target.value)} maxLength={1000} className="h-10 rounded-lg border bg-card px-3" />}</label>;
}

function Admin() {
  const { t } = useLang();
  const [user, setUser] = useState<SessionUser | null>(null);
  const [checkingSession, setCheckingSession] = useState(true);
  const [tab, setTab] = useState<(typeof TABS)[number]["id"]>("schemes");
  const [schemes, setSchemes] = useState<Scheme[]>([]);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [donations, setDonations] = useState<AdminDonation[]>([]);
  const [newNameHi, setNewNameHi] = useState("");
  const [newNameEn, setNewNameEn] = useState("");
  const [newNeed, setNewNeed] = useState<Need>("money");
  const [schemeEditors, setSchemeEditors] = useState<Record<string, SchemeEditor>>({});
  const [banner, setBanner] = useState("");
  const [noticeDrafts, setNoticeDrafts] = useState<Record<string, string>>({});
  const [sourceUrls, setSourceUrls] = useState<Record<string, string>>({});
  const [campaignGoals, setCampaignGoals] = useState<Record<string, string>>({});
  const [loginEmail, setLoginEmail] = useState("admin@sakhisetu.test");
  const [loginPassword, setLoginPassword] = useState("");
  const [loginError, setLoginError] = useState<string | null>(null);
  const [dataError, setDataError] = useState<string | null>(null);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [loadingData, setLoadingData] = useState(false);
  const donationTotals = useMemo(() => ({
    raised: donations.filter((item) => item.status === "SUCCEEDED").reduce((sum, item) => sum + item.amount, 0),
    monthly: donations.filter((item) => item.frequency === "MONTHLY" && item.status === "SUCCEEDED").length,
  }), [donations]);

  useEffect(() => {
    let active = true;
    getMe()
      .then(({ user: sessionUser }) => { if (active) setUser(sessionUser); })
      .catch(() => { if (active) setUser(null); })
      .finally(() => { if (active) setCheckingSession(false); });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (user?.role !== "ADMIN") return;
    let active = true;
    setLoadingData(true);
    setDataError(null);
    Promise.all([getSchemes({ drafts: true }), getCampaigns(true), getAdminDonations(), getHomepageBanner()])
      .then(([schemeRows, campaignRows, donationRows, setting]) => {
        if (!active) return;
        setSchemes(schemeRows);
        setCampaigns(campaignRows);
        setDonations(donationRows);
        setBanner(setting.text ?? "");
        setNoticeDrafts(Object.fromEntries(schemeRows.map((scheme) => [scheme.id, scheme.officialNoticeText ?? ""])));
        setSourceUrls(Object.fromEntries(schemeRows.map((scheme) => [scheme.id, scheme.sourceUrl ?? ""])));
        setCampaignGoals(Object.fromEntries(campaignRows.map((campaign) => [campaign.id, String(campaign.goal)])));
        setSchemeEditors(Object.fromEntries(schemeRows.map((scheme) => [scheme.id, createSchemeEditor(scheme)])));
      })
      .catch((error: unknown) => { if (active) setDataError(error instanceof Error ? error.message : "Could not load admin data."); })
      .finally(() => { if (active) setLoadingData(false); });
    return () => { active = false; };
  }, [user]);

  const handleLogin = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoginError(null);
    setBusyKey("login");
    try {
      const result = await login({ email: loginEmail.trim(), password: loginPassword });
      if (result.user.role !== "ADMIN") {
        await logout();
        throw new Error("This account does not have trust administrator access.");
      }
      setUser(result.user);
      setLoginPassword("");
    } catch (error) {
      setLoginError(error instanceof Error ? error.message : "Could not sign in.");
    } finally {
      setBusyKey(null);
    }
  };

  const handleLogout = async () => {
    setBusyKey("logout");
    try { await logout(); } finally { setUser(null); setSchemes([]); setCampaigns([]); setDonations([]); setBusyKey(null); }
  };

  const addScheme = async () => {
    if (!newNameHi.trim() || !newNameEn.trim()) return;
    setBusyKey("add-scheme");
    setFeedback(null);
    try {
      const created = await createAdminScheme({ need: newNeed, name: { hi: newNameHi.trim(), en: newNameEn.trim() } });
      setSchemes((current) => [created, ...current]);
      setNoticeDrafts((current) => ({ ...current, [created.id]: "" }));
      setSourceUrls((current) => ({ ...current, [created.id]: "" }));
      setSchemeEditors((current) => ({ ...current, [created.id]: createSchemeEditor(created) }));
      setNewNameHi("");
      setNewNameEn("");
      setFeedback(t({ hi: "नई योजना ड्राफ्ट में सहेजी गई।", en: "New scheme saved as a draft." }));
    } catch (error) {
      setDataError(error instanceof Error ? error.message : "Could not create scheme.");
    } finally { setBusyKey(null); }
  };

  const togglePublish = async (scheme: Scheme) => {
    setBusyKey(`publish-${scheme.id}`);
    setDataError(null);
    try {
      const updated = await updateAdminScheme(scheme.id, { published: !scheme.published });
      setSchemes((current) => current.map((row) => row.id === scheme.id ? { ...row, ...updated } : row));
    } catch (error) { setDataError(error instanceof Error ? error.message : "Could not update scheme."); }
    finally { setBusyKey(null); }
  };

  const removeScheme = async (scheme: Scheme) => {
    if (!window.confirm(t({ hi: "क्या आप इस योजना को हटाना चाहते हैं?", en: "Delete this scheme?" }))) return;
    setBusyKey(`delete-${scheme.id}`);
    setDataError(null);
    try {
      await deleteAdminScheme(scheme.id);
      setSchemes((current) => current.filter((row) => row.id !== scheme.id));
    } catch (error) { setDataError(error instanceof Error ? error.message : "Could not delete scheme."); }
    finally { setBusyKey(null); }
  };

  const updateSchemeEditor = (id: string, key: keyof SchemeEditor, value: string) => {
    setSchemeEditors((current) => ({
      ...current,
      [id]: { ...(current[id] ?? createSchemeEditor(schemes.find((item) => item.id === id)!)), [key]: value },
    }));
  };

  const saveSchemeContent = async (scheme: Scheme) => {
    const editor = schemeEditors[scheme.id];
    if (!editor) return;
    let rules: unknown;
    let districts: unknown;
    try {
      rules = JSON.parse(editor.rulesJson);
      if (!rules || typeof rules !== "object" || Array.isArray(rules)) throw new Error("Rules must be a JSON object.");
      districts = JSON.parse(editor.districtsJson);
      if (districts !== "all" && (!Array.isArray(districts) || districts.some((item) => typeof item !== "string"))) {
        throw new Error('Districts must be the string "all" or a JSON array of district IDs.');
      }
    } catch (error) {
      setDataError(error instanceof Error ? error.message : "Scheme JSON is invalid.");
      return;
    }
    setBusyKey(`content-${scheme.id}`);
    setDataError(null);
    try {
      const updated = await updateAdminScheme(scheme.id, {
        name: { hi: editor.nameHi, en: editor.nameEn },
        need: editor.need,
        districts,
        dept: { hi: editor.deptHi, en: editor.deptEn },
        short: { hi: editor.shortHi, en: editor.shortEn },
        benefit: { hi: editor.benefitHi, en: editor.benefitEn },
        eligibility: pairLines(editor.eligibilityHi, editor.eligibilityEn),
        documents: pairLines(editor.documentsHi, editor.documentsEn),
        steps: pairLines(editor.stepsHi, editor.stepsEn),
        rules,
      });
      setSchemes((current) => current.map((row) => row.id === scheme.id ? { ...row, ...updated } : row));
      setFeedback(t({ hi: "योजना की हिंदी और अंग्रेज़ी सामग्री सहेजी गई।", en: "Hindi and English scheme content saved." }));
    } catch (error) { setDataError(error instanceof Error ? error.message : "Could not save scheme content."); }
    finally { setBusyKey(null); }
  };

  const saveSchemeSource = async (scheme: Scheme) => {
    setBusyKey(`source-${scheme.id}`);
    setDataError(null);
    try {
      const updated = await updateAdminScheme(scheme.id, {
        officialNoticeText: noticeDrafts[scheme.id] ?? "",
        sourceUrl: sourceUrls[scheme.id]?.trim() || null,
      });
      setSchemes((current) => current.map((row) => row.id === scheme.id ? { ...row, ...updated } : row));
      setFeedback(t({ hi: "योजना का स्रोत सहेजा गया।", en: "Scheme source saved." }));
    } catch (error) { setDataError(error instanceof Error ? error.message : "Could not save scheme source."); }
    finally { setBusyKey(null); }
  };

  const generateSummary = async (scheme: Scheme) => {
    setBusyKey(`draft-${scheme.id}`);
    setDataError(null);
    try {
      await updateAdminScheme(scheme.id, {
        officialNoticeText: noticeDrafts[scheme.id] ?? "",
        sourceUrl: sourceUrls[scheme.id]?.trim() || null,
      });
      const draft = await draftSchemeSummary(scheme.id);
      setSchemes((current) => current.map((row) => row.id === scheme.id ? { ...row, aiSummaryDraftHi: draft.draft, aiSummaryApproved: false } : row));
      setFeedback(t({ hi: "AI सारांश ड्राफ्ट तैयार है। प्रकाशित करने से पहले इसे जाँचें।", en: "AI summary draft generated. Review it before approval." }));
    } catch (error) { setDataError(error instanceof Error ? error.message : "Could not generate draft."); }
    finally { setBusyKey(null); }
  };

  const dismissSummary = async (scheme: Scheme) => {
    if (!window.confirm(t({ hi: "क्या आप इस AI ड्राफ्ट को अस्वीकार करना चाहते हैं? इसे प्रकाशित सामग्री में उपयोग नहीं किया जाएगा।", en: "Dismiss this AI draft? It will not be used as published content." }))) return;
    setBusyKey(`dismiss-${scheme.id}`);
    setDataError(null);
    try {
      await dismissSchemeSummary(scheme.id);
      setSchemes((current) => current.map((row) => row.id === scheme.id ? { ...row, aiSummaryDraftHi: null, aiSummaryApproved: false } : row));
      setFeedback(t({ hi: "AI ड्राफ्ट अस्वीकार किया गया। आप हिंदी सारांश स्वयं संपादित कर सकते हैं।", en: "AI draft dismissed. You can edit the Hindi summary manually." }));
    } catch (error) { setDataError(error instanceof Error ? error.message : "Could not dismiss draft."); }
    finally { setBusyKey(null); }
  };

  const approveSummary = async (scheme: Scheme) => {
    setBusyKey(`approve-${scheme.id}`);
    setDataError(null);
    try {
      const updated = await approveSchemeSummary(scheme.id);
      setSchemes((current) => current.map((row) => row.id === scheme.id ? { ...row, ...updated } : row));
      setSchemeEditors((current) => current[scheme.id] ? { ...current, [scheme.id]: { ...current[scheme.id], shortHi: updated.short.hi } } : current);
      setFeedback(t({ hi: "हिंदी सारांश स्वीकृत करके सहेजा गया।", en: "Hindi summary approved and saved." }));
    } catch (error) { setDataError(error instanceof Error ? error.message : "Could not approve summary."); }
    finally { setBusyKey(null); }
  };

  const saveCampaign = async (campaign: Campaign) => {
    setBusyKey(`campaign-${campaign.id}`);
    setDataError(null);
    try {
      const updated = await updateAdminCampaign(campaign.id, { goalAmount: Number(campaignGoals[campaign.id] ?? campaign.goal) });
      setCampaigns((current) => current.map((row) => row.id === campaign.id ? updated : row));
      setCampaignGoals((current) => ({ ...current, [campaign.id]: String(updated.goal) }));
      setFeedback(t({ hi: "अभियान लक्ष्य सहेजा गया।", en: "Campaign goal saved." }));
    } catch (error) { setDataError(error instanceof Error ? error.message : "Could not save campaign."); }
    finally { setBusyKey(null); }
  };

  const toggleCampaign = async (campaign: Campaign) => {
    setBusyKey(`campaign-${campaign.id}`);
    setDataError(null);
    try {
      const updated = await updateAdminCampaign(campaign.id, { active: !campaign.active });
      setCampaigns((current) => current.map((row) => row.id === campaign.id ? updated : row));
    } catch (error) { setDataError(error instanceof Error ? error.message : "Could not update campaign."); }
    finally { setBusyKey(null); }
  };

  const saveBanner = async () => {
    setBusyKey("banner");
    setDataError(null);
    try {
      const result = await updateHomepageBanner(banner);
      setBanner(result.text);
      setFeedback(t({ hi: "होमपेज सूचना सहेजी गई।", en: "Homepage announcement saved." }));
    } catch (error) { setDataError(error instanceof Error ? error.message : "Could not save announcement."); }
    finally { setBusyKey(null); }
  };

  if (checkingSession) return <div className="mx-auto max-w-6xl px-4 py-12 text-muted-foreground">{t({ hi: "सत्र जाँचा जा रहा है…", en: "Checking session…" })}</div>;

  if (!user) return (
    <div className="mx-auto max-w-xl px-4 py-14">
      <div className="card-soft p-6 md:p-8">
        <p className="text-sm text-muted-foreground">{t({ hi: "सिर्फ़ अधिकृत ट्रस्ट कर्मचारी", en: "Authorized trust staff only" })}</p>
        <h1 className="text-3xl mt-1">{t({ hi: "ट्रस्ट प्रशासन में प्रवेश", en: "Trust administrator sign-in" })}</h1>
        <form onSubmit={handleLogin} className="mt-6 space-y-4">
          <label className="flex flex-col gap-1 font-medium">{t({ hi: "ईमेल", en: "Email" })}<input type="email" required autoComplete="username" value={loginEmail} onChange={(event) => setLoginEmail(event.target.value)} className="h-12 rounded-xl border bg-card px-3" /></label>
          <label className="flex flex-col gap-1 font-medium">{t({ hi: "पासवर्ड", en: "Password" })}<input type="password" required autoComplete="current-password" value={loginPassword} onChange={(event) => setLoginPassword(event.target.value)} className="h-12 rounded-xl border bg-card px-3" /></label>
          {loginError && <p role="alert" className="rounded-xl bg-destructive/10 text-destructive p-3 text-sm">{loginError}</p>}
          <button disabled={busyKey === "login"} className="btn-big w-full bg-primary text-primary-foreground disabled:opacity-60">{busyKey === "login" ? t({ hi: "प्रवेश हो रहा है…", en: "Signing in…" }) : t({ hi: "प्रवेश करें", en: "Sign in" })}</button>
        </form>
        <p className="mt-4 text-xs text-muted-foreground">{t({ hi: "डेमो प्रवेश विवरण deployment.md में दिए गए हैं।", en: "Demo credentials are documented in deployment.md." })}</p>
      </div>
    </div>
  );

  if (user.role !== "ADMIN") return (
    <div className="mx-auto max-w-xl px-4 py-14"><div className="card-soft p-6"><h1 className="text-2xl">{t({ hi: "अनुमति नहीं है", en: "Access denied" })}</h1><p className="mt-2 text-muted-foreground">{t({ hi: "इस खाते को ट्रस्ट प्रशासन की अनुमति नहीं है।", en: "This account does not have trust administrator access." })}</p><button onClick={() => void handleLogout()} className="btn-big border bg-card mt-5">{t({ hi: "लॉग आउट", en: "Log out" })}</button></div></div>
  );

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <div className="flex flex-wrap justify-between items-start gap-3">
        <div>
          <p className="text-sm text-muted-foreground">{t({ hi: "डेटाबेस से लाइव डेटा", en: "Live data from database" })}</p>
          <h1 className="text-4xl">{t({ hi: "ट्रस्ट प्रशासन", en: "Trust admin" })}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{user.email}</p>
        </div>
        <button onClick={() => void handleLogout()} disabled={busyKey === "logout"} className="btn-big border bg-card"><LogOut className="size-4" /> {t({ hi: "लॉग आउट", en: "Log out" })}</button>
      </div>

      {dataError && <p role="alert" className="mt-5 rounded-xl bg-destructive/10 text-destructive p-4">{dataError}</p>}
      {feedback && <p role="status" className="mt-5 rounded-xl bg-leaf-soft p-4 text-leaf">{feedback}</p>}
      {loadingData && <p role="status" className="mt-5 text-muted-foreground">{t({ hi: "प्रशासनिक डेटा लोड हो रहा है…", en: "Loading administrative data…" })}</p>}

      <div className="mt-6 grid grid-cols-2 md:grid-cols-4 gap-3">
        <Stat k={t({ hi: "प्रकाशित योजनाएँ", en: "Published schemes" })} v={String(schemes.filter((s) => s.published).length)} />
        <Stat k={t({ hi: "सक्रिय अभियान", en: "Active campaigns" })} v={String(campaigns.filter((c) => c.active).length)} />
        <Stat k={t({ hi: "सफल टेस्ट दान", en: "Successful test donations" })} v={inr(donationTotals.raised)} />
        <Stat k={t({ hi: "मासिक दान इरादे", en: "Monthly intentions" })} v={String(donationTotals.monthly)} />
      </div>

      <div role="tablist" className="mt-8 flex gap-2 overflow-x-auto border-b">
        {TABS.map((item) => (
          <button key={item.id} role="tab" aria-selected={tab === item.id} onClick={() => setTab(item.id)} className={`px-4 h-12 font-semibold border-b-3 -mb-px ${tab === item.id ? "border-primary text-primary" : "border-transparent text-muted-foreground"}`}>
            {t(item.label)}
          </button>
        ))}
      </div>

      {tab === "schemes" && (
        <div className="mt-6">
          <div className="card-soft p-4 grid gap-3 sm:grid-cols-[1fr_1fr_auto_auto] items-end">
            <label className="flex flex-col gap-1 text-sm font-medium">{t({ hi: "योजना का नाम (हिंदी)", en: "Scheme name (Hindi)" })}<input value={newNameHi} onChange={(event) => setNewNameHi(event.target.value)} maxLength={180} className="h-12 rounded-xl border bg-card px-3" /></label>
            <label className="flex flex-col gap-1 text-sm font-medium">{t({ hi: "योजना का नाम (अंग्रेज़ी)", en: "Scheme name (English)" })}<input value={newNameEn} onChange={(event) => setNewNameEn(event.target.value)} maxLength={180} className="h-12 rounded-xl border bg-card px-3" /></label>
            <select value={newNeed} onChange={(event) => setNewNeed(event.target.value as Need)} aria-label="Category" className="h-12 rounded-xl border bg-card px-3">
              {NEEDS.map((item) => <option key={item.id} value={item.id}>{t(item.name)}</option>)}
            </select>
            <button onClick={() => void addScheme()} disabled={!newNameHi.trim() || !newNameEn.trim() || busyKey === "add-scheme"} className="btn-big bg-primary text-primary-foreground disabled:opacity-60"><Plus className="size-5" /> {t({ hi: "ड्राफ्ट जोड़ें", en: "Add draft" })}</button>
          </div>
          <ul className="mt-4 divide-y card-soft">
            {schemes.map((scheme) => (
              <li key={scheme.id} className="p-4">
                <div className="flex items-center gap-3">
                  <span className="text-2xl" aria-hidden>{NEEDS.find((item) => item.id === scheme.need)?.icon}</span>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold truncate">{scheme.name.hi}</p>
                    <p className="text-sm text-muted-foreground">{scheme.id} · {scheme.districts === "all" ? "9/9" : `${scheme.districts.length}/9`} {t({ hi: "ज़िले", en: "districts" })}</p>
                  </div>
                  <span className={`text-xs rounded-full px-2.5 py-1 ${scheme.published ? "bg-leaf-soft text-leaf" : "bg-muted text-muted-foreground"}`}>{scheme.published ? t({ hi: "प्रकाशित", en: "Live" }) : t({ hi: "ड्राफ्ट", en: "Draft" })}</span>
                  <button aria-label="Toggle publish" title={scheme.published ? "Unpublish" : "Publish"} disabled={busyKey === `publish-${scheme.id}`} onClick={() => void togglePublish(scheme)} className="p-2 rounded-lg hover:bg-muted disabled:opacity-50">
                    {scheme.published ? <EyeOff className="size-5" /> : <Eye className="size-5" />}
                  </button>
                  <button aria-label="Delete" disabled={busyKey === `delete-${scheme.id}`} onClick={() => void removeScheme(scheme)} className="p-2 rounded-lg hover:bg-muted text-destructive disabled:opacity-50"><Trash2 className="size-5" /></button>
                </div>
                <details className="mt-3 ml-9 text-sm">
                  <summary className="cursor-pointer font-semibold text-primary">{t({ hi: "आधिकारिक स्रोत और AI सारांश", en: "Official source and AI summary" })}</summary>
                  <div className="mt-3 space-y-4">
                    {schemeEditors[scheme.id] && <>
                      <div className="grid gap-3 md:grid-cols-2">
                        <EditorField label="योजना का नाम — हिंदी / Name — Hindi" value={schemeEditors[scheme.id]!.nameHi} onChange={(value) => updateSchemeEditor(scheme.id, "nameHi", value)} />
                        <EditorField label="योजना का नाम — अंग्रेज़ी / Name — English" value={schemeEditors[scheme.id]!.nameEn} onChange={(value) => updateSchemeEditor(scheme.id, "nameEn", value)} />
                        <EditorField label="विभाग — हिंदी / Department — Hindi" value={schemeEditors[scheme.id]!.deptHi} onChange={(value) => updateSchemeEditor(scheme.id, "deptHi", value)} />
                        <EditorField label="विभाग — अंग्रेज़ी / Department — English" value={schemeEditors[scheme.id]!.deptEn} onChange={(value) => updateSchemeEditor(scheme.id, "deptEn", value)} />
                        <EditorField label="संक्षिप्त विवरण — हिंदी / Summary — Hindi" value={schemeEditors[scheme.id]!.shortHi} onChange={(value) => updateSchemeEditor(scheme.id, "shortHi", value)} multiline />
                        <EditorField label="संक्षिप्त विवरण — अंग्रेज़ी / Summary — English" value={schemeEditors[scheme.id]!.shortEn} onChange={(value) => updateSchemeEditor(scheme.id, "shortEn", value)} multiline />
                        <EditorField label="लाभ — हिंदी / Benefit — Hindi" value={schemeEditors[scheme.id]!.benefitHi} onChange={(value) => updateSchemeEditor(scheme.id, "benefitHi", value)} multiline />
                        <EditorField label="लाभ — अंग्रेज़ी / Benefit — English" value={schemeEditors[scheme.id]!.benefitEn} onChange={(value) => updateSchemeEditor(scheme.id, "benefitEn", value)} multiline />
                        <EditorField label="पात्रता — हिंदी (एक पंक्ति प्रति नियम) / Eligibility — Hindi" value={schemeEditors[scheme.id]!.eligibilityHi} onChange={(value) => updateSchemeEditor(scheme.id, "eligibilityHi", value)} multiline />
                        <EditorField label="पात्रता — अंग्रेज़ी / Eligibility — English" value={schemeEditors[scheme.id]!.eligibilityEn} onChange={(value) => updateSchemeEditor(scheme.id, "eligibilityEn", value)} multiline />
                        <EditorField label="दस्तावेज़ — हिंदी / Documents — Hindi" value={schemeEditors[scheme.id]!.documentsHi} onChange={(value) => updateSchemeEditor(scheme.id, "documentsHi", value)} multiline />
                        <EditorField label="दस्तावेज़ — अंग्रेज़ी / Documents — English" value={schemeEditors[scheme.id]!.documentsEn} onChange={(value) => updateSchemeEditor(scheme.id, "documentsEn", value)} multiline />
                        <EditorField label="आवेदन चरण — हिंदी / Steps — Hindi" value={schemeEditors[scheme.id]!.stepsHi} onChange={(value) => updateSchemeEditor(scheme.id, "stepsHi", value)} multiline />
                        <EditorField label="आवेदन चरण — अंग्रेज़ी / Steps — English" value={schemeEditors[scheme.id]!.stepsEn} onChange={(value) => updateSchemeEditor(scheme.id, "stepsEn", value)} multiline />
                      </div>
                      <div className="grid md:grid-cols-2 gap-3">
                        <label className="flex flex-col gap-1">{t({ hi: "पात्रता नियम JSON", en: "Eligibility rules JSON" })}<textarea rows={5} spellCheck={false} value={schemeEditors[scheme.id]!.rulesJson} onChange={(event) => updateSchemeEditor(scheme.id, "rulesJson", event.target.value)} className="rounded-lg border bg-card p-3 font-mono text-xs" /></label>
                        <label className="flex flex-col gap-1">{t({ hi: "ज़िला कवरेज JSON (या all)", en: "District coverage JSON (or all)" })}<textarea rows={5} spellCheck={false} value={schemeEditors[scheme.id]!.districtsJson} onChange={(event) => updateSchemeEditor(scheme.id, "districtsJson", event.target.value)} className="rounded-lg border bg-card p-3 font-mono text-xs" /></label>
                      </div>
                      <p className="text-xs text-muted-foreground">{t({ hi: "समर्थित नियम: minAge, maxAge, widowed, bpl, shgMember, pregnant, firstChild, married, hasDaughter, rural। ज़िला सूची में केवल configured 9 demo IDs मान्य हैं। प्रकाशित करने से पहले नियमों, कवरेज और आधिकारिक स्रोत की समीक्षा करें।", en: "Supported rule keys: minAge, maxAge, widowed, bpl, shgMember, pregnant, firstChild, married, hasDaughter, rural. District arrays accept the configured nine demo IDs. Review rules, coverage and the official source before publishing." })}</p>
                      <button onClick={() => void saveSchemeContent(scheme)} disabled={busyKey === `content-${scheme.id}`} className="btn-big bg-primary text-primary-foreground"><Save className="size-4" /> {t({ hi: "योजना सामग्री सहेजें", en: "Save scheme content" })}</button>
                    </>}
                    <label className="flex flex-col gap-1">{t({ hi: "आधिकारिक नोटिस का URL", en: "Official notice URL" })}<input type="url" value={sourceUrls[scheme.id] ?? ""} onChange={(event) => setSourceUrls((current) => ({ ...current, [scheme.id]: event.target.value }))} className="h-10 rounded-lg border bg-card px-3" placeholder="https://" /></label>
                    <label className="flex flex-col gap-1">{t({ hi: "आधिकारिक नोटिस का पाठ (AI इसी से ड्राफ्ट बनाएगा)", en: "Official notice text (AI drafts only from this text)" })}<textarea rows={4} value={noticeDrafts[scheme.id] ?? ""} onChange={(event) => setNoticeDrafts((current) => ({ ...current, [scheme.id]: event.target.value }))} className="rounded-lg border bg-card p-3" /></label>
                    <div className="flex flex-wrap gap-2">
                      <button onClick={() => void saveSchemeSource(scheme)} disabled={busyKey === `source-${scheme.id}`} className="btn-big !min-h-10 border bg-card"><Save className="size-4" /> {t({ hi: "स्रोत सहेजें", en: "Save source" })}</button>
                      <button onClick={() => void generateSummary(scheme)} disabled={busyKey === `draft-${scheme.id}`} className="btn-big !min-h-10 bg-secondary text-secondary-foreground"><Sparkles className="size-4" /> {t({ hi: "हिंदी सारांश ड्राफ्ट", en: "Draft Hindi summary" })}</button>
                    </div>
                    {scheme.aiSummaryDraftHi && <div className="rounded-xl bg-muted p-4"><p className="text-xs uppercase tracking-wide text-muted-foreground">{scheme.aiSummaryApproved ? t({ hi: "स्वीकृत सारांश", en: "Approved summary" }) : t({ hi: "AI ड्राफ्ट — समीक्षा आवश्यक", en: "AI draft — review required" })}</p><p className="mt-2 whitespace-pre-wrap">{scheme.aiSummaryDraftHi}</p>{!scheme.aiSummaryApproved && <div className="mt-3 flex flex-wrap gap-2"><button onClick={() => void approveSummary(scheme)} disabled={busyKey === `approve-${scheme.id}`} className="btn-big bg-primary text-primary-foreground"><CheckCircle2 className="size-4" /> {t({ hi: "सारांश स्वीकृत करें", en: "Approve summary" })}</button><button onClick={() => void dismissSummary(scheme)} disabled={busyKey === `dismiss-${scheme.id}`} className="btn-big border bg-card">{t({ hi: "ड्राफ्ट अस्वीकार करें", en: "Dismiss draft" })}</button></div>}</div>}
                  </div>
                </details>
              </li>
            ))}
            {schemes.length === 0 && !loadingData && <li className="p-5 text-muted-foreground">{t({ hi: "अभी कोई योजना नहीं है। ऊपर से नई योजना जोड़ें।", en: "No schemes yet. Add one above." })}</li>}
          </ul>
        </div>
      )}

      {tab === "campaigns" && (
        <ul className="mt-6 grid md:grid-cols-3 gap-4">
          {campaigns.map((campaign) => (
            <li key={campaign.id} className="card-soft p-5">
              <p className="text-3xl" aria-hidden>{campaign.emoji}</p>
              <p className="font-display text-lg mt-1">{t(campaign.title)}</p>
              <label className="mt-3 flex flex-col text-sm font-medium gap-1">{t({ hi: "लक्ष्य (₹)", en: "Goal (₹)" })}<input type="number" min={1000} value={campaignGoals[campaign.id] ?? campaign.goal} onChange={(event) => setCampaignGoals((current) => ({ ...current, [campaign.id]: event.target.value }))} className="h-11 rounded-xl border bg-card px-3" /></label>
              <p className="text-sm mt-2">{inr(campaign.raised)} · {campaign.goal > 0 ? Math.round((campaign.raised / campaign.goal) * 100) : 0}%</p>
              <button onClick={() => void saveCampaign(campaign)} disabled={busyKey === `campaign-${campaign.id}`} className="btn-big !min-h-10 w-full mt-3 border bg-card"><Save className="size-4" /> {t({ hi: "लक्ष्य सहेजें", en: "Save goal" })}</button>
              <label className="mt-3 flex items-center gap-2 font-medium"><input type="checkbox" className="size-5 accent-primary" checked={campaign.active} onChange={() => void toggleCampaign(campaign)} disabled={busyKey === `campaign-${campaign.id}`} />{t({ hi: "सक्रिय", en: "Active" })}</label>
            </li>
          ))}
          {campaigns.length === 0 && !loadingData && <li className="text-muted-foreground">{t({ hi: "कोई अभियान नहीं है।", en: "No campaigns found." })}</li>}
        </ul>
      )}

      {tab === "donations" && (
        <div className="mt-6 card-soft overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-muted text-sm"><tr>{["ID", t({ hi: "दानदाता", en: "Donor" }), t({ hi: "राशि", en: "Amount" }), t({ hi: "प्रकार", en: "Type" }), t({ hi: "स्थिति", en: "Status" }), t({ hi: "दिनांक", en: "Date" })].map((heading) => <th key={heading} className="p-3">{heading}</th>)}</tr></thead>
            <tbody>
              {donations.map((donation) => <tr key={donation.id} className="border-t"><td className="p-3 font-mono text-xs">{donation.id.slice(0, 12)}</td><td className="p-3">{donation.donorName}<p className="text-xs text-muted-foreground">{donation.donorEmail}</p></td><td className="p-3 font-semibold">{inr(donation.amount)}</td><td className="p-3">{donation.frequency === "MONTHLY" ? t({ hi: "मासिक इरादा", en: "Monthly intention" }) : t({ hi: "एक बार", en: "One-time" })}</td><td className="p-3">{donation.status === "SUCCEEDED" ? "TEST" : donation.status}</td><td className="p-3">{new Date(donation.createdAt).toLocaleDateString("en-IN")}</td></tr>)}
              {donations.length === 0 && <tr><td colSpan={6} className="p-5 text-muted-foreground">{t({ hi: "अभी कोई दान दर्ज नहीं है।", en: "No donations have been recorded yet." })}</td></tr>}
            </tbody>
          </table>
          <p className="p-3 text-xs text-muted-foreground">{t({ hi: "सभी राशियाँ परीक्षण लेन-देन हैं; कोई वास्तविक भुगतान नहीं हुआ।", en: "All amounts are test transactions; no real payment was collected." })}</p>
        </div>
      )}

      {tab === "content" && (
        <div className="mt-6 card-soft p-5 max-w-2xl">
          <label className="flex flex-col gap-1 font-medium">{t({ hi: "होमपेज सूचना पट्टी", en: "Homepage announcement" })}<textarea value={banner} onChange={(event) => setBanner(event.target.value)} rows={3} maxLength={1000} className="rounded-xl border bg-card p-3" /></label>
          <p className="mt-4 text-sm text-muted-foreground">{t({ hi: "पूर्वावलोकन", en: "Preview" })}</p>
          <div className="mt-1 rounded-xl bg-secondary text-secondary-foreground p-3 font-semibold">{banner || t({ hi: "कोई सूचना नहीं", en: "No announcement" })}</div>
          <button onClick={() => void saveBanner()} disabled={busyKey === "banner"} className="btn-big bg-primary text-primary-foreground mt-4"><Save className="size-4" /> {t({ hi: "सहेजें", en: "Save" })}</button>
        </div>
      )}
    </div>
  );
}

function Stat({ k, v }: { k: string; v: string }) {
  return <div className="card-soft p-4"><p className="text-sm text-muted-foreground">{k}</p><p className="font-display text-2xl mt-1">{v}</p></div>;
}
