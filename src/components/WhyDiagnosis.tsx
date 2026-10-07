"use client";

import { useT } from "@/lib/i18n";
import type { TriageResult } from "@/lib/types";

const FLAG_TEXT: Record<string, string> = {
  "low agreement": "The AI and the keyword classifier disagreed and the AI was not confident, so the keyword result is used.",
  "llm overrode keyword classifier": "The AI was confident enough to override the keyword classifier.",
  "agrees with keyword classifier": "The AI and the keyword classifier agree.",
  "no api key": "AI is not configured on this server, so the built-in knowledge base answered.",
  timeout: "The AI did not answer within 8 seconds, so the built-in knowledge base answered.",
};

/** "Why this diagnosis": source, reasoning, cited guides and the agent's path. */
export default function WhyDiagnosis({ triage }: { triage: TriageResult }) {
  const a = triage.agent;
  const ai = a?.source === "llm+rag";
  const notes = (a?.flags ?? []).map((f) => FLAG_TEXT[f]).filter(Boolean);
  const t = useT();

  return (
    <div className="card-pad">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="text-[10px] uppercase tracking-wider text-muted">{t("Why this diagnosis")}</div>
        <div className="flex flex-wrap gap-1.5">
          <span
            className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold ${
              ai ? "border-blue-400/40 bg-blue-400/10 text-blue-300" : "border-edge bg-panel2 text-muted"
            }`}
          >
            {ai ? t("AI: LLM + RAG") : t("Knowledge base")}
          </span>
          {a?.retrieval && (
            <span className="inline-flex items-center rounded-full border border-edge bg-panel2 px-2 py-0.5 text-[10px] text-muted">
              {t(a.retrieval === "embedding" ? "Semantic search" : "Keyword search")}
            </span>
          )}
        </div>
      </div>

      <p className="mt-2 text-xs leading-relaxed">{triage.reasoning}</p>

      {notes.length > 0 && (
        <ul className="mt-2 space-y-1">
          {notes.map((n) => (
            <li key={n} className="text-[11px] leading-relaxed text-muted">ⓘ {t(n)}</li>
          ))}
        </ul>
      )}

      {triage.planBRecommended && (
        <p className="mt-2 text-[11px] text-purple-300">
          🛡️ {t("Severe or not roadside-fixable: safe onward travel options are being prepared in parallel.")}
        </p>
      )}

      {triage.citations && triage.citations.length > 0 ? (
        <div className="mt-3 space-y-2">
          {triage.citations.map((c, i) => (
            <div key={c.chunkId ?? i} className="rounded-xl border border-edge bg-panel2 p-3">
              <div className="flex items-baseline justify-between gap-2">
                <div className="text-xs font-semibold">{c.docTitle}</div>
                {c.chunkId && <code className="shrink-0 text-[10px] text-muted">{c.chunkId}</code>}
              </div>
              <p className="mt-1 text-[11px] leading-relaxed text-muted">{c.snippet}</p>
              <div className="mt-1 text-[10px] text-muted/70">{c.source ?? t("RoadSathi guide (self-written)")}</div>
            </div>
          ))}
        </div>
      ) : (
        <p className="mt-3 text-[11px] text-muted">{t("No specific guide matched this description yet.")}</p>
      )}

      {a && a.path.length > 1 && (
        <div className="mt-3 text-[10px] text-muted">
          {t("Path")}: <code>{a.path.join(" → ")}</code>
          {typeof a.ms === "number" && ` · ${a.ms} ms`}
          {a.model && ` · ${a.model}`}
        </div>
      )}
      <p className="mt-2 text-[10px] leading-relaxed text-muted/70">
        {t("Guidance only. The AI advises on the likely fault; dispatch and price are decided by fixed rules.")}
      </p>
    </div>
  );
}
