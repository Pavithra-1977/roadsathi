import { etaMinutes, roadKm } from "./geo";
import { partName } from "./knowledgeBase";
import { mechanicsNear, shopsNear } from "./seed";
import type {
  LatLng, Mechanic, PartsPlan, PlanBOption, TriageResult, VehicleType,
} from "./types";

export interface RankedMechanic {
  mechanic: Mechanic;
  distanceKm: number;
  etaMinutes: number;
  score: number;
  skillMatch: number;
  /** True when this shop has been idle and is getting queue priority */
  idleBoost: boolean;
  reasons: string[];
}

/**
 * Dispatch ranking.
 *
 * Speed matters most when a family is standing on a highway shoulder at night,
 * so ETA dominates. But we deliberately give a boost to shops that have been
 * sitting idle - that is the whole economic point of the platform. Idle capacity
 * gets paid, and the customer still gets someone who can actually do the job.
 */
export function rankMechanics(
  location: LatLng,
  triage: TriageResult | null,
  vehicleType: VehicleType
): RankedMechanic[] {
  const needed = triage?.requiredSkills ?? ["general"];

  return mechanicsNear(location)
    .filter((m) => m.online && m.vehicleTypes.includes(vehicleType))
    .map((m) => {
      const distanceKm = roadKm(location, m.location);
      const eta = etaMinutes(location, m.location);

      const matched = needed.filter((s) => m.skills.includes(s));
      const skillMatch = needed.length ? matched.length / needed.length : 1;

      // ETA score: 10 min or less is a perfect score, 40 min is zero.
      const etaScore = Math.max(0, 1 - Math.max(0, eta - 10) / 30);
      const ratingScore = (m.rating - 3.5) / 1.5;

      // Idle boost: a shop with under 3 jobs this week gets pushed up the queue.
      const idleBoost = m.jobsLast7Days < 3;
      const idleScore = Math.max(0, 1 - m.jobsLast7Days / 12);

      const score =
        etaScore * 0.42 +
        skillMatch * 0.28 +
        ratingScore * 0.15 +
        idleScore * 0.15;

      const reasons: string[] = [];
      if (eta <= 12) reasons.push(`Can reach you in ${eta} min`);
      if (skillMatch === 1) reasons.push("Has every skill this repair needs");
      else if (skillMatch > 0)
        reasons.push(`Covers ${matched.length} of ${needed.length} required skills`);
      if (m.verified) reasons.push("ID verified");
      if (idleBoost) reasons.push("Idle shop - priority queue");
      if (m.rating >= 4.7) reasons.push(`Rated ${m.rating} over ${m.jobsCompleted} jobs`);

      return {
        mechanic: m,
        distanceKm: Number(distanceKm.toFixed(2)),
        etaMinutes: eta,
        score: Number(score.toFixed(4)),
        skillMatch: Number(skillMatch.toFixed(2)),
        idleBoost,
        reasons,
      };
    })
    .sort((a, b) => b.score - a.score);
}

/**
 * Parts routing.
 *
 * The mechanic rarely carries everything. This works out which shops stock the
 * missing parts and orders them into a pickup route that adds the least detour,
 * so the mechanic collects on the way instead of arriving and then leaving again.
 */
export function planParts(
  incident: LatLng,
  mechanic: Mechanic,
  requiredParts: string[]
): PartsPlan {
  if (requiredParts.length === 0) {
    return { needed: [], pickups: [], unavailable: [], totalDetourKm: 0 };
  }

  const shops = shopsNear(incident);
  const directKm = roadKm(mechanic.location, incident);

  const remaining = new Set(requiredParts);
  const pickups: PartsPlan["pickups"] = [];

  // Greedy: repeatedly take the shop that covers the most outstanding parts
  // for the smallest detour, preferring shops that are actually open.
  while (remaining.size > 0) {
    let best: {
      shop: (typeof shops)[number];
      parts: string[];
      detourKm: number;
      value: number;
    } | null = null;

    for (const shop of shops) {
      const parts = [...remaining].filter((p) => (shop.inventory[p] ?? 0) > 0);
      if (parts.length === 0) continue;

      const viaKm =
        roadKm(mechanic.location, shop.location) + roadKm(shop.location, incident);
      const detourKm = Math.max(0, viaKm - directKm);

      const openFactor = shop.openNow ? 1 : 0.25; // closed shops are a last resort
      const value = (parts.length * openFactor) / (1 + detourKm);

      if (!best || value > best.value) {
        best = { shop, parts, detourKm, value };
      }
    }

    if (!best) break;

    pickups.push({
      shopId: best.shop.id,
      shopName: best.shop.name,
      phone: best.shop.phone,
      location: best.shop.location,
      parts: best.parts,
      detourKm: Number(best.detourKm.toFixed(2)),
      openNow: best.shop.openNow,
    });
    best.parts.forEach((p) => remaining.delete(p));
  }

  return {
    needed: requiredParts,
    pickups,
    unavailable: [...remaining],
    totalDetourKm: Number(
      pickups.reduce((s, p) => s + p.detourKm, 0).toFixed(2)
    ),
  };
}

