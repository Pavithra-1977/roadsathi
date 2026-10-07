"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Map, { type MapMarker } from "@/components/Map";
import { DemoPartnerChip, SeverityBadge } from "@/components/ui";
import { LAST_REQUEST_KEY } from "@/components/AppShell";
import VoiceAssistant from "@/components/VoiceAssistant";
import WhyDiagnosis from "@/components/WhyDiagnosis";
import { useT } from "@/lib/i18n";
import { partName } from "@/lib/knowledgeBase";
import type { TriageResult, VehicleType } from "@/lib/types";

interface Candidate {
  mechanic: { id: string; name: string; shopName: string; rating: number; verified: boolean; location: { lat: number; lng: number } };
  distanceKm: number;
  etaMinutes: number;
  idleBoost: boolean;
  reasons: string[];
}

const QUICK = [
  "Front left tyre puncture, losing air fast",
  "Car will not start, only a clicking sound",
  "Temperature gauge in the red and steam from the bonnet",
  "Loud bang then the tyre burst on the highway",
  "Brake pedal has gone soft, not stopping properly",
  "Petrol finished, tank is empty",
];

const VEHICLES: { value: VehicleType; label: string }[] = [
  { value: "car", label: "Car" },
  { value: "suv", label: "SUV" },
  { value: "bike", label: "Bike" },
  { value: "auto", label: "Auto" },
  { value: "truck", label: "Truck" },
];

const STEPS = [
  { id: "problem", label: "Problem", short: "Problem" },
  { id: "location", label: "Location & mechanics", short: "Location" },
  { id: "details", label: "Details & send", short: "Send" },
] as const;

