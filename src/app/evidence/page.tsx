import Link from "next/link";
import results from "../../../data/eval-results.json";
import { Stat } from "@/components/ui";
import { T } from "@/lib/i18n";

export const metadata = { title: "Evidence - RoadSathi triage evaluation" };

interface Row { text: string; expected: string; kind: string; predicted: string; top3: string[] }
interface Pipeline {
  name: string;
  accuracy: number;
  top3Accuracy: number;
  correct: number;
  top3Correct: number;
  byKind: Record<string, string>;
  misses: Row[];
}

const KIND_LABEL: Record<string, string> = { en: "English", hinglish: "Hinglish", typo: "Typos", vague: "Vague (unknown)" };

function PipelineCard({ p, n, note }: { p: Pipeline; n: number; note?: string }) {
  return (
    <div className="card-pad min-w-0">
      <div className="text-[10px] uppercase tracking-wider text-muted"><T>Pipeline</T></div>
      <h2 className="mt-1 text-lg font-bold">{p.name}</h2>
      {note && <p className="mt-1 text-xs leading-relaxed text-amber"><T>{note}</T></p>}

      <div className="mt-4 grid grid-cols-2 gap-2">
        <Stat label="Accuracy" value={`${p.accuracy}%`} sub={<T vars={{ x: p.correct, n }}>{"{x} of {n} correct"}</T>} />
        <Stat label="Top-3 accuracy" value={`${p.top3Accuracy}%`} sub={<T vars={{ x: p.top3Correct, n }}>{"{x} of {n} in top 3"}</T>} />
      </div>

      <div className="mt-3 flex flex-wrap gap-1.5">
        {Object.entries(p.byKind).map(([k, v]) => (
          <span key={k} className="chip"><T>{KIND_LABEL[k] ?? k}</T>: {v}</span>
        ))}
      </div>

      <details className="mt-4">
        <summary className="cursor-pointer text-xs font-semibold text-amber">
          <T vars={{ n: p.misses.length }}>{"Show all {n} misses"}</T>
        </summary>
        <ul className="mt-2 space-y-2">
          {p.misses.map((m) => (
            <li key={m.text} className="rounded-xl border border-edge bg-panel2 p-3 text-xs">
              <div className="break-words">&quot;{m.text}&quot;</div>
              <div className="mt-1 text-[11px] text-muted">
                <T>expected</T> <code className="text-safe">{m.expected}</code> · <T>got</T>{" "}
                <code className="text-sos">{m.predicted}</code> · <T>top 3</T>: {m.top3.join(", ")} · <T>{KIND_LABEL[m.kind] ?? m.kind}</T>
              </div>
            </li>
          ))}
        </ul>
      </details>
    </div>
  );
}

export default function EvidencePage() {
  const r = results;
  const n = r.testSet.size;
  return (
    <main className="mx-auto max-w-5xl px-4 py-8">
      <h1 className="text-3xl font-extrabold tracking-tight"><T>Evidence: how good is the triage?</T></h1>
      <p className="mt-2 max-w-3xl text-sm leading-relaxed text-muted">
        <T>{"Every SOS is classified into one of 18 faults or \"unknown\". This page shows how often that classification is right on a test set, for both the deterministic keyword classifier and the LangGraph + RAG pipeline."}</T>
      </p>

      <div className="mt-5 rounded-2xl border border-amber/40 bg-amber/[0.06] p-4 text-sm leading-relaxed">
        <strong className="text-amber"><T>About this test set:</T></strong>{" "}
        <T vars={{ n }}>{"{n} phrases, self-written for this project and labelled by hand, not collected from real drivers. They were written to describe symptoms the way a stranded driver might, independently of the knowledge-base keyword lists, and the knowledge base has not been tuned against them. It is not a real-world dataset, so treat the numbers as an honest smoke test, not a benchmark."}</T>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {Object.entries(r.testSet.byKind).map(([k, v]) => (
            <span key={k} className="chip"><T>{KIND_LABEL[k] ?? k}</T>: {v}</span>
          ))}
        </div>
      </div>

      <div className="mt-6 grid gap-5 md:grid-cols-2">
        <PipelineCard p={r.deterministic} n={n} />
        <PipelineCard
          p={r.langgraph}
          n={n}
          note={
            r.langgraph.llmUsed
              ? `LLM: ${r.langgraph.model} · average ${r.langgraph.avgMs} ms per phrase`
              : "Run without HUGGINGFACE_API_KEY: this column shows the agent's deterministic fallback (Hinglish/typo normalisation + keyword classifier), not LLM accuracy."
          }
        />
      </div>

      <p className="mt-6 text-xs leading-relaxed text-muted">
        <T>Generated</T> {new Date(r.generatedAt).toUTCString()} <T>by</T> <code>npx tsx scripts/eval.ts</code>.{" "}
        <T>Live model status:</T> <Link href="/api/health/ai" className="text-amber underline">/api/health/ai</Link>.{" "}
        <T>Whatever the classifier says, dispatch and price are decided by fixed rules, and an unclear description is sent a general mechanic with a full tool kit.</T>
      </p>
    </main>
  );
}
