"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useT } from "@/lib/i18n";

const CHAPTERS = [
  {
    n: "01",
    video: "/media/landing-1.mp4",
    title: "Stranded on a highway",
    accent: "with your family at night?",
    body: "RoadSathi connects you to the nearest small garage in 5 to 10 minutes. We work out what is wrong before anyone sets off, route the mechanic through a shop that has the part, and if the vehicle still cannot be fixed tonight, we get your family home safely and keep the vehicle secure.",
  },
  {
    n: "02",
    video: "/media/landing-2.mp4",
    title: "AI triage in seconds",
    body: "Describe it in your own words. We predict the fault, tell you what to do right now to stay safe, and tell the mechanic which tools and parts to bring.",
    right: true,
  },
  {
    n: "03",
    video: "/media/landing-3.mp4",
    title: "Nearest idle mechanic accepts",
    body: "Thousands of small garages within a few kilometres of the same highway sit idle. The job is routed through whichever spare parts shop stocks what is missing, so nobody arrives empty handed.",
  },
];

const STEPS = [
  {
    n: "01",
    title: "Tap SOS",
    body: "Your GPS location, vehicle and problem go out in one tap. No data connection? A plain SMS creates the same request.",
  },
  {
    n: "02",
    title: "AI triage in seconds",
    body: "Describe it in your own words. We predict the fault, tell you what to do right now to stay safe, and tell the mechanic which tools and parts to bring.",
  },
  {
    n: "03",
    title: "Nearest idle mechanic accepts",
    body: "The job is routed through whichever spare parts shop stocks what is missing, so nobody arrives empty handed.",
  },
  {
    n: "04",
    title: "Fixed, or Plan B",
    body: "If it cannot be repaired tonight, we get your family onto a verified cab, bus or train and put your vehicle into monitored overnight custody.",
  },
];

const FEATURES = [
  {
    icon: "🧠",
    title: "Fault triage before anyone moves",
    body: "A 19-fault knowledge base scores your description, including Hinglish terms drivers actually type. The mechanic leaves with the right tools the first time.",
  },
  {
    icon: "🧰",
    title: "Parts routing, not guesswork",
    body: "Shops publish live inventory. We compute the pickup route that adds the least detour, so an alternator does not turn into a two hour round trip.",
  },
  {
    icon: "🛡️",
    title: "Guardian Link",
    body: "One tap sends a live tracking page to a family member: mechanic name, photo, ID status, plate number, ETA. They watch from home.",
  },
  {
    icon: "🔢",
    title: "Arrival code handshake",
    body: "Work cannot begin until you read out a 4 digit code. It proves the person walking up in the dark is the one we dispatched.",
  },
  {
    icon: "💸",
    title: "Price locked before dispatch",
    body: "A stranded family at midnight has no bargaining power. The quote is frozen before the mechanic sets off. No surge, no renegotiation.",
  },
  {
    icon: "📈",
    title: "Idle shops get paid",
    body: "Small garages sitting empty are pushed up the dispatch queue. Existing capacity gets utilised instead of new supply being created.",
  },
];

const WHY = [
  {
    title: "Midnight changes everything",
    body: "A puncture at noon is an inconvenience. The same puncture at midnight, on an unlit stretch, with children asleep in the back, is a safety incident. Today the only options are a phone tree of numbers that do not answer and whatever price the one mechanic who does answer decides to name.",
  },
  {
    title: "The capacity already exists",
    body: "Meanwhile thousands of small garages within a few kilometres of that same highway sit idle. The capacity to solve this already exists. It is simply not connected to the people who need it, at the moment they need it.",
  },
  {
    title: "People before the vehicle",
    body: "Existing apps stop at the vehicle. They tow the metal and leave the people. RoadSathi treats the family as the thing being rescued, and the vehicle as second priority.",
  },
];

const clamp = (n: number) => Math.min(1, Math.max(0, n));

/** Runs cb once per animation frame while the page scrolls or resizes. */
function useScrollFrame(cb: () => void) {
  const latest = useRef(cb);
  latest.current = cb;
  useEffect(() => {
    let raf = 0;
    const run = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => latest.current());
    };
    run();
    window.addEventListener("scroll", run, { passive: true });
    window.addEventListener("resize", run);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("scroll", run);
      window.removeEventListener("resize", run);
    };
  }, []);
}

/** 0..1: how far a tall container with a sticky child has been scrolled through. */
function pinnedProgress(el: HTMLElement) {
  const r = el.getBoundingClientRect();
  return clamp(-r.top / (r.height - window.innerHeight));
}

/** True while the element is on screen (IntersectionObserver). */
function useOnScreen(ref: React.RefObject<Element>, threshold = 0) {
  const [on, setOn] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => setOn(e.isIntersecting), { threshold });
    io.observe(el);
    return () => io.disconnect();
  }, [ref, threshold]);
  return on;
}

