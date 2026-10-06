/**
 * Builds data/index.json from data/kb/*.md.
 *
 *   npx tsx scripts/build-index.ts
 *
 * Chunks every guide (~500 chars, 80 overlap) and embeds the chunks once with
 * HF_EMBED_MODEL through HF Inference. The output is committed, so the app
 * never embeds documents at runtime - only the user's query.
 *
 * Without HUGGINGFACE_API_KEY the chunks are written without embeddings and the
 * retriever uses keyword search only.
 */
import { existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";
import { embed, embedModel } from "../src/lib/rag/embed";
import type { KbIndex } from "../src/lib/rag/retriever";

const ROOT = join(__dirname, "..");
for (const f of [".env.local", ".env"]) {
  if (existsSync(join(ROOT, f))) process.loadEnvFile(join(ROOT, f));
}

function parse(md: string): { meta: Record<string, string>; body: string } {
  const m = md.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/);
  if (!m) throw new Error("missing frontmatter");
  const meta = Object.fromEntries(
    m[1].split(/\r?\n/).map((l) => {
      const i = l.indexOf(":");
      return [l.slice(0, i).trim(), l.slice(i + 1).trim()];
    })
  );
  return { meta, body: m[2].trim() };
}

async function main() {
  const dir = join(ROOT, "data", "kb");
  const splitter = new RecursiveCharacterTextSplitter({ chunkSize: 500, chunkOverlap: 80 });
  const chunks: KbIndex["chunks"] = [];

  for (const file of readdirSync(dir).filter((f) => f.endsWith(".md")).sort()) {
    const { meta, body } = parse(readFileSync(join(dir, file), "utf8"));
    if (!meta.id || !meta.title || !meta.category) throw new Error(`${file}: frontmatter needs id, title, category`);
    const parts = await splitter.splitText(body);
    parts.forEach((text, i) =>
      chunks.push({ id: `${meta.id}#${i}`, docId: meta.id, title: meta.title, category: meta.category, text })
    );
  }

  const model = embedModel();
  let embedded = false;
  if (process.env.HUGGINGFACE_API_KEY) {
    // Small batches keep each request well inside the free tier's limits.
    for (let i = 0; i < chunks.length; i += 16) {
      const batch = chunks.slice(i, i + 16);
      // Title is prepended so short chunks still carry their topic.
      const vecs = await embed(batch.map((c) => `${c.title}. ${c.text}`), "passage", { model, timeoutMs: 60_000 });
      batch.forEach((c, j) => (c.embedding = vecs[j].map((v) => Number(v.toFixed(5)))));
      process.stdout.write(`embedded ${Math.min(i + 16, chunks.length)}/${chunks.length}\r`);
    }
    embedded = true;
  } else {
    console.warn("HUGGINGFACE_API_KEY not set: writing chunks WITHOUT embeddings (keyword retrieval only).");
  }

  const index: KbIndex = {
    source: "RoadSathi guide (self-written)",
    model: embedded ? model : null,
    dim: embedded ? chunks[0].embedding!.length : null,
    builtAt: new Date().toISOString(),
    chunks,
  };
  writeFileSync(join(ROOT, "data", "index.json"), JSON.stringify(index));
  console.log(`\nwrote data/index.json: ${chunks.length} chunks from ${new Set(chunks.map((c) => c.docId)).size} docs, model=${index.model}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
