"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { TRANSLATIONS } from "./translations";

/**
 * Lightweight UI translation. English text is the key; TRANSLATIONS holds the Tamil, Telugu
 * and Hindi for each key. Missing keys fall back to English (and warn in development).
 * Only UI text is translated: API data, names and routes stay as they are.
 */

export type Lang = "en" | "ta" | "te" | "hi";

export const LANGS: { code: Lang; bcp: string; label: string; short: string }[] = [
  { code: "en", bcp: "en-IN", label: "English", short: "EN" },
  { code: "ta", bcp: "ta-IN", label: "தமிழ்", short: "த" },
  { code: "te", bcp: "te-IN", label: "తెలుగు", short: "తె" },
  { code: "hi", bcp: "hi-IN", label: "हिंदी", short: "हि" },
];

const KEY = "rs:lang";
const COLUMN: Record<Exclude<Lang, "en">, number> = { ta: 0, te: 1, hi: 2 };

const LangContext = createContext<{ lang: Lang; setLang: (l: Lang) => void }>({ lang: "en", setLang: () => {} });

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<Lang>("en");

  // Read after mount: the server always renders English, then the saved choice applies.
  useEffect(() => {
    try {
      const saved = localStorage.getItem(KEY) as Lang | null;
      if (saved && LANGS.some((l) => l.code === saved)) setLangState(saved);
    } catch { /* storage blocked: stay on English */ }
  }, []);

  useEffect(() => { document.documentElement.lang = lang; }, [lang]);

  const setLang = useCallback((l: Lang) => {
    setLangState(l);
    try { localStorage.setItem(KEY, l); } catch { /* storage blocked: choice lasts this page only */ }
  }, []);

  return <LangContext.Provider value={{ lang, setLang }}>{children}</LangContext.Provider>;
}

export function useLang() {
  return useContext(LangContext);
}

const warned = new Set<string>();

export function translate(lang: Lang, text: string, vars?: Record<string, string | number>) {
  let out = text;
  if (lang !== "en") {
    const row = TRANSLATIONS[text];
    if (row) out = row[COLUMN[lang]];
    else if (process.env.NODE_ENV !== "production" && !warned.has(text)) {
      warned.add(text);
      console.warn(`[i18n] missing translation: ${JSON.stringify(text)}`);
    }
  }
  if (vars) for (const [k, v] of Object.entries(vars)) out = out.split(`{${k}}`).join(String(v));
  return out;
}

/** t("Raise an SOS"), t("{n} min", { n: 7 }) */
export function useT() {
  const { lang } = useLang();
  return useCallback((text: string, vars?: Record<string, string | number>) => translate(lang, text, vars), [lang]);
}

/** <T>Raise an SOS</T>: translated text that also works inside server components. */
export function T({ children, vars }: { children: string; vars?: Record<string, string | number> }) {
  return <>{useT()(children, vars)}</>;
}

export function LanguageSelect({ className = "", short = false }: { className?: string; short?: boolean }) {
  const { lang, setLang } = useLang();
  return (
    <select
      value={lang}
      onChange={(e) => setLang(e.target.value as Lang)}
      aria-label="Language"
      className={className}
    >
      {LANGS.map((l) => <option key={l.code} value={l.code}>{short ? l.short : l.label}</option>)}
    </select>
  );
}
