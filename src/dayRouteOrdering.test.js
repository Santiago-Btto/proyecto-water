import { describe, expect, it } from "vitest";
import { ubicarClienteEnDia } from "./dayRouteOrdering";

describe("orden por día del recorrido", () => {
  it("ubica un cliente entre los que visitan el día elegido sin tocar otros días", () => {
    const resultado = ubicarClienteEnDia({
      clientes: [
        {
          id: "ana",
          nombre: "Ana",
          repartidorId: "rep-1",
          orden: 1,
          diasVisita: ["Viernes", "Lunes"],
        },
        {
          id: "beto",
          nombre: "Beto",
          repartidorId: "rep-1",
          orden: 2,
          diasVisita: ["Viernes"],
        },
        {
          id: "caro",
          nombre: "Caro",
          repartidorId: "rep-1",
          orden: 3,
          diasVisita: ["Lunes"],
        },
      ],
      cliente: {
        id: "nuevo",
        nombre: "Dani",
        repartidorId: "rep-1",
        diasVisita: ["Viernes"],
      },
      dia: "Viernes",
      despuesDeId: "ana",
    });

    expect(
      resultado
        .filter((cliente) => cliente.diasVisita.includes("Viernes"))
        .sort((a, b) => a.ordenPorDia.Viernes - b.ordenPorDia.Viernes)
        .map((cliente) => [cliente.id, cliente.ordenPorDia.Viernes])
    ).toEqual([
      ["ana", 1],
      ["nuevo", 2],
      ["beto", 3],
    ]);
    expect(resultado.find((cliente) => cliente.id === "caro").ordenPorDia).toBeUndefined();
    expect(resultado.find((cliente) => cliente.id === "ana").orden).toBe(1);
    expect(resultado.find((cliente) => cliente.id === "beto").orden).toBe(2);
  });

  it("normaliza solo el día seleccionado cuando había posiciones repetidas", () => {
    const resultado = ubicarClienteEnDia({
      clientes: [
        { id: "ana", nombre: "Ana", repartidorId: "rep-1", orden: 1, diasVisita: ["Viernes"] },
        { id: "beto", nombre: "Beto", repartidorId: "rep-1", orden: 2, diasVisita: ["Viernes", "Martes"] },
        { id: "caro", nombre: "Caro", repartidorId: "rep-1", orden: 2, diasVisita: ["Viernes"] },
      ],
      cliente: {
        id: "caro",
        nombre: "Caro",
        repartidorId: "rep-1",
        orden: 2,
        diasVisita: ["Viernes"],
      },
      dia: "Viernes",
      despuesDeId: "beto",
    });

    expect(
      resultado
        .filter((cliente) => cliente.diasVisita.includes("Viernes"))
        .sort((a, b) => a.ordenPorDia.Viernes - b.ordenPorDia.Viernes)
        .map((cliente) => [cliente.id, cliente.ordenPorDia.Viernes])
    ).toEqual([
      ["ana", 1],
      ["beto", 2],
      ["caro", 3],
    ]);
    expect(resultado.find((cliente) => cliente.id === "beto").ordenPorDia.Martes).toBeUndefined();
  });
});
