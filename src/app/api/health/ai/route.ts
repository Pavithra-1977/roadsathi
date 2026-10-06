import { NextResponse } from "next/server";
import rawIndex from "../../../../../data/index.json";
import { DEFAULT_HF_MODEL } from "@/lib/agent/graph";
import { embed, embedModel } from "@/lib/rag/embed";
import type { KbIndex } from "@/lib/rag/retriever";

export const dynamic = "force-dynamic";

const TIMEOUT_MS = 4000;

interface Check {
  status: "up" | "down" | "skipped";
  latencyMs: number | null;
  error?: string;
}

async function timed(run: () => Promise<unknown>): Promise<Check> {
  const t0 = Date.now();
  try {
    await run();
    return { status: "up", latencyMs: Date.now() - t0 };
  } catch (e) {
    return { status: "down", latencyMs: Date.now() - t0, error: (e as Error).message.slice(0, 160) };
  }
}

/**
 * AI health: pings the HF embedding and chat endpoints (4 s each) and reports
 * which models are configured. Reports only WHETHER a key is set, never its value.
 */
export async function GET() {
  const key = process.env.HUGGINGFACE_API_KEY;
  const chatModel = process.env.HF_MODEL || DEFAULT_HF_MODEL;
  const index = rawIndex as unknown as KbIndex;
  const skipped: Check = { status: "skipped", latencyMs: null, error: "HUGGINGFACE_API_KEY not set" };

  const [embedding, chat] = key
    ? await Promise.all([
        timed(() => embed(["gaadi garam ho gayi"], "query", { timeoutMs: TIMEOUT_MS })),
        timed(async () => {
          const res = await fetch("https://router.huggingface.co/v1/chat/completions", {
            method: "POST",
            cache: "no-store",
            signal: AbortSignal.timeout(TIMEOUT_MS),
            headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
            body: JSON.stringify({ model: chatModel, max_tokens: 8, messages: [{ role: "user", content: "Reply OK" }] }),
          });
          if (!res.ok) throw new Error(`HTTP ${res.status}: ${(await res.text()).slice(0, 120)}`);
        }),
      ])
    : [skipped, skipped];

  const indexEmbedded = index.chunks.length > 0 && index.chunks.every((c) => c.embedding);
  return NextResponse.json({
    at: new Date().toISOString(),
    hasApiKey: Boolean(key),
    models: { chat: chatModel, embedding: embedModel(), index: index.model },
    index: {
      chunks: index.chunks.length,
      embedded: indexEmbedded,
      // Query and document vectors are only comparable if built with the same model.
      modelMatches: index.model === embedModel(),
      builtAt: index.builtAt,
    },
    retrieval: key && indexEmbedded && index.model === embedModel() ? "embedding" : "keyword",
    embedding,
    chat,
  });
}
