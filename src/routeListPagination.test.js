import { describe, expect, it } from "vitest";
import {
  CLIENTES_POR_BLOQUE,
  clientesVisiblesEnRecorrido,
  siguienteLimiteVisible,
} from "./routeListPagination";

describe("carga gradual del recorrido", () => {
  it("muestra solo el primer bloque, conservando el orden del recorrido", () => {
    const clientes = Array.from({ length: 30 }, (_, index) => ({
      id: index + 1,
    }));

    expect(clientesVisiblesEnRecorrido(clientes)).toEqual(
      clientes.slice(0, CLIENTES_POR_BLOQUE)
    );
  });

  it("amplía un bloque sin superar la cantidad real de clientes", () => {
    expect(siguienteLimiteVisible(25, 60)).toBe(50);
    expect(siguienteLimiteVisible(50, 58)).toBe(58);
  });
});
