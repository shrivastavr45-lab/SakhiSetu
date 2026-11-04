import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

export type Lang = "hi" | "en";
export type L = { hi: string; en: string };

const Ctx = createContext<{ lang: Lang; setLang: (l: Lang) => void; t: (s: L) => string }>({
  lang: "hi",
  setLang: () => {},
  t: (s) => s.hi,
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
  return <Ctx.Provider value={{ lang, setLang, t: (s) => s[lang] }}>{children}</Ctx.Provider>;
}

export const useLang = () => useContext(Ctx);
