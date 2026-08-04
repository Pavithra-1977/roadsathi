"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import Map, { type MapMarker } from "@/components/Map";
import { Rupees, SeverityBadge, StatusPill } from "@/components/ui";
import { partName } from "@/lib/knowledgeBase";
import type { AssistanceRequest, LatLng } from "@/lib/types";

export default function TrackPage({ params }: { params: { id: string } }) {
  const [req, setReq] = useState<AssistanceRequest | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [origin, setOrigin] = useState("");

  useEffect(() => setOrigin(window.location.origin), []);

  // Poll. With Supabase configured you would swap this for a realtime
  // subscription on assistance_requests - the render path is identical.
  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        const res = await fetch(`/api/requests/${params.id}`, { cache: "no-store" });
        const data = await res.json();
        if (!alive) return;
        if (!res.ok) return setError(data.error ?? "Not found");
        setReq(data.request);
      } catch {
        /* keep the last known state on a transient network blip */
      }
    };
    load();
    const t = setInterval(load, 4000);
    return () => { alive = false; clearInterval(t); };
  }, [params.id]);

  const markers = useMemo<MapMarker[]>(() => {
    if (!req) return [];
    const list: MapMarker[] = [
      { id: "incident", position: req.location, kind: "incident", title: "Your vehicle", subtitle: req.highwayRef },
    ];
    if (req.mechanic) {
      list.push({
        id: "mech", position: req.mechanic.location, kind: "mechanic",
        title: req.mechanic.name, subtitle: `${req.mechanic.shopName} · ETA ${req.etaMinutes} min`,
      });
    }
    for (const p of req.partsPlan?.pickups ?? []) {
      list.push({
        id: p.shopId, position: p.location, kind: "shop",
        title: p.shopName, subtitle: `Collecting: ${p.parts.map(partName).join(", ")}`,
      });
    }
    for (const o of req.planB ?? []) {
      if (o.location) {
        list.push({ id: o.title, position: o.location, kind: "safe", title: o.title, subtitle: o.detail.slice(0, 80) });
      }
    }
    return list;
  }, [req]);

  const route = useMemo<LatLng[] | undefined>(() => {
    if (!req?.mechanic) return undefined;
    const pts: LatLng[] = [req.mechanic.location];
    for (const p of req.partsPlan?.pickups ?? []) pts.push(p.location);
    pts.push(req.location);
    return pts;
  }, [req]);

  async function engagePlanB() {
    const res = await fetch(`/api/requests/${params.id}/planb`, { method: "POST" });
    const data = await res.json();
    if (res.ok) setReq(data.request);
  }

  if (error) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-20 text-center">
        <div className="text-5xl">🤔</div>
        <h1 className="mt-4 text-2xl font-bold">{error}</h1>
        <p className="mt-2 text-sm text-muted">
          In-memory demo mode resets when the serverless function goes cold. Connect
          Supabase for requests that survive.
        </p>
        <Link href="/sos" className="btn-primary mt-6">Raise a new SOS</Link>
      </main>
    );
  }

  if (!req) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-24 text-center text-muted">
        Loading your request…
      </main>
    );
  }

  const guardianUrl = origin ? `${origin}/guardian/${req.guardianToken}` : "";

  return (
    <main className="mx-auto max-w-7xl px-4 py-8">
      {/* header */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-extrabold tracking-tight">{req.id}</h1>
            <StatusPill status={req.status} />
          </div>
          <p className="mt-1 text-sm text-muted">
            {req.highwayRef} · {req.vehicleModel} {req.vehiclePlate && `· ${req.vehiclePlate}`} ·{" "}
            {req.passengers} {req.passengers === 1 ? "person" : "people"}
            {req.hasChildren && " (children on board)"}
          </p>
        </div>
        <a href="tel:112" className="btn-sos">📞 Emergency 112</a>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.1fr_1fr]">
        {/* -------------------------------------------------- left */}
        <div className="space-y-5">
          <Map center={req.location} markers={markers} route={route} height={340} />

          {/* mechanic */}
          {req.mechanic ? (
            <div className="card-pad border-amber/30">
              <div className="mb-3 flex items-center justify-between">
                <div className="text-[10px] uppercase tracking-wider text-muted">
                  Your mechanic
                </div>
                <div className="text-right">
                  <div className="text-3xl font-extrabold leading-none text-amber">
                    {req.etaMinutes}
                  </div>
                  <div className="text-[10px] uppercase text-muted">min away</div>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <span className="grid h-14 w-14 shrink-0 place-items-center rounded-full bg-amber/15 text-2xl">🔧</span>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-lg font-bold">{req.mechanic.name}</span>
                    {req.mechanic.verified && (
                      <span className="chip border-safe/40 bg-safe/10 text-safe">✓ ID verified</span>
                    )}
                  </div>
                  <div className="text-sm text-muted">{req.mechanic.shopName}</div>
                  <div className="text-xs text-muted">
                    ★ {req.mechanic.rating} · {req.mechanic.jobsCompleted} jobs ·{" "}
                    {req.mechanic.arrivalVehicle} · {req.mechanic.plateNumber}
                  </div>
                </div>
              </div>

              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <a href={`tel:${req.mechanic.phone.replace(/\s/g, "")}`} className="btn-ghost">
                  📞 Call {req.mechanic.name.split(" ")[0]}
                </a>
                <div className="rounded-xl border border-amber/40 bg-amber/10 px-4 py-2.5 text-center">
                  <div className="text-[10px] uppercase tracking-wider text-muted">
                    {req.otpVerified ? "Arrival verified" : "Arrival code"}
                  </div>
                  <div className="text-xl font-extrabold tracking-[0.35em] text-amber">
                    {req.otpVerified ? "✓ ✓ ✓ ✓" : req.otp}
                  </div>
                </div>
              </div>

              {!req.otpVerified && (
                <p className="mt-3 rounded-xl border border-edge bg-panel2 px-3.5 py-2.5 text-xs leading-relaxed text-muted">
                  <span className="font-semibold text-white">Read this code aloud only when they reach you.</span>{" "}
                  Work cannot start until they enter it. If the person who arrives cannot
                  produce the app, do not hand over your keys — call {req.mechanic.name.split(" ")[0]} on the number above.
                </p>
              )}
            </div>
          ) : (
            <div className="card-pad border-sos/30 bg-sos/[0.04]">
              <div className="flex items-center gap-3">
                <span className="relative flex h-3 w-3">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-sos opacity-75" />
                  <span className="relative inline-flex h-3 w-3 rounded-full bg-sos" />
                </span>
                <div>
                  <div className="font-bold">Broadcasting to nearby mechanics</div>
                  <div className="text-xs text-muted">
                    Typically accepted within 60 seconds. Estimated arrival {req.etaMinutes} min.
                  </div>
                </div>
              </div>
              <p className="mt-3 text-xs text-muted">
                Demo tip: open the{" "}
                <Link href="/mechanic" className="text-amber underline">mechanic dashboard</Link>{" "}
                in another tab and accept this job.
              </p>
            </div>
          )}

          {/* parts route */}
          {req.partsPlan && req.partsPlan.pickups.length > 0 && (
            <div className="card-pad">
              <div className="mb-3 text-[10px] uppercase tracking-wider text-muted">
                Parts pickup route · +{req.partsPlan.totalDetourKm} km detour
              </div>
              <div className="space-y-2">
                {req.partsPlan.pickups.map((p, i) => (
                  <div key={p.shopId} className="flex items-start gap-3 rounded-xl border border-edge bg-panel2 p-3">
                    <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-blue-400/15 text-xs font-bold text-blue-300">
                      {i + 1}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-semibold">{p.shopName}</div>
                      <div className="text-xs text-muted">
                        {p.parts.map(partName).join(", ")}
                      </div>
                    </div>
                    <span className={`chip shrink-0 ${p.openNow ? "border-safe/40 text-safe" : "border-sos/40 text-sos"}`}>
                      {p.openNow ? "Open" : "Closed"}
                    </span>
                  </div>
                ))}
              </div>
              {req.partsPlan.unavailable.length > 0 && (
                <p className="mt-3 text-xs text-sos">
                  Not in stock nearby: {req.partsPlan.unavailable.map(partName).join(", ")}. The
                  mechanic will assess whether a temporary fix is safe.
                </p>
              )}
            </div>
          )}

          {/* plan b */}
          {req.planB ? (
            <div className="card-pad border-purple-400/30 bg-purple-400/[0.04]">
              <div className="text-[10px] uppercase tracking-wider text-purple-300">
                Plan B · getting you home safely
              </div>
              <h3 className="mt-1 text-lg font-bold">
                The vehicle is not going anywhere tonight. You are.
              </h3>
              <div className="mt-4 space-y-3">
                {req.planB.map((o) => (
                  <div key={o.title} className="rounded-xl border border-edge bg-panel2 p-3.5">
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <div className="font-semibold">{o.title}</div>
                      {typeof o.priceInr === "number" && (
                        <div className="text-sm font-bold text-amber"><Rupees amount={o.priceInr} /></div>
                      )}
                    </div>
                    <p className="mt-1 text-xs leading-relaxed text-muted">{o.detail}</p>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {typeof o.distanceKm === "number" && <span className="chip">{o.distanceKm} km away</span>}
                      {typeof o.etaMinutes === "number" && <span className="chip">{o.etaMinutes} min</span>}
                      {o.contact && <span className="chip">{o.contact}</span>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            req.status !== "resolved" && (
              <button onClick={engagePlanB} className="btn-ghost w-full border-purple-400/40 py-3.5 text-purple-200">
                🛡️ It cannot be fixed — arrange safe onward travel and vehicle custody
              </button>
            )
          )}
        </div>

        {/* -------------------------------------------------- right */}
        <div className="space-y-5">
          {req.triage && (
            <div className="card-pad">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="text-[10px] uppercase tracking-wider text-muted">Diagnosis</div>
                <SeverityBadge severity={req.triage.severity} />
              </div>
              <div className="mt-2 text-xl font-extrabold">{req.triage.faultLabel}</div>
              <div className="mt-1 text-xs text-muted">
                {Math.round(req.triage.confidence * 100)}% confidence ·{" "}
                {req.triage.source === "llm" ? "LLM refined" : "knowledge base"}
              </div>
              <p className="mt-3 text-xs leading-relaxed text-muted">&quot;{req.symptomText}&quot;</p>

              <div className="mt-4">
                <div className="mb-1.5 text-[10px] uppercase tracking-wider text-muted">
                  Stay safe while you wait
                </div>
                <ul className="space-y-1.5">
                  {req.triage.safetyAdvice.map((a) => (
                    <li key={a} className="flex gap-2 text-xs leading-relaxed">
                      <span className="text-amber">▸</span>{a}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}

          {/* price */}
          {typeof req.quotedPriceInr === "number" && (
            <div className="card-pad border-safe/30">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-[10px] uppercase tracking-wider text-muted">
                    Locked price
                  </div>
                  <div className="text-2xl font-extrabold text-safe">
                    <Rupees amount={req.quotedPriceInr} />
                  </div>
                </div>
                <span className="chip border-safe/40 text-safe">🔒 No surge</span>
              </div>
              <p className="mt-2 text-xs leading-relaxed text-muted">
                Frozen before the mechanic was dispatched. Parts are billed at actual cost
                with the shop receipt attached. Nothing above this without your approval.
              </p>
            </div>
          )}

          {/* guardian */}
          <div className="card-pad border-safe/25">
            <div className="text-[10px] uppercase tracking-wider text-muted">Guardian Link</div>
            <p className="mt-1 text-xs leading-relaxed text-muted">
              Share this with someone at home. They see the mechanic&apos;s identity, plate
              number and live ETA — without needing the app.
            </p>
            <div className="mt-3 flex gap-2">
              <input readOnly value={guardianUrl} className="input flex-1 text-xs" />
              <button
                onClick={() => { navigator.clipboard.writeText(guardianUrl); setCopied(true); setTimeout(() => setCopied(false), 1800); }}
                className="btn-safe shrink-0"
              >
                {copied ? "Copied" : "Copy"}
              </button>
            </div>
            <Link href={`/guardian/${req.guardianToken}`} className="mt-2 inline-block text-xs text-amber underline">
              Preview the guardian view →
            </Link>
          </div>

          {/* timeline */}
          <div className="card-pad">
            <div className="mb-3 text-[10px] uppercase tracking-wider text-muted">Timeline</div>
            <ol className="space-y-3">
              {[...req.timeline].reverse().map((e, i) => (
                <li key={`${e.at}-${i}`} className="flex gap-3">
                  <div className="flex flex-col items-center">
                    <span className={`mt-1 h-2 w-2 shrink-0 rounded-full ${i === 0 ? "bg-amber" : "bg-edge"}`} />
                    {i < req.timeline.length - 1 && <span className="mt-1 w-px flex-1 bg-edge" />}
                  </div>
                  <div className="pb-1">
                    <div className="text-sm font-semibold">{e.label}</div>
                    {e.detail && <div className="text-xs text-muted">{e.detail}</div>}
                    <div className="text-[10px] text-muted/70">
                      {new Date(e.at).toLocaleTimeString()}
                    </div>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </div>
    </main>
  );
}
