import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * Voice layer on top of the existing triage. Two modes:
 *  - listen: base64 16 kHz WAV -> Bhashini ASR -> Qwen (Ollama) -> English problem statement
 *    that the client drops into the symptom field, which drives the normal /api/triage flow.
 *  - speak:  the triage result -> Qwen phrases it in the driver's language -> Bhashini TTS.
 * Qwen never diagnoses; it only translates/condenses around the existing triage.
 */

const LANGS = { en: "English", te: "Telugu", ta: "Tamil", hi: "Hindi" } as const;
type Lang = keyof typeof LANGS;

const BHASHINI_CONFIG_URL =
  process.env.BHASHINI_CONFIG_URL ?? "https://meity-auth.ulcacontrib.org/ulca/apis/v0/model/getModelsPipeline";
const BHASHINI_PIPELINE_ID = process.env.BHASHINI_PIPELINE_ID ?? "64392f96daac500b55c543cd";
const OLLAMA_URL = process.env.OLLAMA_URL ?? "http://127.0.0.1:11434";
const OLLAMA_MODEL = process.env.OLLAMA_MODEL ?? "qwen2.5:3b";

class VoiceError extends Error {
  constructor(message: string, public status = 502) { super(message); }
}

interface Pipeline { url: string; header: Record<string, string>; serviceId: string }
// ponytail: in-memory cache per server instance; fine since Bhashini config rarely changes.
const pipelines = new Map<string, Pipeline>();

async function bhashiniPipeline(task: "asr" | "tts", lang: Lang): Promise<Pipeline> {
  const key = `${task}:${lang}`;
  const hit = pipelines.get(key);
  if (hit) return hit;
  const userId = process.env.BHASHINI_USER_ID;
  const apiKey = process.env.BHASHINI_API_KEY;
  if (!userId || !apiKey) {
    throw new VoiceError("Voice is not configured: set BHASHINI_USER_ID and BHASHINI_API_KEY in .env.local", 503);
  }
  const res = await fetch(BHASHINI_CONFIG_URL, {
    method: "POST",
    headers: { "content-type": "application/json", userID: userId, ulcaApiKey: apiKey },
    body: JSON.stringify({
      pipelineTasks: [{ taskType: task, config: { language: { sourceLanguage: lang } } }],
      pipelineRequestConfig: { pipelineId: BHASHINI_PIPELINE_ID },
    }),
  });
  if (!res.ok) throw new VoiceError(`Bhashini config failed (${res.status})`);
  const data = await res.json();
  const ep = data.pipelineInferenceAPIEndPoint;
  const serviceId = data.pipelineResponseConfig?.[0]?.config?.[0]?.serviceId;
  if (!ep?.callbackUrl || !serviceId) throw new VoiceError(`Bhashini has no ${task} model for ${LANGS[lang]}`);
  const p = { url: ep.callbackUrl, header: { [ep.inferenceApiKey.name]: ep.inferenceApiKey.value }, serviceId };
  pipelines.set(key, p);
  return p;
}

async function bhashini(task: "asr" | "tts", lang: Lang, config: object, inputData: object) {
  const p = await bhashiniPipeline(task, lang);
  const res = await fetch(p.url, {
    method: "POST",
    headers: { "content-type": "application/json", ...p.header },
    body: JSON.stringify({
      pipelineTasks: [{ taskType: task, config: { language: { sourceLanguage: lang }, serviceId: p.serviceId, ...config } }],
      inputData,
    }),
    signal: AbortSignal.timeout(20000),
  });
  if (!res.ok) throw new VoiceError(`Bhashini ${task.toUpperCase()} failed (${res.status})`);
  return (await res.json()).pipelineResponse?.[0];
}

async function qwen(system: string, user: string): Promise<Record<string, string>> {
  let res: Response;
  try {
    res = await fetch(`${OLLAMA_URL}/api/chat`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        model: OLLAMA_MODEL,
        stream: false,
        format: "json",
        options: { temperature: 0.2 },
        messages: [{ role: "system", content: system }, { role: "user", content: user }],
      }),
      signal: AbortSignal.timeout(30000),
    });
  } catch {
    throw new VoiceError(`Cannot reach Ollama at ${OLLAMA_URL}. Is "ollama serve" running?`, 503);
  }
  if (!res.ok) throw new VoiceError(`Ollama error (${res.status}). Did you run "ollama pull ${OLLAMA_MODEL}"?`, 503);
  try {
    return JSON.parse((await res.json()).message?.content ?? "{}");
  } catch {
    throw new VoiceError("Qwen returned an unreadable answer");
  }
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const lang = body.lang as Lang;
  if (!(lang in LANGS)) return NextResponse.json({ error: "Unsupported language" }, { status: 400 });

  try {
    if (body.mode === "listen") {
      if (typeof body.audio !== "string" || !body.audio) {
        return NextResponse.json({ error: "No audio received" }, { status: 400 });
      }
      const out = await bhashini("asr", lang, { audioFormat: "wav", samplingRate: 16000 }, {
        audio: [{ audioContent: body.audio }],
      });
      const transcript: string = out?.output?.[0]?.source?.trim() ?? "";
      if (!transcript) return NextResponse.json({ error: "Could not hear anything. Please try again." }, { status: 422 });

      const q = await qwen(
        `You help stranded drivers on Indian highways. The driver spoke in ${LANGS[lang]}. ` +
          `Rewrite what they said as one short plain-English description of the vehicle problem and who is with them, ` +
          `keeping every symptom they mentioned. Do not diagnose or add facts. ` +
          `Reply as JSON: {"symptomText": "..."}`,
        transcript,
      );
      return NextResponse.json({ transcript, symptomText: q.symptomText?.trim() || transcript });
    }

    if (body.mode === "speak") {
      const facts = String(body.facts ?? "").slice(0, 2000);
      if (!facts) return NextResponse.json({ error: "Nothing to speak" }, { status: 400 });
      const q = await qwen(
        `You are RoadSathi's calm voice assistant. Turn these triage facts into 2-3 short spoken sentences ` +
          `in ${LANGS[lang]} (native script). Keep the safety advice. Do not add new diagnosis. ` +
          `Reply as JSON: {"reply": "..."}`,
        facts,
      );
      const reply = q.reply?.trim();
      if (!reply) throw new VoiceError("Qwen returned an empty reply");
      const out = await bhashini("tts", lang, { gender: "female", samplingRate: 22050 }, { input: [{ source: reply }] });
      return NextResponse.json({ reply, audio: out?.audio?.[0]?.audioContent ?? null });
    }

    return NextResponse.json({ error: "mode must be listen or speak" }, { status: 400 });
  } catch (e) {
    const err = e instanceof VoiceError ? e : new VoiceError("Voice service unavailable");
    return NextResponse.json({ error: err.message }, { status: err.status });
  }
}
