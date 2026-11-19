import { describe, expect, it } from "vitest";
import {
  ARTICULOS_STOCK,
  PRODUCTOS_CARGA_CAMIONETA,
  calcularStockEnCamionetas,
  calcularStockEnGalpon,
  combinarStockAdminConSalidas,
  registrarCargaCamioneta,
  resumenCargaRepartidorDia,
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

describe("carga de salida y recargas del repartidor", () => {
  it("define únicamente Bidón 20L, Bidón 12L y Sifón para la carga del repartidor", () => {
    expect(PRODUCTOS_CARGA_CAMIONETA.map((p) => p.key)).toEqual(["b20", "b12", "sifon"]);
  });

  it("registra la primera salida del día con el total en camioneta y preserva esqueletos", () => {
    const stockPrevio = {
      id: "rep-1",
      b20: 5,
      b12: 1,
      sifon: 2,
      esqueletos: 6,
      salidasDia: [
        { id: "ayer-1", fecha: "2026-11-13", timestamp: 500, b20: 30, b12: 5, sifon: 10 },
      ],
    };

    const actualizado = registrarCargaCamioneta({
      stockActual: stockPrevio,
      repartidorId: "rep-1",
      carga: { b20: 40, b12: 10, sifon: 24 },
      fecha: "2026-11-14",
      timestamp: 1000,
      id: "salida-1",
    });

    expect(actualizado).toMatchObject({
      id: "rep-1",
      b20: 40,
      b12: 10,
      sifon: 24,
      esqueletos: 6,
      ultimaCargaFecha: "2026-11-14",
      ultimaCargaTimestamp: 1000,
    });
    expect(actualizado.salidasDia).toEqual([
      {
        id: "salida-1",
        fecha: "2026-11-14",
        timestamp: 1000,
        b20: 40,
        b12: 10,
        sifon: 24,
      },
    ]);
  });

  it("descuenta ventas comunes y entregas de abono desde la última salida y reemplaza por el nuevo total al recargar", () => {
    const salida1 = registrarCargaCamioneta({
      stockActual: { id: "rep-1", esqueletos: 4 },
      repartidorId: "rep-1",
      carga: { b20: 40, b12: 10, sifon: 20 },
      fecha: "2026-11-14",
      timestamp: 1000,
      id: "salida-1",
    });

    const visitasVuelta1 = [
      {
        id: "v1",
        repartidorId: "rep-1",
        fecha: "2026-11-14",
        timestamp: 1500,
        vendio: true,
        items: [{ tipo: "b20", cantidad: 0 }],
        subscriptionAttribution: { subscriptionId: "sub-1", cantidadX20: 2 },
      },
      {
        id: "v2",
        repartidorId: "rep-1",
        fecha: "2026-11-14",
        timestamp: 2000,
        vendio: true,
        items: [
          { tipo: "b20", cantidad: 8 },
          { tipo: "b12", cantidad: 3 },
          { tipo: "sifon", cantidad: 6 },
        ],
      },
    ];

    const resumenVuelta1 = resumenCargaRepartidorDia({
      stockRepartidor: salida1,
      visitas: visitasVuelta1,
      fecha: "2026-11-14",
    });

    expect(resumenVuelta1.tieneSalidaHoy).toBe(true);
    expect(resumenVuelta1.salidasHoy).toHaveLength(1);
    expect(resumenVuelta1.entregadosDesdeUltimaSalida).toEqual({
      b20: 10,
      b12: 3,
      sifon: 6,
    });
    expect(resumenVuelta1.restanteEnCamioneta).toEqual({
      b20: 30,
      b12: 7,
      sifon: 14,
    });

    // Segunda vuelta: el repartidor ingresa el nuevo TOTAL dentro de la camioneta (no la suma)
    const salida2 = registrarCargaCamioneta({
      stockActual: salida1,
      repartidorId: "rep-1",
      carga: { b20: 45, b12: 12, sifon: 30 },
      fecha: "2026-11-14",
      timestamp: 3000,
      id: "salida-2",
    });

    const visitasConVuelta2 = [
      ...visitasVuelta1,
      {
        id: "v3",
        repartidorId: "rep-1",
        fecha: "2026-11-14",
        timestamp: 3500,
        vendio: true,
        items: [
          { tipo: "b20", cantidad: 5 },
          { tipo: "b12", cantidad: 2 },
          { tipo: "sifon", cantidad: 4 },
        ],
      },
    ];

    const resumenVuelta2 = resumenCargaRepartidorDia({
      stockRepartidor: salida2,
      visitas: visitasConVuelta2,
      fecha: "2026-11-14",
    });

    expect(resumenVuelta2.salidasHoy).toHaveLength(2);
    expect(resumenVuelta2.entregadosDesdeUltimaSalida).toEqual({
      b20: 5,
      b12: 2,
      sifon: 4,
    });
    expect(resumenVuelta2.restanteEnCamioneta).toEqual({
      b20: 40,
      b12: 10,
      sifon: 26,
    });
    expect(resumenVuelta2.entregadosTotalHoy).toEqual({
      b20: 15,
      b12: 5,
      sifon: 10,
    });
  });

  it("ignora visitas sin venta y nunca devuelve stock negativo si se entregó de más", () => {
    const salida = registrarCargaCamioneta({
      stockActual: { id: "rep-1" },
      repartidorId: "rep-1",
      carga: { b20: "2", b12: -5, sifon: "" },
      fecha: "2026-11-14",
      timestamp: 1000,
    });

    const resumen = resumenCargaRepartidorDia({
      stockRepartidor: salida,
      fecha: "2026-11-14",
      visitas: [
        {
          id: "no-vendio",
          fecha: "2026-11-14",
          timestamp: 1200,
          vendio: false,
          items: [{ tipo: "b20", cantidad: 10 }],
        },
        {
          id: "exceso",
          fecha: "2026-11-14",
          timestamp: 1500,
          vendio: true,
          items: [{ tipo: "b20", cantidad: 5 }],
        },
      ],
    });

    expect(salida).toMatchObject({ b20: 2, b12: 0, sifon: 0 });
    expect(resumen.entregadosDesdeUltimaSalida).toEqual({ b20: 5, b12: 0, sifon: 0 });
    expect(resumen.restanteEnCamioneta).toEqual({ b20: 0, b12: 0, sifon: 0 });
  });

  it("preserva salidasDia, ultimaCargaFecha y ultimaCargaTimestamp al guardar stock desde AdminStock", () => {
    const stockActual = registrarCargaCamioneta({
      stockActual: { id: "rep-1", esqueletos: 4 },
      repartidorId: "rep-1",
      carga: { b20: 40, b12: 10, sifon: 20 },
      fecha: "2026-11-14",
      timestamp: 1000,
      id: "salida-1",
    });

    const combinado = combinarStockAdminConSalidas({
      stockActual,
      stockEditado: { b20: 42, b12: 10, sifon: 18, esqueletos: 6 },
      repartidorId: "rep-1",
    });

    expect(combinado).toEqual({
      id: "rep-1",
      b20: 42,
      b12: 10,
      sifon: 18,
      esqueletos: 6,
      ultimaCargaFecha: "2026-11-14",
      ultimaCargaTimestamp: 1000,
      salidasDia: [
        {
          id: "salida-1",
          fecha: "2026-11-14",
          timestamp: 1000,
          b20: 40,
          b12: 10,
          sifon: 20,
        },
      ],
    });

    const sinSalidasPrevias = combinarStockAdminConSalidas({
      stockActual: null,
      stockEditado: { b20: 15, esqueletos: 3 },
      repartidorId: "rep-2",
    });

    expect(sinSalidasPrevias).toEqual({
      id: "rep-2",
      b20: 15,
      b12: 0,
      sifon: 0,
      esqueletos: 3,
    });
  });
});
