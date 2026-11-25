import { describe, expect, it } from "vitest";
import {
  summarizeClientsWithDebt,
  groupClientsWithDebtByRoute,
  calcularLiquidacionVisitaConDeuda,
} from "./clientDebtSummary";

describe("client debt summary", () => {
  it("lists debtors from the largest pending balance to the smallest", () => {
    const result = summarizeClientsWithDebt([
      { id: "a", nombre: "Ana", deudaAcumulada: 2500 },
      { id: "b", nombre: "Bruno", deudaAcumulada: 8000 },
    ]);

    expect(result.clients.map((client) => client.id)).toEqual(["b", "a"]);
    expect(result.total).toBe(10500);
  });

  it("excludes clients without a positive pending balance", () => {
    const result = summarizeClientsWithDebt([
      { id: "paid", deudaAcumulada: 0 },
      { id: "adjustment", deudaAcumulada: -50 },
      { id: "owing", deudaAcumulada: 300 },
    ]);

    expect(result.clients.map((client) => client.id)).toEqual(["owing"]);
    expect(result.total).toBe(300);
  });

  it("groups debtors by route day and sorts them by their delivery route order in each day", () => {
    const repartidores = [
      { id: "r1", nombre: "Lukas" },
      { id: "r2", nombre: "Matías" },
    ];
    const clientes = [
      {
        id: "c-orden-3",
        nombre: "Carlos",
        deudaAcumulada: 3000,
        repartidorId: "r1",
        diasVisita: ["Lunes"],
        ordenPorDia: { Lunes: 3 },
      },
      {
        id: "c-orden-1",
        nombre: "Ana",
        deudaAcumulada: 5000,
        repartidorId: "r1",
        diasVisita: ["Lunes", "Jueves"],
        ordenPorDia: { Lunes: 1, Jueves: 2 },
      },
      {
        id: "c-orden-2",
        nombre: "Beto",
        deudaAcumulada: 2000,
        repartidorId: "r2",
        diasVisita: ["Lunes"],
        ordenPorDia: { Lunes: 2 },
      },
      {
        id: "c-jueves-1",
        nombre: "Diana",
        deudaAcumulada: 4000,
        repartidorId: "r1",
        diasVisita: ["Jueves"],
        ordenPorDia: { Jueves: 1 },
      },
      {
        id: "c-sin-deuda",
        nombre: "Elena",
        deudaAcumulada: 0,
        repartidorId: "r1",
        diasVisita: ["Lunes"],
        ordenPorDia: { Lunes: 1 },
      },
    ];

    const grouped = groupClientsWithDebtByRoute({
      clientes,
      repartidores,
    });

    expect(grouped.totalDeudaFiltrada).toBe(14000);
    expect(grouped.totalClientesFiltrados).toBe(4);
    expect(grouped.grupos.map((g) => g.dia)).toEqual(["Lunes", "Jueves"]);

    const lunes = grouped.grupos.find((g) => g.dia === "Lunes");
    expect(lunes.clientes.map((c) => c.id)).toEqual([
      "c-orden-1",
      "c-orden-2",
      "c-orden-3",
    ]);
    expect(lunes.clientes.map((c) => c.ordenEnDia)).toEqual([1, 2, 3]);
    expect(lunes.clientes[0].repartidorNombre).toBe("Lukas");
    expect(lunes.subtotalDeuda).toBe(10000);

    const jueves = grouped.grupos.find((g) => g.dia === "Jueves");
    expect(jueves.clientes.map((c) => c.id)).toEqual([
      "c-jueves-1",
      "c-orden-1",
    ]);
    expect(jueves.subtotalDeuda).toBe(9000);
  });

  it("filters debtors by repartidor, specific day, and groups clients without assigned days", () => {
    const repartidores = [
      { id: "r1", nombre: "Lukas" },
      { id: "r2", nombre: "Matías" },
    ];
    const clientes = [
      {
        id: "c1",
        nombre: "Zoe",
        deudaAcumulada: 1500,
        repartidorId: "r1",
        diasVisita: ["Martes"],
      },
      {
        id: "c2",
        nombre: "Aldo",
        deudaAcumulada: 2500,
        repartidorId: "r1",
        diasVisita: ["Martes"],
      },
      {
        id: "c3",
        nombre: "Franco",
        deudaAcumulada: 6000,
        repartidorId: "r1",
        diasVisita: [],
      },
      {
        id: "c4",
        nombre: "OtroRep",
        deudaAcumulada: 9000,
        repartidorId: "r2",
        diasVisita: ["Martes"],
        ordenPorDia: { Martes: 1 },
      },
    ];

    const soloR1 = groupClientsWithDebtByRoute({
      clientes,
      repartidores,
      repartidorId: "r1",
    });

    expect(soloR1.totalDeudaFiltrada).toBe(10000);
    expect(soloR1.grupos.map((g) => g.dia)).toEqual([
      "Martes",
      "Sin día asignado",
    ]);
    // Desempate por nombre cuando no tienen orden numérico
    expect(soloR1.grupos[0].clientes.map((c) => c.id)).toEqual(["c2", "c1"]);
    expect(soloR1.grupos[1].clientes.map((c) => c.id)).toEqual(["c3"]);

    const soloMartesR1 = groupClientsWithDebtByRoute({
      clientes,
      repartidores,
      repartidorId: "r1",
      dia: "Martes",
    });
    expect(soloMartesR1.grupos).toHaveLength(1);
    expect(soloMartesR1.totalDeudaFiltrada).toBe(4000);
  });

  it("suma automáticamente el fiado marcado para cobrar + lo que se deja hoy en el total a pagar", () => {
    const liquidacion = calcularLiquidacionVisitaConDeuda({
      importeVentaHoy: 3500,
      registraVenta: true,
      cobrarDeuda: true,
      montoDeuda: 5000,
      saldoAnterior: 5000,
      metodoPago: "efectivo",
      montoPagadoInput: null,
    });

    expect(liquidacion).toEqual({
      ventaHoy: 3500,
      saldoBase: 5000,
      fiadoMarcadoParaCobrar: 5000,
      totalFiadoMasPedido: 8500,
      totalACobrarAhora: 8500,
      montoPagadoEfectivo: 8500,
      deudaCobradaFinal: 5000,
      pagadoVentaHoy: 3500,
      deudaGeneradaFinal: 0,
      restanteSinPagarHoy: 0,
      saldoFinalPrevisto: 0,
    });
  });

  it("aplica pagos parciales primero al fiado marcado para cobrar y luego a la venta de hoy", () => {
    const pagoCubreDeudaYParteDeHoy = calcularLiquidacionVisitaConDeuda({
      importeVentaHoy: 4000,
      registraVenta: true,
      cobrarDeuda: true,
      montoDeuda: 5000,
      saldoAnterior: 5000,
      metodoPago: "efectivo",
      montoPagadoInput: 6500,
    });

    expect(pagoCubreDeudaYParteDeHoy).toEqual({
      ventaHoy: 4000,
      saldoBase: 5000,
      fiadoMarcadoParaCobrar: 5000,
      totalFiadoMasPedido: 9000,
      totalACobrarAhora: 9000,
      montoPagadoEfectivo: 6500,
      deudaCobradaFinal: 5000,
      pagadoVentaHoy: 1500,
      deudaGeneradaFinal: 2500,
      restanteSinPagarHoy: 2500,
      saldoFinalPrevisto: 2500,
    });

    const pagoMenorQueElFiadoMarcado = calcularLiquidacionVisitaConDeuda({
      importeVentaHoy: 4000,
      registraVenta: true,
      cobrarDeuda: true,
      montoDeuda: 5000,
      saldoAnterior: 5000,
      metodoPago: "mercadopago",
      montoPagadoInput: 3000,
    });

    expect(pagoMenorQueElFiadoMarcado).toEqual({
      ventaHoy: 4000,
      saldoBase: 5000,
      fiadoMarcadoParaCobrar: 5000,
      totalFiadoMasPedido: 9000,
      totalACobrarAhora: 9000,
      montoPagadoEfectivo: 3000,
      deudaCobradaFinal: 3000,
      pagadoVentaHoy: 0,
      deudaGeneradaFinal: 4000,
      restanteSinPagarHoy: 6000,
      saldoFinalPrevisto: 6000,
    });
  });

  it("mantiene separada la deuda nueva si hoy se deja fiado pero se cobra el fiado anterior", () => {
    const liquidacion = calcularLiquidacionVisitaConDeuda({
      importeVentaHoy: 3200,
      registraVenta: true,
      cobrarDeuda: true,
      montoDeuda: 4500,
      saldoAnterior: 4500,
      metodoPago: "deuda",
      montoPagadoInput: null,
    });

    expect(liquidacion).toEqual({
      ventaHoy: 3200,
      saldoBase: 4500,
      fiadoMarcadoParaCobrar: 4500,
      totalFiadoMasPedido: 7700,
      totalACobrarAhora: 4500,
      montoPagadoEfectivo: 4500,
      deudaCobradaFinal: 4500,
      pagadoVentaHoy: 0,
      deudaGeneradaFinal: 3200,
      restanteSinPagarHoy: 0,
      saldoFinalPrevisto: 3200,
    });
  });

  it("limita el fiado a cobrar al saldo anterior y maneja visitas sin venta o sin cobro de deuda", () => {
    const sinCobrarDeuda = calcularLiquidacionVisitaConDeuda({
      importeVentaHoy: 3000,
      registraVenta: true,
      cobrarDeuda: false,
      montoDeuda: 5000,
      saldoAnterior: 5000,
      metodoPago: "efectivo",
      montoPagadoInput: 2000,
    });

    expect(sinCobrarDeuda).toEqual({
      ventaHoy: 3000,
      saldoBase: 5000,
      fiadoMarcadoParaCobrar: 0,
      totalFiadoMasPedido: 3000,
      totalACobrarAhora: 3000,
      montoPagadoEfectivo: 2000,
      deudaCobradaFinal: 0,
      pagadoVentaHoy: 2000,
      deudaGeneradaFinal: 1000,
      restanteSinPagarHoy: 1000,
      saldoFinalPrevisto: 6000,
    });

    const sinVentaCobrandoDeuda = calcularLiquidacionVisitaConDeuda({
      importeVentaHoy: 3000,
      registraVenta: false,
      cobrarDeuda: true,
      montoDeuda: 9000,
      saldoAnterior: 5000,
      metodoPago: "efectivo",
      montoPagadoInput: null,
    });

    expect(sinVentaCobrandoDeuda).toEqual({
      ventaHoy: 0,
      saldoBase: 5000,
      fiadoMarcadoParaCobrar: 5000,
      totalFiadoMasPedido: 5000,
      totalACobrarAhora: 5000,
      montoPagadoEfectivo: 5000,
      deudaCobradaFinal: 5000,
      pagadoVentaHoy: 0,
      deudaGeneradaFinal: 0,
      restanteSinPagarHoy: 0,
      saldoFinalPrevisto: 0,
    });
  });
});
