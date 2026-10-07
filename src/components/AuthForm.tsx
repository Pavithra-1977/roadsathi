"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { LanguageSelect, useT } from "@/lib/i18n";

export const SESSION_KEY = "rs:session";

export type Role = "customer" | "mechanic";

// Demo only: fixed accounts checked in the browser. Not real authentication.
const DEMO_ACCOUNTS: { email: string; password: string; role: Role; name: string; home: string }[] = [
  { email: "customer@roadsathi.demo", password: "customer123", role: "customer", name: "Customer (demo)", home: "/sos" },
  { email: "mechanic@roadsathi.demo", password: "mechanic123", role: "mechanic", name: "Mechanic (demo)", home: "/mechanic" },
];

type Mode = "sign-in" | "sign-up";

const FIELDS: Record<Mode, { name: string; label: string; type: string; placeholder: string }[]> = {
  "sign-in": [
    { name: "id", label: "Email or phone", type: "text", placeholder: "you@example.com or +91 …" },
    { name: "password", label: "Password", type: "password", placeholder: "••••••" },
  ],
  "sign-up": [
    { name: "name", label: "Full name", type: "text", placeholder: "Your name" },
    { name: "phone", label: "Phone", type: "tel", placeholder: "+91 …" },
    { name: "email", label: "Email", type: "email", placeholder: "you@example.com" },
    { name: "password", label: "Password", type: "password", placeholder: "At least 6 characters" },
  ],
};

/**
 * Demo-only auth: no backend. The two DEMO_ACCOUNTS sign in with their role; any other
 * non-empty details (and every sign-up) create a customer session. Stored in localStorage.
 */
export default function AuthForm({ mode }: { mode: Mode }) {
  const router = useRouter();
  const [values, setValues] = useState<Record<string, string>>({});
  const [error, setError] = useState<{ text: string; vars?: Record<string, string> } | null>(null);
  const signUp = mode === "sign-up";
  const t = useT();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    signIn(values);
  }

  function signIn(values: Record<string, string>) {
    setError(null);
    const missing = FIELDS[mode].find((f) => !values[f.name]?.trim());
    if (missing) return setError({ text: "Please fill in: {field}", vars: { field: missing.label } });
    if (signUp && values.password.length < 6) return setError({ text: "Password must be at least 6 characters." });
    const demo = signUp ? undefined : DEMO_ACCOUNTS.find((a) => a.email === values.id.trim().toLowerCase());
    if (demo && demo.password !== values.password) return setError({ text: "Wrong password for this demo account." });
    const session = {
      role: demo?.role ?? ("customer" as Role),
      name: demo?.name ?? (values.name?.trim() || values.id.trim()),
      contact: values.email?.trim() || values.id?.trim(),
      phone: values.phone?.trim() ?? null,
      at: new Date().toISOString(),
    };
    try { localStorage.setItem(SESSION_KEY, JSON.stringify(session)); } catch { /* storage blocked: still let them in */ }
    router.push(demo?.home ?? "/sos");
  }

  return (
    <main className="relative grid min-h-screen place-items-center overflow-hidden px-4 py-10">
      <video
        className="absolute inset-0 h-full w-full object-cover"
        src={signUp ? "/media/sign-up.mp4" : "/media/sign-in.mp4"}
        autoPlay muted loop playsInline aria-hidden
      />
      <div className="absolute inset-0 bg-ink/75" />

      <div className="card-pad relative w-full max-w-sm sm:p-7">
        <div className="mb-6 flex items-center justify-between gap-2">
          <Link href="/" className="flex items-center gap-2.5">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-amber text-lg text-ink">🛞</span>
            <span className="text-[15px] font-bold tracking-tight">RoadSathi</span>
          </Link>
          <LanguageSelect className="input !w-auto py-1.5 text-xs" />
        </div>

        <h1 className="text-2xl font-extrabold tracking-tight">{t(signUp ? "Create your account" : "Welcome back")}</h1>
        <p className="mt-1 text-sm text-muted">
          {t(signUp ? "Set up once, get help in seconds on the highway." : "Sign in to raise an SOS and track help.")}
        </p>

        <form onSubmit={submit} className="mt-6 space-y-4" noValidate>
          {FIELDS[mode].map((f) => (
            <div key={f.name}>
              <label htmlFor={f.name} className="label">{t(f.label)}</label>
              <input
                id={f.name} name={f.name} type={f.type} placeholder={t(f.placeholder)} className="input"
                autoComplete={f.name === "password" ? (signUp ? "new-password" : "current-password") : f.name}
                value={values[f.name] ?? ""}
                onChange={(e) => setValues((v) => ({ ...v, [f.name]: e.target.value }))}
              />
            </div>
          ))}

          {error && <p className="text-sm text-sos">{t(error.text, error.vars && { field: t(error.vars.field) })}</p>}

          <button type="submit" className="btn-primary w-full py-3">
            {t(signUp ? "Sign Up" : "Sign In")}
          </button>
        </form>

        {!signUp && (
          <div className="mt-6 border-t border-edge pt-5">
            <div className="label text-center">{t("Demo login")}</div>
            <div className="grid grid-cols-2 gap-2">
              {DEMO_ACCOUNTS.map((a) => (
                <button
                  key={a.role}
                  type="button"
                  className="btn-ghost"
                  onClick={() => {
                    const demoValues = { id: a.email, password: a.password };
                    setValues(demoValues);
                    signIn(demoValues);
                  }}
                >
                  {a.role === "customer" ? `🚗 ${t("Customer Demo")}` : `🔧 ${t("Mechanic Demo")}`}
                </button>
              ))}
            </div>
          </div>
        )}

        <p className="mt-5 text-center text-sm text-muted">
          {t(signUp ? "Already have an account?" : "Don't have an account?")}{" "}
          <Link href={signUp ? "/sign-in" : "/sign-up"} className="font-semibold text-amber hover:underline">
            {t(signUp ? "Sign In" : "Sign Up")}
          </Link>
        </p>
        <p className="mt-3 text-center text-[11px] text-muted">{t("Demo only: details stay in this browser.")}</p>
      </div>
    </main>
  );
}
