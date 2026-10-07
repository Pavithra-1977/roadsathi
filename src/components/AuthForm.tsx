"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

export const SESSION_KEY = "rs:session";

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

/** Demo-only auth: no backend. Any non-empty details create a localStorage session, then /sos. */
export default function AuthForm({ mode }: { mode: Mode }) {
  const router = useRouter();
  const [values, setValues] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const signUp = mode === "sign-up";

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const missing = FIELDS[mode].find((f) => !values[f.name]?.trim());
    if (missing) return setError(`Please enter your ${missing.label.toLowerCase()}.`);
    if (signUp && values.password.length < 6) return setError("Password must be at least 6 characters.");
    const session = {
      name: values.name?.trim() || values.id.trim(),
      contact: values.email?.trim() || values.id?.trim(),
      phone: values.phone?.trim() ?? null,
      at: new Date().toISOString(),
    };
    try { localStorage.setItem(SESSION_KEY, JSON.stringify(session)); } catch { /* storage blocked: still let them in */ }
    router.push("/sos");
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
        <Link href="/" className="mb-6 flex items-center gap-2.5">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-amber text-lg text-ink">🛞</span>
          <span className="text-[15px] font-bold tracking-tight">RoadSathi</span>
        </Link>

        <h1 className="text-2xl font-extrabold tracking-tight">{signUp ? "Create your account" : "Welcome back"}</h1>
        <p className="mt-1 text-sm text-muted">
          {signUp ? "Set up once, get help in seconds on the highway." : "Sign in to raise an SOS and track help."}
        </p>

        <form onSubmit={submit} className="mt-6 space-y-4" noValidate>
          {FIELDS[mode].map((f) => (
            <div key={f.name}>
              <label htmlFor={f.name} className="label">{f.label}</label>
              <input
                id={f.name} name={f.name} type={f.type} placeholder={f.placeholder} className="input"
                autoComplete={f.name === "password" ? (signUp ? "new-password" : "current-password") : f.name}
                value={values[f.name] ?? ""}
                onChange={(e) => setValues((v) => ({ ...v, [f.name]: e.target.value }))}
              />
            </div>
          ))}

          {error && <p className="text-sm text-sos">{error}</p>}

          <button type="submit" className="btn-primary w-full py-3">
            {signUp ? "Sign Up" : "Sign In"}
          </button>
        </form>

        <p className="mt-5 text-center text-sm text-muted">
          {signUp ? "Already have an account? " : "Don't have an account? "}
          <Link href={signUp ? "/sign-in" : "/sign-up"} className="font-semibold text-amber hover:underline">
            {signUp ? "Sign In" : "Sign Up"}
          </Link>
        </p>
        <p className="mt-3 text-center text-[11px] text-muted">Demo only: details stay in this browser.</p>
      </div>
    </main>
  );
}
