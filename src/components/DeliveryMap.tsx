import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { DEPOT, haversineKm } from "@/lib/geo";

export type MapStop = {
  id: string;
  lat: number;
  lng: number;
  status: string;
  label: string;
  title: string;
  subtitle?: string | undefined;
  distFromPrev?: number | undefined;
  isReference?: boolean | undefined;
  proximityStatus?: "perto" | "medio" | "longe" | "ref" | "sem_gps" | undefined;
};

export default function DeliveryMap({
  stops,
  showRoute = false,
  selectedId,
  onSelect,
}: {
  stops: MapStop[];
  showRoute?: boolean;
  selectedId?: string | null | undefined;
  onSelect?: ((id: string) => void) | undefined;
}) {
  const el = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const layer = useRef<L.LayerGroup | null>(null);
  const markers = useRef<Record<string, L.Marker>>({});

  useEffect(() => {
    if (!el.current) return;
    if (map.current) {
      map.current.remove();
      map.current = null;
    }

    const m = L.map(el.current, { zoomControl: true }).setView([DEPOT.lat, DEPOT.lng], 12);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: "&copy; OpenStreetMap",
    }).addTo(m);

    const g = L.layerGroup().addTo(m);
    map.current = m;
    layer.current = g;

    return () => {
      m.remove();
      map.current = null;
      layer.current = null;
    };
  }, []);

  useEffect(() => {
    const m = map.current;
    const g = layer.current;
    if (!m || !g) return;

    g.clearLayers();
    markers.current = {};

    // Marcador da Base Operacional (Ponto de Partida)
    L.marker([DEPOT.lat, DEPOT.lng], {
      icon: L.divIcon({
        className: "",
        html: `<div class="depot-pin"><span style="display:inline-block;width:7px;height:7px;border-radius:50%;background:#38bdf8;box-shadow:0 0 6px #38bdf8;margin-right:4px;"></span>BASE CD</div>`,
        iconSize: [84, 32],
        iconAnchor: [42, 16],
      }),
    })
      .bindPopup(
        `<div style="font-family:system-ui,-apple-system,sans-serif;font-size:12px;line-height:1.4;">
          <b style="font-size:13px;color:#1e3a8a;">${DEPOT.nome}</b><br/>
          <span style="color:#64748b;">${DEPOT.endereco}</span><br/>
          <div style="margin-top:6px;display:inline-flex;align-items:center;gap:4px;padding:2px 8px;background:#2563eb;color:#fff;border-radius:6px;font-size:10px;font-weight:bold;letter-spacing:0.5px;">
            PONTO INICIAL DA ROTA
          </div>
        </div>`,
      )
      .addTo(g);

    const validStops = stops.filter(
      (s) => s.lat != null && s.lng != null && !Number.isNaN(Number(s.lat)) && !Number.isNaN(Number(s.lng))
    );

    let prevLoc = { lat: DEPOT.lat, lng: DEPOT.lng };

    for (let i = 0; i < validStops.length; i++) {
      const s = validStops[i]!;
      const distFromPrev = s.distFromPrev ?? haversineKm(prevLoc, { lat: Number(s.lat), lng: Number(s.lng) });
      prevLoc = { lat: Number(s.lat), lng: Number(s.lng) };

      const proxAttr = s.isReference
        ? 'data-proximity="ref"'
        : s.proximityStatus
        ? `data-proximity="${s.proximityStatus}"`
        : "";
      const labelContent = s.isReference ? "🎯" : s.label;

      const mk = L.marker([Number(s.lat), Number(s.lng)], {
        icon: L.divIcon({
          className: "",
          html: `<div class="stop-pin" data-status="${s.status}" ${proxAttr}><span>${labelContent}</span></div>`,
          iconSize: s.isReference ? [34, 34] : [28, 28],
          iconAnchor: s.isReference ? [6, 34] : [4, 28],
          popupAnchor: [10, -26],
        }),
      })
        .bindPopup(
          `<div style="font-family:system-ui,-apple-system,sans-serif;font-size:12px;min-width:180px;">
            <div style="display:flex;align-items:center;gap:6px;margin-bottom:4px;">
              ${
                s.isReference
                  ? '<span style="background:#fbbf24;color:#000;padding:1px 6px;border-radius:4px;font-weight:bold;font-size:10px;">🎯 NOTA REFERÊNCIA</span>'
                  : s.proximityStatus === "perto"
                  ? '<span style="background:#10b981;color:#fff;padding:1px 6px;border-radius:4px;font-weight:bold;font-size:10px;">🟢 PERTO</span>'
                  : s.proximityStatus === "longe"
                  ? '<span style="background:#ef4444;color:#fff;padding:1px 6px;border-radius:4px;font-weight:bold;font-size:10px;">🔴 LONGE</span>'
                  : ""
              }
            </div>
            <b style="font-size:13px;color:#0f172a;">${s.title}</b>
            ${s.subtitle ? `<br/><span style="color:#64748b;font-size:11px;">${s.subtitle}</span>` : ""}
            ${
              showRoute
                ? `<div style="margin-top:8px;padding:4px 8px;background:#eff6ff;color:#1e40af;border:1px solid #bfdbfe;border-radius:6px;font-size:11px;font-weight:600;">
                    🎯 Trecho Estratégico: +${distFromPrev.toFixed(1)} km (Mais próxima)
                   </div>`
                : ""
            }
          </div>`,
        )
        .addTo(g);

      if (onSelect) {
        mk.on("click", () => onSelect(s.id));
      }
      markers.current[s.id] = mk;
    }

    if (showRoute && validStops.length) {
      const latlngs: [number, number][] = [
        [DEPOT.lat, DEPOT.lng],
        ...validStops.map((s) => [Number(s.lat), Number(s.lng)] as [number, number]),
      ];

      // Linha de reflexo / halo externo
      L.polyline(latlngs, {
        color: "#60a5fa",
        weight: 7,
        opacity: 0.35,
        lineCap: "round",
        lineJoin: "round",
      }).addTo(g);

      // Linha principal de trajeto
      L.polyline(latlngs, {
        color: "#2563eb",
        weight: 3.5,
        dashArray: "6, 8",
        lineCap: "round",
        lineJoin: "round",
      }).addTo(g);
    }

    if (validStops.length) {
      const bounds = L.latLngBounds([
        [DEPOT.lat, DEPOT.lng],
        ...validStops.map((s) => [Number(s.lat), Number(s.lng)] as [number, number]),
      ]);
      m.fitBounds(bounds, { padding: [40, 40], maxZoom: 14 });
    }
  }, [stops, showRoute, onSelect]);

  useEffect(() => {
    if (!selectedId || !markers.current[selectedId] || !map.current) return;
    const mk = markers.current[selectedId];
    map.current.panTo(mk.getLatLng(), { animate: true });
    mk.openPopup();
  }, [selectedId]);

  return <div ref={el} className="h-full w-full" style={{ minHeight: "100%", background: "#f8fafc" }} />;
}
