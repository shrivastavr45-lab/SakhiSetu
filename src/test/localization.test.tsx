import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { LangProvider, useLang } from "@/lib/i18n";
import { SchemeCard } from "@/components/SchemeCard";
import type { Scheme } from "@/lib/data";
import { publishedSchemesLocalization } from "../../backend/prisma/published-schemes-data";

vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement>) => (
    <a {...props}>{children}</a>
  ),
}));

// Helper component that wraps children with LangProvider and adds language toggle buttons
function TestHarness({ children }: { children: React.ReactNode }) {
  return (
    <LangProvider>
      <LanguageControls />
      {children}
    </LangProvider>
  );
}

function LanguageControls() {
  const { lang, setLang } = useLang();
  return (
    <div>
      <span data-testid="current-lang">{lang}</span>
      <button onClick={() => setLang("hi")} data-testid="set-hi">
        हिंदी
      </button>
      <button onClick={() => setLang("en")} data-testid="set-en">
        English
      </button>
    </div>
  );
}

const mockScheme: Scheme = {
  id: "import-6c4e345f",
  need: "money",
  name: {
    hi: "मुख्यमंत्री लाड़ली बहना योजना",
    en: "Chief Minister Ladli Behna Yojana",
  },
  dept: {
    hi: "महिला एवं बाल विकास विभाग, मध्य प्रदेश शासन",
    en: "Madhya Pradesh",
  },
  short: {
    hi: "मध्य प्रदेश की पात्र बहनों के स्वास्थ्य, पोषण और आर्थिक स्वावलंबन को सुदृढ़ करने के उद्देश्य से शुरू की गई ऐतिहासिक वित्तीय सहायता योजना।",
    en: "An initiative for women's health and economic self-reliance in Madhya Pradesh.",
  },
  benefit: {
    hi: "प्रत्येक पात्र बहन के आधार-लिंक्ड डीबीटी बैंक खाते में प्रति माह ₹1,000 (वर्तमान में ₹1,250) की आर्थिक सहायता राशि का सीधा अंतरण।",
    en: "An amount of Rs.1000/- per month will be paid to each eligible woman.",
  },
  eligibility: [
    {
      hi: "मध्य प्रदेश की स्थानीय निवासी विवाहित महिलाएँ।",
      en: "Applicants must be local residents of Madhya Pradesh.",
    },
  ],
  documents: [
    {
      hi: "समग्र परिवार आईडी एवं सदस्य आईडी",
      en: "Samagra ID and Aadhaar Card",
    },
  ],
  steps: [
    {
      hi: "ग्राम पंचायत या वार्ड कार्यालय में फॉर्म भरें।",
      en: "Submit application form at camp site / Gram Panchayat.",
    },
  ],
  rules: { minAge: 21, maxAge: 60 },
  districts: "all",
  published: true,
};

describe("Scheme localization and language switching", () => {
  it("renders scheme card in Hindi by default", () => {
    localStorage.removeItem("sakhi-lang");
    render(
      <TestHarness>
        <SchemeCard s={mockScheme} />
      </TestHarness>,
    );

    // Hindi name and benefit should be rendered
    expect(screen.getByText("मुख्यमंत्री लाड़ली बहना योजना")).toBeInTheDocument();
    expect(
      screen.getByText(
        "प्रत्येक पात्र बहन के आधार-लिंक्ड डीबीटी बैंक खाते में प्रति माह ₹1,000 (वर्तमान में ₹1,250) की आर्थिक सहायता राशि का सीधा अंतरण।",
      ),
    ).toBeInTheDocument();
    expect(screen.getByText("पूरी जानकारी")).toBeInTheDocument();
  });

  it("updates scheme card to English when language is switched to English", () => {
    localStorage.removeItem("sakhi-lang");
    render(
      <TestHarness>
        <SchemeCard s={mockScheme} />
      </TestHarness>,
    );

    // Click English button
    fireEvent.click(screen.getByTestId("set-en"));

    // English name, benefit, and link text should now be rendered
    expect(screen.getByText("Chief Minister Ladli Behna Yojana")).toBeInTheDocument();
    expect(
      screen.getByText("An amount of Rs.1000/- per month will be paid to each eligible woman."),
    ).toBeInTheDocument();
    expect(screen.getByText("Full details")).toBeInTheDocument();

    // Switch back to Hindi
    fireEvent.click(screen.getByTestId("set-hi"));
    expect(screen.getByText("मुख्यमंत्री लाड़ली बहना योजना")).toBeInTheDocument();
    expect(screen.getByText("पूरी जानकारी")).toBeInTheDocument();
  });

  it("verifies all 22 published schemes in publishedSchemesLocalization have non-empty Hindi fields", () => {
    const keys = Object.keys(publishedSchemesLocalization);
    expect(keys.length).toBe(22);

    for (const [id, loc] of Object.entries(publishedSchemesLocalization)) {
      expect(loc.nameHi, `Scheme ${id} must have non-empty nameHi`).toBeTruthy();
      expect(loc.deptHi, `Scheme ${id} must have non-empty deptHi`).toBeTruthy();
      expect(loc.shortHi, `Scheme ${id} must have non-empty shortHi`).toBeTruthy();
      expect(loc.benefitHi, `Scheme ${id} must have non-empty benefitHi`).toBeTruthy();
      expect(loc.eligibilityHi.length, `Scheme ${id} must have eligibility items`).toBeGreaterThan(
        0,
      );
      expect(loc.documentsHi.length, `Scheme ${id} must have document items`).toBeGreaterThan(0);
      expect(loc.stepsHi.length, `Scheme ${id} must have step items`).toBeGreaterThan(0);

      // Verify no item is empty
      for (const e of loc.eligibilityHi) {
        expect(
          e.trim().length,
          `Scheme ${id} eligibility item should not be empty`,
        ).toBeGreaterThan(0);
      }
      for (const d of loc.documentsHi) {
        expect(d.trim().length, `Scheme ${id} document item should not be empty`).toBeGreaterThan(
          0,
        );
      }
      for (const s of loc.stepsHi) {
        expect(s.trim().length, `Scheme ${id} step item should not be empty`).toBeGreaterThan(0);
      }
    }
  });
});
