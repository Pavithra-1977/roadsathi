"use client";

import { useEffect, useRef, useState } from "react";
import { LANGS, LanguageSelect, useLang, useT, type Lang } from "@/lib/i18n";
import type { Severity, TriageResult } from "@/lib/types";

/**
 * Spoken reply built from the triage result. Fixed phrases per language: no translation
 * service is used, so the fault name stays as the triage returned it.
 */
const PHRASES: Record<Lang, {
  severity: Record<Severity, string>;
  problem: (fault: string, sev: string) => string;
  safety: (advice: string[]) => string;
  eta: (min: number) => string;
  fixable: string;
  notFixable: string;
  send: string;
}> = {
  en: {
    severity: { low: "low", medium: "medium", high: "high", critical: "critical" },
    problem: (f, s) => `Problem: ${f}. Severity: ${s}.`,
    safety: (a) => `Do this now: ${a.slice(0, 2).join(" ")}`,
    eta: (m) => `The nearest mechanic can reach you in about ${m} minutes.`,
    fixable: "Usually fixable at the roadside.",
    notFixable: "Usually not fixable at the roadside; a Plan B will be arranged.",
    send: "Send the SOS to dispatch a mechanic.",
  },
  ta: {
    severity: { low: "குறைவு", medium: "நடுத்தரம்", high: "அதிகம்", critical: "மிக அதிகம்" },
    problem: (f, s) => `பிரச்சனை: ${f}. தீவிரம்: ${s}.`,
    safety: () => "அபாய விளக்குகளை இயக்கி, வாகனத்திலிருந்து விலகி பாதுகாப்பான இடத்தில் இருங்கள்.",
    eta: (m) => `அருகிலுள்ள மெக்கானிக் சுமார் ${m} நிமிடங்களில் வந்து சேர முடியும்.`,
    fixable: "பொதுவாக சாலையோரத்திலேயே சரிசெய்யலாம்.",
    notFixable: "பொதுவாக சாலையோரத்தில் சரிசெய்ய முடியாது; மாற்று ஏற்பாடு செய்யப்படும்.",
    send: "மெக்கானிக்கை அனுப்ப SOS அனுப்புங்கள்.",
  },
  te: {
    severity: { low: "తక్కువ", medium: "మధ్యస్థం", high: "ఎక్కువ", critical: "చాలా ఎక్కువ" },
    problem: (f, s) => `సమస్య: ${f}. తీవ్రత: ${s}.`,
    safety: () => "హజార్డ్ లైట్లు ఆన్ చేసి, వాహనానికి దూరంగా సురక్షితమైన చోట ఉండండి.",
    eta: (m) => `దగ్గరలోని మెకానిక్ సుమారు ${m} నిమిషాల్లో చేరుకోగలరు.`,
    fixable: "సాధారణంగా రోడ్డు పక్కనే బాగుచేయవచ్చు.",
    notFixable: "సాధారణంగా రోడ్డు పక్కన బాగుచేయలేరు; ప్రత్యామ్నాయ ఏర్పాటు చేయబడుతుంది.",
    send: "మెకానిక్‌ను పంపడానికి SOS పంపండి.",
  },
  hi: {
    severity: { low: "कम", medium: "मध्यम", high: "गंभीर", critical: "बहुत गंभीर" },
    problem: (f, s) => `समस्या: ${f}। गंभीरता: ${s}।`,
    safety: () => "हैज़र्ड लाइट चालू करें और गाड़ी से दूर किसी सुरक्षित जगह पर रहें।",
    eta: (m) => `नज़दीकी मैकेनिक लगभग ${m} मिनट में पहुँच सकता है।`,
    fixable: "आमतौर पर सड़क किनारे ही ठीक हो जाता है।",
    notFixable: "आमतौर पर सड़क किनारे ठीक नहीं होता; दूसरी व्यवस्था की जाएगी।",
    send: "मैकेनिक बुलाने के लिए SOS भेजें।",
  },
};

function replyText(code: Lang, t: TriageResult, eta: number | null) {
  const p = PHRASES[code];
  return [
    p.problem(t.faultLabel, p.severity[t.severity]),
    p.safety(t.safetyAdvice),
    eta != null ? p.eta(eta) : "",
    t.roadsideFixable ? p.fixable : p.notFixable,
    p.send,
  ].filter(Boolean).join(" ");
}

