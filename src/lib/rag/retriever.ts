import rawIndex from "../../../data/index.json";
import type { Citation } from "../types";
import { embed, embedModel } from "./embed";

/**
 * RAG retriever over the committed knowledge-base index (data/index.json).
 *
 * At runtime only the user's query is embedded (4 s timeout). If that fails, or
 * the index was built without embeddings / with a different model, it falls back
 * to keyword (TF-IDF) search over the same chunks. Never throws.
 */

export interface KbChunk {
  id: string;        // "<docId>#<n>"
  docId: string;
  title: string;
  category: string;
  text: string;
  embedding?: number[];
}

export interface KbIndex {
  source: string;
  model: string | null;
  dim: number | null;
  builtAt: string;
  chunks: KbChunk[];
}

export interface RetrievedChunk {
  id: string;
  docId: string;
  title: string;
  category: string;
  text: string;
  score: number;
}

export interface Retrieval {
  mode: "embedding" | "keyword";
  chunks: RetrievedChunk[];
}

export const KB_SOURCE = "RoadSathi guide (self-written)";

const index = rawIndex as unknown as KbIndex;

export function toCitation(c: RetrievedChunk): Citation {
  return {
    docTitle: c.title,
    snippet: c.text.length > 220 ? `${c.text.slice(0, 217).trimEnd()}...` : c.text,
    chunkId: c.id,
    source: KB_SOURCE,
  };
}

// ------------------------------------------------------------------ vectors
function cosine(a: number[], b: number[]): number {
  let dot = 0, na = 0, nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  return dot / (Math.sqrt(na * nb) || 1);
}

// ------------------------------------------------------------------ keywords
const STOP = new Set(
  "a an the and or of to in on at is it my me i we our you your with for from this that was are be not no but so if as by its has have had".split(" ")
);
const tokens = (s: string) =>
  s.toLowerCase().replace(/[^a-z0-9ऀ-ॿ\s]/g, " ").split(/\s+/).filter((t) => t.length > 1 && !STOP.has(t));

const docTokens = index.chunks.map((c) => tokens(`${c.title} ${c.title} ${c.text}`));
const df = new Map<string, number>();
for (const toks of docTokens) for (const t of new Set(toks)) df.set(t, (df.get(t) ?? 0) + 1);

/** First chunk of a guide, by doc id (e.g. "when-not-to-repair"). */
export function guideChunk(docId: string): RetrievedChunk | null {
  const c = index.chunks.find((x) => x.docId === docId);
  return c ? { id: c.id, docId: c.docId, title: c.title, category: c.category, text: c.text, score: 1 } : null;
}

const KEYWORD_MIN_SCORE = 7;

export function keywordSearch(query: string, k = 4): RetrievedChunk[] {
  const q = new Set(tokens(query));
  const N = index.chunks.length;
  const scored = index.chunks.map((c, i) => {
    let s = 0;
    for (const t of q) {
      const tf = docTokens[i].filter((x) => x === t).length;
      if (tf) s += (1 + Math.log(tf)) * Math.log(1 + N / (df.get(t) ?? 1));
    }
    return { c, s };
  });
  const max = Math.max(...scored.map((x) => x.s), 1e-9);
  // Relevance floor, tuned on sample queries: a vague "something is wrong"
  // tops out ~6 on incidental words; real matches score 10-30.
  const floor = Math.max(KEYWORD_MIN_SCORE, max / 3);
  return pick(scored.filter((x) => x.s >= floor).map((x) => ({ c: x.c, s: x.s / max })), k);
}

/** Top k, at most one chunk per document so citations are not repetitive. */
function pick(scored: { c: KbChunk; s: number }[], k: number): RetrievedChunk[] {
  const seen = new Set<string>();
  const out: RetrievedChunk[] = [];
  for (const { c, s } of scored.sort((a, b) => b.s - a.s)) {
    if (seen.has(c.docId)) continue;
    seen.add(c.docId);
    out.push({ id: c.id, docId: c.docId, title: c.title, category: c.category, text: c.text, score: Number(s.toFixed(3)) });
    if (out.length === k) break;
  }
  return out;
}

export async function retrieve(query: string, k = 4, timeoutMs = 4000): Promise<Retrieval> {
  const canEmbed =
    Boolean(process.env.HUGGINGFACE_API_KEY) &&
    index.model === embedModel() &&
    index.chunks.every((c) => c.embedding);
  if (canEmbed) {
    try {
      const [q] = await embed([query], "query", { timeoutMs });
      return {
        mode: "embedding",
        chunks: pick(index.chunks.map((c) => ({ c, s: cosine(q, c.embedding!) })), k),
      };
    } catch {
      /* fall through to keyword search */
    }
  }
  return { mode: "keyword", chunks: keywordSearch(query, k) };
}
