import { describe, expect, it } from "vitest";
import {
  buscarClientesParaRepartidor,
  filtrarYAgruparClientesOtrosDias,
} from "./routeSearch";

describe("búsqueda entre recorridos", () => {
  const repartidores = [
    { id: "marcos", nombre: "Marcos" },
    { id: "lucas", nombre: "Lucas" },
  ];
  const clientes = [
    {
      id: "1",
      nombre: "Ana Pérez",
      direccion: "Calle 1",
      departamento: "Godoy Cruz",
      repartidorId: "marcos",
    },
    {
      id: "2",
      nombre: "Ana Gómez",
      direccion: "Calle 2",
      departamento: "Guaymallén",
      repartidorId: "lucas",
    },
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

  it("admite buscar por dirección o departamento y no devuelve nada sin texto", () => {
    expect(
      buscarClientesParaRepartidor({
        clientes,
        repartidores,
        repartidorId: "marcos",
        textoBusqueda: "calle 2",
      })
    ).toMatchObject([{ id: "2", nombreRepartidor: "Lucas" }]);

    expect(
      buscarClientesParaRepartidor({
        clientes,
        repartidores,
        repartidorId: "marcos",
        textoBusqueda: "godoy cruz",
      })
    ).toMatchObject([{ id: "1", nombreRepartidor: "Marcos" }]);

    expect(
      buscarClientesParaRepartidor({
        clientes,
        repartidores,
        repartidorId: "marcos",
        textoBusqueda: "   ",
      })
    ).toEqual([]);
  });
});

describe("clientes de otros días del repartidor", () => {
  const clientesBase = [
    {
      id: "lun-1",
      nombre: "Laura Lunes",
      direccion: "San Martín 100",
      departamento: "Ciudad",
      diasVisita: ["Lunes"],
      ordenPorDia: { Lunes: 1 },
    },
    {
      id: "vie-2",
      nombre: "Valeria Viernes",
      direccion: "Belgrano 250",
      departamento: "Godoy Cruz",
      diasVisita: ["Viernes"],
      ordenPorDia: { Viernes: 2 },
    },
    {
      id: "vie-1",
      nombre: "Carlos Viernes",
      direccion: "Las Heras 500",
      departamento: "Las Heras",
      diasVisita: ["Viernes", "Martes"],
      ordenPorDia: { Viernes: 1, Martes: 3 },
    },
    {
      id: "sab-1",
      nombre: "Sofía Sábado",
      direccion: "Arístides 80",
      departamento: "Ciudad",
      diasVisita: ["Sábado"],
      ordenPorDia: { Sábado: 1 },
    },
  ];

  it("cuando hoy es Lunes, incluye los clientes del Viernes y Sábado sin quedar vacío", () => {
    const resultado = filtrarYAgruparClientesOtrosDias({
      clientes: clientesBase,
      diaActual: "Lunes",
      idsRecorridoActual: ["lun-1"],
      idsVisitadosHoy: [],
      diaFiltro: "todos",
      textoBusqueda: "",
    });

    expect(resultado.totalDisponibles).toBe(3);
    expect(resultado.totalFiltrados).toBe(3);
    expect(resultado.conteoPorDia.Viernes).toBe(2);
    expect(resultado.conteoPorDia.Sábado).toBe(1);
    expect(resultado.diasDisponibles).toEqual(["Martes", "Viernes", "Sábado"]);

    const idsEnGrupos = resultado.grupos.flatMap((g) =>
      g.clientes.map((c) => c.id)
    );
    expect(idsEnGrupos).toContain("vie-1");
    expect(idsEnGrupos).toContain("vie-2");
    expect(idsEnGrupos).toContain("sab-1");
  });

  it("al filtrar por Viernes devuelve toda la lista del Viernes ordenada por ordenPorDia", () => {
    const resultado = filtrarYAgruparClientesOtrosDias({
      clientes: clientesBase,
      diaActual: "Lunes",
      idsRecorridoActual: ["lun-1"],
      idsVisitadosHoy: [],
      diaFiltro: "Viernes",
      textoBusqueda: "",
    });

    expect(resultado.totalFiltrados).toBe(2);
    expect(resultado.grupos).toHaveLength(1);
    expect(resultado.grupos[0].dia).toBe("Viernes");
    expect(resultado.grupos[0].clientes.map((c) => c.id)).toEqual([
      "vie-1",
      "vie-2",
    ]);
  });

  it("filtra por textoBusqueda en nombre, dirección o departamento y excluye visitados o del recorrido actual", () => {
    const porDireccion = filtrarYAgruparClientesOtrosDias({
      clientes: clientesBase,
      diaActual: "Lunes",
      idsRecorridoActual: ["lun-1"],
      idsVisitadosHoy: ["sab-1"],
      diaFiltro: "todos",
      textoBusqueda: "belgrano",
    });

    expect(porDireccion.totalFiltrados).toBe(1);
    expect(porDireccion.clientes.map((c) => c.id)).toEqual(["vie-2"]);

    const porDepartamento = filtrarYAgruparClientesOtrosDias({
      clientes: clientesBase,
      diaActual: "Lunes",
      idsRecorridoActual: ["lun-1"],
      idsVisitadosHoy: ["sab-1"],
      diaFiltro: "Viernes",
      textoBusqueda: "las heras",
    });

    expect(porDepartamento.totalFiltrados).toBe(1);
    expect(porDepartamento.grupos[0].clientes.map((c) => c.id)).toEqual([
      "vie-1",
    ]);
  });

  it("prioriza el día anterior más cercano cuando hoy es Jueves y desempata alfabéticamente si no hay ordenPorDia", () => {
    const clientesJueves = [
      {
        id: "mie-z",
        nombre: "Zulema",
        direccion: "Calle Z",
        diasVisita: ["Lunes", "Miércoles"],
      },
      {
        id: "mie-a",
        nombre: "Alberto",
        direccion: "Calle A",
        diasVisita: ["Miércoles"],
      },
    ];

    const resultado = filtrarYAgruparClientesOtrosDias({
      clientes: clientesJueves,
      diaActual: "Jueves",
      idsRecorridoActual: [],
      idsVisitadosHoy: [],
      diaFiltro: "todos",
      textoBusqueda: "",
    });

    expect(resultado.grupos).toHaveLength(1);
    expect(resultado.grupos[0].dia).toBe("Miércoles");
    expect(resultado.grupos[0].clientes.map((c) => c.id)).toEqual([
      "mie-a",
      "mie-z",
    ]);
  });
});

