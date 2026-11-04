import { describe, expect, it } from "vitest";
import {
  calculateStrategicLegs,
  formatCep,
  haversineKm,
  normalizeCep,
  optimizeStopOrder,
} from "./geo";

describe("haversineKm", () => {
  it("calcula distância zero entre o mesmo ponto", () => {
    const p = { lat: -23.5505, lng: -46.6333 };
    expect(haversineKm(p, p)).toBe(0);
  });

  it("calcula distância coerente entre dois pontos conhecidos de SP", () => {
    const se = { lat: -23.5505, lng: -46.6333 };
    const paulista = { lat: -23.5614, lng: -46.6559 };
    const d = haversineKm(se, paulista);
    expect(d).toBeGreaterThan(2);
    expect(d).toBeLessThan(4);
  });
});

describe("optimizeStopOrder", () => {
  it("retorna lista vazia se não houver paradas", () => {
    expect(optimizeStopOrder([])).toEqual([]);
  });

  it("ordena paradas por vizinho mais próximo", () => {
    const start = { lat: 0, lng: 0 };
    const stops = [
      { id: "far", lat: 0, lng: 10 },
      { id: "near", lat: 0, lng: 1 },
      { id: "mid", lat: 0, lng: 3 },
    ];
    const ordered = optimizeStopOrder(stops, start);
    expect(ordered.map((s: { id: string }) => s.id)).toEqual(["near", "mid", "far"]);
  });

  it("calcula trechos estratégicos (legs) com distância incremental", () => {
    const start = { lat: 0, lng: 0, nome: "Base" };
    const stops = [
      { id: "1", lat: 0, lng: 1, numero: "101", destinatario: "Cliente A" },
      { id: "2", lat: 0, lng: 2, numero: "102", destinatario: "Cliente B" },
    ];
    const legs = calculateStrategicLegs(stops, start);
    expect(legs.length).toBe(2);
    expect(legs[0]?.fromName).toBe("Base");
    expect(legs[0]?.distanceKm).toBeGreaterThan(0);
    expect(legs[1]?.distanceKm).toBeGreaterThan(0);
    expect(legs[1]?.cumulativeKm).toBeGreaterThan(legs[0]?.cumulativeKm ?? 0);
  });
});

describe("formatCep", () => {
  it("formata CEP com hífen", () => {
    expect(formatCep("01310100")).toBe("01310-100");
  });

  it("tolera CEP vazio ou incompleto", () => {
    expect(formatCep("")).toBe("");
    expect(formatCep("123")).toBe("123");
  });
});

describe("normalizeCep", () => {
  it("remove caracteres não numéricos", () => {
    expect(normalizeCep("01310-100")).toBe("01310100");
    expect(normalizeCep("01.310-100")).toBe("01310100");
  });
});
