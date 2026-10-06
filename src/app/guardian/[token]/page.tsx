"use client";

import { useEffect, useMemo, useState } from "react";
import Map, { type MapMarker } from "@/components/Map";
import { DemoPartnerChip, StatusPill } from "@/components/ui";
import type { LatLng, PlanBOption, RequestStatus, Severity, TimelineEvent } from "@/lib/types";

interface GuardianView {
  id: string;
  status: RequestStatus;
  customerName: string;
  passengers: number;
  hasChildren: boolean;
  location: LatLng;
  highwayRef: string;
  vehicleModel: string;
  vehiclePlate: string;
  fault: string;
  severity: Severity;
  etaMinutes: number | null;
  otpVerified: boolean;
  mechanic: {
    name: string; shopName: string; phone: string; rating: number;
    verified: boolean; plateNumber: string; arrivalVehicle: string; location: LatLng;
  } | null;
  planB: PlanBOption[] | null;
  timeline: TimelineEvent[];
}

export default function GuardianPage({ params }: { params: { token: string } }) {
  const [v, setV] = useState<GuardianView | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        const res = await fetch(`/api/guardian/${params.token}`, { cache: "no-store" });
        const data = await res.json();
        if (!alive) return;
        if (!res.ok) return setError(data.error ?? "Link not valid");
        setV(data);
      } catch {
        /* transient */
      }
    };
    load();
    const t = setInterval(load, 4000);
    return () => { alive = false; clearInterval(t); };
  }, [params.token]);

  const markers = useMemo<MapMarker[]>(() => {
    if (!v) return [];
    const list: MapMarker[] = [
      { id: "them", position: v.location, kind: "incident", title: `${v.customerName} is here`, subtitle: v.highwayRef },
    ];
    if (v.mechanic) {
      list.push({
        id: "mech", position: v.mechanic.location, kind: "mechanic",
        title: v.mechanic.name, subtitle: `${v.mechanic.shopName} · ${v.etaMinutes} min away`,
      });
    }
    return list;
  }, [v]);

  if (error) {
    return (
      <main className="mx-auto max-w-lg px-4 py-24 text-center">
        <div className="text-5xl">🔗</div>
        <h1 className="mt-4 text-xl font-bold">{error}</h1>
        <p className="mt-2 text-sm text-muted">
          Guardian links expire once the trip is closed.
        </p>
      </main>
    );
  }

  if (!v) {
    return <main className="px-4 py-24 text-center text-muted">Loading…</main>;
  }

  return (
    <main className="mx-auto max-w-2xl px-4 py-8">
      <div className="card-pad border-safe/30 bg-safe/[0.04] text-center">
        <div className="text-[10px] uppercase tracking-[0.2em] text-safe">Guardian view</div>
        <h1 className="mt-2 text-2xl font-extrabold">
          {v.customerName} has help on the way
        </h1>
        <p className="mt-1 text-sm text-muted">
          {v.passengers} {v.passengers === 1 ? "person" : "people"}
          {v.hasChildren && " including children"} · {v.highwayRef}
        </p>
        <div className="mt-3 flex justify-center"><StatusPill status={v.status} /></div>
      </div>

      <div className="mt-5">
        <Map center={v.location} markers={markers} height={280} />
      </div>

      {v.mechanic ? (
        <div className="card-pad mt-5 border-amber/30">
          <div className="flex items-center justify-between">
            <div className="text-[10px] uppercase tracking-wider text-muted">
              Who is coming
            </div>
            <div className="text-right">
              <div className="text-2xl font-extrabold leading-none text-amber">{v.etaMinutes}</div>
              <div className="text-[10px] uppercase text-muted">min</div>
            </div>
          </div>

          <div className="mt-3 flex items-center gap-3">
            <span className="grid h-12 w-12 place-items-center rounded-full bg-amber/15 text-xl">🔧</span>
            <div>
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <span className="font-bold">{v.mechanic.name}</span>
                <DemoPartnerChip />
                {v.mechanic.verified && (
                  <span className="chip border-safe/40 bg-safe/10 text-safe">✓ ID verified</span>
                )}
              </div>
              <div className="text-sm text-muted">{v.mechanic.shopName} · ★ {v.mechanic.rating}</div>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
            <div className="stat">
              <div className="text-[10px] uppercase text-muted">Arriving on</div>
              <div className="font-bold">{v.mechanic.arrivalVehicle}</div>
            </div>
            <div className="stat">
              <div className="text-[10px] uppercase text-muted">Plate number</div>
              <div className="font-bold">{v.mechanic.plateNumber}</div>
            </div>
          </div>

          <a href={`tel:${v.mechanic.phone.replace(/\s/g, "")}`} className="btn-ghost mt-3 w-full">
            📞 Call the mechanic directly
          </a>

          <div className={`mt-3 rounded-xl border px-3.5 py-2.5 text-xs font-semibold ${
            v.otpVerified
              ? "border-safe/40 bg-safe/10 text-safe"
              : "border-edge bg-panel2 text-muted"
          }`}>
            {v.otpVerified
              ? "✅ Identity confirmed on site — the correct arrival code was entered"
              : "⏳ Not yet on site. Identity will be confirmed by a 4 digit code."}
          </div>
        </div>
      ) : (
        <div className="card-pad mt-5 text-center">
          <div className="font-bold">Finding the nearest mechanic</div>
          <div className="mt-1 text-xs text-muted">
            Problem reported: {v.fault}
          </div>
        </div>
      )}

      {v.planB && (
        <div className="card-pad mt-5 border-purple-400/30 bg-purple-400/[0.04]">
          <div className="text-[10px] uppercase tracking-wider text-purple-300">
            Plan B in progress
          </div>
          <p className="mt-1 text-sm text-muted">
            The vehicle cannot be repaired tonight, so onward travel is being arranged.
          </p>
          <ul className="mt-3 space-y-2">
            {v.planB.map((o) => (
              <li key={o.title} className="rounded-xl border border-edge bg-panel2 p-3 text-sm">
                <div className="font-semibold">{o.title}</div>
                <div className="text-xs text-muted">{o.detail}</div>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="card-pad mt-5">
        <div className="mb-3 text-[10px] uppercase tracking-wider text-muted">Live updates</div>
        <ol className="space-y-2.5">
          {[...v.timeline].reverse().map((e, i) => (
            <li key={`${e.at}-${i}`} className="flex gap-3 text-sm">
              <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${i === 0 ? "bg-amber" : "bg-edge"}`} />
              <div>
                <div className="font-medium">{e.label}</div>
                {e.detail && <div className="text-xs text-muted">{e.detail}</div>}
                <div className="text-[10px] text-muted/70">{new Date(e.at).toLocaleTimeString()}</div>
              </div>
            </li>
          ))}
        </ol>
      </div>

      <p className="mt-6 text-center text-xs text-muted">
        This page updates on its own. You do not need the app installed.
      </p>
    </main>
  );
}
