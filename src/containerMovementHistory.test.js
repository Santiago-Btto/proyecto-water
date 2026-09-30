import { describe, expect, it } from "vitest";
import { PERIODOS_MOVIMIENTOS_ENVASES, movimientosDeEnvases } from "./containerMovementHistory";

const clientes = [
  { id: "c1", nombre: "Ana" },
  { id: "c2", nombre: "Bruno" },
];
const repartidores = [{ id: "r1", nombre: "Marcos" }];

describe("movimientos de envases", () => {
  it("no ofrece el período completo para evitar cargar todo el historial", () => {
    expect(PERIODOS_MOVIMIENTOS_ENVASES.map((periodo) => periodo.key)).not.toContain("todo");
  });

  it("encuentra los retiros del envase y día elegidos sin recorrer clientes", () => {
    const movimientos = movimientosDeEnvases({
      visitas: [
        { id: "v1", clienteId: "c1", repartidorId: "r1", fecha: "2026-09-29", timestamp: 20, extrasRetirados: { sifon: 2 } },
        { id: "v2", clienteId: "c2", repartidorId: "r1", fecha: "2026-09-29", timestamp: 10, extrasPrestados: { sifon: 1 } },
      ],
      clientes,
      repartidores,
      filtros: { periodo: "hoy", fechaActual: "2026-09-29", tipo: "sifon", movimiento: "retirado" },
    });

    expect(movimientos).toEqual([
      expect.objectContaining({ clienteNombre: "Ana", repartidorNombre: "Marcos", cantidad: 2, tipo: "sifon", movimiento: "retirado", origen: "Extra" }),
    ]);
  });

  it("incluye movimientos de la semana y separa préstamos de retiros", () => {
    const movimientos = movimientosDeEnvases({
      visitas: [
        { id: "v1", clienteId: "c1", repartidorId: "r1", fecha: "2026-09-27", timestamp: 10, permanentesRetirados: { b20: 1 } },
        { id: "v2", clienteId: "c2", repartidorId: "r1", fecha: "2026-09-29", timestamp: 20, extrasPrestados: { b20: 3 } },
        { id: "v3", clienteId: "c2", repartidorId: "r1", fecha: "2026-09-20", timestamp: 30, extrasPrestados: { b20: 4 } },
      ],
      clientes,
      repartidores,
      filtros: { periodo: "semana", fechaActual: "2026-09-29", tipo: "b20", movimiento: "todos" },
    });

    expect(movimientos.map((movimiento) => [movimiento.clienteNombre, movimiento.movimiento, movimiento.cantidad])).toEqual([
      ["Bruno", "prestado", 3],
      ["Ana", "retirado", 1],
    ]);
  });
});
