import { describe, expect, it } from "vitest";
import {
  summarizeClientsWithDebt,
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