/** Fades content up the first time it scrolls into view. */
function Reveal({ children, delay = 0, className = "" }: { children: React.ReactNode; delay?: number; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [shown, setShown] = useState(false);
  const on = useOnScreen(ref, 0.2);
  useEffect(() => { if (on) setShown(true); }, [on]);
  return (
    <div
      ref={ref}
      style={{ transitionDelay: `${delay}ms` }}
      className={`transition duration-700 ease-out motion-reduce:transition-none ${
        shown ? "translate-y-0 opacity-100" : "translate-y-8 opacity-0"
      } ${className}`}
    >
      {children}
    </div>
  );
}

function Eyebrow({ children }: { children: string }) {
  return <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-amber">{useT()(children)}</div>;
}

/* ------------------------------------------------------------ pinned video story */
function Story() {
  const wrap = useRef<HTMLElement>(null);
  const bar = useRef<HTMLDivElement>(null);
  const videos = useRef<(HTMLVideoElement | null)[]>([]);
  const [active, setActive] = useState(0);
  const onScreen = useOnScreen(wrap);
  const t = useT();

  useScrollFrame(() => {
    if (!wrap.current) return;
    const p = pinnedProgress(wrap.current);
    if (bar.current) bar.current.style.transform = `scaleX(${p})`;
    setActive(Math.min(CHAPTERS.length - 1, Math.floor(p * CHAPTERS.length)));
  });

  // Only the active chapter's clip plays, and only while the story is on screen.
  useEffect(() => {
    videos.current.forEach((v, i) => {
      if (!v) return;
      if (onScreen && i === active) v.play().catch(() => { /* autoplay refused: first frame stays */ });
      else v.pause();
    });
  }, [active, onScreen]);

  return (
    <section ref={wrap} style={{ height: `${CHAPTERS.length * 100}vh` }} className="relative">
      <div className="sticky top-0 h-[100svh] overflow-hidden bg-[#0b1020]">
        {CHAPTERS.map((c, i) => (
          <video
            key={c.video}
            ref={(el) => { videos.current[i] = el; }}
            src={c.video}
            muted loop playsInline aria-hidden
            preload={i === 0 ? "auto" : "metadata"}
            className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-700 ${
              i === active ? "opacity-100" : "opacity-0"
            }`}
          />
        ))}
        <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/25 to-black/30" />

        {CHAPTERS.map((c, i) => {
          const Heading = i === 0 ? "h1" : "h2";
          return (
            <div
              key={c.n}
              aria-hidden={i !== active}
              className={`absolute inset-x-0 bottom-20 mx-auto flex max-w-6xl px-5 transition duration-700 sm:bottom-28 ${
                c.right ? "md:justify-end md:text-right" : ""
              } ${i === active ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-6 opacity-0"}`}
            >
              <div className="max-w-xl">
                <div className="text-xs font-semibold tracking-[0.2em] text-slate-300">{c.n}</div>
                <Heading className="mt-2 text-4xl font-extrabold leading-[1.05] tracking-tight text-slate-50 sm:text-6xl">
                  {t(c.title)}
                  {c.accent && (
                    <span className="block bg-gradient-to-r from-violet-300 to-orange-300 bg-clip-text text-transparent">
                      {t(c.accent)}
                    </span>
                  )}
                </Heading>
                <p className="mt-4 text-[15px] leading-relaxed text-slate-200">{t(c.body)}</p>
                {i === 0 && (
                  <div className="mt-6 flex flex-wrap gap-3">
                    <Link href="/sos" className="btn-sos rounded-full px-6 py-3">🚨 {t("Raise an SOS")}</Link>
                    <Link href="/mechanic" className="btn rounded-full border border-white/30 bg-white/10 px-6 py-3 text-slate-50 backdrop-blur hover:bg-white/20">
                      🔧 {t("I am a mechanic")}
                    </Link>
                  </div>
                )}
              </div>
            </div>
          );
        })}

        <div className="absolute bottom-8 left-1/2 h-0.5 w-40 -translate-x-1/2 overflow-hidden rounded-full bg-white/25">
          <div ref={bar} className="h-full origin-left bg-white" style={{ transform: "scaleX(0)" }} />
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------ dashboard tilting into place */
function ControlRoom() {
  const card = useRef<HTMLDivElement>(null);
  const t = useT();
  useScrollFrame(() => {
    const el = card.current;
    if (!el) return;
    const p = clamp((window.innerHeight - el.getBoundingClientRect().top) / (window.innerHeight * 0.9));
    el.style.transform = `perspective(1200px) rotateX(${(1 - p) * 28}deg) scale(${0.88 + p * 0.12})`;
    el.style.opacity = String(0.3 + p * 0.7);
  });

  const stat = "rounded-xl border border-edge bg-panel2 p-3";
  return (
    <section className="mx-auto max-w-5xl px-5 pb-10 pt-24 sm:pt-32">
      <div ref={card} className="rounded-2xl border border-edge bg-white p-3 shadow-2xl shadow-black/10 sm:p-4">
        <div className="mb-3 flex items-center gap-1.5 text-[11px] text-muted">
          <span className="h-2 w-2 rounded-full bg-edge" /><span className="h-2 w-2 rounded-full bg-edge" /><span className="h-2 w-2 rounded-full bg-edge" />
          <span className="ml-2">RoadSathi · NH-44 · KM 212 · 23:47</span>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-3">
          <div className="rounded-xl border border-sos/40 bg-sos/10 p-3">
            <div className="text-[10px] uppercase tracking-wider text-sos">{t("Triage")}</div>
            <div className="mt-0.5 text-sm font-bold">{t("Flat tyre / puncture")}</div>
            <div className="text-[11px] text-muted">{t("{n}% confidence", { n: 92 })}</div>
          </div>
          <div className={stat}>
            <div className="text-[10px] uppercase tracking-wider text-muted">Ravi Kumar · ✅ {t("verified")}</div>
            <div className="text-xl font-extrabold text-amber">{t("{n} min", { n: 7 })}</div>
          </div>
          <div className={stat}>
            <div className="text-[10px] uppercase tracking-wider text-muted">{t("Locked price")}</div>
            <div className="text-xl font-extrabold">&#8377;641</div>
          </div>
          <div className={stat}>
            <div className="text-[10px] uppercase tracking-wider text-muted">{t("Arrival code")}</div>
            <div className="text-xl font-extrabold tracking-[0.2em] text-amber">4812</div>
          </div>
        </div>
        <div className="mt-2 grid gap-2 sm:mt-3 sm:grid-cols-[1fr_1.4fr] sm:gap-3">
          <div className="rounded-xl border border-safe/40 bg-safe/10 p-3">
            <div className="text-xs font-semibold text-safe">{t("Guardian Link sent")}</div>
            <div className="text-[11px] text-muted">{t("Amma is watching this trip from home")}</div>
          </div>
          <div className="grid grid-cols-4 gap-1.5 text-center text-[10px] font-semibold sm:text-[11px]">
            {["Finding", "On the way", "On site", "Resolved"].map((s, i) => (
              <div key={s} className={`grid place-items-center rounded-lg border px-1 py-3 ${i === 1 ? "border-amber bg-amber/10 text-amber" : "border-edge text-muted"}`}>
                {t(s)}
              </div>
            ))}
          </div>
        </div>
      </div>
      <Reveal className="mt-12 text-center">
        <Eyebrow>One screen</Eyebrow>
        <h2 className="mx-auto mt-3 max-w-2xl text-3xl font-bold tracking-tight sm:text-4xl">
          {t("Triage, mechanic, locked price and family on one screen")}
        </h2>
      </Reveal>
    </section>
  );
}

/* ------------------------------------------------------------ features slide sideways while pinned */
function FeatureRail() {
  const wrap = useRef<HTMLElement>(null);
  const t = useT();
  const track = useRef<HTMLDivElement>(null);
  useScrollFrame(() => {
    const w = wrap.current, t = track.current;
    if (!w || !t?.parentElement) return;
    const visible = t.parentElement.clientWidth;
    t.style.transform = `translate3d(${-pinnedProgress(w) * Math.max(0, t.scrollWidth - visible)}px,0,0)`;
  });

  return (
    <section ref={wrap} className="relative h-[260vh]">
      <div className="sticky top-0 flex h-[100svh] flex-col justify-center overflow-hidden">
        <div className="mx-auto w-full max-w-6xl px-5">
          <Eyebrow>Features</Eyebrow>
          <h2 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">{t("What makes it different")}</h2>
          <div className="mt-10">
            <div ref={track} className="flex w-max gap-4 will-change-transform sm:gap-5">
              {FEATURES.map((f) => (
                <div key={f.title} className="w-[78vw] max-w-[340px] shrink-0 rounded-2xl border border-edge bg-white p-6 shadow-lg shadow-black/5">
                  <div className="grid h-12 w-12 place-items-center rounded-full border border-edge text-2xl">{f.icon}</div>
                  <div className="mt-4 font-bold">{t(f.title)}</div>
                  <p className="mt-1.5 text-sm leading-relaxed text-muted">{t(f.body)}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------ closing video band + auth CTA */
function FinalCta() {
  const ref = useRef<HTMLElement>(null);
  const video = useRef<HTMLVideoElement>(null);
  const onScreen = useOnScreen(ref);
  const t = useT();
  useEffect(() => {
    if (onScreen) video.current?.play().catch(() => { /* autoplay refused */ });
    else video.current?.pause();
  }, [onScreen]);

  return (
    <section ref={ref} className="relative grid min-h-[480px] place-items-center overflow-hidden bg-[#0b1020] px-5 py-24 text-center sm:min-h-[70svh]">
      <video ref={video} src="/media/landing-1.mp4" muted loop playsInline preload="none" aria-hidden className="absolute inset-0 h-full w-full object-cover" />
      <div className="absolute inset-0 bg-[#0b1020]/65" />
      <Reveal className="relative max-w-2xl">
        <h2 className="text-4xl font-extrabold tracking-tight text-slate-50 sm:text-5xl">{t("Ready when the road isn't?")}</h2>
        <p className="mx-auto mt-4 max-w-md text-[15px] leading-relaxed text-slate-200">
          {t("Create your account once. When something goes wrong on the highway, help is one tap away.")}
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Link href="/sign-up" className="btn-primary rounded-full px-7 py-3 text-base">{t("Create Account")}</Link>
          <Link href="/sign-in" className="btn rounded-full border border-white/30 bg-white/10 px-7 py-3 text-base text-slate-50 backdrop-blur hover:bg-white/20">
            {t("Sign In")}
          </Link>
        </div>
        <p className="mt-6 text-sm text-slate-300">
          {t("Stranded right now?")}{" "}
          <Link href="/sos" className="font-semibold text-slate-50 underline">{t("Raise an SOS")}</Link>, {t("no account needed.")}
        </p>
      </Reveal>
    </section>
  );
}

export default function Home() {
  const t = useT();
  return (
    <main className="overflow-x-clip">
      <Story />
      <ControlRoom />

      {/* ---------------------------------------------------------- steps */}
      <section className="mx-auto max-w-6xl px-5 py-24 sm:py-32">
        <Reveal className="text-center">
          <Eyebrow>How it works</Eyebrow>
          <h2 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">{t("From one tap to help on the way")}</h2>
        </Reveal>
        <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {STEPS.map((s, i) => (
            <Reveal key={s.n} delay={i * 150} className="rounded-2xl border border-edge bg-white p-6 shadow-sm">
              <div className="grid h-10 w-10 place-items-center rounded-full border-2 border-amber text-sm font-bold text-amber">{i + 1}</div>
              <div className="mt-4 font-bold">{t(s.title)}</div>
              <p className="mt-1.5 text-sm leading-relaxed text-muted">{t(s.body)}</p>
            </Reveal>
          ))}
        </div>
      </section>

      <FeatureRail />

      {/* ---------------------------------------------------------- numbers */}
      <section className="mx-auto max-w-5xl px-5 py-24 sm:py-32">
        <Reveal className="text-center">
          <Eyebrow>Built for the 2 a.m. breakdown</Eyebrow>
          <h2 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">{t("Measured, not promised")}</h2>
        </Reveal>
        <Reveal className="mt-10 grid grid-cols-3 divide-x divide-edge rounded-2xl border border-edge bg-white shadow-sm">
          {[
            ["5-10", "minutes to first mechanic"],
            ["100%", "quotes locked before dispatch"],
            ["0", "families left on the shoulder"],
          ].map(([v, l]) => (
            <div key={l} className="p-4 sm:p-6">
              <div className="text-2xl font-extrabold text-amber sm:text-4xl">{v}</div>
              <div className="mt-1 text-[11px] leading-tight text-muted sm:text-sm">{t(l)}</div>
            </div>
          ))}
        </Reveal>
        <p className="mt-4 text-center text-xs text-muted">
          {t("How good is the triage?")} <Link href="/evidence" className="font-semibold text-amber underline">{t("See the evidence")}</Link>
        </p>
      </section>

      {/* ---------------------------------------------------------- why */}
      <section className="mx-auto max-w-6xl px-5 pb-24 sm:pb-32">
        <Reveal className="text-center">
          <Eyebrow>Why it exists</Eyebrow>
          <h2 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">{t("Why this needs to exist")}</h2>
        </Reveal>
        <div className="mt-12 grid gap-4 md:grid-cols-3">
          {WHY.map((w, i) => (
            <Reveal key={w.title} delay={i * 150} className="rounded-2xl border border-edge border-t-amber/60 bg-white p-6 shadow-sm [border-top-width:2px]">
              <div className="font-bold">{t(w.title)}</div>
              <p className="mt-2 text-sm leading-relaxed text-muted">{t(w.body)}</p>
            </Reveal>
          ))}
        </div>
      </section>

      <FinalCta />
    </main>
  );
}
