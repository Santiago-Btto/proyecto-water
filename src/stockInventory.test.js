import { describe, expect, it } from "vitest";
import {
  ARTICULOS_STOCK,
  calcularStockEnCamionetas,
  calcularStockEnGalpon,
  stockInventarioVacio,
} from "./stockInventory";

describe("stock de esqueletos", () => {
  it("incluye esqueletos como un artículo de inventario independiente", () => {
    expect(ARTICULOS_STOCK).toContainEqual(
      expect.objectContaining({ key: "esqueletos", label: "Esqueletos" })
    );
    expect(stockInventarioVacio()).toMatchObject({ esqueletos: 0 });
  });

  it("calcula los esqueletos del galpón solo con el total y las camionetas", () => {
    const porRepartidor = {
      marcos: { b20: 6, esqueletos: 8 },
      lucas: { b20: 4, esqueletos: 7 },
    };
    const galpon = calcularStockEnGalpon({
      total: { b20: 20, esqueletos: 30 },
      porRepartidor,
      enClientes: { b20: 5, esqueletos: 99 },
    });

    expect(calcularStockEnCamionetas(porRepartidor)).toMatchObject({ b20: 10, esqueletos: 15 });
    expect(galpon.b20).toBe(5);
    expect(galpon.esqueletos).toBe(15);
  });
});