export default function SosPage() {
  const router = useRouter();
  const t = useT();
  const [step, setStep] = useState<(typeof STEPS)[number]["id"]>("problem");

  const [pos, setPos] = useState<{ lat: number; lng: number } | null>(null);
  const [locState, setLocState] = useState<"idle" | "locating" | "ok" | "denied">("idle");

  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [passengers, setPassengers] = useState(2);
  const [hasChildren, setHasChildren] = useState(false);
  const [vehicleType, setVehicleType] = useState<VehicleType>("car");
  const [vehicleModel, setVehicleModel] = useState("");
  const [vehiclePlate, setVehiclePlate] = useState("");
  const [symptomText, setSymptomText] = useState("");
  const [guardianPhone, setGuardianPhone] = useState("");

  const [triage, setTriage] = useState<TriageResult | null>(null);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [analysing, setAnalysing] = useState(false);
  const [clarification, setClarification] = useState<{ question: string; answer: string } | null>(null);
  const [answerDraft, setAnswerDraft] = useState("");
  const [error, setError] = useState<string | null>(null);

  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  const locate = useCallback(() => {
    setLocState("locating");
    if (!navigator.geolocation) {
      setLocState("denied");
      setPos({ lat: 17.385, lng: 78.4867 }); // Hyderabad fallback
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (p) => {
        setPos({ lat: Number(p.coords.latitude.toFixed(6)), lng: Number(p.coords.longitude.toFixed(6)) });
        setLocState("ok");
      },
      () => {
        setLocState("denied");
        setPos({ lat: 17.385, lng: 78.4867 });
      },
      { enableHighAccuracy: true, timeout: 8000 }
    );
  }, []);

  useEffect(() => { locate(); }, [locate]);

  // Live triage while the driver is still typing. Instant and deterministic;
  // the LangGraph agent runs only on "Analyse with AI" and on SOS submit.
  useEffect(() => setClarification(null), [symptomText]);
  useEffect(() => {
    if (symptomText.trim().length < 4) {
      setTriage(null);
      setCandidates([]);
      return;
    }
    if (debounce.current) clearTimeout(debounce.current);
    debounce.current = setTimeout(async () => {
      try {
        const res = await fetch("/api/triage", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ symptomText, vehicleType, lat: pos?.lat, lng: pos?.lng }),
        });
        const data = await res.json();
        setTriage(data.triage);
        setCandidates(data.candidates ?? []);
      } catch {
        /* triage preview is best-effort; the SOS itself still works */
      }
    }, 350);
    return () => { if (debounce.current) clearTimeout(debounce.current); };
  }, [symptomText, vehicleType, pos?.lat, pos?.lng]);

  const markers = useMemo<MapMarker[]>(() => {
    if (!pos) return [];
    const list: MapMarker[] = [
      { id: "me", position: pos, kind: "incident", title: t("You are here"), subtitle: t("SOS location") },
    ];
    for (const c of candidates) {
      list.push({
        id: c.mechanic.id,
        position: c.mechanic.location,
        kind: "mechanic",
        title: c.mechanic.name,
        subtitle: `${c.mechanic.shopName} · ${t("{n} min", { n: c.etaMinutes })}`,
      });
    }
    return list;
  }, [pos, candidates, t]);

  async function analyse(answer?: string) {
    if (symptomText.trim().length < 4) return;
    const clar = answer && triage?.clarifyingQuestion ? { question: triage.clarifyingQuestion, answer } : clarification;
    setAnalysing(true);
    try {
      const res = await fetch("/api/triage", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          symptomText, vehicleType, vehicleModel, hasChildren,
          lat: pos?.lat, lng: pos?.lng, agent: true, clarification: clar,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setTriage(data.triage);
        setCandidates(data.candidates ?? []);
        setClarification(clar ?? null);
        setAnswerDraft("");
      }
    } catch {
      /* analysis is optional; the SOS still works */
    } finally {
      setAnalysing(false);
    }
  }

  /**
   * Voice: put the recognised words in the Problem field and run the existing triage.
   * Non-English speech uses the existing agent mode (multilingual when the AI is configured;
   * otherwise /api/triage falls back to the knowledge base itself).
   */
  async function voiceTriage(text: string, agent: boolean): Promise<{ triage: TriageResult; eta: number | null }> {
    setSymptomText(text);
    const res = await fetch("/api/triage", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ symptomText: text, vehicleType, vehicleModel, hasChildren, lat: pos?.lat, lng: pos?.lng, agent }),
    });
    if (!res.ok) throw new Error("Triage failed. Your words are in the box; you can still send the SOS.");
    const data = await res.json();
    const c: Candidate[] = data.candidates ?? [];
    setTriage(data.triage);
    setCandidates(c);
    return { triage: data.triage, eta: c[0]?.etaMinutes ?? null };
  }

  async function submit() {
    setError(null);
    if (!pos) return setError("We still need your location before we can send help.");
    if (!customerPhone.trim()) return setError("Please enter a phone number so the mechanic can reach you.");
    if (symptomText.trim().length < 4) return setError("Tell us briefly what is wrong.");

    setSubmitting(true);
    try {
      const res = await fetch("/api/requests", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          customerName, customerPhone, passengers, hasChildren,
          lat: pos.lat, lng: pos.lng,
          vehicleType, vehicleModel, vehiclePlate, symptomText,
          guardianPhone: guardianPhone || null,
          clarification,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not raise the SOS");
      try { localStorage.setItem(LAST_REQUEST_KEY, data.request.id); } catch { /* storage blocked */ }
      router.push(`/track/${data.request.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
      setSubmitting(false);
    }
  }

  return (
    <main className="mx-auto max-w-6xl px-4 py-6 md:px-8 md:py-10">
      <div className="mb-6">
        <h1 className="text-2xl font-extrabold tracking-tight md:text-3xl">{t("Get help")}</h1>
        <p className="mt-1 text-sm text-muted">
          {t("Two things matter right now: your location, and roughly what is wrong. Everything else can wait.")}
        </p>
      </div>

      <div className="mb-6 grid grid-cols-3 gap-2 sm:flex sm:flex-wrap">
        {STEPS.map((s, i) => (
          <button
            key={s.id}
            onClick={() => setStep(s.id)}
            className={`flex min-w-0 items-center justify-center gap-1.5 rounded-full border px-2 py-2 text-xs font-semibold transition sm:shrink-0 sm:gap-2 sm:px-4 sm:text-sm ${
              step === s.id ? "border-amber bg-amber text-white" : "border-edge bg-white text-muted hover:text-white"
            }`}
          >
            <span>{i + 1}</span>
            <span className="truncate sm:hidden">{t(s.short)}</span>
            <span className="hidden sm:inline">{t(s.label)}</span>
          </button>
        ))}
      </div>

      {step === "problem" && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <div className="min-w-0 space-y-5">
          {/* problem */}
          <div className="card-pad">
            <div className="font-bold">🔧 {t("What is wrong?")}</div>
            <p className="mt-0.5 text-xs text-muted">
              {t("Plain words are fine. Hinglish is fine. \"Gaadi band ho gayi\" works.")}
            </p>

            <div className="mt-3">
              <VoiceAssistant onTriage={voiceTriage} />
            </div>

            <textarea
              className="input mt-3 min-h-[92px] resize-y"
              placeholder={t("e.g. front left tyre puncture, air going out fast, wife and small kid with me")}
              value={symptomText}
              onChange={(e) => setSymptomText(e.target.value)}
            />

            <div className="mt-3 flex flex-wrap gap-2">
              {QUICK.map((q) => (
                <button
                  key={q}
                  onClick={() => setSymptomText(q)}
                  className="chip transition hover:border-amber/50 hover:text-white"
                >
                  {(() => { const label = t(q); return label.length > 40 ? `${label.slice(0, 38)}…` : label; })()}
                </button>
              ))}
            </div>

            <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
              <div>
                <label className="label">{t("Vehicle")}</label>
                <select
                  className="input"
                  value={vehicleType}
                  onChange={(e) => setVehicleType(e.target.value as VehicleType)}
                >
                  {VEHICLES.map((v) => (
                    <option key={v.value} value={v.value}>{t(v.label)}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label">{t("Model")}</label>
                <input className="input" placeholder="Swift VDi" value={vehicleModel}
                  onChange={(e) => setVehicleModel(e.target.value)} />
              </div>
              <div className="col-span-2 sm:col-span-1">
                <label className="label">{t("Plate")}</label>
                <input className="input" placeholder="TS 09 AB 1234" value={vehiclePlate}
                  onChange={(e) => setVehiclePlate(e.target.value.toUpperCase())} />
              </div>
            </div>
          </div>
            <button onClick={() => setStep("location")} className="btn-primary w-full">
              {t("Next: confirm location")} →
            </button>
          </div>
          <div className="min-w-0 space-y-5">
          {triage ? (
            <div className="card-pad animate-rise">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="text-[10px] uppercase tracking-wider text-muted">
                  {t("Live triage")} · {triage.agent?.source === "llm+rag" ? t("AI (LLM + RAG)") : t("knowledge base")}
                </div>
                <SeverityBadge severity={triage.severity} />
              </div>

              <div className="mt-2 text-xl font-extrabold">{triage.faultLabel}</div>

              <div className="mt-2 flex items-center gap-2.5">
                <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-panel2">
                  <div className="h-full rounded-full bg-amber transition-all duration-500"
                    style={{ width: `${Math.round(triage.confidence * 100)}%` }} />
                </div>
                <span className="text-xs font-semibold text-amber">
                  {Math.round(triage.confidence * 100)}%
                </span>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
                <div className="stat">
                  <div className="text-[10px] uppercase tracking-wider text-muted">{t("Fix time")}</div>
                  <div className="font-bold">~{t("{n} min", { n: triage.estimatedFixMinutes })}</div>
                </div>
                <div className="stat">
                  <div className="text-[10px] uppercase tracking-wider text-muted">{t("Est. cost")}</div>
                  <div className="font-bold">
                    &#8377;{triage.estimatedCostRange[0]}–{triage.estimatedCostRange[1]}
                  </div>
                </div>
              </div>

              <div className={`mt-3 rounded-xl border px-3.5 py-2.5 text-xs font-semibold ${
                triage.roadsideFixable
                  ? "border-safe/40 bg-safe/10 text-safe"
                  : "border-purple-400/40 bg-purple-400/10 text-purple-300"
              }`}>
                {triage.roadsideFixable
                  ? `✅ ${t("Normally fixable at the roadside")}`
                  : `⚠️ ${t("Usually not fixable roadside — Plan B is being prepared in parallel")}`}
              </div>

              {/* safety advice up front, before anyone is dispatched */}
              <div className="mt-4">
                <div className="mb-1.5 text-[10px] uppercase tracking-wider text-muted">
                  {t("Do this right now")}
                </div>
                <ul className="space-y-1.5">
                  {triage.safetyAdvice.map((a) => (
                    <li key={a} className="flex gap-2 text-xs leading-relaxed text-white">
                      <span className="text-amber">▸</span>{a}
                    </li>
                  ))}
                </ul>
              </div>

              {(triage.requiredTools.length > 0 || triage.requiredParts.length > 0) && (
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <div>
                    <div className="mb-1.5 text-[10px] uppercase tracking-wider text-muted">
                      {t("Tools to bring")}
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {triage.requiredTools.map((t) => <span key={t} className="chip">{t}</span>)}
                    </div>
                  </div>
                  <div>
                    <div className="mb-1.5 text-[10px] uppercase tracking-wider text-muted">
                      {t("Parts likely needed")}
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {triage.requiredParts.length
                        ? triage.requiredParts.map((p) => (
                            <span key={p} className="chip border-amber/30 text-amber">{partName(p)}</span>
                          ))
                        : <span className="text-xs text-muted">{t("None")}</span>}
                    </div>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="card-pad text-center text-sm text-muted">
              {t("Start describing the problem and triage will appear here instantly.")}
            </div>
          )}

          {triage && (
            <div className="card-pad border-blue-400/30">
              {triage.needsClarification && triage.clarifyingQuestion ? (
                <form
                  onSubmit={(e) => { e.preventDefault(); if (answerDraft.trim()) analyse(answerDraft.trim()); }}
                  className="space-y-2"
                >
                  <div className="text-[10px] uppercase tracking-wider text-blue-300">{t("One quick question")}</div>
                  <p className="text-sm font-semibold">{triage.clarifyingQuestion}</p>
                  <input
                    className="input"
                    value={answerDraft}
                    onChange={(e) => setAnswerDraft(e.target.value)}
                    placeholder={t("Type your answer (English, Hindi or Hinglish)")}
                  />
                  <button type="submit" disabled={analysing || !answerDraft.trim()} className="btn-ghost w-full">
                    {analysing ? t("Analysing…") : t("Answer and re-check")}
                  </button>
                  <p className="text-[11px] text-muted">{t("Optional. You can send the SOS right now without answering.")}</p>
                </form>
              ) : (
                <button onClick={() => analyse()} disabled={analysing} className="btn-ghost w-full">
                  {analysing
                    ? t("Analysing with AI (up to 8 s)…")
                    : triage.agent?.source === "llm+rag"
                      ? `🧠 ${t("Re-analyse with AI")}`
                      : `🧠 ${t("Analyse with AI (LangGraph + RAG)")}`}
                </button>
              )}
              {clarification && (
                <p className="mt-2 text-[11px] text-muted">
                  {t("Your answer will be sent with the SOS:")} &quot;{clarification.answer}&quot;
                </p>
              )}
            </div>
          )}

          {triage && <WhyDiagnosis triage={triage} />}
          </div>
        </div>
      )}

      {step === "location" && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <div className="min-w-0 space-y-5">
          {/* location */}
          <div className="card-pad">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="font-bold">📍 {t("Your location")}</div>
                <div className="mt-0.5 text-xs text-muted">
                  {locState === "locating" && t("Getting a GPS fix…")}
                  {locState === "ok" && pos && `${t("Locked")}: ${pos.lat}, ${pos.lng}`}
                  {locState === "denied" && t("Location blocked — using a demo point. Edit it below.")}
                  {locState === "idle" && t("Waiting…")}
                </div>
              </div>
              <button onClick={locate} className="btn-ghost shrink-0 px-3 py-1.5 text-xs">
                {t("Refresh")}
              </button>
            </div>

            <div className="mt-3 grid grid-cols-2 gap-3">
              <div>
                <label className="label">{t("Latitude")}</label>
                <input
                  className="input" type="number" step="0.000001"
                  value={pos?.lat ?? ""}
                  onChange={(e) => setPos((p) => ({ lat: Number(e.target.value), lng: p?.lng ?? 0 }))}
                />
              </div>
              <div>
                <label className="label">{t("Longitude")}</label>
                <input
                  className="input" type="number" step="0.000001"
                  value={pos?.lng ?? ""}
                  onChange={(e) => setPos((p) => ({ lat: p?.lat ?? 0, lng: Number(e.target.value) }))}
                />
              </div>
            </div>
          </div>

          {candidates.length > 0 && (
            <div className="card-pad">
              <div className="mb-3 text-[10px] uppercase tracking-wider text-muted">
                {t("Mechanics who can take this ({n})", { n: candidates.length })}
              </div>
              <div className="space-y-2">
                {candidates.map((c) => (
                  <div key={c.mechanic.id}
                    className="flex items-center gap-3 rounded-xl border border-edge bg-panel2 p-3">
                    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-amber/15 text-amber">🔧</span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <span className="truncate text-sm font-semibold">{c.mechanic.name}</span>
                        {c.mechanic.verified && <span className="text-xs text-safe">✓</span>}
                        <DemoPartnerChip />
                        {c.idleBoost && (
                          <span className="rounded bg-safe/15 px-1.5 py-0.5 text-[9px] font-bold uppercase text-safe">
                            {t("idle")}
                          </span>
                        )}
                      </div>
                      <div className="truncate text-[11px] text-muted">
                        {c.mechanic.shopName} · ★ {c.mechanic.rating} · {c.distanceKm} km
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-base font-extrabold text-amber">{c.etaMinutes}</div>
                      <div className="text-[9px] uppercase text-muted">{t("min")}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
            <button onClick={() => setStep("details")} className="btn-primary w-full">
              {t("Next: your details")} →
            </button>
          </div>
          <div className="min-w-0">
          {pos && <Map center={pos} markers={markers} height={300} />}
          </div>
        </div>
      )}

      {step === "details" && (
        <div className="mx-auto max-w-2xl space-y-5">
          {/* people */}
          <div className="card-pad">
            <div className="font-bold">👨‍👩‍👧 {t("Who is with you?")}</div>
            <p className="mt-0.5 text-xs text-muted">
              {t("This changes what we arrange if the vehicle cannot be fixed tonight.")}
            </p>

            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <div>
                <label className="label">{t("Your name")}</label>
                <input className="input" placeholder={t("Name")} value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)} />
              </div>
              <div>
                <label className="label">{t("Phone")} *</label>
                <input className="input" placeholder="+91 …" value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)} />
              </div>
              <div>
                <label className="label">{t("People in the vehicle")}</label>
                <input className="input" type="number" min={1} max={12} value={passengers}
                  onChange={(e) => setPassengers(Number(e.target.value))} />
              </div>
              <div>
                <label className="label">{t("Guardian phone (live link)")}</label>
                <input className="input" placeholder={t("Someone at home")} value={guardianPhone}
                  onChange={(e) => setGuardianPhone(e.target.value)} />
              </div>
            </div>

            <label className="mt-3 flex cursor-pointer items-center gap-2.5 rounded-xl border border-edge bg-panel2 px-3.5 py-2.5">
              <input type="checkbox" checked={hasChildren}
                onChange={(e) => setHasChildren(e.target.checked)}
                className="h-4 w-4 accent-amber" />
              <span className="text-sm">{t("Children or elderly travelling with me")}</span>
            </label>
          </div>

          {error && (
            <div className="rounded-xl border border-sos/50 bg-sos/10 px-4 py-3 text-sm text-sos">
              {t(error)}
            </div>
          )}

          <button onClick={submit} disabled={submitting} className="btn-sos w-full py-4 text-base">
            {submitting ? t("Dispatching…") : `🚨 ${t("Send SOS and dispatch a mechanic")}`}
          </button>

          <p className="text-center text-xs text-muted">
            {t("Life-threatening emergency? Call 112 first.")}{" "}
            <Link href="/how" className="text-amber underline">{t("No signal? Use SMS.")}</Link>
          </p>
        </div>
      )}
    </main>
  );
}
