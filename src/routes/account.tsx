import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { Download, LogIn, LogOut, UserPlus } from "lucide-react";
import { useLang } from "@/lib/i18n";
import { ApiError, downloadReceipt, getMe, getMyDonations, login, logout, registerDonor, type DonationHistoryItem, type SessionUser } from "@/lib/api";
import { inr } from "@/lib/data";

export const Route = createFileRoute("/account")({
  head: () => ({ meta: [{ title: "दाता खाता — SakhiSetu" }, { name: "robots", content: "noindex" }] }),
  component: Account,
});

function Account() {
  const { t } = useLang();
  const [user, setUser] = useState<SessionUser | null>(null);
  const [checking, setChecking] = useState(true);
  const [mode, setMode] = useState<"login" | "register">("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [donations, setDonations] = useState<DonationHistoryItem[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    getMe().then(({ user: sessionUser }) => { if (active) setUser(sessionUser); })
      .catch(() => { if (active) setUser(null); })
      .finally(() => { if (active) setChecking(false); });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!user || user.role !== "DONOR") return;
    let active = true;
    setLoadingHistory(true);
    getMyDonations().then((rows) => { if (active) setDonations(rows); })
      .catch((reason: unknown) => { if (active) setError(reason instanceof Error ? reason.message : "Could not load donation history."); })
      .finally(() => { if (active) setLoadingHistory(false); });
    return () => { active = false; };
  }, [user]);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const result = mode === "register"
        ? await registerDonor({ name: name.trim(), email: email.trim(), password })
        : await login({ email: email.trim(), password });
      setUser(result.user);
      setPassword("");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not authenticate.");
    } finally { setBusy(false); }
  };

  const handleLogout = async () => {
    setBusy(true);
    try { await logout(); setUser(null); setDonations([]); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "Could not sign out."); }
    finally { setBusy(false); }
  };

  const download = async (item: DonationHistoryItem) => {
    if (!item.receipt) return;
    setDownloadingId(item.id);
    setError(null);
    try {
      const blob = await downloadReceipt(item.receipt.id);
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `SakhiSetu-${item.receipt.receiptNumber.replaceAll("/", "-")}.pdf`;
      anchor.click();
      URL.revokeObjectURL(url);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Could not download receipt."); }
    finally { setDownloadingId(null); }
  };

  if (checking) return <div className="mx-auto max-w-4xl px-4 py-12 text-muted-foreground">{t({ hi: "खाता जाँचा जा रहा है…", en: "Checking account…" })}</div>;

  if (!user) return (
    <div className="mx-auto max-w-xl px-4 py-12">
      <div className="card-soft p-6 md:p-8">
        <p className="text-sm text-primary font-semibold">{t({ hi: "दाता खाता", en: "Donor account" })}</p>
        <h1 className="font-display text-3xl mt-1">{mode === "login" ? t({ hi: "वापस स्वागत है", en: "Welcome back" }) : t({ hi: "अपना खाता बनाएँ", en: "Create your account" })}</h1>
        <div className="mt-5 grid grid-cols-2 rounded-full bg-muted p-1" role="group" aria-label="Account mode">
          <button type="button" onClick={() => { setMode("login"); setError(null); }} className={`h-10 rounded-full font-semibold ${mode === "login" ? "bg-card shadow" : "text-muted-foreground"}`}>{t({ hi: "लॉग इन", en: "Sign in" })}</button>
          <button type="button" onClick={() => { setMode("register"); setError(null); }} className={`h-10 rounded-full font-semibold ${mode === "register" ? "bg-card shadow" : "text-muted-foreground"}`}>{t({ hi: "नया खाता", en: "Register" })}</button>
        </div>
        <form onSubmit={submit} className="mt-5 space-y-4">
          {mode === "register" && <label className="flex flex-col gap-1 font-medium">{t({ hi: "पूरा नाम", en: "Full name" })}<input required minLength={2} maxLength={100} value={name} onChange={(event) => setName(event.target.value)} autoComplete="name" className="h-12 rounded-xl border bg-card px-3" /></label>}
          <label className="flex flex-col gap-1 font-medium">{t({ hi: "ईमेल", en: "Email" })}<input type="email" required maxLength={254} value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" className="h-12 rounded-xl border bg-card px-3" /></label>
          <label className="flex flex-col gap-1 font-medium">{t({ hi: "पासवर्ड", en: "Password" })}<input type="password" required minLength={mode === "register" ? 12 : 1} maxLength={128} value={password} onChange={(event) => setPassword(event.target.value)} autoComplete={mode === "register" ? "new-password" : "current-password"} className="h-12 rounded-xl border bg-card px-3" />{mode === "register" && <span className="text-xs text-muted-foreground">{t({ hi: "कम से कम 12 अक्षर।", en: "At least 12 characters." })}</span>}</label>
          {error && <p role="alert" className="rounded-xl bg-destructive/10 text-destructive p-3 text-sm">{error}</p>}
          <button disabled={busy} className="btn-big w-full bg-primary text-primary-foreground disabled:opacity-60">{mode === "login" ? <LogIn className="size-4" /> : <UserPlus className="size-4" />}{busy ? t({ hi: "कृपया प्रतीक्षा करें…", en: "Please wait…" }) : mode === "login" ? t({ hi: "प्रवेश करें", en: "Sign in" }) : t({ hi: "खाता बनाएँ", en: "Create account" })}</button>
        </form>
        <p className="mt-4 text-xs text-muted-foreground">{t({ hi: "दान करते समय इसी खाते में लॉग इन रहें, ताकि दान का इतिहास और रसीदें यहाँ दिखें।", en: "Stay signed in while donating so your donation history and receipts appear here." })}</p>
      </div>
    </div>
  );

  if (user.role !== "DONOR") return <div className="mx-auto max-w-4xl px-4 py-12"><p>{t({ hi: "यह दाता खाता पृष्ठ केवल दाताओं के लिए है।", en: "This account page is for donors." })}</p><button onClick={() => void handleLogout()} className="btn-big border bg-card mt-4"><LogOut className="size-4" />{t({ hi: "लॉग आउट", en: "Log out" })}</button></div>;

  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div><p className="text-sm text-primary font-semibold">{t({ hi: "दाता खाता", en: "Donor account" })}</p><h1 className="text-4xl mt-1">{t({ hi: "नमस्ते", en: "Hello" })}, {user.name}</h1><p className="text-muted-foreground mt-1">{user.email}</p></div>
        <button onClick={() => void handleLogout()} disabled={busy} className="btn-big border bg-card"><LogOut className="size-4" />{t({ hi: "लॉग आउट", en: "Log out" })}</button>
      </div>
      <h2 className="font-display text-2xl mt-8">{t({ hi: "आपके दान और रसीदें", en: "Your donations and receipts" })}</h2>
      {error && <p role="alert" className="mt-4 rounded-xl bg-destructive/10 text-destructive p-4">{error}</p>}
      {loadingHistory ? <p role="status" className="mt-4 text-muted-foreground">{t({ hi: "इतिहास लोड हो रहा है…", en: "Loading history…" })}</p> : donations.length === 0 ? <div className="card-soft p-6 mt-4"><p className="text-muted-foreground">{t({ hi: "अभी आपके खाते से कोई दान जुड़ा नहीं है। अगला दान करते समय लॉग इन रहें।", en: "No donations are linked to this account yet. Stay signed in when making your next donation." })}</p></div> : (
        <ul className="mt-4 divide-y card-soft">
          {donations.map((item) => <li key={item.id} className="p-4 flex flex-wrap items-center gap-4"><div className="flex-1 min-w-0"><p className="font-semibold">{t(item.campaign.title)}</p><p className="text-sm text-muted-foreground">{new Date(item.createdAt).toLocaleDateString("en-IN")} · {item.frequency === "MONTHLY" ? t({ hi: "मासिक इरादा", en: "Monthly intention" }) : t({ hi: "एक बार", en: "One-time" })} · {item.status}{item.testMode ? ` · ${t({ hi: "टेस्ट मोड", en: "TEST MODE" })}` : ""}</p>{item.receipt && <p className="font-mono text-xs mt-1">{item.receipt.receiptNumber}</p>}</div><p className="font-display text-xl">{inr(item.amount)}</p>{item.receipt && <button onClick={() => void download(item)} disabled={downloadingId === item.id} className="btn-big !min-h-10 bg-ink text-ink-foreground"><Download className="size-4" />{downloadingId === item.id ? t({ hi: "डाउनलोड…", en: "Downloading…" }) : t({ hi: "PDF", en: "PDF" })}</button>}</li>)}
        </ul>
      )}
      <p className="mt-5 text-xs text-muted-foreground">{t({ hi: "यहाँ दिखाए गए सभी लेन-देन परीक्षण मोड में हैं।", en: "All transactions shown here are test-mode records." })}</p>
    </div>
  );
}
