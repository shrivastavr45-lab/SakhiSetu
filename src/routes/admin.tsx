import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, useMemo, type FormEvent } from "react";
import {
  LayoutDashboard,
  BookOpen,
  HeartHandshake,
  Receipt,
  Users,
  FileText,
  BarChart3,
  Settings,
  LogOut,
  RefreshCw,
  AlertCircle,
  TrendingUp,
  ShieldCheck,
  Menu,
  X,
  Clock,
  ChevronRight,
  Sparkles,
  Plus,
  Search,
  CheckCircle2,
  Eye,
  EyeOff,
  Edit3,
  Trash2,
  ExternalLink,
  Calendar,
  Layers,
  Save,
  Check,
} from "lucide-react";
import { DISTRICTS, NEEDS, inr, type Need, type Scheme, type Campaign } from "@/lib/data";
import { useLang, type L } from "@/lib/i18n";
import {
  getAdminOverview,
  getMe,
  getSchemes,
  getCampaigns,
  getAdminDonations,
  getAdminDonors,
  getAdminDonorDonations,
  getAdminReceipts,
  downloadReceipt,
  createAdminScheme,
  updateAdminScheme,
  deleteAdminScheme,
  updateAdminCampaign,
  draftSchemeSummary,
  approveSchemeSummary,
  dismissSchemeSummary,
  login,
  logout,
  type AdminOverviewData,
  type AdminDonation,
  type AdminDonorSummary,
  type AdminDonorDonation,
  type AdminReceipt,
  type SessionUser,
} from "@/lib/api";

