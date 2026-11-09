import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { LangProvider, useLang } from "@/lib/i18n";
import * as api from "@/lib/api";
import { Route } from "@/routes/finder";

vi.mock("@tanstack/react-router", () => ({
  createFileRoute: () => (config: unknown) => ({ options: config }),
  Link: ({ children, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement>) => (
    <a {...props}>{children}</a>
  ),
}));

function LanguageSwitcher() {
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

function Harness({ children }: { children: React.ReactNode }) {
  return (
    <LangProvider>
      <LanguageSwitcher />
      {children}
    </LangProvider>
  );
}

describe("Finder error handling and retry flow", () => {
  beforeEach(() => {
    localStorage.removeItem("sakhi-lang");
    vi.restoreAllMocks();
  });

  it("handles 502/API error with correct Hindi/English headings, hides celebratory text, and retries successfully", async () => {
    // Step 1: Mock checkEligibility to fail first with 502 error
    let callCount = 0;
    const checkMock = vi.spyOn(api, "checkEligibility").mockImplementation(async (profile) => {
      callCount++;
      if (callCount === 1) {
        throw new Error("Request failed (502)");
      }
      return {
        results: [],
        count: 0,
        basis: "all_published",
      };
    });

    const FinderComponent = (Route as unknown as { options: { component: React.ComponentType } })
      .options.component;

    render(
      <Harness>
        <FinderComponent />
      </Harness>,
    );

    // Answer the 6 questions + 1 need + 1 district question
    // Q1: Age
    fireEvent.click(screen.getByText("21–60 वर्ष"));
    // Q2: Widowed
    fireEvent.click(screen.getByText("नहीं"));
    // Q3: BPL
    fireEvent.click(screen.getByText("हाँ"));
    // Q4: SHG member
    fireEvent.click(screen.getByText("हाँ"));
    // Q5: Pregnant
    fireEvent.click(screen.getByText("नहीं"));
    // Q6: First child
    fireEvent.click(screen.getByText("नहीं"));
    // Q7: Need preference (pick first: "पैसों की मदद")
    fireEvent.click(screen.getByText("पैसों की मदद"));
    // Q8: District (pick first: Bhopal / भोपाल)
    fireEvent.click(screen.getByText("भोपाल"));

    // Wait for the API error to appear
    await waitFor(() => {
      expect(screen.getByRole("alert")).toBeInTheDocument();
    });

    expect(checkMock).toHaveBeenCalledTimes(1);

    // 1. In Hindi: verify error heading
    expect(screen.getByText("योजनाओं की जाँच नहीं हो सकी")).toBeInTheDocument();

    // 2. Verify error message is displayed
    expect(screen.getByText("Request failed (502)")).toBeInTheDocument();

    // 3. Verify celebratory "बहुत बढ़िया!" and disclaimer are hidden during error
    expect(screen.queryByText("बहुत बढ़िया! 🎉")).not.toBeInTheDocument();
    expect(
      screen.queryByText("यह संभावित मिलान है — अंतिम पात्रता सरकारी विभाग तय करता है।"),
    ).not.toBeInTheDocument();

    // 4. Verify "No matching schemes found" is NOT displayed during error
    expect(screen.queryByText("कोई संभावित योजना नहीं मिली")).not.toBeInTheDocument();
    expect(
      screen.queryByText("दिए गए जवाबों से कोई संभावित योजना नहीं मिली।"),
    ).not.toBeInTheDocument();

    // 5. Verify retry button is present with Hindi text
    const retryBtn = screen.getByText("पुनः प्रयास करें");
    expect(retryBtn).toBeInTheDocument();

    // 6. Switch to English: verify English heading and Retry button
    fireEvent.click(screen.getByTestId("set-en"));
    expect(screen.getByText("Could not check schemes")).toBeInTheDocument();
    expect(screen.getByText("Retry")).toBeInTheDocument();
    expect(screen.queryByText("Well done! 🎉")).not.toBeInTheDocument();
    expect(screen.queryByText("No possible matches found")).not.toBeInTheDocument();

    // Switch back to Hindi
    fireEvent.click(screen.getByTestId("set-hi"));
    expect(screen.getByText("योजनाओं की जाँच नहीं हो सकी")).toBeInTheDocument();

    // 7. Click Retry: verify it repeats the eligibility request with the profile
    const retryBtnAfterSwitch = screen.getByText("पुनः प्रयास करें");
    fireEvent.click(retryBtnAfterSwitch);

    // Wait for the successful retry response (callCount === 2)
    await waitFor(() => {
      expect(checkMock).toHaveBeenCalledTimes(2);
    });

    // Profile passed to call 2 should match the profile from call 1
    const firstCallArg = checkMock.mock.calls[0]![0];
    const secondCallArg = checkMock.mock.calls[1]![0];
    expect(secondCallArg).toEqual(firstCallArg);
    expect(secondCallArg.district).toBe("bhopal");
    expect(secondCallArg.bpl).toBe(true);

    // Now after successful response with 0 matches:
    // Celebratory text and zero matches text SHOULD appear
    await waitFor(() => {
      expect(screen.getByText("बहुत बढ़िया! 🎉")).toBeInTheDocument();
    });
    expect(screen.getByText("कोई संभावित योजना नहीं मिली")).toBeInTheDocument();
    expect(screen.getByText("दिए गए जवाबों से कोई संभावित योजना नहीं मिली।")).toBeInTheDocument();
    expect(screen.queryByText("योजनाओं की जाँच नहीं हो सकी")).not.toBeInTheDocument();
  });
});
