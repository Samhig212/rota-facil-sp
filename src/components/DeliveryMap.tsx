import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { DEPOT, SP_CENTER } from "@/lib/geo";

export type MapStop = {
  id: string;
  lat: number;
  lng: number;
  status: string;
  label: string;
  title: string;
  subtitle?: string;
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
    if (!el.current || map.current) return;
    map.current = L.map(el.current, { zoomControl: true }).setView([SP_CENTER.lat, SP_CENTER.lng], 11);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: "&copy; OpenStreetMap",
    }).addTo(map.current);
    layer.current = L.layerGroup().addTo(map.current);
    return () => {
      map.current?.remove();
      map.current = null;
    };
  }, []);

  useEffect(() => {
    const m = map.current;
    const g = layer.current;
    if (!m || !g) return;
    g.clearLayers();
    markers.current = {};
    L.marker([DEPOT.lat, DEPOT.lng], {
      icon: L.divIcon({ className: "", html: `<div class="depot-pin">CD</div>`, iconSize: [32, 32], iconAnchor: [16, 16] }),
    })
      .bindPopup(`<b>${DEPOT.nome}</b><br/>Base de saída`)
      .addTo(g);
    for (const s of stops) {
      const mk = L.marker([s.lat, s.lng], {
        icon: L.divIcon({
          className: "",
          html: `<div class="stop-pin" data-status="${s.status}"><span>${s.label}</span></div>`,
          iconSize: [28, 28],
          iconAnchor: [4, 28],
          popupAnchor: [10, -26],
        }),
      })
        .bindPopup(`<b>${s.title}</b>${s.subtitle ? `<br/>${s.subtitle}` : ""}`)
        .addTo(g);
      if (onSelect) mk.on("click", () => onSelect(s.id));
      markers.current[s.id] = mk;
    }
    if (showRoute && stops.length) {
      L.polyline(
        [[DEPOT.lat, DEPOT.lng], ...stops.map((s) => [s.lat, s.lng] as [number, number])],
        { color: "oklch(0.21 0.014 260)", weight: 3, dashArray: "6 6" },
      ).addTo(g);
    }
    if (stops.length) {
      const b = L.latLngBounds([[DEPOT.lat, DEPOT.lng], ...stops.map((s) => [s.lat, s.lng] as [number, number])]);
      m.fitBounds(b, { padding: [40, 40], maxZoom: 15 });
    }
  }, [stops, showRoute, onSelect]);

  useEffect(() => {
    if (selectedId && markers.current[selectedId]) {
      const mk = markers.current[selectedId];
      map.current?.setView(mk.getLatLng(), Math.max(map.current.getZoom(), 14));
      mk.openPopup();
    }
  }, [selectedId]);

  return <div ref={el} className="h-full w-full" />;
}
