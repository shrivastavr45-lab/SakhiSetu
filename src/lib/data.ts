import type { L } from "./i18n";

export const DISTRICTS: { id: string; name: L }[] = [
  { id: "bhopal", name: { hi: "भोपाल", en: "Bhopal" } },
  { id: "sehore", name: { hi: "सीहोर", en: "Sehore" } },
  { id: "raisen", name: { hi: "रायसेन", en: "Raisen" } },
  { id: "vidisha", name: { hi: "विदिशा", en: "Vidisha" } },
  { id: "rajgarh", name: { hi: "राजगढ़", en: "Rajgarh" } },
  { id: "dewas", name: { hi: "देवास", en: "Dewas" } },
  { id: "shajapur", name: { hi: "शाजापुर", en: "Shajapur" } },
  { id: "narmadapuram", name: { hi: "नर्मदापुरम", en: "Narmadapuram" } },
  { id: "betul", name: { hi: "बैतूल", en: "Betul" } },
];

export type Need = "money" | "health" | "work" | "education" | "housing";

export const NEEDS: { id: Need; icon: string; name: L }[] = [
  { id: "money", icon: "💰", name: { hi: "पैसों की मदद", en: "Financial help" } },
  { id: "health", icon: "🩺", name: { hi: "स्वास्थ्य", en: "Health" } },
  { id: "work", icon: "🧵", name: { hi: "काम / रोज़गार", en: "Work & livelihood" } },
  { id: "education", icon: "📚", name: { hi: "बेटी की पढ़ाई", en: "Daughter's education" } },
  { id: "housing", icon: "🏠", name: { hi: "घर / गैस", en: "Home & gas" } },
];

export type Profile = {
  age?: number;
  ageMin?: number;
  ageMax?: number;
  married?: boolean;
  pregnant?: boolean;
  hasDaughter?: boolean;
  bpl?: boolean;
  rural?: boolean;
  widowed?: boolean;
  shgMember?: boolean;
  firstChild?: boolean;
  need?: Need;
  district?: string;
};

export type Scheme = {
  id: string;
  need: Need;
  name: L;
  dept: L;
  short: L;
  benefit: L;
  eligibility: L[];
  documents: L[];
  steps: L[];
  rules: { minAge?: number; maxAge?: number; married?: boolean; pregnant?: boolean; hasDaughter?: boolean; bpl?: boolean; rural?: boolean; widowed?: boolean; shgMember?: boolean; firstChild?: boolean };
  districts: string[] | "all";
  published: boolean;
  code?: string | null;
  sourceUrl?: string | null;
  lastCheckedAt?: string | null;
  match?: { rulesApplied: string[]; unansweredRules: string[] };
  aiSummaryDraftHi?: string | null;
  aiSummaryApproved?: boolean;
  officialNoticeText?: string | null;
  // Import-source metadata
  myschemeSlug?: string | null;
  level?: string | null;
  myschemeUrl?: string | null;
};

export type Campaign = {
  id: string;
  title: L;
  story: L;
  district: string;
  goal: number;
  raised: number;
  donors: number;
  impact: L; // per ₹ unit
  emoji: string;
  active: boolean;
};

export const CAMPAIGNS: Campaign[] = [
  {
    id: "silai-kendra",
    title: { hi: "100 दीदियों के लिए सिलाई केंद्र", en: "Tailoring centre for 100 women" },
    story: { hi: "राजगढ़ के 6 गाँवों में सिलाई मशीनें और 3 महीने का प्रशिक्षण — ताकि हर दीदी घर से कमा सके।", en: "Sewing machines and 3-month training across 6 villages of Rajgarh — so every woman can earn from home." },
    district: "rajgarh",
    goal: 800000,
    raised: 512400,
    donors: 318,
    impact: { hi: "₹8,000 = एक दीदी की मशीन और प्रशिक्षण", en: "₹8,000 = one woman's machine and training" },
    emoji: "🧵",
    active: true,
  },
  {
    id: "maa-poshan",
    title: { hi: "माँ पोषण किट", en: "Mother nutrition kits" },
    story: { hi: "बैतूल के आदिवासी गाँवों में गर्भवती महिलाओं को 6 महीने का पोषण आहार और जाँच।", en: "Six months of nutrition and check-ups for pregnant women in Betul's tribal villages." },
    district: "betul",
    goal: 500000,
    raised: 391000,
    donors: 542,
    impact: { hi: "₹1,500 = एक माँ का एक महीने का पोषण", en: "₹1,500 = one month of nutrition for a mother" },
    emoji: "🍲",
    active: true,
  },
  {
    id: "sakhi-mitra",
    title: { hi: "सखी मित्र — योजना सहायिका", en: "Sakhi Mitra — scheme helpers" },
    story: { hi: "गाँव की पढ़ी-लिखी युवतियों को प्रशिक्षित करना, जो दूसरी महिलाओं के फॉर्म भरने में मदद करें।", en: "Training educated young village women to help others fill scheme forms." },
    district: "vidisha",
    goal: 300000,
    raised: 96500,
    donors: 87,
    impact: { hi: "₹3,000 = एक सखी मित्र का प्रशिक्षण", en: "₹3,000 = training one Sakhi Mitra" },
    emoji: "🤝",
    active: true,
  },
];

export const STATS = [
  { value: "9", label: { hi: "ज़िले", en: "districts" } },
  { value: "220", label: { hi: "कर्मचारी", en: "staff members" } },
  { value: "1,400", label: { hi: "स्वयंसेवक", en: "volunteers" } },
  { value: "₹38–45 Cr", label: { hi: "वार्षिक बजट", en: "annual budget" } },
];

export const districtName = (id: string) => DISTRICTS.find((d) => d.id === id)?.name ?? { hi: id, en: id };
export const inr = (n: number) => "₹" + n.toLocaleString("en-IN");
