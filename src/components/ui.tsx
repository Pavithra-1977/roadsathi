"use client";

import { useT } from "@/lib/i18n";
import type { DataSource, RequestStatus, Severity } from "@/lib/types";

const SEVERITY: Record<Severity, { label: string; cls: string }> = {
  low: { label: "Low", cls: "border-safe/40 bg-safe/10 text-safe" },
  medium: { label: "Medium", cls: "border-amber/40 bg-amber/10 text-amber" },
  high: { label: "High", cls: "border-orange-400/40 bg-orange-400/10 text-orange-300" },
  critical: { label: "Critical", cls: "border-sos/50 bg-sos/15 text-sos" },
};

export function SeverityBadge({ severity }: { severity: Severity }) {
  const s = SEVERITY[severity];
  const t = useT();
  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold ${s.cls}`}>
      {t(`${s.label} severity`)}
    </span>
  );
}

const STATUS: Record<RequestStatus, { label: string; cls: string }> = {
  open: { label: "Finding a mechanic", cls: "border-sos/50 bg-sos/15 text-sos" },
  assigned: { label: "Mechanic on the way", cls: "border-amber/40 bg-amber/10 text-amber" },
  arrived: { label: "Mechanic on site", cls: "border-blue-400/40 bg-blue-400/10 text-blue-300" },
  resolved: { label: "Resolved", cls: "border-safe/40 bg-safe/10 text-safe" },
  plan_b: { label: "Plan B - getting you home safely", cls: "border-purple-400/40 bg-purple-400/10 text-purple-300" },
  cancelled: { label: "Cancelled", cls: "border-edge bg-panel2 text-muted" },
};

export function StatusPill({ status }: { status: RequestStatus }) {
  const s = STATUS[status];
  const t = useT();
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold ${s.cls}`}>
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {t(s.label)}
    </span>
  );
}

export function Stat({
  label, value, sub,
}: { label: string; value: React.ReactNode; sub?: React.ReactNode }) {
  return (
    <div className="stat">
      <div className="text-[10px] uppercase tracking-wider text-muted">{useT()(label)}</div>
      <div className="mt-0.5 text-lg font-bold leading-tight">{value}</div>
      {sub ? <div className="text-[11px] text-muted">{sub}</div> : null}
    </div>
  );
}

export function Rupees({ amount }: { amount: number }) {
  return <>&#8377;{amount.toLocaleString("en-IN")}</>;
}

/** Where a data block came from: a free live source, or seeded demo data. */
export function SourceBadge({ source, label }: { source?: DataSource; label: string }) {
  const live = source === "live";
  const t = useT();
  return (
    <span
      title={live ? t("Fetched live from {source}", { source: label }) : t("Live source unavailable - showing demo data")}
      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${
        live ? "border-safe/40 bg-safe/10 text-safe" : "border-edge bg-panel2 text-muted"
      }`}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {live ? `${t("Live")}: ${label}` : t("Fallback")}
    </span>
  );
}

export function DemoPartnerChip() {
  const t = useT();
  return (
    <span
      title={t("Seeded demo roster - not a real business")}
      className="chip whitespace-nowrap border-purple-400/40 bg-purple-400/10 py-0.5 text-[10px] text-purple-200"
    >
      {t("Demo partner")}
    </span>
  );
}
