import { describe, expect, it } from "vitest";
import { buscarClientesParaRepartidor } from "./routeSearch";

describe("búsqueda entre recorridos", () => {
  const repartidores = [
    { id: "marcos", nombre: "Marcos" },
    { id: "lucas", nombre: "Lucas" },
  ];
  const clientes = [
    { id: "1", nombre: "Ana Pérez", direccion: "Calle 1", repartidorId: "marcos" },
    { id: "2", nombre: "Ana Gómez", direccion: "Calle 2", repartidorId: "lucas" },
  ];

  it("encuentra clientes de otro repartidor y señala a quién pertenece el recorrido", () => {
    const resultados = buscarClientesParaRepartidor({
      clientes,
      repartidores,
      repartidorId: "marcos",
      textoBusqueda: "ANA",
    });

    expect(resultados).toHaveLength(2);
    expect(resultados.find((cliente) => cliente.id === "1")).toMatchObject({
      esDeOtroRepartidor: false,
      nombreRepartidor: "Marcos",
    });
    expect(resultados.find((cliente) => cliente.id === "2")).toMatchObject({
      esDeOtroRepartidor: true,
      nombreRepartidor: "Lucas",
    });
  });

  it("admite buscar por dirección y no devuelve nada sin texto", () => {
    expect(buscarClientesParaRepartidor({
      clientes,
      repartidores,
      repartidorId: "marcos",
      textoBusqueda: "calle 2",
    })).toMatchObject([{ id: "2", nombreRepartidor: "Lucas" }]);

    expect(buscarClientesParaRepartidor({
      clientes,
      repartidores,
      repartidorId: "marcos",
      textoBusqueda: "   ",
    })).toEqual([]);
  });
});
