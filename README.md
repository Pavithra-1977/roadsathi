# 🛞 RoadSathi

**Highway breakdown rescue for the people, not just the vehicle.**

A two-sided platform that connects stranded highway travellers with the nearest *idle*
local garage in 5–10 minutes — and when the vehicle cannot be fixed, gets the family
home safely and puts the vehicle into monitored overnight custody.

Built with Next.js 14 (App Router), TypeScript, Tailwind and Leaflet/OpenStreetMap.
Frontend and backend live in one repo and deploy to Vercel as a single project.

---

## The problem

A puncture at noon is an inconvenience. The same puncture at midnight, on an unlit
stretch of NH-44, with children asleep in the back, is a safety incident.

Today the options are a phone tree of numbers that do not answer, and whatever price
the one mechanic who *does* answer decides to name.

Meanwhile thousands of small garages within a few kilometres of that highway sit idle.
The capacity to solve this already exists. It is simply not connected to the people who
need it, at the moment they need it.

**Existing roadside apps tow the metal and leave the people.** RoadSathi treats the
family as the thing being rescued and the vehicle as second priority.

---

## What makes it different

| | |
|---|---|
| 🧠 **Triage before dispatch** | A 19-fault knowledge base scores the driver's own words — including Hinglish terms people actually type — and predicts the fault, severity, whether it is roadside-fixable, and exactly which tools and parts the mechanic must bring. Optional LLM refinement when `ANTHROPIC_API_KEY` is set. |
| 🧰 **Parts routing, not guesswork** | Shops publish live inventory. A greedy set-cover router computes the pickup sequence that adds the least detour, preferring shops that are actually open. An alternator stops being a two-hour round trip. |
| 🛡️ **Guardian Link** | One tap produces a tokenised public page showing the mechanic's name, verification status, plate number and live ETA. Family at home watch without installing anything. |
| 🔢 **Arrival code handshake** | Work cannot begin until the customer reads out a 4-digit code. It proves the person walking up in the dark is the one we dispatched, and timestamps arrival for billing. |
| 💸 **Price locked before dispatch** | A stranded family at midnight has zero bargaining power, so the quote is frozen *before* the mechanic sets off. No surge, no renegotiation. |
| 📶 **SMS fallback** | Highways have dead zones. `POST /api/sms` accepts a Twilio-shaped inbound webhook — a plain text message with coordinates creates a full request with triage and dispatch. Data is an optimisation, not a requirement. |
| 🚌 **Plan B concierge** | Not fixable tonight? The objective switches from vehicle to people: verified cab, bus halt, railway station, family-safe lodge when children are aboard, plus monitored overnight custody with timestamped photos and a digital receipt. **No other roadside app does this.** |
| 📈 **Idle shops get paid** | Garages with fewer than 3 jobs this week are boosted up the dispatch queue. We do not create supply — we utilise the supply that was already sitting there empty. |

---

## Quick start

```bash
npm install
npm run dev
```

Open <http://localhost:3000>.

**Zero configuration required.** With no environment variables the app runs in
in-memory demo mode and every feature works. Supabase is optional and only adds
cross-device persistence.

---

## Deploy to Vercel (no localhost)

```bash
git init
git add .
git commit -m "RoadSathi"
git branch -M main
git remote add origin https://github.com/<you>/roadsathi.git
git push -u origin main
```

Then at <https://vercel.com/new>:

1. **Import** the GitHub repo.
2. Framework preset is detected as **Next.js** — leave every setting at its default.
3. Click **Deploy**.

That is it. No environment variables are required for the demo to work.
Every future `git push` redeploys automatically.

### Optional: real persistence with Supabase

In-memory mode resets when a Vercel serverless function goes cold, so a request raised
on your phone may not be visible on your laptop. For a multi-device demo:

1. Create a free project at <https://supabase.com>.
2. Open **SQL Editor**, paste all of [`supabase/schema.sql`](supabase/schema.sql), hit **Run**.
3. In **Project Settings → API**, copy the Project URL and the keys.
4. In Vercel → **Settings → Environment Variables**, add:

   ```
   NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
   SUPABASE_SERVICE_ROLE_KEY=eyJ...
   ```

5. Redeploy.

The storage adapter in `src/lib/db.ts` switches over automatically — no code changes.
`GET /api/requests` reports which backend is live in its `storage` field.

### Optional: LLM-refined triage

Add `ANTHROPIC_API_KEY` and `src/lib/triage.ts` will call Claude to refine the
classification, falling back to the deterministic knowledge base on any error or after
an 8 second timeout. **A demo must never hang because a third-party API is slow.**

---

## Architecture

```
Customer (phone)                    Mechanic (laptop)              Guardian (anyone)
      │                                    │                             │
      ▼                                    ▼                             ▼
   /sos ─────────► POST /api/requests   /mechanic ──► POST .../accept   /guardian/[token]
      │              │                     │            POST .../verify-otp    │
      │              ├─ triage()           │            PATCH /api/requests/[id]│
      │              ├─ rankMechanics()    │                             │
      │              ├─ planParts()        │                             │
      │              └─ quotePrice()       │                             │
      ▼                     │              ▼                             ▼
  /track/[id] ◄─────────────┴──────── src/lib/db.ts ────────────────────►┘
                                    (Supabase ⇄ in-memory)
```

