/**
 * Hugging Face Inference embeddings (feature-extraction pipeline on the HF router).
 * Shared by scripts/build-index.ts (documents) and the runtime retriever (query only).
 */

export const DEFAULT_EMBED_MODEL = "intfloat/multilingual-e5-small";

export function embedModel(): string {
  return process.env.HF_EMBED_MODEL || DEFAULT_EMBED_MODEL;
}

/** E5 models are trained with "query: " / "passage: " prefixes. */
function prefix(model: string, kind: "query" | "passage"): string {
  return /(^|\/)(multilingual-)?e5/i.test(model) ? `${kind}: ` : "";
}

export async function embed(
  texts: string[],
  kind: "query" | "passage",
  { model = embedModel(), timeoutMs = 4000 }: { model?: string; timeoutMs?: number } = {}
): Promise<number[][]> {
  const token = process.env.HUGGINGFACE_API_KEY;
  if (!token) throw new Error("HUGGINGFACE_API_KEY not set");

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(
      `https://router.huggingface.co/hf-inference/models/${model}/pipeline/feature-extraction`,
      {
        method: "POST",
        signal: ctrl.signal,
        cache: "no-store",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ inputs: texts.map((t) => prefix(model, kind) + t), normalize: true }),
      }
    );
    if (!res.ok) throw new Error(`HF embeddings HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`);
    const out = (await res.json()) as number[][];
    if (!Array.isArray(out) || out.length !== texts.length || !Array.isArray(out[0])) {
      throw new Error("Unexpected embedding response shape");
    }
    return out;
  } finally {
    clearTimeout(timer);
  }
}
