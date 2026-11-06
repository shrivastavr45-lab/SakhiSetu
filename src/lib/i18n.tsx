import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

export type Lang = "hi" | "en";
export type L = { hi: string; en: string };

/** Return the preferred-language string, falling back to the other language
 *  when the preferred one is absent or empty. This allows imported schemes
 *  that only have English text to display correctly in Hindi mode. */
function translate(s: L, lang: Lang): string {
  const primary = s[lang];
  if (primary) return primary;
  // Fall back to the other language rather than showing a blank string.
  return lang === "hi" ? s.en : s.hi;
}

const Ctx = createContext<{ lang: Lang; setLang: (l: Lang) => void; t: (s: L) => string }>({
  lang: "hi",
  setLang: () => {},
  t: (s) => translate(s, "hi"),
});

export function LangProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>("hi");
  useEffect(() => {
    const saved = localStorage.getItem("sakhi-lang");
    if (saved === "en" || saved === "hi") setLangState(saved);
  }, []);
  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);
  const setLang = (l: Lang) => {
    setLangState(l);
    localStorage.setItem("sakhi-lang", l);
  };
  return <Ctx.Provider value={{ lang, setLang, t: (s) => translate(s, lang) }}>{children}</Ctx.Provider>;
}

export const useLang = () => useContext(Ctx);
