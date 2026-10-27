import { describe, expect, it } from "vitest";
import {
  chargeableVisitTotal,
  clientSpecialPriceEntries,
  isComplimentaryVisit,
  resolveClientUnitPrice,
  savedSpecialPrices,
} from "./specialPricing";

describe("precios especiales por cliente", () => {
  it("respeta $0 para agua y mantiene el precio normal de los demás productos", () => {
    const cliente = { preciosEspeciales: { b20: 0 } };
    expect(resolveClientUnitPrice(cliente, "b20", 6500)).toBe(0);
    expect(resolveClientUnitPrice(cliente, "sifon", 1200)).toBe(1200);
    expect(clientSpecialPriceEntries(cliente)).toEqual([["b20", 0]]);
  });

  it("permite un precio rebajado y descarta valores vacíos o inválidos", () => {
    const cliente = { preciosEspeciales: { b20: 5000, sifon: "", jugo: -10 } };
    expect(resolveClientUnitPrice(cliente, "b20", 6500)).toBe(5000);
    expect(resolveClientUnitPrice(cliente, "sifon", 1200)).toBe(1200);
    expect(resolveClientUnitPrice(cliente, "jugo", 3000)).toBe(3000);
    expect(clientSpecialPriceEntries(cliente)).toEqual([["b20", 5000]]);
  });

  it("el selector No desactiva los precios especiales sin afectar los valores del borrador", () => {
    const cliente = { preciosEspeciales: { b20: "0", sifon: "900" } };
    expect(savedSpecialPrices(cliente, false)).toEqual({});
    expect(savedSpecialPrices(cliente, true)).toEqual({ b20: 0, sifon: 900 });
    expect(cliente.preciosEspeciales).toEqual({ b20: "0", sifon: "900" });
  });

  it("cobra solo el excedente del abono al precio especial y también los extras", () => {
    const items = [
      { tipo: "b20", cantidad: 5, precioUnitario: 3000 },
      { tipo: "sifon", cantidad: 1, precioUnitario: 1200 },
    ];
    expect(chargeableVisitTotal(items, 2)).toBe(10200);
    expect(chargeableVisitTotal(items, 0)).toBe(16200);
  });

  it("no cobra el agua gratis pero sí el sifón que acompaña la entrega", () => {
    expect(chargeableVisitTotal([
      { tipo: "b20", cantidad: 1, precioUnitario: 0 },
      { tipo: "sifon", cantidad: 2, precioUnitario: 1200 },
    ])).toBe(2400);
  });

  it("nunca genera un importe negativo si el abono cubre todos los bidones", () => {
    expect(chargeableVisitTotal([
      { tipo: "b20", cantidad: 1, precioUnitario: 0 },
      { tipo: "sifon", cantidad: 1, precioUnitario: 1200 },
    ], 1)).toBe(1200);
  });

  it("identifica una entrega gratis sin confundirla con una entrega cubierta por abono", () => {
    const freeVisit = { vendio: true, total: 0, items: [{ tipo: "b20", cantidad: 1, precioUnitario: 0 }] };
    expect(isComplimentaryVisit(freeVisit)).toBe(true);
    expect(isComplimentaryVisit({ ...freeVisit, subscriptionAttribution: { cantidadX20: 1 } })).toBe(false);
    expect(isComplimentaryVisit({ ...freeVisit, total: 1200 })).toBe(false);
  });
});