export const Route = createFileRoute("/admin")({
  head: () => ({
    meta: [
      { title: "ट्रस्ट प्रशासन — SakhiSetu Dashboard" },
      { name: "description", content: "SakhiSetu Charitable Trust Administrative Dashboard." },
      { property: "og:title", content: "SakhiSetu Admin Dashboard" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AdminDashboard,
});

type NavItem = {
  id: string;
  icon: typeof LayoutDashboard;
  label: L;
  description: L;
  checkpoint?: string;
};

const NAV_ITEMS: NavItem[] = [
  {
    id: "overview",
    icon: LayoutDashboard,
    label: { hi: "सिंहावलोकन", en: "Overview" },
    description: { hi: "ट्रस्ट की मुख्य सांख्यिकी और ताज़ा गतिविधियाँ", en: "Main trust metrics and real-time activity" },
  },
  {
    id: "schemes",
    icon: BookOpen,
    label: { hi: "योजना प्रबंधन", en: "Manage Schemes" },
    description: { hi: "सरकारी योजनाओं का संपादन, नियम, जिले व AI सारांश", en: "Government schemes, eligibility rules, districts & AI drafts" },
  },
  {
    id: "campaigns",
    icon: HeartHandshake,
    label: { hi: "अभियान प्रबंधन", en: "Manage Campaigns" },
    description: { hi: "सहायता अभियान, लक्ष्य व धन संग्रह स्थिति", en: "Charity campaigns, goals & live collections" },
  },
  {
    id: "donations",
    icon: Receipt,
    label: { hi: "दान व लेन-देन", en: "Donations & Transactions" },
    description: { hi: "सफल, लंबित और विफल लेन-देन का विवरण", en: "Detailed donation records, filters & CSV export" },
  },
  {
    id: "donors",
    icon: Users,
    label: { hi: "दानदाता रिकॉर्ड", en: "Donor Records" },
    description: { hi: "दानदाताओं की प्रोफ़ाइल, इतिहास व गोपनीय विवरण", en: "Donor profiles, history and authorized PAN view" },
  },
  {
    id: "receipts",
    icon: FileText,
    label: { hi: "रसीदें व प्रमाण पत्र", en: "Receipts & Certificates" },
    description: { hi: "80G रसीदें, पीडीएफ डाउनलोड व जनरेशन स्थिति", en: "80G test receipts, PDF downloads & status" },
  },
  {
    id: "reports",
    icon: BarChart3,
    label: { hi: "रिपोर्ट्स व विश्लेषण", en: "Reports & Analytics" },
    description: { hi: "मासिक संग्रह, अभियान रिपोर्ट व Form 10BD प्रारूप", en: "Financial summaries, analytics & Form 10BD export" },
    checkpoint: "Checkpoint 6",
  },
  {
    id: "settings",
    icon: Settings,
    label: { hi: "ट्रस्ट सेटिंग्स", en: "Settings" },
    description: { hi: "होमपेज सूचना पट्टी, ऑडिट लॉग व ट्रस्ट विवरण", en: "Trust banner, audit trail & configuration" },
    checkpoint: "Checkpoint 6",
  },
];

function AdminDashboard() {
  const { t } = useLang();
  const [user, setUser] = useState<SessionUser | null>(null);
  const [checkingSession, setCheckingSession] = useState(true);
  const [activeNav, setActiveNav] = useState("schemes"); // Open Schemes directly or default to Overview
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Overview data states
  const [overview, setOverview] = useState<AdminOverviewData | null>(null);
  const [loadingOverview, setLoadingOverview] = useState(false);
  const [overviewError, setOverviewError] = useState<string | null>(null);

  // Schemes management states
  const [schemes, setSchemes] = useState<Scheme[]>([]);
  const [loadingSchemes, setLoadingSchemes] = useState(false);
  const [schemesError, setSchemesError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  // Campaign management states
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loadingCampaigns, setLoadingCampaigns] = useState(false);
  const [campaignsError, setCampaignsError] = useState<string | null>(null);

  // Donations management states
  const [donations, setDonations] = useState<AdminDonation[]>([]);
  const [loadingDonations, setLoadingDonations] = useState(false);
  const [donationsError, setDonationsError] = useState<string | null>(null);

  // Donors management states
  const [donors, setDonors] = useState<AdminDonorSummary[]>([]);
  const [loadingDonors, setLoadingDonors] = useState(false);
  const [donorsError, setDonorsError] = useState<string | null>(null);

  // Receipts management states
  const [receipts, setReceipts] = useState<AdminReceipt[]>([]);
  const [loadingReceipts, setLoadingReceipts] = useState(false);
  const [receiptsError, setReceiptsError] = useState<string | null>(null);

  // Login form states
  const [loginEmail, setLoginEmail] = useState("admin@sakhisetu.test");
  const [loginPassword, setLoginPassword] = useState("");
  const [loginError, setLoginError] = useState<string | null>(null);
  const [busyKey, setBusyKey] = useState<string | null>(null);

  // Check current session
  useEffect(() => {
    let active = true;
    getMe()
      .then(({ user: sessionUser }) => {
        if (active) setUser(sessionUser);
      })
      .catch(() => {
        if (active) setUser(null);
      })
      .finally(() => {
        if (active) setCheckingSession(false);
      });
    return () => {
      active = false;
    };
  }, []);

  // Fetch overview
  const fetchOverview = async () => {
    setLoadingOverview(true);
    setOverviewError(null);
    try {
      const data = await getAdminOverview();
      setOverview(data);
    } catch (err) {
      setOverviewError(err instanceof Error ? err.message : "Failed to load dashboard overview.");
    } finally {
      setLoadingOverview(false);
    }
  };

  // Fetch schemes (all including drafts)
  const fetchSchemes = async () => {
    setLoadingSchemes(true);
    setSchemesError(null);
    try {
      const data = await getSchemes({ drafts: true });
      setSchemes(data);
    } catch (err) {
      setSchemesError(err instanceof Error ? err.message : "Failed to load schemes.");
    } finally {
      setLoadingSchemes(false);
    }
  };

  // Fetch campaigns (including inactive)
  const fetchCampaigns = async () => {
    setLoadingCampaigns(true);
    setCampaignsError(null);
    try {
      const data = await getCampaigns(true);
      setCampaigns(data);
    } catch (err) {
      setCampaignsError(err instanceof Error ? err.message : "Failed to load campaigns.");
    } finally {
      setLoadingCampaigns(false);
    }
  };

  // Fetch donations (all, up to 500)
  const fetchDonations = async () => {
    setLoadingDonations(true);
    setDonationsError(null);
    try {
      const data = await getAdminDonations();
      setDonations(data);
    } catch (err) {
      setDonationsError(err instanceof Error ? err.message : "Failed to load donations.");
    } finally {
      setLoadingDonations(false);
    }
  };

  // Fetch donor records (registered donors with aggregated stats)
  const fetchDonors = async () => {
    setLoadingDonors(true);
    setDonorsError(null);
    try {
      const data = await getAdminDonors();
      setDonors(data);
    } catch (err) {
      setDonorsError(err instanceof Error ? err.message : "Failed to load donor records.");
    } finally {
      setLoadingDonors(false);
    }
  };

  // Fetch receipts (admin view)
  const fetchReceipts = async () => {
    setLoadingReceipts(true);
    setReceiptsError(null);
    try {
      const data = await getAdminReceipts();
      setReceipts(data);
    } catch (err) {
      setReceiptsError(err instanceof Error ? err.message : "Failed to load receipts.");
    } finally {
      setLoadingReceipts(false);
    }
  };

  useEffect(() => {
    if (user?.role === "ADMIN") {
      void fetchOverview();
      void fetchSchemes();
      void fetchCampaigns();
      void fetchDonations();
      void fetchDonors();
      void fetchReceipts();
    }
  }, [user]);

  const handleLogin = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoginError(null);
    setBusyKey("login");
    try {
      const result = await login({ email: loginEmail.trim(), password: loginPassword });
      if (result.user.role !== "ADMIN") {
        await logout();
        throw new Error(
          t({
            hi: "इस खाते को ट्रस्ट प्रशासन में प्रवेश की अनुमति नहीं है।",
            en: "This account does not have trust administrator access.",
          })
        );
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
    try {
      await logout();
    } finally {
      setUser(null);
      setOverview(null);
      setSchemes([]);
      setCampaigns([]);
      setDonations([]);
      setDonors([]);
      setReceipts([]);
      setBusyKey(null);
    }
  };

  if (checkingSession) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-20 text-center">
        <div className="inline-block size-8 animate-spin rounded-full border-3 border-primary border-t-transparent" />
        <p className="mt-4 text-muted-foreground">{t({ hi: "प्रशासनिक सत्र जाँचा जा रहा है…", en: "Verifying administrative session…" })}</p>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="mx-auto max-w-md px-4 py-16">
        <div className="card-soft p-6 md:p-8">
          <div className="flex items-center gap-2 text-primary">
            <ShieldCheck className="size-5" />
            <span className="text-xs font-semibold uppercase tracking-wider">{t({ hi: "सुरक्षित प्रशासनिक प्रवेश", en: "Authorized Staff Only" })}</span>
          </div>
          <h1 className="font-display text-3xl mt-2">{t({ hi: "सखीसेतु प्रशासन", en: "Trust Administrator Sign-in" })}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t({ hi: "डैशबोर्ड तक पहुँचने के लिए अधिकृत क्रेडेंशियल्स दर्ज करें।", en: "Sign in with verified administrator credentials." })}</p>

          <form onSubmit={handleLogin} className="mt-6 space-y-4">
            <label className="flex flex-col gap-1 text-sm font-medium">
              {t({ hi: "प्रशासक ईमेल", en: "Admin Email" })}
              <input
                type="email"
                required
                autoComplete="username"
                value={loginEmail}
                onChange={(event) => setLoginEmail(event.target.value)}
                className="h-11 rounded-xl border bg-card px-3 text-sm focus:border-primary focus:outline-none"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm font-medium">
              {t({ hi: "पासवर्ड", en: "Password" })}
              <input
                type="password"
                required
                autoComplete="current-password"
                value={loginPassword}
                onChange={(event) => setLoginPassword(event.target.value)}
                className="h-11 rounded-xl border bg-card px-3 text-sm focus:border-primary focus:outline-none"
              />
            </label>
            {loginError && (
              <div role="alert" className="flex items-center gap-2 rounded-xl bg-destructive/10 p-3 text-sm text-destructive">
                <AlertCircle className="size-4 shrink-0" />
                <span>{loginError}</span>
              </div>
            )}
            <button
              disabled={busyKey === "login"}
              className="btn-big w-full bg-primary text-primary-foreground disabled:opacity-60"
            >
              {busyKey === "login" ? t({ hi: "सत्यापित हो रहा है…", en: "Signing in…" }) : t({ hi: "डैशबोर्ड खोलें", en: "Sign in to Dashboard" })}
            </button>
          </form>

          <div className="mt-6 border-t pt-4 text-xs text-muted-foreground">
            <p><strong>{t({ hi: "डेमो खाता:", en: "Demo credentials:" })}</strong> <code>admin@sakhisetu.test</code> / <code>SakhiDemo!2026</code></p>
          </div>
        </div>
      </div>
    );
  }

  if (user.role !== "ADMIN") {
    return (
      <div className="mx-auto max-w-md px-4 py-16">
        <div className="card-soft p-6 text-center">
          <AlertCircle className="mx-auto size-12 text-destructive" />
          <h1 className="font-display text-2xl mt-3">{t({ hi: "अनुमति नहीं है", en: "Access Denied" })}</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {t({
              hi: "आपका खाता सामान्य दानदाता के रूप में पंजीकृत है। प्रशासनिक क्षेत्र में प्रवेश केवल ट्रस्ट प्रशासकों के लिए है।",
              en: "Your account is a standard donor account. Administrator area is restricted to trust staff.",
            })}
          </p>
          <button onClick={() => void handleLogout()} className="btn-big border bg-card mt-6 w-full">
            <LogOut className="size-4" /> {t({ hi: "लॉग आउट करें", en: "Sign out" })}
          </button>
        </div>
      </div>
    );
  }

  const currentNav = NAV_ITEMS.find((item) => item.id === activeNav) ?? NAV_ITEMS[0]!;

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-background">
      {/* Top Status Bar */}
      <div className="border-b bg-card/60 backdrop-blur px-4 py-2.5">
        <div className="mx-auto max-w-7xl flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden p-2 rounded-lg border bg-card hover:bg-muted"
              aria-label="Toggle navigation menu"
            >
              {mobileMenuOpen ? <X className="size-5" /> : <Menu className="size-5" />}
            </button>
            <div className="flex items-center gap-2">
              <span className="flex size-2 rounded-full bg-leaf animate-pulse" />
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {t({ hi: "सखीसेतु ट्रस्ट कंट्रोल सेंटर", en: "SakhiSetu Control Center" })}
              </span>
            </div>
            <span className="hidden sm:inline-block rounded-full bg-secondary/60 px-2.5 py-0.5 text-xs font-medium text-secondary-foreground">
              {t({ hi: "परीक्षण मोड सक्रिय (MOCK)", en: "Test Mode Active (MOCK)" })}
            </span>
          </div>

          <div className="flex items-center gap-3">
            <span className="hidden md:inline-block text-xs text-muted-foreground">
              {user.name} ({user.email})
            </span>
            <button
              onClick={() => void handleLogout()}
              disabled={busyKey === "logout"}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border bg-card text-xs font-semibold hover:bg-muted disabled:opacity-50"
            >
              <LogOut className="size-3.5" />
              <span>{t({ hi: "लॉग आउट", en: "Log out" })}</span>
            </button>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-4 py-6 md:py-8 grid md:grid-cols-[260px_1fr] gap-6 items-start">
        {/* Responsive Sidebar Navigation */}
        <aside
          className={`${
            mobileMenuOpen ? "block" : "hidden"
          } md:block card-soft p-3 sticky top-20 z-20 space-y-1 bg-card shadow-sm`}
        >
          <div className="px-3 py-2 border-b mb-2">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {t({ hi: "डैशबोर्ड नेविगेशन", en: "Dashboard Sections" })}
            </p>
          </div>

          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive = activeNav === item.id;
            return (
              <button
                key={item.id}
                onClick={() => {
                  setActiveNav(item.id);
                  setMobileMenuOpen(false);
                }}
                className={`w-full flex items-center justify-between gap-3 px-3.5 py-2.5 rounded-xl text-left text-sm font-medium transition-colors ${
                  isActive
                    ? "bg-primary text-primary-foreground font-semibold shadow-xs"
                    : "text-foreground hover:bg-muted"
                }`}
              >
                <div className="flex items-center gap-3 truncate">
                  <Icon className={`size-4.5 shrink-0 ${isActive ? "text-primary-foreground" : "text-muted-foreground"}`} />
                  <span className="truncate">{t(item.label)}</span>
                </div>
                {item.checkpoint && (
                  <span
                    className={`text-[10px] px-1.5 py-0.5 rounded-md uppercase tracking-wider font-semibold ${
                      isActive ? "bg-primary-foreground/20 text-primary-foreground" : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {item.checkpoint.replace("Checkpoint ", "CP")}
                  </span>
                )}
              </button>
            );
          })}

          <div className="pt-3 mt-4 border-t px-3 text-[11px] text-muted-foreground space-y-1">
            <p><strong>DB:</strong> Neon PostgreSQL</p>
            <p><strong>AI:</strong> Gemini 3.5 Flash</p>
          </div>
        </aside>

        {/* Main Content Area */}
        <main className="space-y-6">
          {/* Header of Active Section */}
          <div className="flex flex-wrap items-center justify-between gap-3 pb-2 border-b">
            <div>
              <div className="flex items-center gap-2">
                <h1 className="font-display text-3xl md:text-4xl">{t(currentNav.label)}</h1>
                {currentNav.checkpoint && (
                  <span className="rounded-full bg-clay-soft px-2.5 py-0.5 text-xs font-semibold text-primary">
                    {currentNav.checkpoint}
                  </span>
                )}
              </div>
              <p className="mt-1 text-sm text-muted-foreground">{t(currentNav.description)}</p>
            </div>

            {activeNav === "overview" && (
              <button
                onClick={() => void fetchOverview()}
                disabled={loadingOverview}
                className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl border bg-card text-xs font-semibold hover:bg-muted disabled:opacity-50"
              >
                <RefreshCw className={`size-3.5 ${loadingOverview ? "animate-spin" : ""}`} />
                <span>{t({ hi: "ताज़ा करें", en: "Refresh Data" })}</span>
              </button>
            )}

            {activeNav === "schemes" && (
              <button
                onClick={() => void fetchSchemes()}
                disabled={loadingSchemes}
                className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl border bg-card text-xs font-semibold hover:bg-muted disabled:opacity-50"
              >
                <RefreshCw className={`size-3.5 ${loadingSchemes ? "animate-spin" : ""}`} />
                <span>{t({ hi: "योजना सूची ताज़ा करें", en: "Refresh Schemes" })}</span>
              </button>
            )}

            {activeNav === "campaigns" && (
              <button
                onClick={() => void fetchCampaigns()}
                disabled={loadingCampaigns}
                className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl border bg-card text-xs font-semibold hover:bg-muted disabled:opacity-50"
              >
                <RefreshCw className={`size-3.5 ${loadingCampaigns ? "animate-spin" : ""}`} />
                <span>{t({ hi: "अभियान सूची ताज़ा करें", en: "Refresh Campaigns" })}</span>
              </button>
            )}

            {activeNav === "donations" && (
              <button
                onClick={() => void fetchDonations()}
                disabled={loadingDonations}
                className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl border bg-card text-xs font-semibold hover:bg-muted disabled:opacity-50"
              >
                <RefreshCw className={`size-3.5 ${loadingDonations ? "animate-spin" : ""}`} />
                <span>{t({ hi: "लेन-देन सूची ताज़ा करें", en: "Refresh Transactions" })}</span>
              </button>
            )}

            {activeNav === "donors" && (
              <button
                onClick={() => void fetchDonors()}
                disabled={loadingDonors}
                className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl border bg-card text-xs font-semibold hover:bg-muted disabled:opacity-50"
              >
                <RefreshCw className={`size-3.5 ${loadingDonors ? "animate-spin" : ""}`} />
                <span>{t({ hi: "दानदाता सूची ताज़ा करें", en: "Refresh Donors" })}</span>
              </button>
            )}

            {activeNav === "receipts" && (
              <button
                onClick={() => void fetchReceipts()}
                disabled={loadingReceipts}
                className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl border bg-card text-xs font-semibold hover:bg-muted disabled:opacity-50"
              >
                <RefreshCw className={`size-3.5 ${loadingReceipts ? "animate-spin" : ""}`} />
                <span>{t({ hi: "रसीद सूची ताज़ा करें", en: "Refresh Receipts" })}</span>
              </button>
            )}
          </div>

          {/* Feedback message banner */}
          {feedback && (
            <div className="flex items-center justify-between rounded-xl bg-leaf-soft p-4 text-sm font-medium text-leaf">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="size-5 shrink-0" />
                <span>{feedback}</span>
              </div>
              <button onClick={() => setFeedback(null)} className="p-1 hover:opacity-75">
                <X className="size-4" />
              </button>
            </div>
          )}

          {/* SECTION 1: OVERVIEW DASHBOARD */}
          {activeNav === "overview" && (
            <OverviewSection
              overview={overview}
              loading={loadingOverview}
              error={overviewError}
              onRetry={fetchOverview}
              onNavigate={(navId) => setActiveNav(navId)}
            />
          )}

          {/* SECTION 2: COMPLETE SCHEME MANAGEMENT */}
          {activeNav === "schemes" && (
            <SchemesSection
              schemes={schemes}
              loading={loadingSchemes}
              error={schemesError}
              onReload={fetchSchemes}
              onSyncOverview={fetchOverview}
              setFeedback={setFeedback}
            />
          )}

          {/* SECTION 3: CAMPAIGN MANAGEMENT */}
          {activeNav === "campaigns" && (
            <CampaignsSection
              campaigns={campaigns}
              loading={loadingCampaigns}
              error={campaignsError}
              onReload={fetchCampaigns}
              onSyncOverview={fetchOverview}
              setFeedback={setFeedback}
            />
          )}

          {/* SECTION 4: DONATIONS & TRANSACTIONS */}
          {activeNav === "donations" && (
            <DonationsSection
              donations={donations}
              loading={loadingDonations}
              error={donationsError}
              onReload={fetchDonations}
            />
          )}

          {/* SECTION 5: DONOR RECORDS */}
          {activeNav === "donors" && (
            <DonorsSection
              donors={donors}
              loading={loadingDonors}
              error={donorsError}
              onReload={fetchDonors}
            />
          )}

          {/* SECTION 6: RECEIPTS & CERTIFICATES */}
          {activeNav === "receipts" && (
            <ReceiptsSection
              receipts={receipts}
              loading={loadingReceipts}
              error={receiptsError}
              onReload={fetchReceipts}
            />
          )}

          {/* SECTIONS 7-8: UPCOMING CHECKPOINTS ROADMAP */}
          {activeNav !== "overview" && activeNav !== "schemes" && activeNav !== "campaigns" && activeNav !== "donations" && activeNav !== "donors" && activeNav !== "receipts" && (
            <CheckpointRoadmapSection
              navItem={currentNav}
              onBackToOverview={() => setActiveNav("overview")}
            />
          )}
        </main>
      </div>
    </div>
  );
}

// -------------------------------------------------------------
// RECEIPTS SECTION (CHECKPOINT 6)
// -------------------------------------------------------------

function ReceiptsSection({
  receipts,
  loading,
  error,
  onReload,
}: {
  receipts: AdminReceipt[];
  loading: boolean;
  error: string | null;
  onReload: () => Promise<void>;
}) {
  const { t } = useLang();
  const [search, setSearch] = useState("");
  const [campaignFilter, setCampaignFilter] = useState("all");
  const [detailReceipt, setDetailReceipt] = useState<AdminReceipt | null>(null);

  const campaignOptions = useMemo(() => {
    const seen = new Map<string, string>();
    for (const r of receipts) {
      if (!seen.has(r.campaign.id)) seen.set(r.campaign.id, r.campaign.title.en);
    }
    return Array.from(seen.entries());
  }, [receipts]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return receipts.filter((r) => {
      if (campaignFilter !== "all" && r.campaign.id !== campaignFilter) return false;
      if (q) {
        const hay = [r.receiptNumber, r.donorName, r.donorEmail, r.donationId].join(" ").toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [receipts, search, campaignFilter]);

  const totalAmount = receipts.reduce((s, r) => s + r.amount, 0);

  return (
    <div className="space-y-6">
      {/* Test-mode notice */}
      <div className="rounded-xl border bg-muted/40 px-4 py-3 text-xs text-muted-foreground flex items-start gap-2">
        <AlertCircle className="size-4 shrink-0 mt-0.5 text-muted-foreground/70" />
        <span>
          {t({
            hi: "सभी रसीदें परीक्षण मोड (TEST / PREVIEW) में हैं। ये 80G कर-छूट के लिए मान्य नहीं हैं। Trust PAN और 80G पंजीकरण डेमो placeholder हैं जब तक सत्यापित नहीं किए जाते।",
            en: "All receipts are TEST / PREVIEW only. They are not valid 80G tax certificates. Trust PAN and 80G registration are demo placeholders until formally verified.",
          })}
        </span>
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="card-soft p-4 flex items-center justify-between border-l-4 border-l-primary">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {t({ hi: "कुल रसीदें", en: "Total Receipts" })}
            </p>
            <p className="font-display text-3xl mt-1">{receipts.length}</p>
          </div>
          <FileText className="size-8 text-primary/30" />
        </div>
        <div className="card-soft p-4 flex items-center justify-between border-l-4 border-l-leaf">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {t({ hi: "कुल राशि (TEST)", en: "Total Amount (TEST)" })}
            </p>
            <p className="font-display text-2xl mt-1 text-leaf">{inr(totalAmount)}</p>
          </div>
          <CheckCircle2 className="size-8 text-leaf/30" />
        </div>
        <div className="card-soft p-4 flex items-center justify-between border-l-4 border-l-turmeric">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {t({ hi: "अभियान", en: "Campaigns" })}
            </p>
            <p className="font-display text-3xl mt-1">{campaignOptions.length}</p>
          </div>
          <HeartHandshake className="size-8 text-turmeric/30" />
        </div>
      </div>

      {/* Search + filter */}
      <div className="card-soft p-4 space-y-3">
        <div className="flex flex-col md:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-3 size-4 text-muted-foreground" />
            <input
              type="text"
              placeholder={t({ hi: "रसीद नंबर, दानदाता नाम या ईमेल खोजें…", en: "Search receipt number, donor name or email…" })}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-10 w-full rounded-xl border bg-card pl-9 pr-4 text-sm focus:border-primary focus:outline-none"
            />
            {search && (
              <button onClick={() => setSearch("")} className="absolute right-3 top-2.5 text-muted-foreground hover:text-foreground">
                <X className="size-4" />
              </button>
            )}
          </div>
          <label className="flex items-center gap-2 text-xs shrink-0">
            <span className="font-semibold text-muted-foreground">{t({ hi: "अभियान:", en: "Campaign:" })}</span>
            <select
              value={campaignFilter}
              onChange={(e) => setCampaignFilter(e.target.value)}
              className="h-10 rounded-xl border bg-card px-3 font-medium focus:border-primary text-sm"
            >
              <option value="all">{t({ hi: "सभी अभियान", en: "All campaigns" })}</option>
              {campaignOptions.map(([id, name]) => (
                <option key={id} value={id}>{name}</option>
              ))}
            </select>
          </label>
        </div>
        <p className="text-xs text-muted-foreground border-t pt-2" aria-live="polite">
          {filtered.length} {t({ hi: "रसीदें दिख रही हैं (कुल", en: "receipts shown (of" })} {receipts.length})
        </p>
      </div>

      {/* Error */}
      {error && (
        <div role="alert" className="card-soft p-4 border-destructive/20 bg-destructive/5 text-destructive flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm">
            <AlertCircle className="size-5 shrink-0" />
            <span>{error}</span>
          </div>
          <button onClick={() => void onReload()} className="btn-big !min-h-8 bg-destructive text-destructive-foreground text-xs">
            {t({ hi: "पुनः लोड करें", en: "Reload" })}
          </button>
        </div>
      )}

      {/* Loading */}
      {loading && !receipts.length && (
        <div className="card-soft p-12 text-center">
          <div className="inline-block size-8 animate-spin rounded-full border-3 border-primary border-t-transparent" />
          <p className="mt-3 text-sm text-muted-foreground">
            {t({ hi: "रसीद रिकॉर्ड लोड हो रहे हैं…", en: "Loading receipt records from database…" })}
          </p>
        </div>
      )}

      {/* Receipts table */}
      {(!loading || receipts.length > 0) && (
        <div className="card-soft overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-muted/70 text-xs text-muted-foreground uppercase font-semibold">
                <tr>
                  <th className="p-3.5">{t({ hi: "रसीद नंबर", en: "Receipt #" })}</th>
                  <th className="p-3.5">{t({ hi: "दानदाता", en: "Donor" })}</th>
                  <th className="p-3.5">{t({ hi: "अभियान", en: "Campaign" })}</th>
                  <th className="p-3.5">{t({ hi: "राशि", en: "Amount" })}</th>
                  <th className="p-3.5">{t({ hi: "दिनांक", en: "Date" })}</th>
                  <th className="p-3.5 text-right">{t({ hi: "PDF / विवरण", en: "PDF / Details" })}</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {filtered.map((r) => (
                  <tr key={r.id} className="hover:bg-muted/30 transition-colors">
                    {/* Receipt number */}
                    <td className="p-3.5 font-mono text-xs whitespace-nowrap">
                      <span className="rounded bg-muted px-2 py-1 font-semibold">{r.receiptNumber}</span>
                      {r.testMode && (
                        <span className="ml-1.5 rounded bg-turmeric/20 px-1 py-0.5 text-[10px] font-semibold text-foreground/70">TEST</span>
                      )}
                    </td>
                    {/* Donor */}
                    <td className="p-3.5 max-w-[160px]">
                      <p className="font-semibold truncate">{r.donorName}</p>
                      <p className="text-xs text-muted-foreground truncate">{r.donorEmail}</p>
                      {r.donorPanLast4 && (
                        <p className="text-[11px] font-mono text-muted-foreground/70">••••{r.donorPanLast4}</p>
                      )}
                    </td>
                    {/* Campaign */}
                    <td className="p-3.5 text-xs text-muted-foreground max-w-[130px]">
                      <span className="truncate block">{t(r.campaign.title)}</span>
                    </td>
                    {/* Amount */}
                    <td className="p-3.5 font-semibold whitespace-nowrap text-leaf">
                      {inr(r.amount)}
                    </td>
                    {/* Date */}
                    <td className="p-3.5 text-xs text-muted-foreground whitespace-nowrap">
                      <div className="flex items-center gap-1">
                        <Calendar className="size-3" />
                        <span>
                          {new Date(r.generatedAt).toLocaleDateString("en-IN", {
                            day: "numeric", month: "short", year: "numeric",
                          })}
                        </span>
                      </div>
                    </td>
                    {/* Download + detail */}
                    <td className="p-3.5 text-right whitespace-nowrap">
                      <div className="flex items-center justify-end gap-1.5">
                        <ReceiptDownloadButton receiptId={r.id} receiptNumber={r.receiptNumber} compact />
                        <button
                          onClick={() => setDetailReceipt(r)}
                          className="inline-flex items-center gap-1 text-xs text-primary font-semibold hover:underline"
                          title={t({ hi: "विवरण देखें", en: "View details" })}
                        >
                          <ChevronRight className="size-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}

                {filtered.length === 0 && !loading && (
                  <tr>
                    <td colSpan={6} className="p-10 text-center text-muted-foreground">
                      <p className="font-semibold">
                        {search || campaignFilter !== "all"
                          ? t({ hi: "इन फ़िल्टर से कोई रसीद नहीं मिली।", en: "No receipts match your filters." })
                          : t({ hi: "अभी कोई रसीद नहीं है।", en: "No receipts generated yet." })}
                      </p>
                      <p className="text-xs mt-1">
                        {t({ hi: "/donate से सफल परीक्षण दान करें।", en: "Submit a successful test donation from /donate." })}
                      </p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Receipt detail drawer */}
      {detailReceipt && (
        <ReceiptDetailDrawer receipt={detailReceipt} onClose={() => setDetailReceipt(null)} />
      )}
    </div>
  );
}

// -------------------------------------------------------------
// RECEIPT DOWNLOAD BUTTON (shared, used in table + drawer)
// -------------------------------------------------------------

// Re-declare with compact prop variant
function ReceiptDownloadButton({
  receiptId,
  receiptNumber,
  compact = false,
}: {
  receiptId: string;
  receiptNumber: string;
  compact?: boolean;
}) {
  const { t } = useLang();
  const [busy, setBusy] = useState(false);
  const [dlError, setDlError] = useState<string | null>(null);

  const handleDownload = async () => {
    setBusy(true);
    setDlError(null);
    try {
      const blob = await downloadReceipt(receiptId);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `SakhiSetu-${receiptNumber.replaceAll("/", "-")}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      setDlError(err instanceof Error ? err.message : "PDF download failed.");
    } finally {
      setBusy(false);
    }
  };

  if (compact) {
    return (
      <div className="flex flex-col items-end gap-0.5">
        <button
          onClick={() => void handleDownload()}
          disabled={busy}
          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-primary text-primary-foreground text-xs font-semibold disabled:opacity-50 hover:opacity-90"
          title={t({ hi: "PDF डाउनलोड", en: "Download PDF" })}
        >
          <Save className="size-3.5" />
          <span>{busy ? t({ hi: "…", en: "…" }) : "PDF"}</span>
        </button>
        {dlError && <p className="text-[10px] text-destructive max-w-[100px] text-right">{dlError}</p>}
      </div>
    );
  }

  return (
    <div className="mx-5 mb-4">
      <button
        onClick={() => void handleDownload()}
        disabled={busy}
        className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-primary text-primary-foreground px-4 py-2.5 text-sm font-semibold disabled:opacity-50 hover:opacity-90"
      >
        <FileText className="size-4" />
        <span>{busy ? t({ hi: "PDF तैयार हो रही है…", en: "Generating PDF…" }) : t({ hi: "रसीद PDF डाउनलोड करें", en: "Download Receipt PDF" })}</span>
      </button>
      {dlError && (
        <p role="alert" className="mt-2 text-xs text-destructive text-center">{dlError}</p>
      )}
    </div>
  );
}

// -------------------------------------------------------------
// RECEIPT DETAIL DRAWER
// -------------------------------------------------------------

function ReceiptDetailDrawer({ receipt: r, onClose }: { receipt: AdminReceipt; onClose: () => void }) {
  const { t } = useLang();

  const rows: Array<[{ hi: string; en: string }, string]> = [
    [{ hi: "रसीद नंबर", en: "Receipt Number" }, r.receiptNumber],
    [{ hi: "रसीद दिनांक", en: "Receipt Date" }, new Date(r.generatedAt).toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata", dateStyle: "medium" })],
    [{ hi: "दान ID", en: "Donation ID" }, r.donationId],
    [{ hi: "दानदाता नाम", en: "Donor Name" }, r.donorName],
    [{ hi: "दानदाता ईमेल", en: "Donor Email" }, r.donorEmail],
    [{ hi: "PAN (अंतिम 4)", en: "PAN (last 4)" }, r.donorPanLast4 ? `••••${r.donorPanLast4}` : t({ hi: "उपलब्ध नहीं", en: "Not available" })],
    [{ hi: "राशि", en: "Amount" }, inr(r.amount)],
    [{ hi: "प्रकार", en: "Type" }, r.frequency === "MONTHLY" ? t({ hi: "मासिक", en: "Monthly" }) : t({ hi: "एकमुश्त", en: "One-time" })],
    [{ hi: "अभियान", en: "Campaign" }, t(r.campaign.title)],
    [{ hi: "भुगतान दिनांक", en: "Paid At" }, r.paidAt ? new Date(r.paidAt).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", dateStyle: "medium", timeStyle: "short" }) : "—"],
    [{ hi: "परीक्षण मोड", en: "Test Mode" }, r.testMode ? t({ hi: "हाँ (MOCK)", en: "Yes (MOCK)" }) : t({ hi: "नहीं", en: "No" })],
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-end bg-black/50 backdrop-blur-xs" onClick={onClose}>
      <div
        className="h-full w-full max-w-md bg-card shadow-2xl overflow-y-auto animate-in slide-in-from-right-8 flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between p-5 border-b sticky top-0 bg-card z-10 shrink-0">
          <div>
            <h3 className="font-display text-xl">{t({ hi: "रसीद विवरण", en: "Receipt Details" })}</h3>
            <p className="font-mono text-xs text-muted-foreground mt-0.5">{r.receiptNumber}</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-muted text-muted-foreground shrink-0">
            <X className="size-5" />
          </button>
        </div>

        {/* Test mode warning */}
        <div className="mx-5 mt-4 rounded-xl bg-turmeric/20 px-4 py-2.5 text-xs font-semibold text-foreground">
          {t({
            hi: "TEST / PREVIEW — यह कर-छूट के लिए मान्य आधिकारिक रसीद नहीं है।",
            en: "TEST / PREVIEW — This is not a valid official receipt for tax purposes.",
          })}
        </div>

        {/* Detail rows */}
        <div className="p-5 flex-1 space-y-0">
          {rows.map(([label, value]) => (
            <div key={label.en} className="flex items-start justify-between gap-4 py-3 border-b last:border-0">
              <span className="text-xs font-semibold text-muted-foreground shrink-0 w-32">{t(label)}</span>
              <span className="text-xs font-medium text-right break-all">{value}</span>
            </div>
          ))}
        </div>

        {/* Download button */}
        <div className="shrink-0 pb-2">
          <ReceiptDownloadButton receiptId={r.id} receiptNumber={r.receiptNumber} />
        </div>

        {/* Footer note */}
        <div className="px-5 pb-5 shrink-0">
          <p className="text-[11px] text-muted-foreground">
            {t({
              hi: "रसीद PDF में Trust PAN और 80G पंजीकरण placeholder हैं जब तक ट्रस्ट द्वारा सत्यापित नहीं किए जाते।",
              en: "The receipt PDF uses placeholder Trust PAN and 80G registration fields until formally verified by the trust.",
            })}
          </p>
        </div>
      </div>
    </div>
  );
}

// -------------------------------------------------------------
// DONORS SECTION (CHECKPOINT 5)
// -------------------------------------------------------------

type DonorSortKey = "name" | "totalAmount" | "totalCount" | "latestDonationAt";

function DonorsSection({
  donors,
  loading,
  error,
  onReload,
}: {
  donors: AdminDonorSummary[];
  loading: boolean;
  error: string | null;
  onReload: () => Promise<void>;
}) {
  const { t } = useLang();
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<DonorSortKey>("latestDonationAt");
  const [sortAsc, setSortAsc] = useState(false);
  const [detailDonor, setDetailDonor] = useState<AdminDonorSummary | null>(null);

  // Computed metrics
  const totalDonors = donors.length;
  const activeDonors = donors.filter((d) => d.succeededCount > 0).length;
  const totalSucceeded = donors.reduce((s, d) => s + d.totalAmount, 0);
  const monthlyDonors = donors.filter((d) => d.succeededCount > 1).length;

  // Filter + sort
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const rows = q
      ? donors.filter((d) => d.name.toLowerCase().includes(q) || d.email.toLowerCase().includes(q))
      : donors.slice();

    rows.sort((a, b) => {
      let cmp = 0;
      if (sortKey === "name") {
        cmp = a.name.localeCompare(b.name, "hi");
      } else if (sortKey === "totalAmount") {
        cmp = a.totalAmount - b.totalAmount;
      } else if (sortKey === "totalCount") {
        cmp = a.totalCount - b.totalCount;
      } else {
        // latestDonationAt — nulls last
        const ta = a.latestDonationAt ? new Date(a.latestDonationAt).getTime() : 0;
        const tb = b.latestDonationAt ? new Date(b.latestDonationAt).getTime() : 0;
        cmp = ta - tb;
      }
      return sortAsc ? cmp : -cmp;
    });
    return rows;
  }, [donors, search, sortKey, sortAsc]);

  const toggleSort = (key: DonorSortKey) => {
    if (sortKey === key) setSortAsc((v) => !v);
    else { setSortKey(key); setSortAsc(false); }
  };

  const SortIcon = ({ k }: { k: DonorSortKey }) => {
    if (sortKey !== k) return <span className="text-muted-foreground/40 ml-0.5">↕</span>;
    return <span className="text-primary ml-0.5">{sortAsc ? "↑" : "↓"}</span>;
  };

  return (
    <div className="space-y-6">
      {/* PII notice */}
      <div className="rounded-xl border bg-muted/40 px-4 py-3 text-xs text-muted-foreground flex items-start gap-2">
        <ShieldCheck className="size-4 shrink-0 mt-0.5 text-muted-foreground/70" />
        <span>
          {t({
            hi: "केवल पंजीकृत दानदाता दिखाए जाते हैं। PAN की केवल अंतिम 4 अंक प्रदर्शित होती हैं। पासवर्ड या पूर्ण PAN कभी नहीं दिखाया जाता।",
            en: "Only registered donors are shown. PAN last 4 digits are displayed only. Passwords and full PAN are never exposed.",
          })}
        </span>
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="card-soft p-4 flex items-center justify-between border-l-4 border-l-primary">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {t({ hi: "पंजीकृत दानदाता", en: "Registered Donors" })}
            </p>
            <p className="font-display text-3xl mt-1">{totalDonors}</p>
          </div>
          <Users className="size-8 text-primary/30" />
        </div>
        <div className="card-soft p-4 flex items-center justify-between border-l-4 border-l-leaf">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {t({ hi: "सफल दान वाले", en: "With Succeeded Donations" })}
            </p>
            <p className="font-display text-3xl mt-1 text-leaf">{activeDonors}</p>
          </div>
          <CheckCircle2 className="size-8 text-leaf/30" />
        </div>
        <div className="card-soft p-4 flex items-center justify-between border-l-4 border-l-turmeric">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {t({ hi: "कुल संग्रह (TEST)", en: "Total Collected (TEST)" })}
            </p>
            <p className="font-display text-2xl mt-1 text-turmeric">{inr(totalSucceeded)}</p>
          </div>
          <TrendingUp className="size-8 text-turmeric/30" />
        </div>
        <div className="card-soft p-4 flex items-center justify-between border-l-4 border-l-accent">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {t({ hi: "बार-बार दाता (2+ दान)", en: "Repeat Donors (2+ donations)" })}
            </p>
            <p className="font-display text-3xl mt-1">{monthlyDonors}</p>
          </div>
          <Sparkles className="size-8 text-accent/30" />
        </div>
      </div>

      {/* Search + Sort bar */}
      <div className="card-soft p-4 space-y-3">
        <div className="relative">
          <Search className="absolute left-3 top-3 size-4 text-muted-foreground" />
          <input
            type="text"
            placeholder={t({ hi: "दानदाता का नाम या ईमेल खोजें…", en: "Search donor name or email…" })}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-10 w-full rounded-xl border bg-card pl-9 pr-4 text-sm focus:border-primary focus:outline-none"
          />
          {search && (
            <button onClick={() => setSearch("")} className="absolute right-3 top-2.5 text-muted-foreground hover:text-foreground">
              <X className="size-4" />
            </button>
          )}
        </div>
        <p className="text-xs text-muted-foreground border-t pt-2" aria-live="polite">
          {filtered.length} {t({ hi: "दानदाता दिख रहे हैं (कुल", en: "donors shown (of" })} {totalDonors})
        </p>
      </div>

      {/* Error */}
      {error && (
        <div role="alert" className="card-soft p-4 border-destructive/20 bg-destructive/5 text-destructive flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm">
            <AlertCircle className="size-5 shrink-0" />
            <span>{error}</span>
          </div>
          <button onClick={() => void onReload()} className="btn-big !min-h-8 bg-destructive text-destructive-foreground text-xs">
            {t({ hi: "पुनः लोड करें", en: "Reload" })}
          </button>
        </div>
      )}

      {/* Loading */}
      {loading && !donors.length && (
        <div className="card-soft p-12 text-center">
          <div className="inline-block size-8 animate-spin rounded-full border-3 border-primary border-t-transparent" />
          <p className="mt-3 text-sm text-muted-foreground">
            {t({ hi: "दानदाता रिकॉर्ड लोड हो रहे हैं…", en: "Loading donor records from database…" })}
          </p>
        </div>
      )}

      {/* Donors Table */}
      {(!loading || donors.length > 0) && (
        <div className="card-soft overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-muted/70 text-xs text-muted-foreground uppercase font-semibold">
                <tr>
                  <th className="p-3.5 cursor-pointer hover:text-foreground select-none" onClick={() => toggleSort("name")}>
                    {t({ hi: "दानदाता", en: "Donor" })} <SortIcon k="name" />
                  </th>
                  <th className="p-3.5">{t({ hi: "PAN (अंतिम 4)", en: "PAN (last 4)" })}</th>
                  <th className="p-3.5 cursor-pointer hover:text-foreground select-none" onClick={() => toggleSort("totalAmount")}>
                    {t({ hi: "कुल राशि (सफल)", en: "Total (Succeeded)" })} <SortIcon k="totalAmount" />
                  </th>
                  <th className="p-3.5 cursor-pointer hover:text-foreground select-none" onClick={() => toggleSort("totalCount")}>
                    {t({ hi: "दान", en: "Donations" })} <SortIcon k="totalCount" />
                  </th>
                  <th className="p-3.5">{t({ hi: "स्थिति सारांश", en: "Status Summary" })}</th>
                  <th className="p-3.5 cursor-pointer hover:text-foreground select-none" onClick={() => toggleSort("latestDonationAt")}>
                    {t({ hi: "नवीनतम दान", en: "Latest Donation" })} <SortIcon k="latestDonationAt" />
                  </th>
                  <th className="p-3.5 text-right">{t({ hi: "विवरण", en: "Details" })}</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {filtered.map((donor) => (
                  <tr key={donor.userId} className="hover:bg-muted/30 transition-colors">
                    {/* Name + Email */}
                    <td className="p-3.5 max-w-[200px]">
                      <p className="font-semibold truncate">{donor.name}</p>
                      <p className="text-xs text-muted-foreground truncate">{donor.email}</p>
                    </td>

                    {/* PAN last-4 */}
                    <td className="p-3.5 font-mono text-xs">
                      {donor.panLast4
                        ? <span className="rounded bg-muted px-1.5 py-0.5">••••{donor.panLast4}</span>
                        : <span className="text-muted-foreground">—</span>}
                    </td>

                    {/* Total succeeded amount */}
                    <td className="p-3.5 font-semibold whitespace-nowrap text-leaf">
                      {inr(donor.totalAmount)}
                    </td>

                    {/* Count */}
                    <td className="p-3.5 text-center font-semibold">
                      {donor.totalCount}
                    </td>

                    {/* Status breakdown pills */}
                    <td className="p-3.5">
                      <div className="flex flex-wrap gap-1">
                        {donor.succeededCount > 0 && (
                          <span className="rounded-full bg-leaf-soft text-leaf px-2 py-0.5 text-[10px] font-semibold">
                            ✓{donor.succeededCount}
                          </span>
                        )}
                        {donor.pendingCount > 0 && (
                          <span className="rounded-full bg-secondary text-secondary-foreground px-2 py-0.5 text-[10px] font-semibold">
                            ⏳{donor.pendingCount}
                          </span>
                        )}
                        {donor.failedCount > 0 && (
                          <span className="rounded-full bg-destructive/10 text-destructive px-2 py-0.5 text-[10px] font-semibold">
                            ✗{donor.failedCount}
                          </span>
                        )}
                        {donor.totalCount === 0 && (
                          <span className="text-xs text-muted-foreground">{t({ hi: "कोई दान नहीं", en: "No donations" })}</span>
                        )}
                      </div>
                    </td>

                    {/* Latest donation date */}
                    <td className="p-3.5 text-xs text-muted-foreground whitespace-nowrap">
                      {donor.latestDonationAt
                        ? (
                          <div className="flex items-center gap-1">
                            <Calendar className="size-3" />
                            <span>
                              {new Date(donor.latestDonationAt).toLocaleDateString("en-IN", {
                                day: "numeric", month: "short", year: "numeric",
                              })}
                            </span>
                          </div>
                        )
                        : <span>—</span>}
                    </td>

                    {/* Detail button */}
                    <td className="p-3.5 text-right">
                      <button
                        onClick={() => setDetailDonor(donor)}
                        className="inline-flex items-center gap-1 text-xs text-primary font-semibold hover:underline"
                        title={t({ hi: "दान इतिहास देखें", en: "View donation history" })}
                      >
                        <ChevronRight className="size-4" />
                      </button>
                    </td>
                  </tr>
                ))}

                {filtered.length === 0 && !loading && (
                  <tr>
                    <td colSpan={7} className="p-10 text-center text-muted-foreground">
                      <p className="font-semibold">
                        {search
                          ? t({ hi: "कोई दानदाता नहीं मिला।", en: "No donors match your search." })
                          : t({ hi: "अभी कोई पंजीकृत दानदाता नहीं है।", en: "No registered donors yet." })}
                      </p>
                      <p className="text-xs mt-1">
                        {search
                          ? t({ hi: "खोज साफ़ करें।", en: "Clear the search." })
                          : t({ hi: "/account पृष्ठ से दानदाता पंजीकरण करें।", en: "Register a donor from the /account page." })}
                      </p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Donor Detail Drawer */}
      {detailDonor && (
        <DonorDetailDrawer
          donor={detailDonor}
          onClose={() => setDetailDonor(null)}
        />
      )}
    </div>
  );
}

// -------------------------------------------------------------
// DONOR DETAIL DRAWER
// -------------------------------------------------------------

function DonorDetailDrawer({
  donor,
  onClose,
}: {
  donor: AdminDonorSummary;
  onClose: () => void;
}) {
  const { t } = useLang();
  const [history, setHistory] = useState<AdminDonorDonation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    getAdminDonorDonations(donor.userId)
      .then((rows) => { if (active) setHistory(rows); })
      .catch((err: unknown) => { if (active) setError(err instanceof Error ? err.message : "Failed to load history."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [donor.userId]);

  const statusBadge = (status: AdminDonorDonation["status"]) => {
    const map = {
      SUCCEEDED: { cls: "bg-leaf-soft text-leaf",                   label: { hi: "✓ सफल", en: "✓ Succeeded" } },
      PENDING:   { cls: "bg-secondary text-secondary-foreground",   label: { hi: "⏳ लंबित", en: "⏳ Pending" } },
      FAILED:    { cls: "bg-destructive/10 text-destructive",        label: { hi: "✗ विफल", en: "✗ Failed" } },
    } as const;
    const { cls, label } = map[status];
    return (
      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ${cls}`}>
        {t(label)}
      </span>
    );
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-end bg-black/50 backdrop-blur-xs"
      onClick={onClose}
    >
      <div
        className="h-full w-full max-w-lg bg-card shadow-2xl overflow-y-auto animate-in slide-in-from-right-8 flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Sticky header */}
        <div className="flex items-start justify-between p-5 border-b sticky top-0 bg-card z-10 shrink-0">
          <div>
            <h3 className="font-display text-xl">{donor.name}</h3>
            <p className="text-xs text-muted-foreground mt-0.5">{donor.email}</p>
            {donor.panLast4 && (
              <p className="text-xs font-mono text-muted-foreground mt-0.5">PAN ••••{donor.panLast4}</p>
            )}
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-muted text-muted-foreground shrink-0 mt-0.5">
            <X className="size-5" />
          </button>
        </div>

        {/* Summary strip */}
        <div className="grid grid-cols-3 gap-3 p-5 border-b shrink-0">
          <div className="text-center">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              {t({ hi: "कुल संग्रह", en: "Total Raised" })}
            </p>
            <p className="font-display text-xl mt-1 text-leaf">{inr(donor.totalAmount)}</p>
          </div>
          <div className="text-center">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              {t({ hi: "कुल दान", en: "Donations" })}
            </p>
            <p className="font-display text-xl mt-1">{donor.totalCount}</p>
          </div>
          <div className="text-center">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              {t({ hi: "सफल / विफल", en: "Succeeded / Failed" })}
            </p>
            <p className="font-display text-xl mt-1">
              <span className="text-leaf">{donor.succeededCount}</span>
              <span className="text-muted-foreground text-sm"> / </span>
              <span className="text-destructive">{donor.failedCount}</span>
            </p>
          </div>
        </div>

        {/* Donation history */}
        <div className="flex-1 overflow-y-auto">
          <div className="px-5 py-4">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
              {t({ hi: "दान इतिहास (नवीनतम पहले)", en: "Donation History (latest first)" })}
            </h4>

            {loading && (
              <div className="py-10 text-center">
                <div className="inline-block size-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                <p className="mt-2 text-xs text-muted-foreground">{t({ hi: "लोड हो रहा है…", en: "Loading…" })}</p>
              </div>
            )}

            {error && (
              <div role="alert" className="rounded-xl bg-destructive/10 p-3 text-sm text-destructive">
                {error}
              </div>
            )}

            {!loading && !error && history.length === 0 && (
              <p className="text-sm text-muted-foreground py-6 text-center">
                {t({ hi: "इस दानदाता का कोई दान रिकॉर्ड नहीं मिला।", en: "No donation records found for this donor." })}
              </p>
            )}

            {!loading && !error && history.length > 0 && (
              <div className="space-y-3">
                {history.map((d) => (
                  <div key={d.id} className="rounded-xl border bg-card/60 p-3 space-y-2">
                    {/* Row 1: amount + status + type */}
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <span className="font-semibold text-base">{inr(d.amount)}</span>
                      <div className="flex items-center gap-1.5">
                        {statusBadge(d.status)}
                        {d.frequency === "MONTHLY" ? (
                          <span className="rounded-md bg-secondary/50 px-2 py-0.5 text-[10px] font-medium">
                            {t({ hi: "मासिक", en: "Monthly" })}
                          </span>
                        ) : (
                          <span className="text-[10px] text-muted-foreground">
                            {t({ hi: "एकमुश्त", en: "One-time" })}
                          </span>
                        )}
                        {d.testMode && (
                          <span className="rounded bg-turmeric/20 px-1 py-0.5 text-[10px] font-semibold text-foreground/70">
                            TEST
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Row 2: campaign + date */}
                    <div className="flex items-center justify-between text-xs text-muted-foreground gap-2 flex-wrap">
                      <span className="truncate">{t(d.campaign.title)}</span>
                      <div className="flex items-center gap-1 shrink-0">
                        <Calendar className="size-3" />
                        <span>
                          {new Date(d.createdAt).toLocaleDateString("en-IN", {
                            day: "numeric", month: "short", year: "numeric",
                          })}
                        </span>
                      </div>
                    </div>

                    {/* Row 3: receipt + payment reference */}
                    <div className="flex items-center justify-between text-[11px] text-muted-foreground/80 gap-2 flex-wrap pt-1 border-t">
                      <span className="font-mono">
                        {d.receipt
                          ? <span className="rounded bg-muted px-1.5 py-0.5 text-foreground">{d.receipt.receiptNumber}</span>
                          : t({ hi: "रसीद नहीं", en: "No receipt" })}
                      </span>
                      <span className="font-mono text-[10px] truncate max-w-[160px]">{d.paymentReference}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="p-5 border-t shrink-0 bg-muted/30">
          <p className="text-[11px] text-muted-foreground">
            {t({
              hi: "दानदाता ID: ",
              en: "Donor user ID: ",
            })}
            <span className="font-mono">{donor.userId}</span>
          </p>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            {t({
              hi: "व्यक्तिगत जानकारी केवल अधिकृत ट्रस्ट प्रशासकों के लिए उपलब्ध है।",
              en: "Personal data is accessible only to authorized trust administrators.",
            })}
          </p>
        </div>
      </div>
    </div>
  );
}

// -------------------------------------------------------------
// DONATIONS SECTION (CHECKPOINT 4)
// -------------------------------------------------------------

type DonationStatusFilter = "all" | "SUCCEEDED" | "PENDING" | "FAILED";
type FrequencyFilter = "all" | "ONE_TIME" | "MONTHLY";

function DonationsSection({
  donations,
  loading,
  error,
  onReload,
}: {
  donations: AdminDonation[];
  loading: boolean;
  error: string | null;
  onReload: () => Promise<void>;
}) {
  const { t } = useLang();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<DonationStatusFilter>("all");
  const [frequencyFilter, setFrequencyFilter] = useState<FrequencyFilter>("all");
  const [campaignFilter, setCampaignFilter] = useState("all");
  const [detailDonation, setDetailDonation] = useState<AdminDonation | null>(null);

  // Derive unique campaign names for filter dropdown
  const campaignOptions = useMemo(() => {
    const seen = new Map<string, string>();
    for (const d of donations) {
      if (!seen.has(d.campaign.id)) seen.set(d.campaign.id, d.campaign.title.en);
    }
    return Array.from(seen.entries());
  }, [donations]);

  // Filtered rows
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return donations.filter((d) => {
      if (statusFilter !== "all" && d.status !== statusFilter) return false;
      if (frequencyFilter !== "all" && d.frequency !== frequencyFilter) return false;
      if (campaignFilter !== "all" && d.campaign.id !== campaignFilter) return false;
      if (q) {
        const haystack = [d.donorName, d.donorEmail, d.id, d.paymentReference, d.receipt?.receiptNumber ?? ""].join(" ").toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });
  }, [donations, search, statusFilter, frequencyFilter, campaignFilter]);

  // Summary metrics
  const succeededCount = donations.filter((d) => d.status === "SUCCEEDED").length;
  const failedCount = donations.filter((d) => d.status === "FAILED").length;
  const pendingCount = donations.filter((d) => d.status === "PENDING").length;
  const totalSucceededAmount = donations.filter((d) => d.status === "SUCCEEDED").reduce((s, d) => s + d.amount, 0);

  const statusBadge = (status: AdminDonation["status"]) => {
    const map: Record<AdminDonation["status"], { cls: string; label: { hi: string; en: string } }> = {
      SUCCEEDED: { cls: "bg-leaf-soft text-leaf", label: { hi: "✓ सफल", en: "✓ Succeeded" } },
      PENDING:   { cls: "bg-secondary text-secondary-foreground", label: { hi: "⏳ लंबित", en: "⏳ Pending" } },
      FAILED:    { cls: "bg-destructive/10 text-destructive", label: { hi: "✗ विफल", en: "✗ Failed" } },
    };
    const { cls, label } = map[status];
    return <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${cls}`}>{t(label)}</span>;
  };

  return (
    <div className="space-y-6">
      {/* Test-mode notice */}
      <div className="rounded-xl border bg-muted/40 px-4 py-3 text-xs text-muted-foreground flex items-start gap-2">
        <AlertCircle className="size-4 shrink-0 mt-0.5 text-muted-foreground/70" />
        <span>
          {t({
            hi: "सभी लेन-देन परीक्षण मोड (MOCK) में हैं। कोई वास्तविक धनराशि एकत्र नहीं की गई है। PAN की अंतिम 4 अंक केवल प्रशासक दृश्य में उपलब्ध हैं।",
            en: "All transactions are in TEST / MOCK mode. No real funds have been collected. PAN last 4 digits are visible to admins only.",
          })}
        </span>
      </div>

      {/* Metrics Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="card-soft p-4 flex items-center justify-between border-l-4 border-l-primary">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{t({ hi: "कुल लेन-देन", en: "Total Transactions" })}</p>
            <p className="font-display text-3xl mt-1">{donations.length}</p>
          </div>
          <Layers className="size-8 text-primary/30" />
        </div>
        <div className="card-soft p-4 flex items-center justify-between border-l-4 border-l-leaf">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{t({ hi: "सफल", en: "Succeeded" })}</p>
            <p className="font-display text-3xl mt-1 text-leaf">{succeededCount}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{inr(totalSucceededAmount)}</p>
          </div>
          <CheckCircle2 className="size-8 text-leaf/30" />
        </div>
        <div className="card-soft p-4 flex items-center justify-between border-l-4 border-l-turmeric">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{t({ hi: "लंबित", en: "Pending" })}</p>
            <p className="font-display text-3xl mt-1 text-turmeric">{pendingCount}</p>
          </div>
          <Clock className="size-8 text-turmeric/30" />
        </div>
        <div className="card-soft p-4 flex items-center justify-between border-l-4 border-l-destructive">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{t({ hi: "विफल", en: "Failed" })}</p>
            <p className="font-display text-3xl mt-1 text-destructive">{failedCount}</p>
          </div>
          <AlertCircle className="size-8 text-destructive/20" />
        </div>
      </div>

      {/* Search & Filter Bar */}
      <div className="card-soft p-4 space-y-3">
        <div className="relative">
          <Search className="absolute left-3 top-3 size-4 text-muted-foreground" />
          <input
            type="text"
            placeholder={t({ hi: "दानदाता नाम, ईमेल, लेन-देन ID या रसीद नंबर खोजें…", en: "Search donor name, email, transaction ID or receipt number…" })}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-10 w-full rounded-xl border bg-card pl-9 pr-4 text-sm focus:border-primary focus:outline-none"
          />
          {search && (
            <button onClick={() => setSearch("")} className="absolute right-3 top-2.5 text-muted-foreground hover:text-foreground">
              <X className="size-4" />
            </button>
          )}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-2 border-t text-xs">
          <label className="flex items-center gap-2">
            <span className="font-semibold text-muted-foreground shrink-0">{t({ hi: "स्थिति:", en: "Status:" })}</span>
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as DonationStatusFilter)}
              className="h-8 flex-1 rounded-lg border bg-card px-2 font-medium focus:border-primary">
              <option value="all">{t({ hi: "सभी स्थितियाँ", en: "All statuses" })}</option>
              <option value="SUCCEEDED">{t({ hi: "✓ सफल", en: "✓ Succeeded" })}</option>
              <option value="PENDING">{t({ hi: "⏳ लंबित", en: "⏳ Pending" })}</option>
              <option value="FAILED">{t({ hi: "✗ विफल", en: "✗ Failed" })}</option>
            </select>
          </label>
          <label className="flex items-center gap-2">
            <span className="font-semibold text-muted-foreground shrink-0">{t({ hi: "प्रकार:", en: "Type:" })}</span>
            <select value={frequencyFilter} onChange={(e) => setFrequencyFilter(e.target.value as FrequencyFilter)}
              className="h-8 flex-1 rounded-lg border bg-card px-2 font-medium focus:border-primary">
              <option value="all">{t({ hi: "सभी प्रकार", en: "All types" })}</option>
              <option value="ONE_TIME">{t({ hi: "एकमुश्त", en: "One-time" })}</option>
              <option value="MONTHLY">{t({ hi: "मासिक", en: "Monthly" })}</option>
            </select>
          </label>
          <label className="flex items-center gap-2">
            <span className="font-semibold text-muted-foreground shrink-0">{t({ hi: "अभियान:", en: "Campaign:" })}</span>
            <select value={campaignFilter} onChange={(e) => setCampaignFilter(e.target.value)}
              className="h-8 flex-1 rounded-lg border bg-card px-2 font-medium focus:border-primary">
              <option value="all">{t({ hi: "सभी अभियान", en: "All campaigns" })}</option>
              {campaignOptions.map(([id, name]) => (
                <option key={id} value={id}>{name}</option>
              ))}
            </select>
          </label>
        </div>
        <p className="text-xs text-muted-foreground pt-1 border-t" aria-live="polite">
          {filtered.length} {t({ hi: "लेन-देन दिख रहे हैं (कुल", en: "transactions shown (of" })} {donations.length})
        </p>
      </div>

      {/* Load Error */}
      {error && (
        <div role="alert" className="card-soft p-4 border-destructive/20 bg-destructive/5 text-destructive flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm">
            <AlertCircle className="size-5 shrink-0" />
            <span>{error}</span>
          </div>
          <button onClick={() => void onReload()} className="btn-big !min-h-8 bg-destructive text-destructive-foreground text-xs">
            {t({ hi: "पुनः लोड करें", en: "Reload" })}
          </button>
        </div>
      )}

      {/* Loading */}
      {loading && !donations.length && (
        <div className="card-soft p-12 text-center">
          <div className="inline-block size-8 animate-spin rounded-full border-3 border-primary border-t-transparent" />
          <p className="mt-3 text-sm text-muted-foreground">{t({ hi: "लेन-देन लोड हो रहे हैं…", en: "Loading transactions from database…" })}</p>
        </div>
      )}

      {/* Transactions Table */}
      {(!loading || donations.length > 0) && (
        <div className="card-soft overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-muted/70 text-xs text-muted-foreground uppercase font-semibold">
                <tr>
                  <th className="p-3.5">{t({ hi: "दानदाता", en: "Donor" })}</th>
                  <th className="p-3.5">{t({ hi: "अभियान", en: "Campaign" })}</th>
                  <th className="p-3.5">{t({ hi: "राशि", en: "Amount" })}</th>
                  <th className="p-3.5">{t({ hi: "प्रकार", en: "Type" })}</th>
                  <th className="p-3.5">{t({ hi: "स्थिति", en: "Status" })}</th>
                  <th className="p-3.5">{t({ hi: "दिनांक", en: "Date" })}</th>
                  <th className="p-3.5">{t({ hi: "रसीद", en: "Receipt" })}</th>
                  <th className="p-3.5 text-right">{t({ hi: "विवरण", en: "Details" })}</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {filtered.map((d) => (
                  <tr key={d.id} className="hover:bg-muted/30 transition-colors">
                    {/* Donor */}
                    <td className="p-3.5 max-w-[160px]">
                      <p className="font-semibold truncate">{d.donorName}</p>
                      <p className="text-xs text-muted-foreground truncate">{d.donorEmail}</p>
                      {d.donorPanLast4 && (
                        <p className="text-[11px] text-muted-foreground/70 font-mono">PAN ••••{d.donorPanLast4}</p>
                      )}
                    </td>
                    {/* Campaign */}
                    <td className="p-3.5 text-xs text-muted-foreground max-w-[130px]">
                      <span className="truncate block">{t(d.campaign.title)}</span>
                    </td>
                    {/* Amount */}
                    <td className="p-3.5 font-semibold whitespace-nowrap">{inr(d.amount)}</td>
                    {/* Type */}
                    <td className="p-3.5 whitespace-nowrap">
                      {d.frequency === "MONTHLY"
                        ? <span className="rounded-md bg-secondary/50 px-2 py-0.5 text-xs font-medium">{t({ hi: "मासिक", en: "Monthly" })}</span>
                        : <span className="text-xs text-muted-foreground">{t({ hi: "एकमुश्त", en: "One-time" })}</span>}
                    </td>
                    {/* Status */}
                    <td className="p-3.5 whitespace-nowrap">{statusBadge(d.status)}</td>
                    {/* Date */}
                    <td className="p-3.5 text-xs text-muted-foreground whitespace-nowrap">
                      <div className="flex items-center gap-1">
                        <Calendar className="size-3" />
                        <span>{new Date(d.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}</span>
                      </div>
                      {d.testMode && (
                        <span className="text-[10px] rounded bg-turmeric/20 px-1 py-0.5 font-semibold text-foreground/70 mt-0.5 inline-block">TEST</span>
                      )}
                    </td>
                    {/* Receipt */}
                    <td className="p-3.5 font-mono text-xs whitespace-nowrap">
                      {d.receipt
                        ? <span className="rounded bg-muted px-1.5 py-0.5">{d.receipt.receiptNumber}</span>
                        : <span className="text-muted-foreground">—</span>}
                    </td>
                    {/* Detail */}
                    <td className="p-3.5 text-right">
                      <button
                        onClick={() => setDetailDonation(d)}
                        className="inline-flex items-center gap-1 text-xs text-primary font-semibold hover:underline"
                      >
                        <ChevronRight className="size-4" />
                      </button>
                    </td>
                  </tr>
                ))}

                {filtered.length === 0 && !loading && (
                  <tr>
                    <td colSpan={8} className="p-10 text-center text-muted-foreground">
                      <p className="font-semibold">{t({ hi: "कोई लेन-देन नहीं मिला।", en: "No transactions match your filters." })}</p>
                      <p className="text-xs mt-1">{t({ hi: "फ़िल्टर साफ़ करें या /donate से परीक्षण दान करें।", en: "Clear filters or submit a test donation from /donate." })}</p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Transaction Detail Drawer */}
      {detailDonation && (
        <DonationDetailDrawer
          donation={detailDonation}
          onClose={() => setDetailDonation(null)}
        />
      )}
    </div>
  );
}

// -------------------------------------------------------------
// DONATION DETAIL DRAWER
// -------------------------------------------------------------

function DonationDetailDrawer({ donation: d, onClose }: { donation: AdminDonation; onClose: () => void }) {
  const { t } = useLang();

  const statusMeta: Record<AdminDonation["status"], { cls: string; label: { hi: string; en: string } }> = {
    SUCCEEDED: { cls: "bg-leaf-soft text-leaf", label: { hi: "✓ सफल (TEST)", en: "✓ Succeeded (TEST)" } },
    PENDING:   { cls: "bg-secondary text-secondary-foreground", label: { hi: "⏳ लंबित", en: "⏳ Pending" } },
    FAILED:    { cls: "bg-destructive/10 text-destructive", label: { hi: "✗ विफल", en: "✗ Failed" } },
  };

  const rows: Array<[{ hi: string; en: string }, string]> = [
    [{ hi: "लेन-देन ID", en: "Transaction ID" }, d.id],
    [{ hi: "भुगतान संदर्भ", en: "Payment Reference" }, d.paymentReference],
    [{ hi: "दानदाता नाम", en: "Donor Name" }, d.donorName],
    [{ hi: "दानदाता ईमेल", en: "Donor Email" }, d.donorEmail],
    [{ hi: "PAN (अंतिम 4)", en: "PAN (last 4)" }, d.donorPanLast4 ? `••••${d.donorPanLast4}` : t({ hi: "उपलब्ध नहीं", en: "Not available" })],
    [{ hi: "राशि", en: "Amount" }, inr(d.amount)],
    [{ hi: "प्रकार", en: "Type" }, d.frequency === "MONTHLY" ? t({ hi: "मासिक", en: "Monthly" }) : t({ hi: "एकमुश्त", en: "One-time" })],
    [{ hi: "अभियान", en: "Campaign" }, t(d.campaign.title)],
    [{ hi: "बनाया गया", en: "Created" }, new Date(d.createdAt).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", dateStyle: "medium", timeStyle: "short" })],
    [{ hi: "भुगतान दिनांक", en: "Paid At" }, d.paidAt ? new Date(d.paidAt).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", dateStyle: "medium", timeStyle: "short" }) : "—"],
    [{ hi: "रसीद नंबर", en: "Receipt Number" }, d.receipt?.receiptNumber ?? "—"],
    [{ hi: "परीक्षण मोड", en: "Test Mode" }, d.testMode ? t({ hi: "हाँ (MOCK)", en: "Yes (MOCK)" }) : t({ hi: "नहीं", en: "No" })],
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-end bg-black/50 backdrop-blur-xs" onClick={onClose}>
      <div
        className="h-full w-full max-w-md bg-card shadow-2xl overflow-y-auto animate-in slide-in-from-right-8"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b sticky top-0 bg-card z-10">
          <div>
            <h3 className="font-display text-xl">{t({ hi: "लेन-देन विवरण", en: "Transaction Details" })}</h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${statusMeta[d.status].cls}`}>
                {t(statusMeta[d.status].label)}
              </span>
            </p>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-muted text-muted-foreground">
            <X className="size-5" />
          </button>
        </div>

        {/* Test mode warning */}
        {d.testMode && (
          <div className="mx-5 mt-4 rounded-xl bg-turmeric/20 px-4 py-2.5 text-xs font-semibold text-foreground">
            {t({
              hi: "यह एक परीक्षण लेन-देन है। कोई वास्तविक धनराशि एकत्र नहीं की गई।",
              en: "This is a test transaction. No real funds were collected.",
            })}
          </div>
        )}

        {/* Detail rows */}
        <div className="p-5 space-y-0">
          {rows.map(([label, value]) => (
            <div key={label.en} className="flex items-start justify-between gap-4 py-3 border-b last:border-0">
              <span className="text-xs font-semibold text-muted-foreground shrink-0 w-32">{t(label)}</span>
              <span className="text-xs font-medium text-right break-all">{value}</span>
            </div>
          ))}
        </div>

        {/* Receipt download — admin uses isAdmin gate, no token needed */}
        {d.receipt && d.status === "SUCCEEDED" && (
          <ReceiptDownloadButton receiptId={d.receipt.id} receiptNumber={d.receipt.receiptNumber} />
        )}

        {/* Failed payment explanation */}
        {d.status === "FAILED" && (
          <div className="mx-5 mb-5 rounded-xl bg-destructive/10 p-4 text-xs text-destructive space-y-1">
            <p className="font-semibold">{t({ hi: "भुगतान विफल", en: "Payment Failed" })}</p>
            <p>
              {t({
                hi: "यह परीक्षण मोड में एक जानबूझकर असफल लेन-देन हो सकता है। किसी राशि का डेबिट नहीं हुआ।",
                en: "This may be an intentionally failed transaction in test mode. No amount was debited.",
              })}
            </p>
          </div>
        )}

        {/* Idempotency note */}
        <div className="mx-5 mb-5 rounded-xl bg-muted/60 p-3 text-[11px] text-muted-foreground">
          {t({
            hi: "डुप्लीकेट भुगतान रोकने के लिए इस लेन-देन का idempotency key संरक्षित है।",
            en: "The idempotency key for this transaction is preserved to prevent duplicate payments.",
          })}
        </div>
      </div>
    </div>
  );
}

// -------------------------------------------------------------
// CAMPAIGNS SECTION (CHECKPOINT 3)
// -------------------------------------------------------------

function CampaignsSection({
  campaigns,
  loading,
  error,
  onReload,
  onSyncOverview,
  setFeedback,
}: {
  campaigns: Campaign[];
  loading: boolean;
  error: string | null;
  onReload: () => Promise<void>;
  onSyncOverview: () => Promise<void>;
  setFeedback: (msg: string | null) => void;
}) {
  const { t } = useLang();
  const [busyActionId, setBusyActionId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [goalModalCampaign, setGoalModalCampaign] = useState<Campaign | null>(null);

  // Metrics
  const totalCount = campaigns.length;
  const activeCount = campaigns.filter((c) => c.active).length;
  const totalGoal = campaigns.reduce((sum, c) => sum + c.goal, 0);
  const totalRaised = campaigns.reduce((sum, c) => sum + c.raised, 0);

  // Toggle active / inactive
  const handleToggleActive = async (campaign: Campaign) => {
    setBusyActionId(`active-${campaign.id}`);
    setActionError(null);
    try {
      await updateAdminCampaign(campaign.id, { active: !campaign.active });
      await onReload();
      void onSyncOverview();
      setFeedback(
        campaign.active
          ? t({ hi: `अभियान "${campaign.title.hi}" को निष्क्रिय किया गया।`, en: `Campaign "${campaign.title.en}" deactivated.` })
          : t({ hi: `अभियान "${campaign.title.hi}" को सक्रिय किया गया।`, en: `Campaign "${campaign.title.en}" activated.` })
      );
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Failed to update campaign status.");
    } finally {
      setBusyActionId(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Metrics Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="card-soft p-4 flex items-center justify-between border-l-4 border-l-primary">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {t({ hi: "कुल अभियान", en: "Total Campaigns" })}
            </p>
            <p className="font-display text-3xl mt-1">{totalCount}</p>
          </div>
          <HeartHandshake className="size-8 text-primary/30" />
        </div>

        <div className="card-soft p-4 flex items-center justify-between border-l-4 border-l-leaf">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {t({ hi: "सक्रिय अभियान", en: "Active" })}
            </p>
            <p className="font-display text-3xl mt-1 text-leaf">{activeCount}</p>
          </div>
          <CheckCircle2 className="size-8 text-leaf/30" />
        </div>

        <div className="card-soft p-4 flex items-center justify-between border-l-4 border-l-turmeric">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {t({ hi: "कुल लक्ष्य", en: "Total Goal" })}
            </p>
            <p className="font-display text-2xl mt-1 text-turmeric">{inr(totalGoal)}</p>
          </div>
          <TrendingUp className="size-8 text-turmeric/30" />
        </div>

        <div className="card-soft p-4 flex items-center justify-between border-l-4 border-l-accent">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {t({ hi: "कुल एकत्रित (seed + दान)", en: "Total Raised (seed + donations)" })}
            </p>
            <p className="font-display text-2xl mt-1">{inr(totalRaised)}</p>
          </div>
          <Layers className="size-8 text-accent/30" />
        </div>
      </div>

      {/* Note about campaign management scope */}
      <div className="rounded-xl border bg-muted/40 px-4 py-3 text-xs text-muted-foreground flex items-start gap-2">
        <AlertCircle className="size-4 shrink-0 mt-0.5 text-muted-foreground/70" />
        <span>
          {t({
            hi: "अभियान डेटाबेस सीड से बनाए जाते हैं। यहाँ आप लक्ष्य राशि बदल सकते हैं और अभियान को सक्रिय / निष्क्रिय कर सकते हैं। नया अभियान जोड़ने या हटाने के लिए डेटाबेस सीड फ़ाइल अपडेट करें।",
            en: "Campaigns are seeded from the database. You can edit goal amounts and toggle active status here. To add or remove campaigns update the database seed file.",
          })}
        </span>
      </div>

      {/* Action Error Banner */}
      {actionError && (
        <div role="alert" className="flex items-center justify-between rounded-xl bg-destructive/10 p-4 text-sm font-medium text-destructive">
          <div className="flex items-center gap-2">
            <AlertCircle className="size-5 shrink-0" />
            <span>{actionError}</span>
          </div>
          <button onClick={() => setActionError(null)} className="p-1 hover:opacity-75">
            <X className="size-4" />
          </button>
        </div>
      )}

      {/* Load Error */}
      {error && (
        <div role="alert" className="card-soft p-4 border-destructive/20 bg-destructive/5 text-destructive flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm">
            <AlertCircle className="size-5 shrink-0" />
            <span>{error}</span>
          </div>
          <button onClick={() => void onReload()} className="btn-big !min-h-8 bg-destructive text-destructive-foreground text-xs">
            {t({ hi: "पुनः लोड करें", en: "Reload" })}
          </button>
        </div>
      )}

      {/* Loading Skeleton */}
      {loading && !campaigns.length && (
        <div className="card-soft p-12 text-center">
          <div className="inline-block size-8 animate-spin rounded-full border-3 border-primary border-t-transparent" />
          <p className="mt-3 text-sm text-muted-foreground">{t({ hi: "अभियान सूची लोड हो रही है…", en: "Loading campaigns from database…" })}</p>
        </div>
      )}

      {/* Campaigns Table */}
      {(!loading || campaigns.length > 0) && (
        <div className="card-soft overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-muted/70 text-xs text-muted-foreground uppercase font-semibold">
                <tr>
                  <th className="p-3.5">{t({ hi: "अभियान", en: "Campaign" })}</th>
                  <th className="p-3.5">{t({ hi: "ज़िला", en: "District" })}</th>
                  <th className="p-3.5">{t({ hi: "लक्ष्य", en: "Goal" })}</th>
                  <th className="p-3.5">{t({ hi: "एकत्रित (seed+दान)", en: "Raised (seed+donations)" })}</th>
                  <th className="p-3.5">{t({ hi: "प्रगति", en: "Progress" })}</th>
                  <th className="p-3.5">{t({ hi: "स्थिति", en: "Status" })}</th>
                  <th className="p-3.5 text-right">{t({ hi: "कार्रवाई", en: "Actions" })}</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {campaigns.map((campaign) => {
                  const isBusy = busyActionId === `active-${campaign.id}`;
                  const progressPct = campaign.goal > 0
                    ? Math.min(100, Math.round((campaign.raised / campaign.goal) * 100))
                    : 0;
                  return (
                    <tr key={campaign.id} className="hover:bg-muted/30 transition-colors">
                      {/* Title + story snippet */}
                      <td className="p-3.5 max-w-xs">
                        <div className="flex items-start gap-2">
                          <span className="text-2xl mt-0.5 shrink-0" aria-hidden>{campaign.emoji}</span>
                          <div>
                            <p className="font-semibold text-foreground leading-snug">{campaign.title.hi}</p>
                            <p className="text-xs text-muted-foreground leading-snug">{campaign.title.en}</p>
                            <p className="text-[11px] text-muted-foreground/70 mt-0.5 line-clamp-1">{campaign.story.en}</p>
                          </div>
                        </div>
                      </td>

                      {/* District */}
                      <td className="p-3.5 text-xs">
                        <span className="rounded-full bg-muted px-2 py-0.5 font-medium capitalize">{campaign.district}</span>
                      </td>

                      {/* Goal */}
                      <td className="p-3.5 font-semibold whitespace-nowrap">
                        {inr(campaign.goal)}
                      </td>

                      {/* Raised */}
                      <td className="p-3.5 whitespace-nowrap">
                        <p className="font-semibold text-leaf">{inr(campaign.raised)}</p>
                        <p className="text-[11px] text-muted-foreground">{campaign.donors} {t({ hi: "दानदाता", en: "donors" })}</p>
                      </td>

                      {/* Progress bar */}
                      <td className="p-3.5 min-w-[120px]">
                        <div className="flex items-center gap-2">
                          <div className="h-2 flex-1 bg-muted rounded-full overflow-hidden">
                            <div
                              className="h-full bg-leaf rounded-full transition-all"
                              style={{ width: `${Math.max(progressPct, 2)}%` }}
                            />
                          </div>
                          <span className="text-xs font-semibold tabular-nums w-8 text-right">{progressPct}%</span>
                        </div>
                        <p className="text-[11px] text-muted-foreground mt-0.5">
                          {t({ hi: "शेष:", en: "Remaining:" })} {inr(Math.max(0, campaign.goal - campaign.raised))}
                        </p>
                      </td>

                      {/* Active toggle */}
                      <td className="p-3.5 whitespace-nowrap">
                        <button
                          onClick={() => void handleToggleActive(campaign)}
                          disabled={isBusy}
                          title={campaign.active ? t({ hi: "क्लिक करके निष्क्रिय करें", en: "Click to deactivate" }) : t({ hi: "क्लिक करके सक्रिय करें", en: "Click to activate" })}
                          className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold transition-transform active:scale-95 disabled:opacity-50 ${
                            campaign.active
                              ? "bg-leaf-soft text-leaf hover:bg-leaf-soft/80"
                              : "bg-muted text-muted-foreground hover:bg-muted/80"
                          }`}
                        >
                          {campaign.active ? <Eye className="size-3.5" /> : <EyeOff className="size-3.5" />}
                          <span>{campaign.active ? t({ hi: "सक्रिय", en: "Active" }) : t({ hi: "निष्क्रिय", en: "Inactive" })}</span>
                        </button>
                      </td>

                      {/* Actions */}
                      <td className="p-3.5 text-right whitespace-nowrap">
                        <button
                          onClick={() => setGoalModalCampaign(campaign)}
                          className="p-1.5 rounded-lg border bg-card hover:bg-muted text-foreground"
                          title={t({ hi: "लक्ष्य राशि बदलें", en: "Edit goal amount" })}
                        >
                          <Edit3 className="size-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })}

                {campaigns.length === 0 && !loading && (
                  <tr>
                    <td colSpan={7} className="p-10 text-center text-muted-foreground">
                      <p className="font-semibold">{t({ hi: "कोई अभियान नहीं मिला।", en: "No campaigns found." })}</p>
                      <p className="text-xs mt-1">{t({ hi: "डेटाबेस सीड चलाएँ: npm run db:seed", en: "Run the database seed: npm run db:seed" })}</p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Per-campaign impact note */}
      {campaigns.length > 0 && (
        <div className="card-soft p-4 space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {t({ hi: "प्रति दान प्रभाव (Impact Per Donation)", en: "Impact Per Donation" })}
          </p>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {campaigns.map((c) => (
              <div key={c.id} className="flex items-center gap-2 text-xs">
                <span aria-hidden className="text-lg">{c.emoji}</span>
                <span className="text-muted-foreground">
                  <strong className="text-foreground">{c.title.en}:</strong> {c.impact.en}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Goal Edit Modal */}
      {goalModalCampaign && (
        <CampaignGoalModal
          campaign={goalModalCampaign}
          onClose={() => setGoalModalCampaign(null)}
          onSaveSuccess={async (updated) => {
            setGoalModalCampaign(null);
            await onReload();
            void onSyncOverview();
            setFeedback(t({
              hi: `अभियान "${updated.title.hi}" का लक्ष्य ${inr(updated.goal)} किया गया।`,
              en: `Campaign "${updated.title.en}" goal updated to ${inr(updated.goal)}.`,
            }));
          }}
        />
      )}
    </div>
  );
}

// -------------------------------------------------------------
// CAMPAIGN GOAL EDIT MODAL
// -------------------------------------------------------------

function CampaignGoalModal({
  campaign,
  onClose,
  onSaveSuccess,
}: {
  campaign: Campaign;
  onClose: () => void;
  onSaveSuccess: (updated: Campaign) => Promise<void>;
}) {
  const { t } = useLang();
  const [goalInput, setGoalInput] = useState(String(campaign.goal));
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const handleSave = async () => {
    setFormError(null);
    const parsed = Number(goalInput.replace(/,/g, "").trim());
    if (!Number.isFinite(parsed) || parsed < 1000 || parsed > 100_000_000) {
      setFormError(t({
        hi: "लक्ष्य राशि ₹1,000 से ₹10,00,00,000 के बीच होनी चाहिए।",
        en: "Goal amount must be between ₹1,000 and ₹10,00,00,000.",
      }));
      return;
    }
    setBusy(true);
    try {
      const updated = await updateAdminCampaign(campaign.id, { goalAmount: parsed });
      await onSaveSuccess(updated);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Failed to update goal.");
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
      <div className="card-soft max-w-md w-full p-6 space-y-5 bg-card shadow-xl animate-in fade-in zoom-in-95">
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-2xl" aria-hidden>{campaign.emoji}</span>
              <h3 className="font-display text-xl text-foreground">
                {t({ hi: "लक्ष्य राशि संपादित करें", en: "Edit Goal Amount" })}
              </h3>
            </div>
            <p className="text-sm text-muted-foreground mt-0.5">{campaign.title.en}</p>
          </div>
          <button onClick={onClose} disabled={busy} className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground">
            <X className="size-5" />
          </button>
        </div>

        {/* Current stats */}
        <div className="rounded-xl bg-muted/50 p-3 text-xs space-y-1">
          <div className="flex justify-between">
            <span className="text-muted-foreground">{t({ hi: "वर्तमान लक्ष्य:", en: "Current goal:" })}</span>
            <span className="font-semibold">{inr(campaign.goal)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">{t({ hi: "एकत्रित (seed + दान):", en: "Raised (seed + donations):" })}</span>
            <span className="font-semibold text-leaf">{inr(campaign.raised)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">{t({ hi: "दानदाता:", en: "Donors:" })}</span>
            <span className="font-semibold">{campaign.donors}</span>
          </div>
        </div>

        {/* Input */}
        <label className="flex flex-col gap-1.5 text-sm font-medium">
          {t({ hi: "नई लक्ष्य राशि (₹)", en: "New Goal Amount (₹)" })}
          <input
            type="number"
            min={1000}
            max={100_000_000}
            step={1000}
            value={goalInput}
            onChange={(e) => setGoalInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") void handleSave(); }}
            className="h-11 rounded-xl border bg-card px-3 text-base font-semibold focus:border-primary focus:outline-none"
            autoFocus
          />
          <span className="text-xs text-muted-foreground font-normal">
            {t({ hi: "न्यूनतम ₹1,000 — अधिकतम ₹10 करोड़", en: "Minimum ₹1,000 — Maximum ₹10 crore" })}
          </span>
        </label>

        {formError && (
          <div role="alert" className="flex items-center gap-2 rounded-xl bg-destructive/10 p-3 text-sm text-destructive">
            <AlertCircle className="size-4 shrink-0" />
            <span>{formError}</span>
          </div>
        )}

        {/* Actions */}
        <div className="flex justify-end gap-3 pt-1 border-t">
          <button onClick={onClose} disabled={busy} className="btn-big !min-h-10 border bg-card">
            {t({ hi: "रद्द करें", en: "Cancel" })}
          </button>
          <button
            onClick={() => void handleSave()}
            disabled={busy}
            className="btn-big !min-h-10 bg-primary text-primary-foreground disabled:opacity-50"
          >
            {busy
              ? t({ hi: "सहेजा जा रहा है…", en: "Saving…" })
              : t({ hi: "लक्ष्य अपडेट करें", en: "Update Goal" })}
          </button>
        </div>
      </div>
    </div>
  );
}

// -------------------------------------------------------------
// SCHEMES SECTION (CHECKPOINT 2)
// -------------------------------------------------------------

function SchemesSection({
  schemes,
  loading,
  error,
  onReload,
  onSyncOverview,
  setFeedback,
}: {
  schemes: Scheme[];
  loading: boolean;
  error: string | null;
  onReload: () => Promise<void>;
  onSyncOverview: () => Promise<void>;
  setFeedback: (msg: string | null) => void;
}) {
  const { t } = useLang();

  // Search and filter states
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [districtFilter, setDistrictFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<"all" | "published" | "draft">("all");

  // Modal & Dialog states
  const [modalOpen, setModalOpen] = useState(false);
  const [editingScheme, setEditingScheme] = useState<Scheme | null>(null);
  const [deleteDialogScheme, setDeleteDialogScheme] = useState<Scheme | null>(null);
  const [busyActionId, setBusyActionId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  // Statistics calculation
  const totalCount = schemes.length;
  const publishedCount = schemes.filter((s) => s.published).length;
  const draftCount = totalCount - publishedCount;

  // Filter schemes
  const filteredSchemes = useMemo(() => {
    return schemes.filter((s) => {
      // Search by name (Hi / En) or code
      if (search.trim()) {
        const q = search.trim().toLowerCase();
        const matchNameHi = s.name.hi.toLowerCase().includes(q);
        const matchNameEn = s.name.en.toLowerCase().includes(q);
        const matchCode = (s.code ?? s.id).toLowerCase().includes(q);
        if (!matchNameHi && !matchNameEn && !matchCode) return false;
      }
      // Category filter
      if (categoryFilter !== "all" && s.need !== categoryFilter) return false;
      // District filter
      if (districtFilter !== "all") {
        if (s.districts !== "all" && (!Array.isArray(s.districts) || !s.districts.includes(districtFilter))) {
          return false;
        }
      }
      // Status filter
      if (statusFilter === "published" && !s.published) return false;
      if (statusFilter === "draft" && s.published) return false;

      return true;
    });
  }, [schemes, search, categoryFilter, districtFilter, statusFilter]);

  // Quick toggle publish/unpublish
  const handleTogglePublish = async (scheme: Scheme) => {
    setBusyActionId(`publish-${scheme.id}`);
    setActionError(null);
    try {
      await updateAdminScheme(scheme.id, { published: !scheme.published });
      await onReload();
      void onSyncOverview();
      setFeedback(
        scheme.published
          ? t({ hi: `योजना "${scheme.name.hi}" को ड्राफ्ट में बदला गया।`, en: `Scheme "${scheme.name.en}" set to draft.` })
          : t({ hi: `योजना "${scheme.name.hi}" को सफलतापूर्वक प्रकाशित किया गया!`, en: `Scheme "${scheme.name.en}" published successfully!` })
      );
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Failed to update publication status.");
    } finally {
      setBusyActionId(null);
    }
  };

  // Delete scheme
  const handleDeleteScheme = async (scheme: Scheme) => {
    setBusyActionId(`delete-${scheme.id}`);
    setActionError(null);
    try {
      await deleteAdminScheme(scheme.id);
      await onReload();
      void onSyncOverview();
      setDeleteDialogScheme(null);
      setFeedback(t({ hi: `योजना "${scheme.name.hi}" को सफलतापूर्वक हटा दिया गया।`, en: `Scheme "${scheme.name.en}" deleted successfully.` }));
    } catch (err) {
      setDeleteDialogScheme(null);
      setActionError(err instanceof Error ? err.message : "Failed to delete scheme.");
    } finally {
      setBusyActionId(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Metrics Summary Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="card-soft p-4 flex items-center justify-between border-l-4 border-l-primary">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {t({ hi: "कुल दर्ज योजनाएँ", en: "Total Schemes" })}
            </p>
            <p className="font-display text-3xl mt-1 text-foreground">{totalCount}</p>
          </div>
          <Layers className="size-8 text-primary/30" />
        </div>

        <div className="card-soft p-4 flex items-center justify-between border-l-4 border-l-leaf">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {t({ hi: "प्रकाशित योजनाएँ (Live)", en: "Published (Live)" })}
            </p>
            <p className="font-display text-3xl mt-1 text-leaf">{publishedCount}</p>
          </div>
          <CheckCircle2 className="size-8 text-leaf/30" />
        </div>

        <div className="card-soft p-4 flex items-center justify-between border-l-4 border-l-turmeric">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {t({ hi: "ड्राफ्ट योजनाएँ", en: "Drafts (Unpublished)" })}
            </p>
            <p className="font-display text-3xl mt-1 text-turmeric">{draftCount}</p>
          </div>
          <Clock className="size-8 text-turmeric/30" />
        </div>
      </div>

      {/* Search, Filter & Action Bar */}
      <div className="card-soft p-4 space-y-3">
        <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
          {/* Search bar */}
          <div className="relative flex-1">
            <Search className="absolute left-3 top-3 size-4 text-muted-foreground" />
            <input
              type="text"
              placeholder={t({ hi: "योजना का नाम या कोड खोजें (उदा. विधवा पेंशन, SCH-014)…", en: "Search scheme name or code (e.g. widow pension, SCH-014)…" })}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-10 w-full rounded-xl border bg-card pl-9 pr-4 text-sm focus:border-primary focus:outline-none"
            />
            {search && (
              <button onClick={() => setSearch("")} className="absolute right-3 top-2.5 text-muted-foreground hover:text-foreground">
                <X className="size-4" />
              </button>
            )}
          </div>

          {/* Prominent Add New Scheme Button */}
          <button
            onClick={() => {
              setEditingScheme(null);
              setModalOpen(true);
            }}
            className="btn-big bg-primary text-primary-foreground flex items-center justify-center gap-2 whitespace-nowrap shadow-sm hover:opacity-95"
          >
            <Plus className="size-5" />
            <span>{t({ hi: "+ नई योजना जोड़ें", en: "+ Add New Scheme" })}</span>
          </button>
        </div>

        {/* Filter Dropdowns */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-2 border-t text-xs">
          {/* Category */}
          <label className="flex items-center gap-2">
            <span className="font-semibold text-muted-foreground shrink-0">{t({ hi: "श्रेणी:", en: "Category:" })}</span>
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="h-8 flex-1 rounded-lg border bg-card px-2 font-medium focus:border-primary"
            >
              <option value="all">{t({ hi: "सभी श्रेणियां (All Needs)", en: "All Categories" })}</option>
              {NEEDS.map((n) => (
                <option key={n.id} value={n.id}>
                  {n.icon} {t(n.name)}
                </option>
              ))}
            </select>
          </label>

          {/* District */}
          <label className="flex items-center gap-2">
            <span className="font-semibold text-muted-foreground shrink-0">{t({ hi: "ज़िला:", en: "District:" })}</span>
            <select
              value={districtFilter}
              onChange={(e) => setDistrictFilter(e.target.value)}
              className="h-8 flex-1 rounded-lg border bg-card px-2 font-medium focus:border-primary"
            >
              <option value="all">{t({ hi: "सभी ज़िले (All Districts)", en: "All Districts" })}</option>
              {DISTRICTS.map((d) => (
                <option key={d.id} value={d.id}>
                  {t(d.name)}
                </option>
              ))}
            </select>
          </label>

          {/* Status */}
          <label className="flex items-center gap-2">
            <span className="font-semibold text-muted-foreground shrink-0">{t({ hi: "स्थिति:", en: "Status:" })}</span>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as "all" | "published" | "draft")}
              className="h-8 flex-1 rounded-lg border bg-card px-2 font-medium focus:border-primary"
            >
              <option value="all">{t({ hi: "सभी (प्रकाशित व ड्राफ्ट)", en: "All Statuses" })}</option>
              <option value="published">{t({ hi: "केवल प्रकाशित (Live)", en: "Published Only" })}</option>
              <option value="draft">{t({ hi: "केवल ड्राफ्ट (Draft)", en: "Drafts Only" })}</option>
            </select>
          </label>
        </div>
      </div>

      {/* Action Error Banner (publish/delete failures) */}
      {actionError && (
        <div role="alert" className="flex items-center justify-between rounded-xl bg-destructive/10 p-4 text-sm font-medium text-destructive">
          <div className="flex items-center gap-2">
            <AlertCircle className="size-5 shrink-0" />
            <span>{actionError}</span>
          </div>
          <button onClick={() => setActionError(null)} className="p-1 hover:opacity-75">
            <X className="size-4" />
          </button>
        </div>
      )}

      {/* Schemes Error State */}
      {error && (
        <div role="alert" className="card-soft p-4 border-destructive/20 bg-destructive/5 text-destructive flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm">
            <AlertCircle className="size-5 shrink-0" />
            <span>{error}</span>
          </div>
          <button onClick={() => void onReload()} className="btn-big !min-h-8 bg-destructive text-destructive-foreground text-xs">
            {t({ hi: "पुनः लोड करें", en: "Reload" })}
          </button>
        </div>
      )}

      {/* Schemes Loading State */}
      {loading && !schemes.length && (
        <div className="card-soft p-12 text-center">
          <div className="inline-block size-8 animate-spin rounded-full border-3 border-primary border-t-transparent" />
          <p className="mt-3 text-sm text-muted-foreground">{t({ hi: "योजना सूची लोड हो रही है…", en: "Loading schemes from database…" })}</p>
        </div>
      )}

      {/* Schemes Table */}
      {!loading || schemes.length > 0 ? (
        <div className="card-soft overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-muted/70 text-xs text-muted-foreground uppercase font-semibold">
                <tr>
                  <th className="p-3.5">{t({ hi: "योजना का नाम व विवरण", en: "Scheme Name & Dept" })}</th>
                  <th className="p-3.5">{t({ hi: "कोड", en: "Code" })}</th>
                  <th className="p-3.5">{t({ hi: "श्रेणी", en: "Category" })}</th>
                  <th className="p-3.5">{t({ hi: "ज़िला कवरेज", en: "Districts" })}</th>
                  <th className="p-3.5">{t({ hi: "स्थिति", en: "Status" })}</th>
                  <th className="p-3.5">{t({ hi: "सत्यापित", en: "Last Checked" })}</th>
                  <th className="p-3.5 text-right">{t({ hi: "कार्रवाई", en: "Actions" })}</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {filteredSchemes.map((scheme) => {
                  const needObj = NEEDS.find((n) => n.id === scheme.need);
                  const isBusy = busyActionId === `publish-${scheme.id}` || busyActionId === `delete-${scheme.id}`;
                  const districtsText =
                    scheme.districts === "all"
                      ? t({ hi: "सभी 9 ज़िले", en: "All 9 districts" })
                      : `${(scheme.districts as string[]).length}/9 ज़िले`;

                  return (
                    <tr key={scheme.id} className="hover:bg-muted/30 transition-colors">
                      {/* Name & Dept */}
                      <td className="p-3.5 max-w-xs">
                        <p className="font-semibold text-foreground truncate">{scheme.name.hi}</p>
                        <p className="text-xs text-muted-foreground truncate">{scheme.name.en}</p>
                        {scheme.dept?.hi && <p className="text-[11px] text-muted-foreground/80 truncate mt-0.5">{scheme.dept.hi}</p>}
                        {scheme.aiSummaryDraftHi && (
                          <div className="mt-1">
                            <span
                              className={`inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-semibold ${
                                scheme.aiSummaryApproved ? "bg-leaf-soft text-leaf" : "bg-turmeric/20 text-foreground"
                              }`}
                            >
                              <Sparkles className="size-3" />
                              {scheme.aiSummaryApproved ? t({ hi: "AI सारांश स्वीकृत", en: "AI Summary Approved" }) : t({ hi: "AI ड्राफ्ट समीक्षा बाकी", en: "AI Draft Pending" })}
                            </span>
                          </div>
                        )}
                      </td>

                      {/* Code */}
                      <td className="p-3.5 font-mono text-xs">
                        <span className="rounded bg-muted px-2 py-1 font-semibold">{scheme.code ?? scheme.id.slice(0, 8)}</span>
                      </td>

                      {/* Category */}
                      <td className="p-3.5">
                        <span className="inline-flex items-center gap-1.5 text-xs font-medium">
                          <span aria-hidden>{needObj?.icon ?? "📋"}</span>
                          <span>{t(needObj?.name ?? { hi: scheme.need, en: scheme.need })}</span>
                        </span>
                      </td>

                      {/* Districts */}
                      <td className="p-3.5 text-xs text-muted-foreground whitespace-nowrap">
                        <span className="rounded-full bg-muted px-2 py-0.5 font-medium">{districtsText}</span>
                      </td>

                      {/* Status */}
                      <td className="p-3.5 whitespace-nowrap">
                        <button
                          onClick={() => void handleTogglePublish(scheme)}
                          disabled={isBusy}
                          title={scheme.published ? "Click to Unpublish" : "Click to Publish"}
                          className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold transition-transform active:scale-95 disabled:opacity-50 ${
                            scheme.published ? "bg-leaf-soft text-leaf hover:bg-leaf-soft/80" : "bg-muted text-muted-foreground hover:bg-muted/80"
                          }`}
                        >
                          {scheme.published ? <Eye className="size-3.5" /> : <EyeOff className="size-3.5" />}
                          <span>{scheme.published ? t({ hi: "प्रकाशित (Live)", en: "Live" }) : t({ hi: "ड्राफ्ट (Draft)", en: "Draft" })}</span>
                        </button>
                      </td>

                      {/* Last Checked Date & Source */}
                      <td className="p-3.5 text-xs text-muted-foreground whitespace-nowrap">
                        <div className="flex items-center gap-1">
                          <Calendar className="size-3" />
                          <span>
                            {scheme.lastCheckedAt
                              ? new Date(scheme.lastCheckedAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })
                              : "—"}
                          </span>
                        </div>
                        {scheme.sourceUrl && (
                          <a
                            href={scheme.sourceUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-[11px] text-primary hover:underline mt-0.5"
                          >
                            <span>{t({ hi: "स्रोत लिंक", en: "Source" })}</span>
                            <ExternalLink className="size-2.5" />
                          </a>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="p-3.5 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* View on site (published only) */}
                          {scheme.published && (
                            <a
                              href={`/schemes/${encodeURIComponent(scheme.id)}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="p-1.5 rounded-lg border bg-card hover:bg-muted text-muted-foreground"
                              title={t({ hi: "पोर्टल पर देखें", en: "View on site" })}
                            >
                              <ExternalLink className="size-4" />
                            </a>
                          )}

                          {/* Edit button */}
                          <button
                            onClick={() => {
                              setEditingScheme(scheme);
                              setModalOpen(true);
                            }}
                            className="p-1.5 rounded-lg border bg-card hover:bg-muted text-foreground"
                            title={t({ hi: "संपादित करें", en: "Edit Scheme" })}
                          >
                            <Edit3 className="size-4" />
                          </button>

                          {/* Delete button */}
                          <button
                            onClick={() => setDeleteDialogScheme(scheme)}
                            disabled={isBusy}
                            className="p-1.5 rounded-lg border bg-card hover:bg-destructive/10 text-destructive disabled:opacity-50"
                            title={t({ hi: "हटाएं", en: "Delete Scheme" })}
                          >
                            <Trash2 className="size-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}

                {filteredSchemes.length === 0 && (
                  <tr>
                    <td colSpan={7} className="p-10 text-center text-muted-foreground">
                      <p className="font-semibold text-base">{t({ hi: "कोई योजना नहीं मिली।", en: "No schemes match your filters." })}</p>
                      <p className="text-xs mt-1">
                        {t({
                          hi: "फ़िल्टर साफ़ करें या ऊपर '+ नई योजना जोड़ें' बटन पर क्लिक करके नई योजना जोड़ें।",
                          en: "Clear filters or click '+ Add New Scheme' to create a scheme.",
                        })}
                      </p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}

      {/* Add / Edit Scheme Modal */}
      {modalOpen && (
        <SchemeModal
          scheme={editingScheme}
          onClose={() => {
            setModalOpen(false);
            setEditingScheme(null);
          }}
          onSaveSuccess={async (savedScheme) => {
            setModalOpen(false);
            setEditingScheme(null);
            await onReload();
            void onSyncOverview();
            setFeedback(
              editingScheme
                ? t({ hi: `योजना "${savedScheme.name.hi}" को सफलतापूर्वक अपडेट किया गया।`, en: `Scheme "${savedScheme.name.en}" updated successfully.` })
                : t({ hi: `नई योजना "${savedScheme.name.hi}" सफलतापूर्वक बनाई गई!`, en: `New scheme "${savedScheme.name.en}" created successfully!` })
            );
          }}
        />
      )}

      {/* Delete Confirmation Dialog */}
      {deleteDialogScheme && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="card-soft max-w-md w-full p-6 space-y-4 bg-card shadow-xl animate-in fade-in zoom-in-95">
            <div className="flex items-center gap-3 text-destructive">
              <AlertCircle className="size-6" />
              <h3 className="font-display text-xl text-foreground">{t({ hi: "योजना हटाएं?", en: "Delete Scheme?" })}</h3>
            </div>
            <p className="text-sm text-muted-foreground leading-relaxed">
              {t({
                hi: `क्या आप वाकई "${deleteDialogScheme.name.hi}" (${deleteDialogScheme.code ?? deleteDialogScheme.id}) को हटाना चाहते हैं? यह क्रिया वापस नहीं ली जा सकती और यह योजना पोर्टल से पूरी तरह हट जाएगी।`,
                en: `Are you sure you want to permanently delete "${deleteDialogScheme.name.en}" (${deleteDialogScheme.code ?? deleteDialogScheme.id})? This action cannot be undone.`,
              })}
            </p>
            <div className="flex justify-end gap-3 pt-3 border-t">
              <button
                onClick={() => setDeleteDialogScheme(null)}
                disabled={busyActionId === `delete-${deleteDialogScheme.id}`}
                className="btn-big !min-h-10 border bg-card"
              >
                {t({ hi: "रद्द करें", en: "Cancel" })}
              </button>
              <button
                onClick={() => void handleDeleteScheme(deleteDialogScheme)}
                disabled={busyActionId === `delete-${deleteDialogScheme.id}`}
                className="btn-big !min-h-10 bg-destructive text-destructive-foreground disabled:opacity-50"
              >
                {busyActionId === `delete-${deleteDialogScheme.id}` ? t({ hi: "हटाई जा रही है…", en: "Deleting…" }) : t({ hi: "हाँ, हटाएं", en: "Delete Scheme" })}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// -------------------------------------------------------------
// ADD & EDIT SCHEME MODAL
// -------------------------------------------------------------

function SchemeModal({
  scheme,
  onClose,
  onSaveSuccess,
}: {
  scheme: Scheme | null;
  onClose: () => void;
  onSaveSuccess: (scheme: Scheme) => Promise<void>;
}) {
  const { t } = useLang();
  const isEditing = scheme !== null;

  // Form states
  const [code, setCode] = useState(scheme?.code ?? "");
  const [nameHi, setNameHi] = useState(scheme?.name.hi ?? "");
  const [nameEn, setNameEn] = useState(scheme?.name.en ?? "");
  const [deptHi, setDeptHi] = useState(scheme?.dept.hi ?? "");
  const [deptEn, setDeptEn] = useState(scheme?.dept.en ?? "");
  const [need, setNeed] = useState<Need>(scheme?.need ?? "money");
  const [shortHi, setShortHi] = useState(scheme?.short.hi ?? "");
  const [shortEn, setShortEn] = useState(scheme?.short.en ?? "");
  const [benefitHi, setBenefitHi] = useState(scheme?.benefit.hi ?? "");
  const [benefitEn, setBenefitEn] = useState(scheme?.benefit.en ?? "");

  // Districts
  const [allDistricts, setAllDistricts] = useState(scheme ? scheme.districts === "all" : true);
  const [selectedDistricts, setSelectedDistricts] = useState<string[]>(
    scheme && Array.isArray(scheme.districts) ? scheme.districts : DISTRICTS.map((d) => d.id)
  );

  // Repeatable rows
  const [eligibilityRows, setEligibilityRows] = useState<Array<{ hi: string; en: string }>>(
    scheme?.eligibility?.length ? scheme.eligibility : [{ hi: "", en: "" }]
  );
  const [documentRows, setDocumentRows] = useState<Array<{ hi: string; en: string }>>(
    scheme?.documents?.length ? scheme.documents : [{ hi: "", en: "" }]
  );
  const [stepRows, setStepRows] = useState<Array<{ hi: string; en: string }>>(
    scheme?.steps?.length ? scheme.steps : [{ hi: "", en: "" }]
  );

  // Source & Notice
  const [sourceUrl, setSourceUrl] = useState(scheme?.sourceUrl ?? "");
  const [officialNoticeText, setOfficialNoticeText] = useState(scheme?.officialNoticeText ?? "");
  const [lastCheckedAt, setLastCheckedAt] = useState(
    scheme?.lastCheckedAt ? new Date(scheme.lastCheckedAt).toISOString().split("T")[0] : new Date().toISOString().split("T")[0]
  );
  const [rulesJson, setRulesJson] = useState(JSON.stringify(scheme?.rules ?? {}, null, 2));

  // AI Summary draft states
  const [aiDraft, setAiDraft] = useState<string | null>(scheme?.aiSummaryDraftHi ?? null);
  const [aiApproved, setAiApproved] = useState<boolean>(scheme?.aiSummaryApproved ?? false);
  const [generatingAi, setGeneratingAi] = useState(false);

  // Submitting states
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Handle District selection
  const toggleDistrict = (id: string) => {
    if (allDistricts) {
      setAllDistricts(false);
      setSelectedDistricts([id]);
    } else {
      setSelectedDistricts((prev) => (prev.includes(id) ? prev.filter((d) => d !== id) : [...prev, id]));
    }
  };

  // Generate AI Summary draft
  const handleDraftAiSummary = async () => {
    if (!officialNoticeText.trim()) {
      setFormError(t({ hi: "AI सारांश बनाने के लिए आधिकारिक नोटिस का पाठ अनिवार्य है।", en: "Official notice text is required to generate AI draft." }));
      return;
    }
    setGeneratingAi(true);
    setFormError(null);
    try {
      if (scheme?.id) {
        // Save current notice text first
        await updateAdminScheme(scheme.id, { officialNoticeText, sourceUrl: sourceUrl.trim() || null });
        const res = await draftSchemeSummary(scheme.id);
        setAiDraft(res.draft);
        setAiApproved(false);
      } else {
        setFormError(t({ hi: "पहले योजना सहेजें, फिर AI सारांश ड्राफ्ट करें।", en: "Save scheme first to draft AI summary." }));
      }
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Failed to draft AI summary.");
    } finally {
      setGeneratingAi(false);
    }
  };

  // Approve AI Summary
  const handleApproveAiSummary = async () => {
    if (!scheme?.id) return;
    setBusy(true);
    try {
      const updated = await approveSchemeSummary(scheme.id);
      setAiApproved(true);
      setShortHi(updated.short.hi);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Failed to approve summary.");
    } finally {
      setBusy(false);
    }
  };

  // Dismiss AI Summary
  const handleDismissAiSummary = async () => {
    if (!scheme?.id) return;
    setBusy(true);
    try {
      await dismissSchemeSummary(scheme.id);
      setAiDraft(null);
      setAiApproved(false);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Failed to dismiss summary.");
    } finally {
      setBusy(false);
    }
  };

  // Submit form
  const handleSubmit = async (publishIntent?: boolean) => {
    setFormError(null);

    if (!nameHi.trim() || !nameEn.trim()) {
      setFormError(t({ hi: "योजना का नाम (हिंदी व अंग्रेज़ी दोनों) आवश्यक है।", en: "Scheme name in both Hindi and English is required." }));
      return;
    }

    let parsedRules: Record<string, unknown> = {};
    try {
      if (rulesJson.trim()) {
        parsedRules = JSON.parse(rulesJson) as Record<string, unknown>;
      }
    } catch {
      setFormError(t({ hi: "पात्रता नियम JSON अमान्य है।", en: "Eligibility rules JSON is invalid." }));
      return;
    }

    const cleanEligibility = eligibilityRows.filter((r) => r.hi.trim() || r.en.trim()).map((r) => ({ hi: r.hi.trim() || r.en.trim(), en: r.en.trim() || r.hi.trim() }));
    const cleanDocuments = documentRows.filter((r) => r.hi.trim() || r.en.trim()).map((r) => ({ hi: r.hi.trim() || r.en.trim(), en: r.en.trim() || r.hi.trim() }));
    const cleanSteps = stepRows.filter((r) => r.hi.trim() || r.en.trim()).map((r) => ({ hi: r.hi.trim() || r.en.trim(), en: r.en.trim() || r.hi.trim() }));

    const districts = allDistricts ? "all" : selectedDistricts.length === 0 ? "all" : selectedDistricts;

    const payload = {
      code: code.trim() || undefined,
      need,
      name: { hi: nameHi.trim(), en: nameEn.trim() },
      dept: { hi: deptHi.trim(), en: deptEn.trim() },
      short: { hi: shortHi.trim(), en: shortEn.trim() },
      benefit: { hi: benefitHi.trim(), en: benefitEn.trim() },
      eligibility: cleanEligibility,
      documents: cleanDocuments,
      steps: cleanSteps,
      districts,
      rules: parsedRules,
      sourceUrl: sourceUrl.trim() || null,
      officialNoticeText: officialNoticeText.trim() || null,
      // Only send lastCheckedAt when a source URL is present (or for existing schemes
      // that previously had a verification date — the date picker still lets admins update it).
      lastCheckedAt: (sourceUrl.trim() || (isEditing && scheme?.lastCheckedAt))
        ? (lastCheckedAt ? new Date(lastCheckedAt).toISOString() : null)
        : undefined,
      published: publishIntent !== undefined ? publishIntent : (scheme?.published ?? false),
    };

    setBusy(true);
    try {
      let saved: Scheme;
      if (isEditing && scheme) {
        saved = await updateAdminScheme(scheme.id, payload);
      } else {
        saved = await createAdminScheme(payload);
      }
      // onSaveSuccess closes the modal and reloads; errors here are reported
      // to the parent (SchemesSection) via its own error state.
      await onSaveSuccess(saved);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Failed to save scheme.");
      setBusy(false);
    }
    // Do NOT reset busy in a finally block — onSaveSuccess unmounts this component
    // when successful, so calling setBusy(false) after it would cause a state update on
    // an unmounted component. The catch branch above handles the failure path.
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-3 md:p-6 overflow-y-auto">
      <div className="card-soft max-w-4xl w-full max-h-[92vh] flex flex-col bg-card shadow-2xl animate-in fade-in zoom-in-95">
        {/* Modal Header */}
        <div className="flex items-center justify-between p-5 border-b shrink-0">
          <div>
            <h2 className="font-display text-2xl text-foreground">
              {isEditing ? t({ hi: `योजना संपादित करें — ${scheme.name.hi}`, en: `Edit Scheme — ${scheme.name.en}` }) : t({ hi: "नई योजना जोड़ें", en: "Add New Scheme" })}
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              {t({ hi: "योजना का विवरण, पात्रता नियम, ज़िले व आधिकारिक सूचना दर्ज करें।", en: "Enter scheme details, criteria, district availability and notice text." })}
            </p>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground">
            <X className="size-5" />
          </button>
        </div>

        {/* Modal Scrollable Body */}
        <div className="p-5 md:p-6 overflow-y-auto space-y-6 flex-1 text-sm">
          {formError && (
            <div role="alert" className="flex items-center gap-2 rounded-xl bg-destructive/10 p-4 text-sm text-destructive">
              <AlertCircle className="size-5 shrink-0" />
              <span>{formError}</span>
            </div>
          )}

          {/* 1. Basic Info Section */}
          <div className="space-y-4">
            <h3 className="font-semibold text-primary border-b pb-1 text-sm uppercase tracking-wider">
              {t({ hi: "1. सामान्य जानकारी (Basic Information)", en: "1. Basic Information" })}
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <label className="flex flex-col gap-1 font-medium">
                {t({ hi: "योजना कोड (Scheme Code)", en: "Scheme Code" })}
                <input
                  type="text"
                  placeholder="e.g. SCH-045"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  className="h-10 rounded-xl border bg-card px-3 font-mono"
                />
              </label>

              <label className="flex flex-col gap-1 font-medium md:col-span-2">
                {t({ hi: "श्रेणी (Category / Need)", en: "Category / Need" })}
                <select
                  value={need}
                  onChange={(e) => setNeed(e.target.value as Need)}
                  className="h-10 rounded-xl border bg-card px-3 font-medium"
                >
                  {NEEDS.map((n) => (
                    <option key={n.id} value={n.id}>
                      {n.icon} {t(n.name)} ({n.id})
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <label className="flex flex-col gap-1 font-medium">
                {t({ hi: "योजना का नाम — हिंदी (Name in Hindi) *", en: "Name in Hindi *" })}
                <input
                  type="text"
                  required
                  placeholder="उदा. राज्य विधवा पेंशन"
                  value={nameHi}
                  onChange={(e) => setNameHi(e.target.value)}
                  className="h-10 rounded-xl border bg-card px-3"
                />
              </label>

              <label className="flex flex-col gap-1 font-medium">
                {t({ hi: "योजना का नाम — अंग्रेज़ी (Name in English) *", en: "Name in English *" })}
                <input
                  type="text"
                  required
                  placeholder="e.g. State Widow Pension"
                  value={nameEn}
                  onChange={(e) => setNameEn(e.target.value)}
                  className="h-10 rounded-xl border bg-card px-3"
                />
              </label>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <label className="flex flex-col gap-1 font-medium">
                {t({ hi: "विभाग का नाम — हिंदी (Department Hindi)", en: "Department in Hindi" })}
                <input
                  type="text"
                  placeholder="उदा. महिला एवं बाल विकास विभाग"
                  value={deptHi}
                  onChange={(e) => setDeptHi(e.target.value)}
                  className="h-10 rounded-xl border bg-card px-3"
                />
              </label>

              <label className="flex flex-col gap-1 font-medium">
                {t({ hi: "विभाग का नाम — अंग्रेज़ी (Department English)", en: "Department in English" })}
                <input
                  type="text"
                  placeholder="e.g. Department of Women and Child Development"
                  value={deptEn}
                  onChange={(e) => setDeptEn(e.target.value)}
                  className="h-10 rounded-xl border bg-card px-3"
                />
              </label>
            </div>
          </div>

          {/* 2. Descriptions and Benefits */}
          <div className="space-y-4">
            <h3 className="font-semibold text-primary border-b pb-1 text-sm uppercase tracking-wider">
              {t({ hi: "2. संक्षिप्त विवरण और लाभ (Summary & Benefits)", en: "2. Summary & Benefits" })}
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <label className="flex flex-col gap-1 font-medium">
                {t({ hi: "संक्षिप्त विवरण — हिंदी (Summary Hindi)", en: "Summary in Hindi" })}
                <textarea
                  rows={3}
                  value={shortHi}
                  onChange={(e) => setShortHi(e.target.value)}
                  placeholder="पात्र महिलाओं को मिलने वाली सहायता का सरल हिंदी विवरण…"
                  className="rounded-xl border bg-card p-3"
                />
              </label>

              <label className="flex flex-col gap-1 font-medium">
                {t({ hi: "संक्षिप्त विवरण — अंग्रेज़ी (Summary English)", en: "Summary in English" })}
                <textarea
                  rows={3}
                  value={shortEn}
                  onChange={(e) => setShortEn(e.target.value)}
                  placeholder="Short description in English…"
                  className="rounded-xl border bg-card p-3"
                />
              </label>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <label className="flex flex-col gap-1 font-medium">
                {t({ hi: "योजना के मुख्य लाभ — हिंदी (Benefit Hindi)", en: "Key Benefits in Hindi" })}
                <textarea
                  rows={2}
                  value={benefitHi}
                  onChange={(e) => setBenefitHi(e.target.value)}
                  placeholder="उदा. ₹600 प्रति माह सीधे बैंक खाते में"
                  className="rounded-xl border bg-card p-3"
                />
              </label>

              <label className="flex flex-col gap-1 font-medium">
                {t({ hi: "योजना के मुख्य लाभ — अंग्रेज़ी (Benefit English)", en: "Key Benefits in English" })}
                <textarea
                  rows={2}
                  value={benefitEn}
                  onChange={(e) => setBenefitEn(e.target.value)}
                  placeholder="e.g. ₹600 per month direct into bank account"
                  className="rounded-xl border bg-card p-3"
                />
              </label>
            </div>
          </div>

          {/* 3. District Availability */}
          <div className="space-y-3">
            <div className="flex items-center justify-between border-b pb-1">
              <h3 className="font-semibold text-primary text-sm uppercase tracking-wider">
                {t({ hi: "3. लागू ज़िले (Applicable Districts)", en: "3. Applicable Districts" })}
              </h3>
              <button
                type="button"
                onClick={() => {
                  setAllDistricts(!allDistricts);
                  if (!allDistricts) setSelectedDistricts(DISTRICTS.map((d) => d.id));
                }}
                className={`text-xs font-semibold px-2 py-1 rounded-md border ${
                  allDistricts ? "bg-leaf-soft text-leaf border-leaf/30" : "bg-card text-muted-foreground"
                }`}
              >
                {allDistricts ? t({ hi: "✓ सभी 9 ज़िलों में लागू", en: "✓ All 9 Districts" }) : t({ hi: "सभी ज़िले चुनें", en: "Select All" })}
              </button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 pt-1">
              {DISTRICTS.map((d) => {
                const checked = allDistricts || selectedDistricts.includes(d.id);
                return (
                  <label
                    key={d.id}
                    className={`flex items-center gap-2 p-2 rounded-xl border text-xs font-medium cursor-pointer transition-colors ${
                      checked ? "bg-primary/5 border-primary/40 text-foreground" : "bg-card text-muted-foreground"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleDistrict(d.id)}
                      className="size-4 rounded accent-primary"
                    />
                    <span>📍 {t(d.name)}</span>
                  </label>
                );
              })}
            </div>
          </div>

          {/* 4. Eligibility, Documents & Steps */}
          <div className="space-y-4">
            <h3 className="font-semibold text-primary border-b pb-1 text-sm uppercase tracking-wider">
              {t({ hi: "4. पात्रता, दस्तावेज़ व आवेदन चरण (Criteria, Docs & Steps)", en: "4. Criteria, Documents & Steps" })}
            </h3>

            {/* Eligibility Rows */}
            <RepeatableFieldList
              title={t({ hi: "पात्रता शर्तें (Eligibility Criteria)", en: "Eligibility Criteria" })}
              items={eligibilityRows}
              onChange={setEligibilityRows}
              placeholderHi="उदा. महिला की उम्र 18 से 79 वर्ष के बीच हो"
              placeholderEn="e.g. Woman aged between 18 and 79"
            />

            {/* Document Rows */}
            <RepeatableFieldList
              title={t({ hi: "आवश्यक दस्तावेज़ (Required Documents)", en: "Required Documents" })}
              items={documentRows}
              onChange={setDocumentRows}
              placeholderHi="उदा. समग्र आईडी, आधार कार्ड, बीपीएल कार्ड"
              placeholderEn="e.g. Samagra ID, Aadhaar Card, BPL Card"
            />

            {/* Step Rows */}
            <RepeatableFieldList
              title={t({ hi: "आवेदन के चरण (Application Steps)", en: "Application Steps" })}
              items={stepRows}
              onChange={setStepRows}
              placeholderHi="उदा. ग्राम पंचायत या समग्र पोर्टल पर ऑनलाइन आवेदन करें"
              placeholderEn="e.g. Apply online on Samagra portal or Gram Panchayat"
            />

            {/* Eligibility Rules JSON */}
            <label className="flex flex-col gap-1 font-medium">
              <span className="flex items-center justify-between text-xs">
                <span>{t({ hi: "पात्रता नियम JSON (रूल इंजन के लिए)", en: "Eligibility Rules JSON (for matching engine)" })}</span>
                <span className="text-muted-foreground font-normal">minAge, maxAge, widowed, bpl, shgMember, pregnant, firstChild...</span>
              </span>
              <textarea
                rows={3}
                spellCheck={false}
                value={rulesJson}
                onChange={(e) => setRulesJson(e.target.value)}
                className="font-mono text-xs rounded-xl border bg-card p-3"
              />
            </label>
          </div>

          {/* 5. Official Source & AI Summary */}
          <div className="space-y-4">
            <h3 className="font-semibold text-primary border-b pb-1 text-sm uppercase tracking-wider">
              {t({ hi: "5. आधिकारिक स्रोत व AI सारांश (Source & AI Workflow)", en: "5. Official Source & AI Summary" })}
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <label className="flex flex-col gap-1 font-medium">
                {t({ hi: "आधिकारिक स्रोत लिंक (Official Source URL)", en: "Official Source URL" })}
                <input
                  type="url"
                  placeholder="https://..."
                  value={sourceUrl}
                  onChange={(e) => setSourceUrl(e.target.value)}
                  className="h-10 rounded-xl border bg-card px-3"
                />
              </label>

              <label className="flex flex-col gap-1 font-medium">
                {t({ hi: "अंतिम सत्यापन दिनांक (Last Verified Date)", en: "Last Verified Date" })}
                <input
                  type="date"
                  value={lastCheckedAt}
                  onChange={(e) => setLastCheckedAt(e.target.value)}
                  className="h-10 rounded-xl border bg-card px-3"
                />
              </label>
            </div>

            <label className="flex flex-col gap-1 font-medium">
              <span className="flex items-center justify-between">
                <span>{t({ hi: "आधिकारिक नोटिस का पाठ (Official Notice Text)", en: "Official Scheme Notice Text" })}</span>
                <span className="text-xs text-muted-foreground font-normal">
                  {t({ hi: "AI केवल इसी पाठ से तथ्य निकालता है", en: "AI drafts exclusively from this source text" })}
                </span>
              </span>
              <textarea
                rows={4}
                value={officialNoticeText}
                onChange={(e) => setOfficialNoticeText(e.target.value)}
                placeholder="शासकीय आदेश या अधिसूचना का पाठ यहाँ पेस्ट करें…"
                className="rounded-xl border bg-card p-3 text-xs"
              />
            </label>

            {/* AI Summary Action Box */}
            {isEditing && (
              <div className="rounded-xl border bg-muted/40 p-4 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Sparkles className="size-4 text-primary" />
                    <span className="font-semibold text-sm">{t({ hi: "AI हिंदी सारांश कार्यप्रवाह", en: "Gemini AI Hindi Summary Workflow" })}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => void handleDraftAiSummary()}
                    disabled={generatingAi || !officialNoticeText.trim()}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-secondary text-secondary-foreground text-xs font-semibold hover:opacity-90 disabled:opacity-50"
                  >
                    <Sparkles className={`size-3.5 ${generatingAi ? "animate-spin" : ""}`} />
                    <span>{generatingAi ? t({ hi: "तैयार हो रहा है…", en: "Drafting…" }) : t({ hi: "नया AI ड्राफ्ट बनाएं", en: "Generate Draft" })}</span>
                  </button>
                </div>

                {aiDraft && (
                  <div className="rounded-lg bg-card p-3 border space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] uppercase font-bold text-muted-foreground tracking-wider">
                        {aiApproved ? t({ hi: "✓ स्वीकृत सारांश (Approved)", en: "✓ Approved Summary" }) : t({ hi: "⚠️ AI ड्राफ्ट (समीक्षा व स्वीकृति आवश्यक)", en: "⚠️ AI Draft (Approval Required)" })}
                      </span>
                    </div>
                    <p className="text-xs leading-relaxed text-foreground whitespace-pre-wrap">{aiDraft}</p>
                    {!aiApproved && (
                      <div className="flex items-center gap-2 pt-2 border-t">
                        <button
                          type="button"
                          onClick={() => void handleApproveAiSummary()}
                          disabled={busy}
                          className="inline-flex items-center gap-1 px-3 py-1 rounded-md bg-leaf-soft text-leaf text-xs font-semibold hover:opacity-90"
                        >
                          <Check className="size-3.5" />
                          <span>{t({ hi: "स्वीकृत करें व विवरण में सेट करें", en: "Approve Summary" })}</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => void handleDismissAiSummary()}
                          disabled={busy}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md border text-xs text-muted-foreground hover:bg-muted"
                        >
                          <X className="size-3.5" />
                          <span>{t({ hi: "ड्राफ्ट अस्वीकार करें", en: "Dismiss" })}</span>
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Modal Footer Actions */}
        <div className="p-4 md:p-5 border-t bg-card/60 flex flex-wrap items-center justify-between gap-3 shrink-0">
          <button type="button" onClick={onClose} disabled={busy} className="btn-big !min-h-10 border bg-card">
            {t({ hi: "रद्द करें", en: "Cancel" })}
          </button>

          <div className="flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              onClick={() => void handleSubmit(false)}
              disabled={busy}
              className="btn-big !min-h-10 border bg-card font-medium disabled:opacity-50"
            >
              <Save className="size-4" />
              <span>{t({ hi: "ड्राफ्ट के रूप में सहेजें", en: "Save as Draft" })}</span>
            </button>

            <button
              type="button"
              onClick={() => void handleSubmit(true)}
              disabled={busy}
              className="btn-big !min-h-10 bg-primary text-primary-foreground font-semibold disabled:opacity-50 shadow-sm"
            >
              <Eye className="size-4" />
              <span>{t({ hi: "सहेजें और प्रकाशित करें", en: "Save & Publish" })}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// Helper component for repeatable rows (eligibility, documents, steps)
function RepeatableFieldList({
  title,
  items,
  onChange,
  placeholderHi,
  placeholderEn,
}: {
  title: string;
  items: Array<{ hi: string; en: string }>;
  onChange: (items: Array<{ hi: string; en: string }>) => void;
  placeholderHi: string;
  placeholderEn: string;
}) {
  const { t } = useLang();

  const addRow = () => onChange([...items, { hi: "", en: "" }]);
  const removeRow = (index: number) => {
    if (items.length <= 1) {
      onChange([{ hi: "", en: "" }]);
    } else {
      onChange(items.filter((_, i) => i !== index));
    }
  };
  const updateRow = (index: number, key: "hi" | "en", val: string) => {
    const copy = [...items];
    copy[index] = { ...copy[index]!, [key]: val };
    onChange(copy);
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="font-semibold text-xs text-muted-foreground uppercase">{title}</span>
        <button
          type="button"
          onClick={addRow}
          className="inline-flex items-center gap-1 text-xs text-primary font-semibold hover:underline"
        >
          <Plus className="size-3" />
          <span>{t({ hi: "+ पंक्ति जोड़ें", en: "+ Add Row" })}</span>
        </button>
      </div>

      <div className="space-y-2">
        {items.map((row, idx) => (
          <div key={idx} className="flex gap-2 items-center">
            <input
              type="text"
              placeholder={placeholderHi}
              value={row.hi}
              onChange={(e) => updateRow(idx, "hi", e.target.value)}
              className="h-9 flex-1 rounded-xl border bg-card px-3 text-xs"
            />
            <input
              type="text"
              placeholder={placeholderEn}
              value={row.en}
              onChange={(e) => updateRow(idx, "en", e.target.value)}
              className="h-9 flex-1 rounded-xl border bg-card px-3 text-xs"
            />
            <button
              type="button"
              onClick={() => removeRow(idx)}
              className="p-1.5 text-muted-foreground hover:text-destructive rounded-lg hover:bg-muted"
            >
              <Trash2 className="size-3.5" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

// -------------------------------------------------------------
// OVERVIEW SECTION COMPONENT (CHECKPOINT 1)
// -------------------------------------------------------------

function OverviewSection({
  overview,
  loading,
  error,
  onRetry,
  onNavigate,
}: {
  overview: AdminOverviewData | null;
  loading: boolean;
  error: string | null;
  onRetry: () => void;
  onNavigate: (navId: string) => void;
}) {
  const { t } = useLang();

  if (loading && !overview) {
    return (
      <div className="card-soft p-12 text-center">
        <div className="inline-block size-8 animate-spin rounded-full border-3 border-primary border-t-transparent" />
        <p className="mt-3 text-sm text-muted-foreground">{t({ hi: "डेटाबेस से आँकड़े संकलित किए जा रहे हैं…", en: "Aggregating live data from PostgreSQL…" })}</p>
      </div>
    );
  }

  if (error && !overview) {
    return (
      <div role="alert" className="card-soft p-6 border-destructive/20 bg-destructive/5 text-destructive">
        <div className="flex items-center gap-3">
          <AlertCircle className="size-6 shrink-0" />
          <div className="flex-1">
            <h3 className="font-semibold">{t({ hi: "डैशबोर्ड आँकड़े लोड करने में विफल", en: "Failed to load dashboard metrics" })}</h3>
            <p className="text-sm mt-1">{error}</p>
          </div>
          <button onClick={onRetry} className="btn-big bg-destructive text-destructive-foreground">
            {t({ hi: "पुनः प्रयास करें", en: "Retry" })}
          </button>
        </div>
      </div>
    );
  }

  if (!overview) return null;

  const { stats, recentDonations, campaignCollections, monthlyTrends } = overview;
  const maxMonthlyAmount = Math.max(...monthlyTrends.map((m) => m.amount), 1000);

  return (
    <div className="space-y-6">
      {/* 4 Main Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Donations */}
        <div className="card-soft p-5 border-l-4 border-l-primary relative overflow-hidden">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-semibold uppercase tracking-wider">{t({ hi: "सफल दान संग्रह", en: "Total Collections" })}</span>
            <TrendingUp className="size-4 text-leaf" />
          </div>
          <p className="font-display text-3xl mt-2 text-foreground">{inr(stats.totalSuccessfulAmount)}</p>
          <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
            <span>{stats.successfulDonationsCount} {t({ hi: "सफल लेन-देन", en: "successful donations" })}</span>
            <span className="rounded-full bg-leaf-soft px-2 py-0.5 text-leaf font-medium">{t({ hi: "100% सत्यापित", en: "Verified" })}</span>
          </div>
        </div>

        {/* Unique Donors */}
        <div className="card-soft p-5 border-l-4 border-l-turmeric relative overflow-hidden">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-semibold uppercase tracking-wider">{t({ hi: "अद्वितीय दानदाता", en: "Unique Donors" })}</span>
            <Users className="size-4 text-turmeric" />
          </div>
          <p className="font-display text-3xl mt-2 text-foreground">{stats.uniqueDonorsCount}</p>
          <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
            <span>{t({ hi: "सत्यापित ईमेल आईडी", en: "Unique donor emails" })}</span>
            <button onClick={() => onNavigate("donors")} className="hover:underline text-primary font-semibold">
              {t({ hi: "रिकॉर्ड देखें →", en: "View donors →" })}
            </button>
          </div>
        </div>

        {/* Active Campaigns */}
        <div className="card-soft p-5 border-l-4 border-l-leaf relative overflow-hidden">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-semibold uppercase tracking-wider">{t({ hi: "सक्रिय सहायता अभियान", en: "Active Campaigns" })}</span>
            <HeartHandshake className="size-4 text-leaf" />
          </div>
          <p className="font-display text-3xl mt-2 text-foreground">
            {stats.activeCampaignsCount} <span className="text-sm font-sans font-normal text-muted-foreground">/ {stats.totalCampaignsCount} कुल</span>
          </p>
          <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
            <span>{t({ hi: "ज़िलों में फील्ड कार्य", en: "District operations" })}</span>
            <button onClick={() => onNavigate("campaigns")} className="hover:underline text-primary font-semibold">
              {t({ hi: "अभियान देखें →", en: "Manage →" })}
            </button>
          </div>
        </div>

        {/* Published Schemes */}
        <div className="card-soft p-5 border-l-4 border-l-accent relative overflow-hidden">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-semibold uppercase tracking-wider">{t({ hi: "प्रकाशित योजनाएँ", en: "Published Schemes" })}</span>
            <BookOpen className="size-4 text-accent" />
          </div>
          <p className="font-display text-3xl mt-2 text-foreground">
            {stats.publishedSchemesCount} <span className="text-sm font-sans font-normal text-muted-foreground">/ {stats.totalSchemesCount} कुल</span>
          </p>
          <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
            <span>{t({ hi: "पोर्टल पर लाइव उपलब्ध", en: "Live on portal" })}</span>
            <button onClick={() => onNavigate("schemes")} className="hover:underline text-primary font-semibold">
              {t({ hi: "योजना सूची →", en: "Manage →" })}
            </button>
          </div>
        </div>
      </div>

      {/* Transaction Health Status Bar */}
      <div className="card-soft px-4 py-3 bg-card/60 flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2">
          <Clock className="size-4 text-turmeric" />
          <span>
            <strong>{stats.pendingDonationsCount}</strong> {t({ hi: "लंबित लेन-देन (Pending Transactions)", en: "pending transactions awaiting confirmation" })}
          </span>
        </div>
        <div className="flex items-center gap-4 text-muted-foreground">
          <span>{stats.failedDonationsCount} {t({ hi: "विफल प्रयास (कुल राशि से बाहर)", en: "failed attempts excluded from funds" })}</span>
          <button onClick={() => onNavigate("donations")} className="text-primary font-semibold hover:underline">
            {t({ hi: "लेन-देन तालिका देखें →", en: "View transaction log →" })}
          </button>
        </div>
      </div>

      {/* Two Column Section: Monthly Trends Chart + Campaign Collection */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Monthly Donation Trends Chart */}
        <div className="card-soft p-5 md:p-6 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <h2 className="font-display text-xl">{t({ hi: "मासिक दान संग्रह (विगत 6 माह)", en: "Monthly Donations (Past 6 Months)" })}</h2>
              <span className="text-xs text-muted-foreground">{t({ hi: "सफल दान केवल", en: "Succeeded only" })}</span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {t({ hi: "प्रत्येक माह में प्राप्त सफल दान राशि का प्रत्यक्ष विश्लेषण।", en: "Breakdown of donations collected across calendar months." })}
            </p>
          </div>

          <div className="mt-6 pt-4 border-t space-y-3">
            {monthlyTrends.map((trend) => {
              const fillPct = Math.max(4, Math.round((trend.amount / maxMonthlyAmount) * 100));
              return (
                <div key={trend.monthKey} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-foreground">{trend.monthLabel}</span>
                    <span className="font-mono font-medium text-foreground">
                      {inr(trend.amount)} <span className="text-muted-foreground">({trend.count})</span>
                    </span>
                  </div>
                  <div className="h-3 w-full bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full bg-primary rounded-full transition-all duration-500"
                      style={{ width: `${fillPct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>

          <div className="mt-4 pt-3 border-t flex items-center justify-between text-xs text-muted-foreground">
            <span>{t({ hi: "डेटा स्रोत: PostgreSQL लाइव टेबल", en: "Source: PostgreSQL live donation table" })}</span>
            <span className="font-medium text-leaf">✓ {t({ hi: "सत्यापित गणना", en: "Verified sync" })}</span>
          </div>
        </div>

        {/* Campaign-wise Live Collection */}
        <div className="card-soft p-5 md:p-6 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <h2 className="font-display text-xl">{t({ hi: "अभियान-वार संग्रह स्थिति", en: "Campaign-wise Collection" })}</h2>
              <button onClick={() => onNavigate("campaigns")} className="text-xs text-primary font-semibold hover:underline">
                {t({ hi: "प्रबंधन करें →", en: "Manage →" })}
              </button>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {t({ hi: "प्रत्येक अभियान का लक्ष्य, वास्तविक संग्रह और प्रगति।", en: "Target goals and actual funds linked to active campaigns." })}
            </p>
          </div>

          <div className="mt-4 divide-y">
            {campaignCollections.map((campaign) => (
              <div key={campaign.id} className="py-3 first:pt-0 last:pb-0 space-y-1.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 truncate">
                    <span className="text-xl" aria-hidden>{campaign.emoji}</span>
                    <span className="font-semibold text-sm truncate">{t(campaign.title)}</span>
                    <span className="rounded-md bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground uppercase">
                      {campaign.district}
                    </span>
                  </div>
                  <span className="text-xs font-semibold">{campaign.progressPercent}%</span>
                </div>

                <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full bg-leaf rounded-full transition-all duration-500"
                    style={{ width: `${Math.max(campaign.progressPercent, 2)}%` }}
                  />
                </div>

                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>
                    <strong>{inr(campaign.collectedAmount)}</strong> {t({ hi: "एकत्रित", en: "raised" })} ({campaign.donationCount} {t({ hi: "दान", en: "donations" })})
                  </span>
                  <span>{t({ hi: "लक्ष्य:", en: "Goal:" })} {inr(campaign.goalAmount)}</span>
                </div>
              </div>
            ))}

            {campaignCollections.length === 0 && (
              <p className="py-6 text-center text-sm text-muted-foreground">
                {t({ hi: "कोई अभियान दर्ज नहीं है।", en: "No campaigns found." })}
              </p>
            )}
          </div>

          <div className="mt-4 pt-3 border-t text-xs text-muted-foreground flex items-center justify-between">
            <span>{t({ hi: "केवल सफल लेन-देन प्रगति में गिने जाते हैं।", en: "Only succeeded payments count towards progress." })}</span>
          </div>
        </div>
      </div>

      {/* Recent Five Donations Table */}
      <div className="card-soft p-5 md:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div>
            <h2 className="font-display text-xl">{t({ hi: "हाल ही के पाँच दान लेन-देन", en: "Recent Five Donations" })}</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              {t({ hi: "नवीनतम दर्ज दान रिकॉर्ड्स (लाइव डेटाबेस से)", en: "Latest donation records straight from the database" })}
            </p>
          </div>
          <button
            onClick={() => onNavigate("donations")}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary hover:underline"
          >
            <span>{t({ hi: "सभी लेन-देन देखें", en: "View all transactions" })}</span>
            <ChevronRight className="size-3.5" />
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-muted/70 text-xs text-muted-foreground uppercase font-semibold">
              <tr>
                <th className="p-3 rounded-l-lg">{t({ hi: "दानदाता", en: "Donor" })}</th>
                <th className="p-3">{t({ hi: "अभियान", en: "Campaign" })}</th>
                <th className="p-3">{t({ hi: "राशि", en: "Amount" })}</th>
                <th className="p-3">{t({ hi: "प्रकार", en: "Type" })}</th>
                <th className="p-3">{t({ hi: "स्थिति", en: "Status" })}</th>
                <th className="p-3">{t({ hi: "दिनांक", en: "Date" })}</th>
                <th className="p-3 rounded-r-lg">{t({ hi: "रसीद #", en: "Receipt #" })}</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {recentDonations.map((donation) => {
                const isSuccess = donation.status === "SUCCEEDED";
                const isPending = donation.status === "PENDING";
                return (
                  <tr key={donation.id} className="hover:bg-muted/30">
                    <td className="p-3 font-medium">
                      <p className="text-foreground">{donation.donorName}</p>
                      <p className="text-xs text-muted-foreground">{donation.donorEmail}</p>
                    </td>
                    <td className="p-3 text-xs text-muted-foreground">
                      {t(donation.campaignTitle)}
                    </td>
                    <td className="p-3 font-semibold text-foreground">
                      {inr(donation.amount)}
                    </td>
                    <td className="p-3 text-xs">
                      {donation.frequency === "MONTHLY" ? (
                        <span className="rounded-md bg-secondary/40 px-2 py-0.5 font-medium text-secondary-foreground">
                          {t({ hi: "मासिक", en: "Monthly" })}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">{t({ hi: "एकमुश्त", en: "One-time" })}</span>
                      )}
                    </td>
                    <td className="p-3">
                      <span
                        className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${
                          isSuccess
                            ? "bg-leaf-soft text-leaf"
                            : isPending
                            ? "bg-secondary text-secondary-foreground"
                            : "bg-destructive/10 text-destructive"
                        }`}
                      >
                        {isSuccess ? `✓ TEST` : donation.status}
                      </span>
                    </td>
                    <td className="p-3 text-xs text-muted-foreground">
                      {new Date(donation.createdAt).toLocaleDateString("en-IN", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })}
                    </td>
                    <td className="p-3 font-mono text-xs">
                      {donation.receiptNumber ? (
                        <span className="rounded bg-muted px-1.5 py-0.5">{donation.receiptNumber}</span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                  </tr>
                );
              })}

              {recentDonations.length === 0 && (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-muted-foreground">
                    <p className="font-medium">{t({ hi: "अभी कोई दान दर्ज नहीं हुआ है।", en: "No donations recorded yet." })}</p>
                    <p className="text-xs mt-1">
                      {t({
                        hi: "वेबसाइट के 'दान करें' पृष्ठ से परीक्षण भुगतान करके देखें।",
                        en: "Try submitting a test donation from the public Donate page.",
                      })}
                    </p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// -------------------------------------------------------------
// CHECKPOINT PLACEHOLDER / ROADMAP COMPONENT (FOR SECTIONS 3-8)
// -------------------------------------------------------------

function CheckpointRoadmapSection({
  navItem,
  onBackToOverview,
}: {
  navItem: NavItem;
  onBackToOverview: () => void;
}) {
  const { t } = useLang();
  const Icon = navItem.icon;

  return (
    <div className="card-soft p-8 md:p-12 text-center max-w-2xl mx-auto my-6">
      <div className="size-16 rounded-2xl bg-clay-soft text-primary mx-auto grid place-items-center mb-4">
        <Icon className="size-8" />
      </div>

      <span className="inline-block rounded-full bg-primary/10 text-primary px-3 py-1 text-xs font-semibold uppercase tracking-wider mb-2">
        {navItem.checkpoint ?? "Planned Checkpoint"}
      </span>

      <h2 className="font-display text-2xl md:text-3xl text-foreground">{t(navItem.label)}</h2>
      <p className="mt-2 text-sm text-muted-foreground leading-relaxed max-w-lg mx-auto">
        {t(navItem.description)}
      </p>

      <div className="mt-6 p-4 rounded-xl bg-muted/60 text-left text-xs text-muted-foreground space-y-2 border">
        <p className="font-semibold text-foreground flex items-center gap-1.5">
          <Sparkles className="size-3.5 text-primary" />
          {t({ hi: "अगले चेकपॉइंट में शामिल सुविधाएँ:", en: "Features scheduled for this checkpoint:" })}
        </p>
        <p>• {t({ hi: "पूर्ण डेटाबेस एकीकरण एवं सुरक्षित बैकएंड प्रमाणीकरण", en: "Full database integration and authenticated APIs" })}</p>
        <p>• {t({ hi: "खोज, फ़िल्टर, संपादन और विस्तृत रिकॉर्ड दृश्य", en: "Search, filters, editing, and comprehensive record drawer" })}</p>
        <p>• {t({ hi: "सखीसेतु की मौजूदा डिज़ाइन प्रणाली के अनुरूप इंटरफ़ेस", en: "Complete responsive UI adhering to SakhiSetu design system" })}</p>
      </div>

      <div className="mt-8 flex justify-center">
        <button onClick={onBackToOverview} className="btn-big bg-primary text-primary-foreground">
          {t({ hi: "← सिंहावलोकन डैशबोर्ड पर लौटें", en: "← Return to Overview" })}
        </button>
      </div>
    </div>
  );
}
