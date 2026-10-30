import { describe, expect, it } from "vitest";
import { formatCep, orderByProximity } from "./geo";

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

describe("formatCep", () => {
  it("formata CEP com hífen", () => {
    expect(formatCep("01310100")).toBe("01310-100");
  });
});
