import { describe, expect, it } from "vitest";
import {
  getPendingExtraContainersAlert,
  convertExtraContainersToPermanent,
  buildFullExtraContainersReturn,
} from "./containerLoanAlerts";

describe("alertas de envases prestados pendientes", () => {
  it("detecta cuando un cliente tiene envases extra prestados y arma el texto resumen", () => {
    const cliente = {
      id: "c1",
      nombre: "Familia Pérez",
      envasesPermanentes: { b20: 2, b12: 0, sifon: 0 },
      envasesExtra: { b20: 1, b12: 0, sifon: 2 },
    };

    const alerta = getPendingExtraContainersAlert(cliente);
    expect(alerta.hasPendingExtras).toBe(true);
    expect(alerta.totalUnits).toBe(3);
    expect(alerta.summaryText).toBe("1×20L, 2×Sifón");
    expect(alerta.items).toEqual([
      { key: "b20", label: "Bidón 20L", corto: "20L", cantidad: 1 },
      { key: "sifon", label: "Sifón", corto: "Sifón", cantidad: 2 },
    ]);
  });

  it("no alerta cuando el cliente solo tiene envases permanentes o extras en cero", () => {
    const cliente = {
      id: "c2",
      nombre: "Cliente sin extras",
      envasesPermanentes: { b20: 3, b12: 1, sifon: 6 },
      envasesExtra: { b20: 0, b12: 0, sifon: 0 },
    };

    const alerta = getPendingExtraContainersAlert(cliente);
    expect(alerta.hasPendingExtras).toBe(false);
    expect(alerta.totalUnits).toBe(0);
    expect(alerta.summaryText).toBe("");
    expect(alerta.items).toEqual([]);
  });

  it("convierte los envases extra prestados en permanentes y apaga la alerta pendiente", () => {
    const cliente = {
      id: "c1",
      nombre: "Familia Pérez",
      envasesPermanentes: { b20: 2, b12: 1, sifon: 0 },
      envasesExtra: { b20: 1, b12: 2, sifon: 6 },
    };

    const actualizado = convertExtraContainersToPermanent(cliente);
    expect(actualizado.envasesPermanentes).toMatchObject({
      b20: 3,
      b12: 3,
      sifon: 6,
    });
    expect(actualizado.envasesExtra).toMatchObject({
      b20: 0,
      b12: 0,
      sifon: 0,
    });
    expect(getPendingExtraContainersAlert(actualizado).hasPendingExtras).toBe(
      false
    );
  });

  it("arma el objeto de devolución completa de envases extra para precargar en la visita", () => {
    const cliente = {
      id: "c1",
      envasesExtra: { b20: 2, b12: 0, sifon: 4 },
    };

    expect(buildFullExtraContainersReturn(cliente)).toEqual({
      b20: 2,
      b12: 0,
      sifon: 4,
    });
  });
});
