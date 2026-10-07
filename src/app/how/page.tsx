import Link from "next/link";
import { T } from "@/lib/i18n";

const SCRIPT = [
  {
    t: "0:00",
    title: "Open with the moment, not the product",
    body: "\"It is 11:40 at night on NH-44. Your tyre bursts. Your wife and your four year old are in the back. Who do you call?\" Pause. Let the room answer it themselves.",
  },
  {
    t: "0:30",
    title: "Raise a live SOS from your own phone",
    body: "Open /sos on the phone, allow location, tap a quick symptom chip. Triage, safety advice, tools and parts appear before you have finished talking. Say: nobody has been dispatched yet and we already know what is wrong.",
  },
  {
    t: "1:15",
    title: "Accept the job from the mechanic tab",
    body: "Switch to the laptop showing /mechanic. The job is already there. Accept it. Switch back — the customer screen now shows the mechanic, the plate number, the locked price and the arrival code.",
  },
  {
    t: "2:00",
    title: "Show the parts route",
    body: "Point at the route line on the map - real roads from OpenStreetMap. The mechanic does not go straight there — he goes via the shop that has the part. That is the difference between a 20 minute fix and a two hour round trip.",
  },
  {
    t: "2:30",
    title: "Open the Guardian Link on a third screen",
    body: "\"This is what your mother sees from home.\" Verified mechanic, plate number, live ETA, no app install. This is usually the moment the room goes quiet.",
  },
  {
    t: "3:10",
    title: "Break it on purpose",
    body: "From the mechanic tab, choose 'Cannot fix — engage Plan B'. Show the bus, the train, the verified cab and the overnight custody receipt. Say: every other roadside app ends at the vehicle. This is where ours starts caring about the people.",
  },
  {
    t: "3:50",
    title: "Close on the mechanic's side",
    body: "\"We did not create this supply. Those garages were already sitting there, empty, that night. We just connected them.\" End on the earnings number in the mechanic dashboard.",
  },
];

const QA = [
  {
    q: "How is this different from a towing app or roadside cover?",
    a: "Three ways. We triage before dispatch so the mechanic arrives with the right tools. We route through parts inventory instead of guessing. And when the vehicle cannot be fixed we switch objective from the vehicle to the people — onward travel plus monitored custody. Towing apps move metal and leave families on the shoulder.",
  },
  {
    q: "How do you solve cold start with no mechanics on the platform?",
    a: "We do not need density, we need coverage of highway corridors. One garage every 15 km on a single corridor is a viable launch. Onboarding is free and the pitch to the garage is pure upside: you were sitting idle, here is a paid job 6 km away. Idle shops also get queue priority, so the earliest adopters see the most volume.",
  },
  {
    q: "What stops a mechanic from overcharging a stranded family?",
    a: "The quote is computed and frozen before dispatch and shown to both sides. Parts are billed at actual cost with the shop receipt attached. Anything above the locked quote needs explicit customer approval in the app.",
  },
  {
    q: "What about safety — a stranger arriving at night?",
    a: "Four layers. KYC-verified mechanics only. A 4 digit arrival code the customer reads aloud before work starts. The Guardian Link so someone at home sees the mechanic's name, photo and plate number. And one-tap 112 on every screen.",
  },
  {
    q: "Highways have no signal. Does the app just fail?",
    a: "No. POST /api/sms accepts a Twilio-shaped inbound webhook. A plain text message with coordinates creates a full request with triage and dispatch, and the reply SMS carries the mechanic's ETA and the arrival code. Data is an optimisation, not a requirement.",
  },
  {
    q: "Where is the business model?",
    a: "A take rate on each job, a subscription for fleets and logistics operators, and the breakdown blackspot dataset. Aggregated incident density by highway kilometre is genuinely valuable to highway authorities, insurers and tyre manufacturers, and no one else is collecting it at this granularity.",
  },
];

export default function HowPage() {
  return (
    <main className="mx-auto max-w-4xl px-4 py-10">
      <h1 className="text-3xl font-extrabold tracking-tight"><T>Demo script and judge Q&A</T></h1>
      <p className="mt-2 text-sm text-muted">
        <T>A four minute run that shows every differentiator, in the order that lands best. Have three screens ready: phone on /sos, laptop on /mechanic, second window on the Guardian Link.</T>
      </p>

      <section className="mt-8 space-y-3">
        {SCRIPT.map((s) => (
          <div key={s.t} className="card-pad flex gap-4">
            <div className="shrink-0 font-mono text-sm font-bold text-amber">{s.t}</div>
            <div>
              <div className="font-bold"><T>{s.title}</T></div>
              <p className="mt-1 text-sm leading-relaxed text-muted"><T>{s.body}</T></p>
            </div>
          </div>
        ))}
      </section>

      <h2 className="mt-12 text-2xl font-bold"><T>Questions judges will ask</T></h2>
      <div className="mt-4 space-y-3">
        {QA.map((x) => (
          <details key={x.q} className="card-pad group">
            <summary className="cursor-pointer list-none font-semibold marker:hidden">
              <span className="mr-2 text-amber transition group-open:rotate-90 inline-block">▸</span>
              <T>{x.q}</T>
            </summary>
            <p className="mt-2.5 pl-5 text-sm leading-relaxed text-muted"><T>{x.a}</T></p>
          </details>
        ))}
      </div>

      <h2 className="mt-12 text-2xl font-bold"><T>SMS fallback — test it</T></h2>
      <p className="mt-2 text-sm text-muted">
        <T>Run this against your deployed URL to prove a request can be created with no app and no data connection:</T>
      </p>
      <pre className="card-pad mt-3 overflow-x-auto text-xs leading-relaxed text-safe">
{`curl -X POST https://YOUR-APP.vercel.app/api/sms \\
  -H "content-type: application/json" \\
  -d '{"From":"+919876543210",
       "Body":"SOS TS09AB1234 17.385,78.486 tyre burst, wife and kid with me"}'`}
      </pre>

      <div className="mt-12 flex flex-wrap gap-3">
        <Link href="/sos" className="btn-sos px-5 py-3"><T>Raise an SOS</T></Link>
        <Link href="/mechanic" className="btn-ghost px-5 py-3"><T>Mechanic dashboard</T></Link>
      </div>
    </main>
  );
}
