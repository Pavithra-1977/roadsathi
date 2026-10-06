"use client";

import { useEffect, useRef } from "react";
import type { LatLng } from "@/lib/types";

export type MarkerKind = "incident" | "mechanic" | "shop" | "safe" | "garage" | "hospital" | "police";

export interface MapMarker {
  id: string;
  position: LatLng;
  kind: MarkerKind;
  title: string;
  subtitle?: string;
}

interface Props {
  center: LatLng;
  markers: MapMarker[];
  /** Dashed straight lines between points, in order (fallback when no road route) */
  route?: LatLng[];
  /** Real road geometry as [lat, lng] pairs, drawn solid */
  path?: [number, number][];
  height?: number;
  zoom?: number;
  className?: string;
}

const STYLE: Record<MarkerKind, { bg: string; emoji: string }> = {
  incident: { bg: "#FF3B4E", emoji: "🚨" },
  mechanic: { bg: "#FFB020", emoji: "🔧" },
  shop: { bg: "#5B8DEF", emoji: "🧰" },
  safe: { bg: "#22D3A7", emoji: "🛡️" },
  garage: { bg: "#64748B", emoji: "🔩" },
  hospital: { bg: "#F43F5E", emoji: "🏥" },
  police: { bg: "#3B82F6", emoji: "🚓" },
};

/**
 * Raw Leaflet rather than a React wrapper - it keeps the bundle small and
 * avoids the SSR/window problems that eat hackathon hours. Tiles come from
 * OpenStreetMap, so there is no API key and nothing to expire mid-demo.
 */
export default function MapView({
  center,
  markers,
  route,
  path,
  height = 340,
  zoom = 12,
  className = "",
}: Props) {
  const nodeRef = useRef<HTMLDivElement | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mapRef = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const layerRef = useRef<any>(null);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const L = (await import("leaflet")).default;
      if (cancelled || !nodeRef.current) return;

      if (!mapRef.current) {
        mapRef.current = L.map(nodeRef.current, {
          center: [center.lat, center.lng],
          zoom,
          zoomControl: true,
          attributionControl: true,
        });

        L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
          maxZoom: 19,
          attribution: "&copy; OpenStreetMap contributors",
        }).addTo(mapRef.current);

        layerRef.current = L.layerGroup().addTo(mapRef.current);
      }

      const map = mapRef.current;
      const layer = layerRef.current;
      layer.clearLayers();

      const bounds: [number, number][] = [];

      for (const m of markers) {
        const s = STYLE[m.kind];
        const ring = m.kind === "incident" ? '<span class="sos-ring"></span>' : "";
        const icon = L.divIcon({
          className: "",
          html:
            `<div style="position:relative">${ring}` +
            `<div class="marker-pin" style="background:${s.bg}">${s.emoji}</div></div>`,
          iconSize: [30, 30],
          iconAnchor: [15, 15],
        });

        L.marker([m.position.lat, m.position.lng], { icon })
          .addTo(layer)
          .bindPopup(
            `<strong>${escapeHtml(m.title)}</strong>` +
              (m.subtitle ? `<br/><span style="color:#8497b8">${escapeHtml(m.subtitle)}</span>` : "")
          );

        bounds.push([m.position.lat, m.position.lng]);
      }

      if (path && path.length > 1) {
        L.polyline(path, { color: "#FFB020", weight: 4, opacity: 0.9 }).addTo(layer);
      } else if (route && route.length > 1) {
        L.polyline(
          route.map((p) => [p.lat, p.lng] as [number, number]),
          { color: "#FFB020", weight: 3, dashArray: "7 8", opacity: 0.85 }
        ).addTo(layer);
      }

      if (bounds.length > 1) {
        map.fitBounds(bounds, { padding: [42, 42], maxZoom: 14 });
      } else if (bounds.length === 1) {
        map.setView(bounds[0], zoom);
      }

      setTimeout(() => map.invalidateSize(), 60);
    })();

    return () => {
      cancelled = true;
    };
  }, [center.lat, center.lng, markers, route, path, zoom]);

  useEffect(() => {
    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, []);

  return (
    <div
      ref={nodeRef}
      style={{ height }}
      className={`w-full overflow-hidden rounded-2xl border border-edge ${className}`}
    />
  );
}

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] as string)
  );
}
