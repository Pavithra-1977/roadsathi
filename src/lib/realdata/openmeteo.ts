import type { LatLng, Weather } from "../types";
import { cached, fetchJson, gridKey, type Sourced } from "./http";

// Variable names per https://open-meteo.com/en/docs ("current" block).
const VARS = "temperature_2m,precipitation,weather_code,visibility,wind_speed_10m,is_day";

/** WMO weather interpretation codes, grouped. */
function summarise(code: number): string {
  if (code === 0) return "Clear";
  if (code <= 3) return "Partly cloudy";
  if (code === 45 || code === 48) return "Fog";
  if (code >= 51 && code <= 57) return "Drizzle";
  if (code >= 61 && code <= 67) return code >= 65 ? "Heavy rain" : "Rain";
  if (code >= 71 && code <= 77) return "Snow";
  if (code >= 80 && code <= 82) return code >= 81 ? "Heavy showers" : "Showers";
  if (code >= 95) return "Thunderstorm";
  return "Unknown";
}

export function safetyLines(w: Omit<Weather, "safety" | "summary">): string[] {
  const lines: string[] = [];
  const heavyRain =
    w.precipitationMm >= 4 || [65, 67, 81, 82, 95, 96, 99].includes(w.weatherCode);
  if (heavyRain) {
    lines.push("Heavy rain: hazards on, and wait behind the crash barrier rather than inside the car - wet roads double stopping distances.");
  }
  if (w.weatherCode === 45 || w.weatherCode === 48 || (w.visibilityM !== null && w.visibilityM < 1000)) {
    lines.push(`Low visibility${w.visibilityM !== null ? ` (~${Math.round(w.visibilityM)} m)` : ""}: put the warning triangle 50 m behind the vehicle and keep parking lights on.`);
  }
  if (!w.isDay) {
    lines.push("It is dark: keep hazards on, use a phone torch to be seen, and keep everyone on the side away from traffic.");
  }
  if (w.temperatureC >= 40) {
    lines.push("Extreme heat: do not wait in a closed car - find shade and keep water with the children.");
  }
  return lines.slice(0, 3);
}

export function currentWeather(p: LatLng, noCache = false): Promise<Sourced<Weather | null>> {
  return cached(`wx:${gridKey(p)}`, async () => {
    try {
      const json = await fetchJson<{ current?: Record<string, number> }>(
        `https://api.open-meteo.com/v1/forecast?latitude=${p.lat}&longitude=${p.lng}&current=${VARS}&timezone=auto`
      );
      const c = json.current;
      if (!c || typeof c.temperature_2m !== "number") throw new Error("no current block");
      const base = {
        temperatureC: c.temperature_2m,
        precipitationMm: c.precipitation ?? 0,
        weatherCode: c.weather_code ?? -1,
        visibilityM: typeof c.visibility === "number" ? c.visibility : null,
        windKmh: c.wind_speed_10m ?? 0,
        isDay: c.is_day === 1,
      };
      return {
        source: "live",
        data: { ...base, summary: summarise(base.weatherCode), safety: safetyLines(base) },
      };
    } catch {
      return { source: "fallback", data: null };
    }
  }, noCache);
}
