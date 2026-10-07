"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Rupees, SeverityBadge, StatusPill } from "@/components/ui";
import { partName } from "@/lib/knowledgeBase";
import { useT } from "@/lib/i18n";
import type { AssistanceRequest } from "@/lib/types";

/**
 * Mechanic job board.
 *
 * In production the signed-in mechanic's identity comes from Supabase auth.
 * For the demo you pick which of the seeded mechanics you are, so a judge can
 * accept a job from a second tab and watch the customer screen update live.
 */
const ME = [
  { id: "m1", name: "Ravi Kumar", shop: "Sri Balaji Auto Works" },
  { id: "m2", name: "Imran Sheikh", shop: "Highway Tyre Point" },
  { id: "m3", name: "Suresh Reddy", shop: "Reddy Motors & Electricals" },
  { id: "m4", name: "Manoj Yadav", shop: "Yadav Two-Wheeler Service" },
  { id: "m5", name: "Prakash Naidu", shop: "Naidu Recovery & Towing" },
  { id: "m6", name: "Arjun Pillai", shop: "Nightshift Garage (24x7)" },
];

export default function MechanicPage() {
  const t = useT();
  const [me, setMe] = useState(ME[0].id);
  const [rows, setRows] = useState<AssistanceRequest[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [otpInput, setOtpInput] = useState<Record<string, string>>({});
  const [note, setNote] = useState<Record<string, string>>({});
  const [msg, setMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/requests?status=open,assigned,arrived", { cache: "no-store" });
      const data = await res.json();
      setRows(data.requests ?? []);
    } catch {
      /* transient */
    }
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, 4000);
    return () => clearInterval(t);
  }, [load]);

  async function accept(id: string) {
    setBusy(id); setMsg(null);
    const res = await fetch(`/api/requests/${id}/accept`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ mechanicId: me }),
    });
    const data = await res.json();
    if (!res.ok) setMsg(data.error);
    setBusy(null);
    load();
  }

  async function verify(id: string) {
    setBusy(id); setMsg(null);
    const res = await fetch(`/api/requests/${id}/verify-otp`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ code: otpInput[id] ?? "" }),
    });
    const data = await res.json();
    if (!res.ok) setMsg(data.error);
    setBusy(null);
    load();
  }

  async function finish(id: string, status: "resolved" | "plan_b") {
    setBusy(id);
    await fetch(`/api/requests/${id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ status, resolutionNote: note[id] ?? "" }),
    });
    setBusy(null);
    load();
  }

  const mine = rows.filter((r) => r.mechanicId === me);
  const openJobs = rows.filter((r) => r.status === "open");
  const earnings = mine.reduce((s, r) => s + (r.quotedPriceInr ?? 0), 0);

  return (
    <main className="mx-auto max-w-7xl px-4 py-8">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight">{t("Mechanic dashboard")}</h1>
          <p className="mt-1 text-sm text-muted">
            {t("Jobs on your stretch of highway right now. Accepting one locks it to you.")}
          </p>
        </div>
        <div>
          <label className="label">{t("Signed in as (demo)")}</label>
          <select className="input min-w-[260px]" value={me} onChange={(e) => setMe(e.target.value)}>
            {ME.map((m) => (
              <option key={m.id} value={m.id}>{m.name} — {m.shop}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="stat">
          <div className="text-[10px] uppercase tracking-wider text-muted">{t("Open nearby")}</div>
          <div className="text-2xl font-extrabold text-sos">{openJobs.length}</div>
        </div>
        <div className="stat">
          <div className="text-[10px] uppercase tracking-wider text-muted">{t("Your active jobs")}</div>
          <div className="text-2xl font-extrabold text-amber">{mine.length}</div>
        </div>
        <div className="stat">
          <div className="text-[10px] uppercase tracking-wider text-muted">{t("Value in hand")}</div>
          <div className="text-2xl font-extrabold text-safe"><Rupees amount={earnings} /></div>
        </div>
        <div className="stat">
          <div className="text-[10px] uppercase tracking-wider text-muted">{t("Status")}</div>
          <div className="mt-1 text-sm font-bold text-safe">🟢 {t("Online")}</div>
        </div>
      </div>

      {msg && (
        <div className="mb-4 rounded-xl border border-sos/50 bg-sos/10 px-4 py-3 text-sm text-sos">{t(msg)}</div>
      )}

      {rows.length === 0 ? (
        <div className="card-pad text-center">
          <div className="text-4xl">🌙</div>
          <div className="mt-3 font-bold">{t("Quiet on the highway")}</div>
          <p className="mt-1 text-sm text-muted">
            {t("No active requests.")}{" "}
            <Link href="/sos" className="text-amber underline">{t("Raise an SOS")}</Link>{" "}
            {t("in another tab and it will appear here within four seconds.")}
          </p>
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {rows.map((r) => {
            const isMine = r.mechanicId === me;
            const takenByOther = Boolean(r.mechanicId) && !isMine;

            return (
              <div key={r.id}
                className={`card-pad ${isMine ? "border-amber/40" : takenByOther ? "opacity-55" : "border-sos/30"}`}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-sm font-bold">{r.id}</span>
                    <StatusPill status={r.status} />
                  </div>
                  {r.triage && <SeverityBadge severity={r.triage.severity} />}
                </div>

                <div className="mt-3 text-lg font-bold">
                  {r.triage?.faultLabel ?? t("Needs inspection")}
                </div>
                <div className="text-xs text-muted">
                  {r.highwayRef} · {r.vehicleModel} ({r.vehicleType}) {r.vehiclePlate} ·{" "}
                  {t("{n} on board", { n: r.passengers })}{r.hasChildren && ` · ${t("children")}`}
                </div>
                <p className="mt-2 rounded-lg border border-edge bg-panel2 px-3 py-2 text-xs italic text-muted">
                  &quot;{r.symptomText}&quot;
                </p>

                <div className="mt-3 grid grid-cols-3 gap-2">
                  <div className="stat">
                    <div className="text-[10px] uppercase text-muted">{t("ETA")}</div>
                    <div className="font-bold text-amber">{t("{n} min", { n: r.etaMinutes ?? "—" })}</div>
                  </div>
                  <div className="stat">
                    <div className="text-[10px] uppercase text-muted">{t("Job value")}</div>
                    <div className="font-bold text-safe">
                      {r.quotedPriceInr ? <Rupees amount={r.quotedPriceInr} /> : "—"}
                    </div>
                  </div>
                  <div className="stat">
                    <div className="text-[10px] uppercase text-muted">{t("Fix time")}</div>
                    <div className="font-bold">~{r.triage?.estimatedFixMinutes ?? 45}m</div>
                  </div>
                </div>

                {r.triage && (
                  <div className="mt-3 grid gap-2 sm:grid-cols-2">
                    <div>
                      <div className="mb-1 text-[10px] uppercase tracking-wider text-muted">{t("Bring these tools")}</div>
                      <div className="flex flex-wrap gap-1">
                        {r.triage.requiredTools.map((tool) => (
                          <span key={tool} className="chip py-0.5 text-[10px]">{tool}</span>
                        ))}
                      </div>
                    </div>
                    <div>
                      <div className="mb-1 text-[10px] uppercase tracking-wider text-muted">{t("Collect on the way")}</div>
                      <div className="flex flex-wrap gap-1">
                        {r.partsPlan?.pickups.length
                          ? r.partsPlan.pickups.map((p) => (
                              <span key={p.shopId} className="chip border-blue-400/30 py-0.5 text-[10px] text-blue-300">
                                {p.shopName}: {p.parts.map(partName).join(", ")}
                              </span>
                            ))
                          : <span className="text-[11px] text-muted">{t("Nothing to collect")}</span>}
                      </div>
                    </div>
                  </div>
                )}

                {/* actions */}
                <div className="mt-4 border-t border-edge pt-4">
                  {!r.mechanicId && (
                    <button onClick={() => accept(r.id)} disabled={busy === r.id}
                      className="btn-primary w-full py-3">
                      {busy === r.id ? t("Accepting…") : `✋ ${t("Accept this job")}`}
                    </button>
                  )}

                  {takenByOther && (
                    <div className="text-center text-xs text-muted">
                      {t("Taken by {name}", { name: r.mechanic?.name ?? "" })}
                    </div>
                  )}

                  {isMine && r.status === "assigned" && (
                    <div>
                      <div className="mb-2 text-xs text-muted">
                        {t("On arrival, ask the customer for their 4 digit code. Do not start work without it.")}
                      </div>
                      <div className="flex gap-2">
                        <input
                          className="input flex-1 text-center text-lg tracking-[0.4em]"
                          placeholder="••••" maxLength={4}
                          value={otpInput[r.id] ?? ""}
                          onChange={(e) => setOtpInput((s) => ({ ...s, [r.id]: e.target.value }))}
                        />
                        <button onClick={() => verify(r.id)} disabled={busy === r.id}
                          className="btn-primary shrink-0">
                          {t("Verify arrival")}
                        </button>
                      </div>
                    </div>
                  )}

                  {isMine && r.status === "arrived" && (
                    <div className="space-y-2">
                      <input className="input" placeholder={t("What did you do? (goes on the customer's receipt)")}
                        value={note[r.id] ?? ""}
                        onChange={(e) => setNote((s) => ({ ...s, [r.id]: e.target.value }))} />
                      <div className="grid gap-2 sm:grid-cols-2">
                        <button onClick={() => finish(r.id, "resolved")} disabled={busy === r.id}
                          className="btn-safe">✅ {t("Fixed — vehicle roadworthy")}</button>
                        <button onClick={() => finish(r.id, "plan_b")} disabled={busy === r.id}
                          className="btn-ghost border-purple-400/40 text-purple-200">
                          🛡️ {t("Cannot fix — engage Plan B")}
                        </button>
                      </div>
                    </div>
                  )}

                  {isMine && (
                    <Link href={`/track/${r.id}`}
                      className="mt-2 block text-center text-xs text-amber underline">
                      {t("Open the customer view")} →
                    </Link>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </main>
  );
}
