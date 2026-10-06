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
| 🧠 **Triage before dispatch** | An 18-fault knowledge base scores the driver's own words — including Hinglish terms people actually type — and predicts the fault, severity, whether it is roadside-fixable, and exactly which tools and parts the mechanic must bring. With `HUGGINGFACE_API_KEY` set, a LangGraph + RAG agent refines it and cites the guides it used. |
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
in-memory demo mode and every feature works. Upstash Redis is optional and only adds
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

### Optional: persistence with Upstash Redis

In-memory mode resets when a Vercel serverless function goes cold, so a request raised
on your phone may not be visible on your laptop. For a multi-device demo, create a free
database at <https://upstash.com> and add both variables in Vercel:

```
UPSTASH_REDIS_REST_URL=https://xxxx.upstash.io
UPSTASH_REDIS_REST_TOKEN=...
```

`src/lib/db.ts` switches over automatically (plain `fetch` to the REST API, JSON values,
24 h TTL). `GET /api/requests` reports `storage: "memory" | "redis"`.

### Optional: AI triage (LangGraph + RAG + Hugging Face)

```
HUGGINGFACE_API_KEY=hf_...                     # server-side only
HF_MODEL=openai/gpt-oss-20b:groq               # chat model on the HF router
HF_EMBED_MODEL=intfloat/multilingual-e5-small  # must match data/index.json
```

`src/lib/agent/graph.ts` is a LangGraph `StateGraph`:

```
intake -> retrieve -> classify -> validate -> safety -+-> clarify ---+-> plan_b_hint
                                                      +--------------+-> end
```

- **intake** normalises Hinglish and typos, detects language and vehicle type.
- **retrieve** embeds only the query and takes the top 4 chunks from `data/index.json`
  (40 self-written guides in `data/kb/`); keyword search if embedding fails.
- **classify** asks the LLM for a Zod-validated fault id (18 faults + "unknown"), citing chunk ids.
- **validate** compares with the deterministic classifier; on disagreement below 0.7
  confidence the deterministic answer wins ("low agreement").
- **safety** adds rule-based steps (night, rain, children, highway shoulder, do-not-repair).
- **clarify** asks one question when confidence is below 0.55; **plan_b_hint** flags
  severe or non-roadside faults.

The agent has an 8 s budget with per-node timeouts and falls back to the deterministic
knowledge base on any error. **It only advises**: skills, parts, dispatch and price come
from the fixed fault definitions. Rebuild the index after editing a guide:

```bash
npx tsx scripts/build-index.ts    # embeds the guides once, writes data/index.json
npx tsx scripts/check-agent.ts    # self-check (add --offline to test the fallback)
```

---

## Real data (free, no keys)

`src/lib/realdata/` enriches every SOS with live public data, fetched in parallel under a
5 second budget. Each source has a 4 s timeout, a 10 minute cache, and its own fallback,
so the demo works fully offline.

| Block | Source | Fallback |
|---|---|---|
| Road ref + place (e.g. "NH44, near Bhoothpur, Mahabubnagar") | OSM Nominatim | old seeded highway marker |
| Weather + rain/fog/night safety lines | Open-Meteo | hidden |
| Nearby garages, parts, hospitals, police, fuel, bus, rail, lodging | OSM Overpass | empty |
| Road route + ETA for the dispatched mechanic | OSRM demo server | haversine x 1.25, straight line |

Each block on `/track/[id]` carries a Live/Fallback badge, and a "Data sources" panel
lists them. **Mechanics, parts inventory and pricing remain the seeded demo roster**
("Demo partner"). Real OSM garages are shown as listings only, never as partners.

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
                                    (in-memory ⇄ Upstash Redis)
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
    ├── knowledgeBase.ts         18 faults, keyword weights, tools, parts
    ├── triage.ts                Deterministic keyword classifier
    ├── agent/graph.ts           LangGraph triage agent (advises only)
    ├── rag/                     Retriever + HF embeddings over data/index.json
    ├── matching.ts              Dispatch ranking, parts routing, pricing, Plan B
    ├── seed.ts                  Mechanics/shops placed relative to the incident
    ├── geo.ts                   Haversine, road factor, ETA
    ├── db.ts                    In-memory ⇄ Upstash Redis storage adapter
    └── types.ts                 Shared domain types
```

### Two design decisions worth defending in an interview

**Mechanics are seeded relative to the incident, not to a fixed city.** `src/lib/seed.ts`
places the roster at fixed kilometre offsets from wherever the SOS is raised. The demo
therefore works from any GPS location on earth without reseeding a database. In
production this function is replaced by a single PostGIS `ST_DWithin` query — the
interface is identical, so nothing above it changes.

**Storage is an adapter, not a hard dependency.** `src/lib/db.ts` exposes five functions.
Upstash Redis and the in-memory map implement the same contract. The app has no idea which
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
| `GET` | `/api/health/realdata?lat=&lng=` | Pings every real-data source, returns status and latency. |

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
4. **2:00** — Point at the route line on the map (real roads via OSRM; dashed straight line if offline). The mechanic goes *via* the shop that has the part.
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
