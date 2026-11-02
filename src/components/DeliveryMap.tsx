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
  subtitle?: string;
  distFromPrev?: number;
};

export default function DeliveryMap({
  stops,
  showRoute = false,
  selectedId,
  onSelect,
}: {
  stops: MapStop[];
  showRoute?: boolean;
  selectedId?: string | null;
  onSelect?: (id: string) => void;
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

      const mk = L.marker([Number(s.lat), Number(s.lng)], {
        icon: L.divIcon({
          className: "",
          html: `<div class="stop-pin" data-status="${s.status}"><span>${s.label}</span></div>`,
          iconSize: [28, 28],
          iconAnchor: [4, 28],
          popupAnchor: [10, -26],
        }),
      })
        .bindPopup(
          `<div style="font-family:system-ui,-apple-system,sans-serif;font-size:12px;min-width:180px;">
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

      // Linha principal corporativa da rota estratégica
      L.polyline(latlngs, {
        color: "#2563eb",
        weight: 3.5,
        opacity: 0.95,
        lineCap: "round",
        lineJoin: "round",
        dashArray: "8 4",
      }).addTo(g);
    }

    if (validStops.length) {
      const b = L.latLngBounds([
        [DEPOT.lat, DEPOT.lng],
        ...validStops.map((s) => [Number(s.lat), Number(s.lng)] as [number, number]),
      ]);
      if (b.isValid()) {
        m.fitBounds(b, { padding: [45, 45], maxZoom: 15, animate: false });
      }
    }
  }, [stops, showRoute, onSelect]);

  useEffect(() => {
    if (selectedId && markers.current[selectedId]) {
      const mk = markers.current[selectedId];
      map.current?.setView(mk.getLatLng(), Math.max(map.current.getZoom(), 14), { animate: false });
      mk.openPopup();
    }
  }, [selectedId]);

  return <div ref={el} className="h-full w-full" />;
}
