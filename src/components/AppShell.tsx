"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { SESSION_KEY } from "@/components/AuthForm";
import { useEffect, useState } from "react";
import { LanguageSelect, useT } from "@/lib/i18n";

export const LAST_REQUEST_KEY = "rs:lastRequest";

/** Landing page keeps its original chrome; every other route gets the light app shell. */
export default function AppShell({ children }: { children: React.ReactNode }) {
  const path = usePathname() ?? "/";
  const router = useRouter();
  const t = useT();
  const [lastId, setLastId] = useState<string | null>(null);
  const [who, setWho] = useState<{ name: string; role?: string } | null>(null);

  useEffect(() => {
    try {
      setLastId(localStorage.getItem(LAST_REQUEST_KEY));
      setWho(JSON.parse(localStorage.getItem(SESSION_KEY) ?? "null"));
    } catch { /* storage blocked or bad JSON */ }
  }, [path]);

  if (path === "/") return <LandingChrome>{children}</LandingChrome>;
  if (path === "/sign-in" || path === "/sign-up") return <>{children}</>;

  // Guardian links are opened by family at home: light theme, no app navigation.
  if (path.startsWith("/guardian")) {
    return (
      <div className="app-light min-h-screen">
        <div className="flex justify-end px-4 pt-3">
          <LanguageSelect className="input !w-auto py-1.5 text-xs" />
        </div>
        {children}
      </div>
    );
  }

  const nav = [
    { href: "/sos", label: "Get Help", icon: "🚨" },
    ...(lastId ? [{ href: `/track/${lastId}`, label: "My Request", icon: "📍" }] : []),
    { href: "/mechanic", label: "Mechanic", icon: "🔧" },
    { href: "/how", label: "How it works", icon: "📘" },
    { href: "/evidence", label: "Evidence", icon: "📊" },
  ];
  const active = (href: string) =>
    href.startsWith("/track") ? path.startsWith("/track") : path === href;

  return (
    <div className="app-light min-h-screen">
      <aside className="fixed inset-y-0 left-0 z-[1000] hidden w-60 flex-col border-r border-edge bg-white px-4 py-6 md:flex">
        <Link href="/" className="mb-8 flex items-center gap-2.5 px-2">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-amber text-lg">🛞</span>
          <span className="text-[15px] font-bold tracking-tight">RoadSathi</span>
        </Link>
        <nav className="space-y-1">
          {nav.map((n) => (
            <Link
              key={n.href}
              href={n.href}
              className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition ${
                active(n.href) ? "bg-amber/10 text-amber" : "text-muted hover:bg-panel2 hover:text-white"
              }`}
            >
              <span>{n.icon}</span>
              {t(n.label)}
            </Link>
          ))}
        </nav>
        <LanguageSelect className="input mt-auto mb-3 py-2" />
        {who && (
          <div className="px-3 pb-1 text-xs text-muted">
            {t("Signed in as")} <span className="font-semibold text-white">{who.name}</span>
            {who.role && <span className="ml-1 rounded-full bg-amber/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-amber">{t(who.role === "mechanic" ? "Mechanic" : "Customer")}</span>}
          </div>
        )}
        <button
          onClick={() => {
            try { localStorage.removeItem(SESSION_KEY); } catch { /* storage blocked */ }
            router.push("/");
          }}
          className={`mb-3 flex items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-medium text-muted transition hover:bg-panel2 hover:text-white`}
        >
          <span>↩</span>{t("Sign out")}
        </button>
        <div className="rounded-xl border border-edge bg-panel2 p-3 text-xs text-muted">
          {t("Emergency")}: <span className="font-semibold text-white">112</span> · {t("Ambulance")}{" "}
          <span className="font-semibold text-white">108</span> · {t("Highway")}{" "}
          <span className="font-semibold text-white">1033</span>
        </div>
      </aside>

      <div className="pb-20 md:pb-0 md:pl-60">
        <div className="flex justify-end px-4 pt-3 md:hidden">
          <LanguageSelect className="input !w-auto py-1.5 text-xs" />
        </div>
        {children}
      </div>

      <nav className="fixed inset-x-0 bottom-0 z-[1000] flex border-t border-edge bg-white md:hidden">
        {nav.map((n) => (
          <Link
            key={n.href}
            href={n.href}
            className={`flex flex-1 flex-col items-center gap-0.5 py-2 text-[10px] font-medium ${
              active(n.href) ? "text-amber" : "text-muted"
            }`}
          >
            <span className="text-lg leading-none">{n.icon}</span>
            {t(n.label)}
          </Link>
        ))}
      </nav>
    </div>
  );
}

function LandingChrome({ children }: { children: React.ReactNode }) {
  const t = useT();
  const link = "hidden rounded-full px-3 py-1.5 text-muted transition hover:text-white xl:block";
  return (
    <div className="app-light min-h-screen">
      {/* Floating pill nav, as in the landing reference. */}
      <header className="fixed inset-x-0 top-3 z-[1000] flex justify-center px-3">
        <div className="flex w-full max-w-5xl items-center justify-between gap-2 rounded-full border border-edge bg-white/90 py-1.5 pl-2 pr-1.5 text-sm shadow-lg shadow-black/5 backdrop-blur">
          <Link href="/" className="flex shrink-0 items-center gap-2">
            <span className="grid h-8 w-8 place-items-center rounded-full bg-amber text-base">🛞</span>
            <span className="hidden text-[15px] font-bold tracking-tight min-[400px]:block">RoadSathi</span>
          </Link>
          <nav className="flex items-center gap-1 whitespace-nowrap">
            <Link href="/mechanic" className={link}>{t("Mechanic")}</Link>
            <Link href="/how" className={link}>{t("How it works")}</Link>
            <Link href="/evidence" className={link}>{t("Evidence")}</Link>
            <LanguageSelect short className="rounded-full border border-edge bg-white px-1.5 py-1.5 text-xs sm:hidden" />
            <LanguageSelect className="hidden rounded-full border border-edge bg-white px-2 py-1.5 text-sm sm:block" />
            <Link href="/sign-in" className="hidden rounded-full border border-edge px-2.5 py-1.5 text-xs font-medium min-[400px]:block sm:px-3.5 sm:text-sm">
              {t("Sign In")}
            </Link>
            <Link href="/sign-up" className="btn-primary rounded-full !px-2.5 !py-1.5 !text-xs sm:!px-3.5 sm:!text-sm">
              {t("Sign Up")}
            </Link>
            <Link href="/sos" className="btn-sos rounded-full !px-2.5 !py-1.5 !text-xs sm:!px-3.5 sm:!text-sm">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-white" />
              </span>
              SOS
            </Link>
          </nav>
        </div>
      </header>

      {children}

      <footer className="py-8 text-center text-xs text-muted">
        <nav className="mb-3 flex justify-center gap-4 text-sm">
          <Link href="/mechanic" className="hover:text-white">{t("Mechanic")}</Link>
          <Link href="/how" className="hover:text-white">{t("How it works")}</Link>
          <Link href="/evidence" className="hover:text-white">{t("Evidence")}</Link>
        </nav>
        🛞 RoadSathi &middot; {t("built for open innovation")} &middot; {t("emergency services in India")}:
        <span className="font-semibold text-white"> 112</span> ({t("all")}) &middot;
        <span className="font-semibold text-white"> 108</span> ({t("ambulance")}) &middot;
        <span className="font-semibold text-white"> 1033</span> ({t("highway helpline")})
      </footer>
    </div>
  );
}