/**
 * Locked pricing.
 *
 * Quoted and frozen BEFORE the mechanic is dispatched. A stranded family at
 * midnight has zero bargaining power, so the price must not be allowed to move
 * after they have already committed.
 */
export function quotePrice(
  triage: TriageResult | null,
  distanceKm: number,
  detourKm: number
): { total: number; breakdown: { label: string; amount: number }[] } {
  const callout = 199;
  const travel = Math.round((distanceKm + detourKm) * 14);
  const minutes = triage?.estimatedFixMinutes ?? 40;
  const labour = Math.round((minutes / 30) * 250);
  const partsEstimate = triage ? Math.round(triage.estimatedCostRange[0] * 0.6) : 0;

  const breakdown = [
    { label: "Call-out fee", amount: callout },
    { label: `Travel (${(distanceKm + detourKm).toFixed(1)} km)`, amount: travel },
    { label: `Labour (approx ${minutes} min)`, amount: labour },
    { label: "Parts (estimate, billed at actual)", amount: partsEstimate },
  ];

  return {
    total: breakdown.reduce((s, b) => s + b.amount, 0),
    breakdown,
  };
}

/**
 * Plan B concierge.
 *
 * Fires when the vehicle cannot be made roadworthy tonight. The job stops being
 * "fix the car" and becomes "get these people somewhere safe and keep the
 * vehicle secure". This is the part every other roadside app skips.
 */
export function buildPlanB(
  incident: LatLng,
  passengers: number,
  hasChildren: boolean
): PlanBOption[] {
  const shops = shopsNear(incident);
  const custodyShop = shops.find((s) => s.open24h) ?? shops[0];
  const lngScale = Math.max(0.2, Math.cos((incident.lat * Math.PI) / 180));
  const km = 1 / 111;

  const busStop: LatLng = {
    lat: Number((incident.lat + 2.2 * km).toFixed(6)),
    lng: Number((incident.lng + (1.4 * km) / lngScale).toFixed(6)),
  };
  const station: LatLng = {
    lat: Number((incident.lat - 6.5 * km).toFixed(6)),
    lng: Number((incident.lng + (4.1 * km) / lngScale).toFixed(6)),
  };
  const hotel: LatLng = {
    lat: Number((incident.lat + 3.3 * km).toFixed(6)),
    lng: Number((incident.lng - (2.0 * km) / lngScale).toFixed(6)),
  };

  const cabFare = Math.round(320 + passengers * 90);

  const options: PlanBOption[] = [
    {
      kind: "custody",
      title: `Secure overnight custody at ${custodyShop.name}`,
      detail:
        "Vehicle towed to a monitored partner yard. You receive timestamped photos of all four sides, the odometer and the boot, plus a digital custody receipt signed by the shop. Nothing is opened without your approval.",
      distanceKm: Number(roadKm(incident, custodyShop.location).toFixed(1)),
      priceInr: 900,
      location: custodyShop.location,
      contact: custodyShop.phone,
    },
    {
      kind: "cab",
      title: `Verified cab for ${passengers} ${passengers === 1 ? "passenger" : "passengers"}`,
      detail: hasChildren
        ? "Driver ID and plate shared with your guardian contact before pickup. Child-seat equipped vehicle requested."
        : "Driver ID and plate shared with your guardian contact before pickup. Trip tracked end to end inside RoadSathi.",
      etaMinutes: 14,
      priceInr: cabFare,
      contact: "Booked through the app",
    },
    {
      kind: "bus",
      title: "APSRTC / TSRTC bus halt",
      detail:
        "Lit and staffed halt on this highway. Next services at 23:40, 00:25 and 01:50. Mechanic escorts you here and waits until you board.",
      distanceKm: Number(roadKm(incident, busStop).toFixed(1)),
      etaMinutes: 9,
      priceInr: 120 * passengers,
      location: busStop,
    },
    {
      kind: "train",
      title: "Nearest railway station",
      detail:
        "Waiting room open through the night, RPF post on the platform. Last outbound service 01:15.",
      distanceKm: Number(roadKm(incident, station).toFixed(1)),
      etaMinutes: 18,
      priceInr: 90 * passengers,
      location: station,
    },
  ];

  if (hasChildren) {
    options.splice(2, 0, {
      kind: "hotel",
      title: "Family-safe lodge (children travelling)",
      detail:
        "Verified partner lodge with 24h reception and CCTV at the entrance. Recommended over a night bus when small children are in the group.",
      distanceKm: Number(roadKm(incident, hotel).toFixed(1)),
      priceInr: 1400,
      location: hotel,
    });
  }

  return options;
}

export function partsPlanLabels(plan: PartsPlan | null): string[] {
  if (!plan) return [];
  return plan.needed.map(partName);
}
