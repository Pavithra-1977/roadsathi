"use client";

import { useRef, useState } from "react";

const LANGS = [
  { code: "en", label: "English" },
  { code: "te", label: "తెలుగు" },
  { code: "ta", label: "தமிழ்" },
  { code: "hi", label: "हिंदी" },
];

type Phase = "idle" | "recording" | "thinking" | "speaking";

/**
 * Mic -> /api/voice (listen) -> onUnderstood (existing triage) -> /api/voice (speak) -> playback.
 * onUnderstood fills the symptom field, runs triage and returns the facts to read back.
 */
export default function VoiceAssistant({
  onUnderstood,
}: {
  onUnderstood: (symptomText: string) => Promise<string | null>;
}) {
  const [lang, setLang] = useState("en");
  const [phase, setPhase] = useState<Phase>("idle");
  const [transcript, setTranscript] = useState("");
  const [reply, setReply] = useState("");
  const [error, setError] = useState<string | null>(null);
  const recorder = useRef<MediaRecorder | null>(null);

  async function start() {
    setError(null);
    setReply("");
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      return setError("Microphone blocked. Allow mic access or type the problem instead.");
    }
    const chunks: Blob[] = [];
    const rec = new MediaRecorder(stream);
    rec.ondataavailable = (e) => chunks.push(e.data);
    rec.onstop = () => {
      stream.getTracks().forEach((t) => t.stop());
      run(new Blob(chunks, { type: rec.mimeType }));
    };
    rec.start();
    recorder.current = rec;
    setPhase("recording");
  }

  async function run(blob: Blob) {
    setPhase("thinking");
    try {
      const heard = await post({ mode: "listen", lang, audio: await toWav16k(blob) });
      setTranscript(heard.transcript);
      const facts = await onUnderstood(heard.symptomText);
      if (!facts) return setPhase("idle");
      const spoken = await post({ mode: "speak", lang, facts });
      setReply(spoken.reply);
      if (spoken.audio) {
        setPhase("speaking");
        const audio = new Audio(`data:audio/wav;base64,${spoken.audio}`);
        audio.onended = () => setPhase("idle");
        await audio.play();
        return;
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Voice assistant failed");
    }
    setPhase("idle");
  }

  const busy = phase === "thinking" || phase === "speaking";

  return (
    <div className="rounded-xl border border-edge bg-panel2 p-3">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => (phase === "recording" ? recorder.current?.stop() : start())}
          disabled={busy}
          aria-label={phase === "recording" ? "Stop recording" : "Speak your problem"}
          className={`relative grid h-12 w-12 shrink-0 place-items-center rounded-full text-xl text-white transition disabled:opacity-50 ${
            phase === "recording" ? "bg-sos" : "bg-amber"
          }`}
        >
          {phase === "recording" && <span className="sos-ring" />}
          {phase === "recording" ? "■" : "🎙️"}
        </button>
        <div className="min-w-0 flex-1 text-sm">
          <div className="font-semibold">
            {phase === "idle" && "Tap and describe the problem"}
            {phase === "recording" && "Listening… tap to stop"}
            {phase === "thinking" && "Understanding…"}
            {phase === "speaking" && "Speaking…"}
          </div>
          <div className="truncate text-xs text-muted">
            {transcript ? `You said: ${transcript}` : "English, Telugu, Tamil or Hindi"}
          </div>
        </div>
        <select
          className="input !w-28 shrink-0 py-2"
          value={lang}
          onChange={(e) => setLang(e.target.value)}
          disabled={phase !== "idle"}
          aria-label="Voice language"
        >
          {LANGS.map((l) => <option key={l.code} value={l.code}>{l.label}</option>)}
        </select>
      </div>
      {reply && <p className="mt-2 text-xs text-muted">🔊 {reply}</p>}
      {error && <p className="mt-2 text-xs text-sos">{error}</p>}
    </div>
  );
}

async function post(body: object) {
  const res = await fetch("/api/voice", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? `Voice request failed (${res.status})`);
  return data;
}

/** Browser recording (webm/ogg) -> 16 kHz mono 16-bit WAV, base64, which Bhashini ASR accepts. */
async function toWav16k(blob: Blob): Promise<string> {
  const ctx = new AudioContext();
  const decoded = await ctx.decodeAudioData(await blob.arrayBuffer());
  await ctx.close();
  const rate = 16000;
  const offline = new OfflineAudioContext(1, Math.ceil(decoded.duration * rate), rate);
  const src = offline.createBufferSource();
  src.buffer = decoded;
  src.connect(offline.destination);
  src.start();
  const pcm = (await offline.startRendering()).getChannelData(0);

  const view = new DataView(new ArrayBuffer(44 + pcm.length * 2));
  const str = (o: number, s: string) => [...s].forEach((c, i) => view.setUint8(o + i, c.charCodeAt(0)));
  str(0, "RIFF"); view.setUint32(4, 36 + pcm.length * 2, true); str(8, "WAVE");
  str(12, "fmt "); view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, 1, true);
  view.setUint32(24, rate, true); view.setUint32(28, rate * 2, true); view.setUint16(32, 2, true); view.setUint16(34, 16, true);
  str(36, "data"); view.setUint32(40, pcm.length * 2, true);
  pcm.forEach((s, i) => view.setInt16(44 + i * 2, Math.max(-1, Math.min(1, s)) * 0x7fff, true));

  const bytes = new Uint8Array(view.buffer);
  let bin = "";
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin);
}