```
src/
├── app/
│   ├── page.tsx                 Landing / pitch
│   ├── sos/                     Customer SOS wizard with live triage
│   ├── track/[id]/              Customer live tracking
│   ├── mechanic/                Mechanic job board
│   ├── guardian/[token]/        Public read-only family view
│   ├── how/                     Demo script + judge Q&A
│   └── api/                     All backend route handlers
├── components/
│   ├── Map.tsx                  SSR-safe dynamic wrapper
│   ├── MapView.tsx              Raw Leaflet, night-styled OSM tiles
│   └── ui.tsx                   Badges, pills, stat tiles
└── lib/
    ├── knowledgeBase.ts         19 faults, keyword weights, tools, parts
    ├── triage.ts                Classifier + optional LLM refinement
    ├── matching.ts              Dispatch ranking, parts routing, pricing, Plan B
    ├── seed.ts                  Mechanics/shops placed relative to the incident
    ├── geo.ts                   Haversine, road factor, ETA
    ├── db.ts                    Supabase ⇄ in-memory storage adapter
    └── types.ts                 Shared domain types
```

### Two design decisions worth defending in an interview

**Mechanics are seeded relative to the incident, not to a fixed city.** `src/lib/seed.ts`
places the roster at fixed kilometre offsets from wherever the SOS is raised. The demo
therefore works from any GPS location on earth without reseeding a database. In
production this function is replaced by a single PostGIS `ST_DWithin` query — the
interface is identical, so nothing above it changes.

**Storage is an adapter, not a hard dependency.** `src/lib/db.ts` exposes five functions.
Supabase and the in-memory map implement the same contract. The app has no idea which
one it is talking to, which is why it deploys green on the first push with no
configuration.

---

## API reference

| Method | Route | Purpose |
|---|---|---|
| `POST` | `/api/requests` | Raise an SOS. Runs triage, ranks mechanics, plans parts, locks the price. |
| `GET` | `/api/requests?status=open,assigned` | Job board feed. |
| `GET` | `/api/requests/[id]` | Full request state. |
| `PATCH` | `/api/requests/[id]` | Update status / resolution note. |
| `POST` | `/api/requests/[id]/accept` | Mechanic claims the job (409 if already taken). |
| `POST` | `/api/requests/[id]/verify-otp` | Arrival handshake (401 on a wrong code). |
| `POST` | `/api/requests/[id]/planb` | Engage the safety fallback. |
| `POST` | `/api/triage` | Live triage preview while the driver types. |
| `GET` | `/api/guardian/[token]` | Reduced payload for the family view. |
| `POST` | `/api/sms` | Twilio-shaped inbound SMS webhook. |

### Try the SMS fallback

```bash
curl -X POST https://YOUR-APP.vercel.app/api/sms \
  -H "content-type: application/json" \
  -d '{"From":"+919876543210",
       "Body":"SOS TS09AB1234 17.385,78.486 tyre burst, wife and kid with me"}'
```

Returns a full request plus the reply SMS the driver would receive, complete with the
mechanic's ETA, the locked price and the arrival code.

---

## The 4-minute demo

Have three screens ready: phone on `/sos`, laptop on `/mechanic`, second window on the
Guardian Link. The full script with timings lives at **`/how`** in the running app.

1. **0:00** — Open with the moment, not the product. *"It is 11:40 at night on NH-44. Your tyre bursts. Your wife and your four year old are in the back. Who do you call?"* Pause.
2. **0:30** — Raise a live SOS from your own phone. Triage, safety advice, tools and parts appear before you finish talking. **Nobody has been dispatched yet and we already know what is wrong.**
3. **1:15** — Accept the job from the mechanic tab. The customer screen updates live with the mechanic, plate number, locked price and arrival code.
4. **2:00** — Point at the dashed line on the map. The mechanic goes *via* the shop that has the part.
5. **2:30** — Open the Guardian Link. *"This is what your mother sees from home."* Usually the moment the room goes quiet.
6. **3:10** — Break it on purpose: choose **Cannot fix — engage Plan B**. Bus, train, verified cab, custody receipt. *"Every other roadside app ends at the vehicle."*
7. **3:50** — Close on the mechanic's earnings. *"We did not create this supply. Those garages were already sitting there, empty, that night."*

---

## Roadmap beyond the hackathon

- **Blackspot heatmap** — aggregate incident density per highway kilometre into a
  dashboard for highway authorities, insurers and tyre manufacturers. Nobody is
  collecting this at this granularity, and it is the data moat.
- **Engine-audio triage** — a small CNN over a 5-second recording to separate belt
  squeal from bearing whine from a misfire.
- **Escrow payments** — hold the locked quote, release on OTP-verified completion.
- **Mechanic KYC pipeline** — Aadhaar/DL verification with periodic re-checks.
- **Offline BLE mesh** — relay SOS packets between passing vehicles in true dead zones.

---

## Attribution

Map tiles © [OpenStreetMap](https://www.openstreetmap.org/copyright) contributors.
Emergency numbers referenced: 112 (all-in-one), 108 (ambulance), 1033 (national highway helpline).