/** Chrome fills getVoices() asynchronously; wait (briefly) for the list before choosing one. */
function loadVoices(synth: SpeechSynthesis): Promise<SpeechSynthesisVoice[]> {
  const now = synth.getVoices();
  if (now.length) return Promise.resolve(now);
  return new Promise((resolve) => {
    const done = () => { synth.removeEventListener("voiceschanged", done); resolve(synth.getVoices()); };
    synth.addEventListener("voiceschanged", done);
    setTimeout(done, 1500);
  });
}

type Phase = "idle" | "listening" | "thinking" | "speaking";

// Minimal typing for the Web Speech recognition API (not in TypeScript's DOM lib).
interface Recognition {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  onresult: ((e: { results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }> }) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
}
type RecognitionCtor = new () => Recognition;

function recognitionCtor(): RecognitionCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { SpeechRecognition?: RecognitionCtor; webkitSpeechRecognition?: RecognitionCtor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

const MIC_ERRORS: Record<string, string> = {
  "not-allowed": "Microphone blocked. Allow mic access, or type below.",
  "service-not-allowed": "Microphone blocked. Allow mic access, or type below.",
  "no-speech": "Didn't catch that. Tap the mic and try again.",
  "audio-capture": "No microphone found. Type below instead.",
  network: "The browser's speech service is unreachable. Type below instead.",
  "language-not-supported": "This browser can't recognise that language. Type below instead.",
};

/**
 * Browser speech only: SpeechRecognition -> Problem field + existing /api/triage (via onTriage)
 * -> reply text in the app language -> speechSynthesis. Every failure degrades to text;
 * nothing here can block the SOS button, which lives outside this component.
 */
export default function VoiceAssistant({
  onTriage,
}: {
  onTriage: (text: string, agent: boolean) => Promise<{ triage: TriageResult; eta: number | null }>;
}) {
  const t = useT();
  const { lang: code } = useLang();
  const lang = LANGS.find((l) => l.code === code) ?? LANGS[0];
  const [phase, setPhase] = useState<Phase>("idle");
  const [support, setSupport] = useState({ stt: false, tts: false });
  const [heard, setHeard] = useState("");
  const [draft, setDraft] = useState("");
  const [reply, setReply] = useState("");
  const [note, setNote] = useState<{ text: string; vars?: Record<string, string> } | null>(null);
  const rec = useRef<Recognition | null>(null);
  const runId = useRef(0);
  // Chrome can drop utterances that are only referenced by the speech queue; keep them alive.
  const speaking = useRef<SpeechSynthesisUtterance[]>([]);

  // Detect after mount only: window does not exist during server rendering.
  useEffect(() => {
    setSupport({ stt: !!recognitionCtor(), tts: "speechSynthesis" in window });
    if ("speechSynthesis" in window) window.speechSynthesis.getVoices(); // start Chrome's lazy voice load
    return () => {
      rec.current?.abort();
      if ("speechSynthesis" in window) window.speechSynthesis.cancel();
    };
  }, []);

  function listen() {
    const Ctor = recognitionCtor();
    if (!Ctor) return setNote({ text: "Voice input isn't supported in this browser. Type below instead." });
    setNote(null);
    setReply("");
    setHeard("");
    let latest = ""; // last transcript, final or not: Chrome may end without marking it final
    try {
      const r = new Ctor();
      r.lang = lang.bcp;
      r.interimResults = true;
      r.continuous = false;
      r.onresult = (e) => {
        latest = Array.from(e.results, (res) => res[0].transcript).join("");
        setHeard(latest);
      };
      r.onerror = (e) => {
        if (e.error !== "aborted") setNote({ text: MIC_ERRORS[e.error] ?? "Voice input failed. Try again or type below." });
      };
      r.onend = () => {
        rec.current = null;
        if (latest.trim()) run(latest.trim());
        else setPhase((p) => (p === "listening" ? "idle" : p));
      };
      rec.current = r;
      r.start();
      setPhase("listening");
    } catch {
      setNote({ text: "Voice input failed to start. Try again or type below." });
      setPhase("idle");
    }
  }

  function stop() {
    // While listening, stop() (not abort) so the browser still delivers what it heard.
    if (phase === "listening" && rec.current) return rec.current.stop();
    runId.current++; // ignore any answer still on its way
    if (support.tts) window.speechSynthesis.cancel();
    setPhase("idle");
  }

  async function run(text: string) {
    const id = ++runId.current;
    setHeard(text);
    setReply("");
    setNote(null);
    setPhase("thinking");
    try {
      const { triage, eta } = await onTriage(text, lang.code !== "en");
      if (id !== runId.current) return;
      const answer = replyText(lang.code, triage, eta);
      setReply(answer);
      await speak(answer, id);
    } catch (e) {
      if (id !== runId.current) return;
      setNote({ text: e instanceof Error ? e.message : "Triage failed. You can still send the SOS." });
      setPhase("idle");
    }
  }

  async function speak(text: string, id: number) {
    if (!support.tts) {
      setNote({ text: "Spoken replies aren't supported in this browser; the answer is shown above." });
      return setPhase("idle");
    }
    try {
      const synth = window.speechSynthesis;
      const voices = await loadVoices(synth);
      if (id !== runId.current) return;
      const base = lang.code;
      const voice =
        voices.find((v) => v.lang.replace("_", "-").toLowerCase() === lang.bcp.toLowerCase()) ??
        voices.find((v) => v.lang.toLowerCase().startsWith(base));
      if (!voice && base !== "en") {
        setNote({ text: "No {language} voice is installed in this browser, so it may not be read aloud. The answer is shown above.", vars: { language: lang.label } });
      }

      // One utterance per sentence: Chrome stops long utterances after ~15 s.
      const parts = text.match(/[^.!?।]+[.!?।]?/g)?.map((p) => p.trim()).filter(Boolean) ?? [text];
      const queue = parts.map((p) => {
        const u = new SpeechSynthesisUtterance(p);
        u.lang = lang.bcp;
        if (voice) u.voice = voice;
        u.onerror = (e) => {
          if (e.error === "interrupted" || e.error === "canceled") return;
          setNote({ text: "Couldn't play the spoken reply ({error}). The answer is shown above.", vars: { error: e.error } });
          setPhase("idle");
        };
        return u;
      });
      queue[queue.length - 1].onend = () => setPhase((p) => (p === "speaking" ? "idle" : p));
      speaking.current = queue;

      synth.cancel();
      setPhase("speaking");
      // Chrome silently drops speak() calls made in the same tick as cancel().
      setTimeout(() => {
        if (id !== runId.current) return;
        synth.resume();
        queue.forEach((u) => synth.speak(u));
      }, 150);
    } catch {
      setPhase("idle"); // the reply is already on screen
    }
  }

  const busy = phase !== "idle";

  return (
    <div className="rounded-xl border border-edge bg-panel2 p-3">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={busy ? stop : listen}
          disabled={!support.stt && !busy}
          aria-label={busy ? "Stop" : "Speak your problem"}
          className={`relative grid h-12 w-12 shrink-0 place-items-center rounded-full text-xl text-white transition disabled:opacity-40 ${
            busy ? "bg-sos" : "bg-amber"
          }`}
        >
          {phase === "listening" && <span className="sos-ring" />}
          {busy ? "■" : "🎙️"}
        </button>
        <div className="min-w-0 flex-1 text-sm">
          <div className="font-semibold">
            {phase === "idle" && t(support.stt ? "Tap and describe the problem" : "Type the problem below")}
            {phase === "listening" && t("Listening… tap to finish")}
            {phase === "thinking" && t("Checking the problem…")}
            {phase === "speaking" && t("Speaking… tap to stop")}
          </div>
          <div className="truncate text-xs text-muted">
            {heard ? `${t("You said:")} ${heard}` : t("Voice assistant · English, Tamil, Telugu, Hindi")}
          </div>
        </div>
        <LanguageSelect className="input !w-28 shrink-0 py-2" />
      </div>

      <form
        className="mt-3 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (draft.trim() && !busy) { run(draft.trim()); setDraft(""); }
        }}
      >
        <input
          className="input py-2"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder={t("Or type to the assistant ({language})", { language: lang.label })}
          aria-label="Type to the voice assistant"
        />
        <button type="submit" disabled={busy || !draft.trim()} className="btn-ghost shrink-0 px-3 py-2">{t("Ask")}</button>
      </form>

      {reply && <p className="mt-2 text-sm">🔊 {reply}</p>}
      {note && <p className="mt-2 text-xs text-sos">{t(note.text, note.vars)}</p>}
    </div>
  );
}
