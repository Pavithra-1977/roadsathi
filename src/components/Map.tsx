"use client";

import dynamic from "next/dynamic";
import { T } from "@/lib/i18n";

export type { MapMarker, MarkerKind } from "./MapView";

/** Leaflet touches `window`, so the map must never render on the server. */
const Map = dynamic(() => import("./MapView"), {
  ssr: false,
  loading: () => (
    <div className="grid h-[340px] w-full place-items-center rounded-2xl border border-edge bg-panel2/60 text-sm text-muted">
      <T>Loading map…</T>
    </div>
  ),
});

export default Map;
