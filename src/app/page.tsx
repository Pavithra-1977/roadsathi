import Link from "next/link";

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

export default function Home() {
  return (
    <main className="mx-auto max-w-7xl px-4 pb-10">
      {/* ---------------------------------------------------------- hero */}
      <section className="grid items-center gap-10 py-14 md:grid-cols-2 md:py-20">
        <div className="animate-rise">
          <span className="chip mb-5 border-sos/40 bg-sos/10 text-sos">
            <span className="h-1.5 w-1.5 rounded-full bg-sos" />
            Built for the 2 a.m. breakdown
          </span>

          <h1 className="text-4xl font-extrabold leading-[1.08] tracking-tight sm:text-5xl lg:text-6xl">
            Stranded on a highway
            <span className="block bg-gradient-to-r from-amber to-orange-400 bg-clip-text text-transparent">
              with your family at night?
            </span>
          </h1>

          <p className="mt-5 max-w-xl text-[15px] leading-relaxed text-muted">
            RoadSathi connects you to the nearest small garage in{" "}
            <span className="font-semibold text-white">5 to 10 minutes</span>. We work out
            what is wrong before anyone sets off, route the mechanic through a shop that
            has the part, and if the vehicle still cannot be fixed tonight, we get your
            family home safely and keep the vehicle secure.
          </p>

          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/sos" className="btn-sos px-6 py-3.5 text-base">
              🚨 Raise an SOS
            </Link>
            <Link href="/mechanic" className="btn-ghost px-6 py-3.5 text-base">
              🔧 I am a mechanic
            </Link>
          </div>

          <div className="mt-9 grid max-w-lg grid-cols-3 gap-3">
            <div className="stat">
              <div className="text-2xl font-extrabold text-amber">5-10</div>
              <div className="text-[11px] leading-tight text-muted">minutes to first mechanic</div>
            </div>
            <div className="stat">
              <div className="text-2xl font-extrabold text-safe">100%</div>
              <div className="text-[11px] leading-tight text-muted">quotes locked before dispatch</div>
            </div>
            <div className="stat">
              <div className="text-2xl font-extrabold text-white">0</div>
              <div className="text-[11px] leading-tight text-muted">families left on the shoulder</div>
            </div>
          </div>
        </div>

        {/* mock phone */}
        <div className="animate-rise justify-self-center">
          <div className="w-[300px] rounded-[2rem] border border-edge bg-panel p-3 shadow-2xl shadow-black/60">
            <div className="rounded-[1.6rem] border border-edge bg-ink p-4">
              <div className="mb-3 flex items-center justify-between text-[11px] text-muted">
                <span>23:47</span>
                <span>NH-44 · KM 212</span>
              </div>

              <div className="rounded-xl border border-sos/40 bg-sos/10 p-3">
                <div className="text-[11px] uppercase tracking-wider text-sos">Triage</div>
                <div className="mt-0.5 font-bold">Flat tyre / puncture</div>
                <div className="text-[11px] text-muted">92% confidence · roadside fixable</div>
              </div>

              <div className="mt-3 rounded-xl border border-edge bg-panel2 p-3">
                <div className="flex items-center gap-2.5">
                  <span className="grid h-9 w-9 place-items-center rounded-full bg-amber text-ink">🔧</span>
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold">Ravi Kumar</div>
                    <div className="truncate text-[11px] text-muted">
                      Sri Balaji Auto Works · ✅ verified
                    </div>
                  </div>
                  <div className="ml-auto text-right">
                    <div className="text-lg font-extrabold text-amber">7</div>
                    <div className="text-[10px] text-muted">min</div>
                  </div>
                </div>
              </div>

              <div className="mt-3 grid grid-cols-2 gap-2">
                <div className="rounded-xl border border-edge bg-panel2 p-2.5">
                  <div className="text-[10px] uppercase tracking-wider text-muted">Locked price</div>
                  <div className="font-bold">&#8377;641</div>
                </div>
                <div className="rounded-xl border border-edge bg-panel2 p-2.5">
                  <div className="text-[10px] uppercase tracking-wider text-muted">Arrival code</div>
                  <div className="font-bold tracking-[0.2em] text-amber">4 8 1 2</div>
                </div>
              </div>

              <div className="mt-3 rounded-xl border border-safe/40 bg-safe/10 p-2.5">
                <div className="text-[11px] font-semibold text-safe">Guardian Link sent</div>
                <div className="text-[10px] text-muted">
                  Amma is watching this trip from home
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ---------------------------------------------------------- problem */}
      <section className="card-pad border-sos/25 bg-sos/[0.04]">
        <h2 className="text-xl font-bold">Why this needs to exist</h2>
        <div className="mt-4 grid gap-5 text-sm leading-relaxed text-muted md:grid-cols-3">
          <p>
            A puncture at noon is an inconvenience. The same puncture at midnight, on an
            unlit stretch, with children asleep in the back, is a safety incident. Today the
            only options are a phone tree of numbers that do not answer and whatever price
            the one mechanic who does answer decides to name.
          </p>
          <p>
            Meanwhile thousands of small garages within a few kilometres of that same
            highway sit idle. The capacity to solve this already exists. It is simply not
            connected to the people who need it, at the moment they need it.
          </p>
          <p>
            Existing apps stop at the vehicle. They tow the metal and leave the people.
            RoadSathi treats the family as the thing being rescued, and the vehicle as
            second priority.
          </p>
        </div>
      </section>

      {/* ---------------------------------------------------------- steps */}
      <section className="py-14">
        <h2 className="text-2xl font-bold">How it works</h2>
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {STEPS.map((s) => (
            <div key={s.n} className="card-pad">
              <div className="text-xs font-bold tracking-widest text-amber">{s.n}</div>
              <div className="mt-2 font-bold">{s.title}</div>
              <p className="mt-1.5 text-sm leading-relaxed text-muted">{s.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ---------------------------------------------------------- features */}
      <section className="pb-6">
        <h2 className="text-2xl font-bold">What makes it different</h2>
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f) => (
            <div key={f.title} className="card-pad transition hover:border-amber/40">
              <div className="text-2xl">{f.icon}</div>
              <div className="mt-2.5 font-bold">{f.title}</div>
              <p className="mt-1.5 text-sm leading-relaxed text-muted">{f.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ---------------------------------------------------------- cta */}
      <section className="card-pad mt-8 flex flex-col items-center gap-4 border-amber/30 bg-amber/[0.05] py-10 text-center">
        <h2 className="text-2xl font-bold">Try the full flow</h2>
        <p className="max-w-xl text-sm text-muted">
          Raise an SOS from wherever you are. Then open the mechanic dashboard in a second
          tab and accept your own job to watch the whole rescue play out live.
        </p>
        <div className="flex flex-wrap justify-center gap-3">
          <Link href="/sos" className="btn-sos px-6 py-3">Raise an SOS</Link>
          <Link href="/mechanic" className="btn-ghost px-6 py-3">Open mechanic dashboard</Link>
          <Link href="/how" className="btn-ghost px-6 py-3">Demo script</Link>
        </div>
      </section>
    </main>
  );
}
