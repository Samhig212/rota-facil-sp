import { describe, expect, it } from "vitest";
import { DEPOT, formatCep, orderByProximity, calculateStrategicLegs } from "./geo";

describe("DEPOT", () => {
  it("tem o endereço e coordenadas da base Rua Professor Oswaldo Quirino Simões 142", () => {
    expect(DEPOT.endereco).toContain("Rua Professor Oswaldo Quirino Simões, 142");
    expect(DEPOT.lat).toBeCloseTo(-23.68213, 3);
    expect(DEPOT.lng).toBeCloseTo(-46.70174, 3);
  });
});

describe("orderByProximity", () => {
  it("visita sempre a parada mais próxima a partir da base", () => {
    const start = { lat: 0, lng: 0 };
    const stops = [
      { id: "longe", lat: 0, lng: 3 },
      { id: "perto", lat: 0, lng: 1 },
      { id: "meio", lat: 0, lng: 2 },
    ];
    expect(orderByProximity(stops, start).map((s) => s.id)).toEqual(["perto", "meio", "longe"]);
  });

  it("deixa paradas sem coordenadas no final", () => {
    const stops = [
      { id: "sem", lat: null, lng: null },
      { id: "a", lat: 0, lng: 1 },
    ];
    expect(orderByProximity(stops, { lat: 0, lng: 0 }).map((s) => s.id)).toEqual(["a", "sem"]);
  });
});

describe("calculateStrategicLegs", () => {
  it("calcula a distância acumulada e distância perna a perna", () => {
    const start = { lat: 0, lng: 0, nome: "Base" };
    const stops = [
      { id: "1", lat: 0, lng: 1, numero: "101", destinatario: "Cliente A" },
      { id: "2", lat: 0, lng: 2, numero: "102", destinatario: "Cliente B" },
    ];
    const legs = calculateStrategicLegs(stops, start);
    expect(legs.length).toBe(2);
    expect(legs[0].fromName).toBe("Base");
    expect(legs[0].distanceKm).toBeGreaterThan(0);
    expect(legs[1].distanceKm).toBeGreaterThan(0);
    expect(legs[1].cumulativeKm).toBeGreaterThan(legs[0].cumulativeKm);
  });
});

describe("formatCep", () => {
  it("formata CEP com hífen", () => {
    expect(formatCep("01310100")).toBe("01310-100");
  });
});
