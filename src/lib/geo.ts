export type LatLng = { lat: number; lng: number };

/** Base de saída da frota (CD) — usada como ponto inicial da roteirização. */
export const DEPOT: LatLng & { nome: string } = {
  nome: "CD Barra Funda",
  lat: -23.5256,
  lng: -46.6668,
};

export const SP_CENTER: LatLng = { lat: -23.5505, lng: -46.6333 };

export function normalizeCep(cep: string) {
  return cep.replace(/\D/g, "").slice(0, 8);
}

export function formatCep(cep: string) {
  const d = normalizeCep(cep);
  return d.length > 5 ? `${d.slice(0, 5)}-${d.slice(5)}` : d;
}

/** Distância em km entre dois pontos (fórmula de Haversine). */
export function haversineKm(a: LatLng, b: LatLng) {
  const R = 6371;
  const toRad = (x: number) => (x * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/**
 * Ordena paradas por proximidade (vizinho mais próximo) a partir de `start`.
 * Paradas sem coordenadas vão para o final, na ordem original.
 */
export function orderByProximity<T extends { lat: number | null; lng: number | null }>(
  stops: T[],
  start: LatLng = DEPOT,
): T[] {
  const withCoords = stops.filter((s) => s.lat != null && s.lng != null);
  const without = stops.filter((s) => s.lat == null || s.lng == null);
  const result: T[] = [];
  let current: LatLng = start;
  const remaining = [...withCoords];
  while (remaining.length) {
    let best = 0;
    let bestD = Infinity;
    remaining.forEach((s, i) => {
      const d = haversineKm(current, { lat: s.lat!, lng: s.lng! });
      if (d < bestD) {
        bestD = d;
        best = i;
      }
    });
    const [next] = remaining.splice(best, 1);
    result.push(next);
    current = { lat: next.lat!, lng: next.lng! };
  }
  return [...result, ...without];
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
