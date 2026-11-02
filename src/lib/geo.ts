export type LatLng = { lat: number; lng: number };

/** Base de saída da frota (CD / Ponto de partida) — Rua Professor Oswaldo Quirino Simões, 142 */
export const DEPOT: LatLng & {
  nome: string;
  endereco: string;
  bairro: string;
  cidade: string;
  cep: string;
  numero: string;
} = {
  nome: "Base Operacional - R. Prof. Oswaldo Quirino Simões, 142",
  endereco: "Rua Professor Oswaldo Quirino Simões, 142 - Socorro, São Paulo - SP",
  bairro: "Socorro / Vila Califórnia",
  cidade: "São Paulo - SP",
  cep: "04775-010",
  numero: "142",
  lat: -23.68213,
  lng: -46.70174,
};

export const SP_CENTER: LatLng = { lat: -23.68213, lng: -46.70174 };

export function normalizeCep(cep: string) {
  return cep.replace(/\D/g, "").slice(0, 8);
}

export function formatCep(cep: string) {
  const d = normalizeCep(cep);
  return d.length > 5 ? `${d.slice(0, 5)}-${d.slice(5)}` : d;
}

/** Distância em km entre dois pontos (fórmula de Haversine). */
export function haversineKm(a: LatLng, b: LatLng) {
  if (
    a == null || b == null ||
    a.lat == null || a.lng == null ||
    b.lat == null || b.lng == null ||
    Number.isNaN(Number(a.lat)) || Number.isNaN(Number(a.lng)) ||
    Number.isNaN(Number(b.lat)) || Number.isNaN(Number(b.lng))
  ) {
    return 0;
  }
  const R = 6371;
  const toRad = (x: number) => (x * Math.PI) / 180;
  const dLat = toRad(Number(b.lat) - Number(a.lat));
  const dLng = toRad(Number(b.lng) - Number(a.lng));
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(Number(a.lat))) * Math.cos(toRad(Number(b.lat))) * Math.sin(dLng / 2) ** 2;
  const clampedH = Math.min(1, Math.max(0, h));
  return 2 * R * Math.asin(Math.sqrt(clampedH));
}

/**
 * Ordena paradas por rota estratégica (vizinho mais próximo sucessivo) a partir de `start` (Base).
 * A 1ª parada é a mais próxima da Base; a 2ª é a mais próxima da 1ª; e assim por diante.
 * Paradas sem coordenadas vão para o final, na ordem original.
 */
export function orderByProximity<T extends { lat: number | null; lng: number | null }>(
  stops: T[],
  start: LatLng = DEPOT,
): T[] {
  const withCoords = stops.filter(
    (s) => s.lat != null && s.lng != null && !Number.isNaN(Number(s.lat)) && !Number.isNaN(Number(s.lng))
  );
  const without = stops.filter(
    (s) => s.lat == null || s.lng == null || Number.isNaN(Number(s.lat)) || Number.isNaN(Number(s.lng))
  );
  const result: T[] = [];
  let current: LatLng = start;
  const remaining = [...withCoords];

  while (remaining.length > 0) {
    let best = 0;
    let bestD = Infinity;
    for (let i = 0; i < remaining.length; i++) {
      const s = remaining[i]!;
      const d = haversineKm(current, { lat: Number(s.lat), lng: Number(s.lng) });
      if (!Number.isNaN(d) && d < bestD) {
        bestD = d;
        best = i;
      }
    }
    const next = remaining.splice(best, 1)[0]!;
    result.push(next);
    current = { lat: Number(next.lat), lng: Number(next.lng) };
  }
  return [...result, ...without];
}

export type RouteLeg = {
  legIndex: number;
  fromName: string;
  toName: string;
  distanceKm: number;
  cumulativeKm: number;
  estimatedMinutes: number;
};

/**
 * Calcula os trechos estratégicos (perna por perna) de uma rota sequencial.
 */
export function calculateStrategicLegs<
  T extends {
    lat: number | null;
    lng: number | null;
    destinatario?: string;
    numero?: string;
  },
>(
  stops: T[],
  start: LatLng & { nome?: string } = DEPOT,
): RouteLeg[] {
  const validStops = stops.filter((s) => s.lat != null && s.lng != null);
  let cur: LatLng = { lat: start.lat, lng: start.lng };
  let curName = start.nome ?? "Base Operacional";
  let cumulative = 0;

  return validStops.map((stop, idx) => {
    const nextLoc = { lat: stop.lat!, lng: stop.lng! };
    const dist = haversineKm(cur, nextLoc);
    cumulative += dist;
    // Estimativa de tráfego urbano em SP: velocidade média operacional ~26 km/h + 5 min de desembarque
    const estMin = Math.round((dist / 26) * 60) + 5;
    const toName = stop.numero
      ? `NF ${stop.numero} (${stop.destinatario || "Entrega"})`
      : `Parada #${idx + 1}`;

    const leg: RouteLeg = {
      legIndex: idx + 1,
      fromName: curName,
      toName,
      distanceKm: dist,
      cumulativeKm: cumulative,
      estimatedMinutes: estMin,
    };

    cur = nextLoc;
    curName = toName;
    return leg;
  });
}

export function routeDistanceKm(points: LatLng[], start: LatLng = DEPOT) {
  let total = 0;
  let cur = start;
  for (const p of points) {
    total += haversineKm(cur, p);
    cur = p;
  }
  return total;
}

export type CepInfo = {
  cep: string;
  logradouro: string;
  bairro: string;
  cidade: string;
  uf: string;
};

export async function lookupCep(cep: string): Promise<CepInfo | null> {
  const d = normalizeCep(cep);
  if (d.length !== 8) return null;
  const res = await fetch(`https://viacep.com.br/ws/${d}/json/`);
  if (!res.ok) return null;
  const j = await res.json();
  if (j.erro) return null;
  return { cep: d, logradouro: j.logradouro, bairro: j.bairro, cidade: j.localidade, uf: j.uf };
}

async function nominatim(params: Record<string, string>): Promise<LatLng | null> {
  const q = new URLSearchParams({ format: "json", limit: "1", countrycodes: "br", ...params });
  const res = await fetch(`https://nominatim.openstreetmap.org/search?${q}`, {
    headers: { "Accept-Language": "pt-BR" },
  });
  if (!res.ok) return null;
  const arr = await res.json();
  if (!arr?.length) return null;
  return { lat: parseFloat(arr[0].lat), lng: parseFloat(arr[0].lon) };
}

/** Geocodifica um endereço via OpenStreetMap, com fallback progressivo. */
export async function geocode(info: {
  cep: string;
  logradouro?: string;
  numero?: string;
  bairro?: string;
  cidade?: string;
}): Promise<LatLng | null> {
  const cidade = info.cidade || "São Paulo";
  if (info.logradouro) {
    const street = [info.numero, info.logradouro].filter(Boolean).join(" ");
    const r = await nominatim({ street, city: cidade, state: "São Paulo" });
    if (r) return r;
  }
  const r2 = await nominatim({ postalcode: formatCep(info.cep), country: "Brasil" });
  if (r2) return r2;
  if (info.bairro) return nominatim({ q: `${info.bairro}, ${cidade}, SP` });
  return null;
}
