import Link from "next/link";
import results from "../../../data/eval-results.json";
import { Stat } from "@/components/ui";

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
      <div className="text-[10px] uppercase tracking-wider text-muted">Pipeline</div>
      <h2 className="mt-1 text-lg font-bold">{p.name}</h2>
      {note && <p className="mt-1 text-xs leading-relaxed text-amber">{note}</p>}

      <div className="mt-4 grid grid-cols-2 gap-2">
        <Stat label="Accuracy" value={`${p.accuracy}%`} sub={`${p.correct} of ${n} correct`} />
        <Stat label="Top-3 accuracy" value={`${p.top3Accuracy}%`} sub={`${p.top3Correct} of ${n} in top 3`} />
      </div>

      <div className="mt-3 flex flex-wrap gap-1.5">
        {Object.entries(p.byKind).map(([k, v]) => (
          <span key={k} className="chip">{KIND_LABEL[k] ?? k}: {v}</span>
        ))}
      </div>

      <details className="mt-4">
        <summary className="cursor-pointer text-xs font-semibold text-amber">
          Show all {p.misses.length} misses
        </summary>
        <ul className="mt-2 space-y-2">
          {p.misses.map((m) => (
            <li key={m.text} className="rounded-xl border border-edge bg-panel2 p-3 text-xs">
              <div className="break-words">&quot;{m.text}&quot;</div>
              <div className="mt-1 text-[11px] text-muted">
                expected <code className="text-safe">{m.expected}</code> · got{" "}
                <code className="text-sos">{m.predicted}</code> · top 3: {m.top3.join(", ")} · {KIND_LABEL[m.kind] ?? m.kind}
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
      <h1 className="text-3xl font-extrabold tracking-tight">Evidence: how good is the triage?</h1>
      <p className="mt-2 max-w-3xl text-sm leading-relaxed text-muted">
        Every SOS is classified into one of 18 faults or &quot;unknown&quot;. This page shows how
        often that classification is right on a test set, for both the deterministic keyword
        classifier and the LangGraph + RAG pipeline.
      </p>

      <div className="mt-5 rounded-2xl border border-amber/40 bg-amber/[0.06] p-4 text-sm leading-relaxed">
        <strong className="text-amber">About this test set:</strong> {n} phrases, self-written for this
        project and labelled by hand, not collected from real drivers. They were written to describe symptoms the way a
        stranded driver might, independently of the knowledge-base keyword lists, and the knowledge
        base has not been tuned against them. It is not a real-world dataset, so treat the numbers
        as an honest smoke test, not a benchmark.
        <div className="mt-2 flex flex-wrap gap-1.5">
          {Object.entries(r.testSet.byKind).map(([k, v]) => (
            <span key={k} className="chip">{KIND_LABEL[k] ?? k}: {v}</span>
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
        Generated {new Date(r.generatedAt).toUTCString()} by <code>npx tsx scripts/eval.ts</code>.
        Live model status: <Link href="/api/health/ai" className="text-amber underline">/api/health/ai</Link>.
        Whatever the classifier says, dispatch and price are decided by fixed rules, and an
        unclear description is sent a general mechanic with a full tool kit.
      </p>
    </main>
  );
}
