import { describe, expect, it } from "vitest";
import {
  SIFONES_POR_BULTO,
  calcularBultosDeProducto,
  formatearNumeroBultos,
  formatearDetalleBultosProducto,
  calcularResumenBultosVendidos,
} from "./sodaBulkCalculation";

const CATALOGO = [
  { key: "b20", label: "Bidón 20L" },
  { key: "b12", label: "Bidón 12L" },
  { key: "sifon", label: "Sifón" },
  { key: "jugo", label: "Jugo" },
];

describe("cálculo de bultos de soda (6 unidades = 1 bulto)", () => {
  it("divide las unidades de sifón por 6 para obtener la cantidad de bultos", () => {
    expect(SIFONES_POR_BULTO).toBe(6);
    expect(calcularBultosDeProducto("sifon", 6)).toBe(1);
    expect(calcularBultosDeProducto("sifon", 12)).toBe(2);
    expect(calcularBultosDeProducto("sifon", 3)).toBe(0.5);
    expect(calcularBultosDeProducto("sifon", 7)).toBe(1.17);
  });

  it("mantiene una relación 1 a 1 en los demás productos y controla valores negativos o vacíos", () => {
    expect(calcularBultosDeProducto("b20", 6)).toBe(6);
    expect(calcularBultosDeProducto("b12", 4)).toBe(4);
    expect(calcularBultosDeProducto("sifon", -3)).toBe(0);
    expect(calcularBultosDeProducto("b20", null)).toBe(0);
  });

  it("formatea números de bultos enteros y con decimales limpios", () => {
    expect(formatearNumeroBultos(2)).toBe("2");
    expect(formatearNumeroBultos(0)).toBe("0");
    expect(formatearNumeroBultos(1.5)).toMatch(/^1[.,]5$/);
    expect(formatearNumeroBultos(1.17)).toMatch(/^1[.,]17$/);
  });

  it("devuelve el detalle visual con bultos y subtexto de unidades para sifón", () => {
    expect(formatearDetalleBultosProducto("sifon", 18)).toEqual({
      unidades: 18,
      bultos: 3,
      textoPrincipal: "3",
      subtexto: "18 unid. (6 u = 1 bulto)",
    });

    expect(formatearDetalleBultosProducto("b20", 5)).toEqual({
      unidades: 5,
      bultos: 5,
      textoPrincipal: "5",
      subtexto: null,
    });
  });

  it("resume bultos vendidos sumando solo visitas con venta y dividiendo sifón entre 6", () => {
    const visitas = [
      {
        id: "v1",
        vendio: true,
        items: [
          { tipo: "b20", cantidad: 4 },
          { tipo: "sifon", cantidad: 6 },
        ],
      },
      {
        id: "v2",
        vendio: true,
        items: [
          { tipo: "b12", cantidad: 2 },
          { tipo: "sifon", cantidad: 3 },
        ],
      },
      {
        id: "v3",
        vendio: false,
        items: [{ tipo: "sifon", cantidad: 12 }],
      },
    ];

    const resumen = calcularResumenBultosVendidos(visitas, CATALOGO);

    expect(resumen.unidadesPorProducto).toEqual({
      b20: 4,
      b12: 2,
      sifon: 9,
      jugo: 0,
    });
    expect(resumen.bultosPorProducto).toEqual({
      b20: 4,
      b12: 2,
      sifon: 1.5,
      jugo: 0,
    });
    expect(resumen.totalBultos).toBe(7.5);
    expect(resumen.detallePorProducto.sifon.subtexto).toBe(
      "9 unid. (6 u = 1 bulto)"
    );
  });
});
