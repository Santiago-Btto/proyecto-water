import { describe, expect, it, vi } from "vitest";
import {
  applyDeliveryVisitMutation,
  deriveVisitEffects,
  isValidSale,
  saveDeliveryVisit,
  saveVisitAtomically,
  submitVisit,
  totalStreetDebt,
} from "./operationalIntegrity";

describe("isValidSale", () => {
  it("rejects a sale without a positive-quantity item", () => {
    expect(
      isValidSale({
        vendio: true,
        items: [{ tipo: "b20", cantidad: 0, precioUnitario: 5000 }],
        total: 5000,
      })
    ).toBe(false);
  });

  it("rejects a sale with a zero calculated total", () => {
    expect(
      isValidSale({
        vendio: true,
        items: [{ tipo: "b20", cantidad: 1, precioUnitario: 0 }],
        total: 0,
      })
    ).toBe(false);
  });

  it("accepts a sale with a positive item and total", () => {
    expect(
      isValidSale({
        vendio: true,
        items: [{ tipo: "b20", cantidad: 1, precioUnitario: 5000 }],
        total: 5000,
      })
    ).toBe(true);
  });
});

describe("deriveVisitEffects", () => {
  it("derives client balances and enabled stock for a new visit", () => {
    const { client, stockDelta } = deriveVisitEffects({
      client: {
        id: "cliente-1",
        deudaAcumulada: 100,
        envasesPrestados: { b20: 3 },
      },
      previousVisit: null,
      visit: {
        ajusteDeudaManual: 10,
        deudaCobrada: 20,
        deudaGenerada: 40,
        extrasPrestados: { b20: 2, b12: 1 },
        extrasRetirados: { b20: 1 },
        permanentesRetirados: { b20: 1 },
      },
    });

    expect(client.deudaAcumulada).toBe(130);
    expect(client.envasesPermanentes).toMatchObject({ b20: 2 });
    expect(client.envasesExtra).toMatchObject({ b20: 1, b12: 1 });
    expect(client.envasesPrestados).toBeUndefined();
    expect(stockDelta).toEqual({ b20: 0, b12: 1, sifon: 0 });
  });

  it("replaces the previous visit effect when editing", () => {
    const { client, stockDelta } = deriveVisitEffects({
      client: {
        id: "cliente-1",
        deudaAcumulada: 135,
        envasesPermanentes: { b20: 4 },
        envasesExtra: { b20: 2 },
      },
      previousVisit: {
        ajusteDeudaManual: 10,
        deudaCobrada: 5,
        deudaGenerada: 30,
        extrasPrestados: { b20: 2 },
        extrasRetirados: {},
        permanentesRetirados: { b20: 1 },
      },
      visit: {
        ajusteDeudaManual: 0,
        deudaCobrada: 0,
        deudaGenerada: 20,
        extrasPrestados: { b20: 1 },
        extrasRetirados: { b20: 1 },
        permanentesRetirados: { b20: 2 },
      },
    });

    expect(client.deudaAcumulada).toBe(120);
    expect(client.envasesPermanentes).toMatchObject({ b20: 3 });
    expect(client.envasesExtra).toMatchObject({ b20: 0 });
    expect(stockDelta).toEqual({ b20: -3, b12: 0, sifon: 0 });
  });

  it("replaces persisted fiado with a Mercado Pago prior-debt payment", () => {
    const { client } = deriveVisitEffects({
      client: { id: "cliente-1", deudaAcumulada: 1500 },
      previousVisit: { deudaGenerada: 500 },
      visit: { deudaCobrada: 1000, metodoDeuda: "mercadoPago" },
    });

    expect(client.deudaAcumulada).toBe(0);
  });
});

describe("applyDeliveryVisitMutation", () => {
  const previousVisit = { id: "visita-1", clienteId: "cliente-1", deudaGenerada: 500 };
  const replacementVisit = {
    id: "visita-1",
    clienteId: "cliente-1",
    deudaCobrada: 1000,
    metodoDeuda: "mercadoPago",
  };

  it("replaces the visit and its client debt together through one local mutation", () => {
    const mutate = vi.fn();
    const state = {
      clientes: [{ id: "cliente-1", deudaAcumulada: 1500 }],
      visitas: [previousVisit],
      stock: [],
      config: { stockActivo: false },
    };

    expect(
      applyDeliveryVisitMutation({ state, visit: replacementVisit, mutate })
    ).toEqual({ ok: true });

    expect(mutate).toHaveBeenCalledOnce();
    const [nextState, options] = mutate.mock.calls[0];
    expect(options).toEqual({ history: false });
    expect(nextState.visitas).toEqual([replacementVisit]);
    expect(nextState.clientes[0].deudaAcumulada).toBe(0);
  });

  it("does not report a partial save when the affected client is missing", () => {
    const mutate = vi.fn();

    expect(
      applyDeliveryVisitMutation({
        state: { clientes: [], visitas: [previousVisit], stock: [], config: {} },
        visit: replacementVisit,
        mutate,
      })
    ).toMatchObject({ ok: false, error: expect.stringMatching(/guardar/i) });

    expect(mutate).not.toHaveBeenCalled();
  });

  it("updates enabled worker stock in the same local mutation", () => {
    const mutate = vi.fn();
    const state = {
      clientes: [{ id: "cliente-1", deudaAcumulada: 0 }],
      visitas: [],
      stock: [{ id: "repartidor-1", b20: 5 }],
      config: { stockActivo: true },
    };

    expect(
      applyDeliveryVisitMutation({
        state,
        visit: { id: "visita-2", clienteId: "cliente-1", repartidorId: "repartidor-1", extrasPrestados: { b20: 1 } },
        mutate,
      })
    ).toEqual({ ok: true });

    expect(mutate.mock.calls[0][0].stock[0]).toMatchObject({ b20: 4 });
  });
});

describe("totalStreetDebt", () => {
  it("reports zero Plata en la calle after a fiado replacement", () => {
    expect(totalStreetDebt([{ id: "cliente-1", deudaAcumulada: 0 }])).toBe(0);
  });

  it("adds debt across clients", () => {
    expect(totalStreetDebt([{ deudaAcumulada: 500 }, { deudaAcumulada: 1000 }])).toBe(1500);
  });
});

describe("saveVisitAtomically", () => {
  const visit = {
    id: "visita-1",
    clienteId: "cliente-1",
    repartidorId: "repartidor-1",
    ajusteDeudaManual: 0,
    deudaCobrada: 0,
    deudaGenerada: 20,
    extrasPrestados: { b20: 1 },
    extrasRetirados: {},
    permanentesRetirados: {},
  };

  it("writes the visit, client, and enabled stock in one transaction", async () => {
    const refs = { client: { id: "client" }, visit: { id: "visit" }, stock: { id: "stock" } };
    const writes = [];
    const transaction = {
      get: async (ref) => {
        if (ref === refs.client) return { exists: () => true, data: () => ({ id: "cliente-1", deudaAcumulada: 100 }) };
        if (ref === refs.visit) return { exists: () => false };
        return { exists: () => true, data: () => ({ id: "repartidor-1", b20: 10 }) };
      },
      set: (ref, value) => writes.push([ref, value]),
    };

    const result = await saveVisitAtomically({
      runTransaction: async (_db, callback) => callback(transaction),
      db: {},
      refs,
      stockActive: true,
      visit,
    });

    expect(result).toEqual({ ok: true });
    expect(writes).toHaveLength(3);
    expect(writes).toContainEqual([refs.visit, visit]);
    expect(writes).toContainEqual([refs.client, expect.objectContaining({ deudaAcumulada: 120 })]);
    expect(writes).toContainEqual([refs.stock, expect.objectContaining({ b20: 9 })]);
  });

  it("reports a transaction failure without reporting a save", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const result = await saveVisitAtomically({
      runTransaction: async () => {
        throw new Error("unavailable");
      },
      db: {},
      refs: {},
      stockActive: true,
      visit,
    });
    errorSpy.mockRestore();

    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/No se pudo guardar/i);
  });

  it("persists the corrected debt when fiado is replaced by a Mercado Pago debt payment", async () => {
    const refs = { client: { id: "client" }, visit: { id: "visit" } };
    const writes = [];
    const transaction = {
      get: async (ref) => {
        if (ref === refs.client) {
          return { exists: () => true, data: () => ({ id: "cliente-1", deudaAcumulada: 1500 }) };
        }
        return { exists: () => true, data: () => ({ deudaGenerada: 500 }) };
      },
      set: (ref, value) => writes.push([ref, value]),
    };

    const result = await saveVisitAtomically({
      runTransaction: async (_db, callback) => callback(transaction),
      db: {},
      refs,
      stockActive: false,
      visit: { ...visit, deudaGenerada: 0, deudaCobrada: 1000, metodoDeuda: "mercadoPago" },
    });

    expect(result).toEqual({ ok: true });
    expect(writes).toContainEqual([refs.client, expect.objectContaining({ deudaAcumulada: 0 })]);
  });
});

describe("saveDeliveryVisit", () => {
  it("delegates a delivery save to the atomic path and returns its result", async () => {
    const refs = { client: { id: "client" }, visit: { id: "visit" } };
    const result = { ok: false, error: "unavailable" };
    const saveAtomically = vi.fn().mockResolvedValue(result);

    await expect(
      saveDeliveryVisit({
        saveAtomically,
        db: {},
        refs,
        stockActive: false,
        visit: { id: "visita-1" },
      })
    ).resolves.toEqual(result);

    expect(saveAtomically).toHaveBeenCalledWith({
      db: {},
      refs,
      stockActive: false,
      visit: { id: "visita-1" },
    });
  });
});

describe("submitVisit", () => {
  it("rejects an invalid sale without invoking persistence and returns inline feedback", async () => {
    const save = vi.fn();

    await expect(
      submitVisit({
        sale: {
          vendio: true,
          items: [{ tipo: "b20", cantidad: 0, precioUnitario: 5000 }],
          total: 0,
        },
        save,
      })
    ).resolves.toMatchObject({ ok: false, inlineError: expect.stringMatching(/cantidad.*total/i) });

    expect(save).not.toHaveBeenCalled();
  });

  it("keeps a failed save retryable with its returned feedback", async () => {
    const save = vi.fn().mockResolvedValue({ ok: false, error: "No se pudo confirmar la operación." });

    await expect(
      submitVisit({
        sale: { vendio: true, items: [{ tipo: "b20", cantidad: 1 }], total: 5000 },
        save,
      })
    ).resolves.toEqual({ ok: false, inlineError: "No se pudo confirmar la operación." });
  });

  it("makes a returned connection failure actionable", async () => {
    const save = vi.fn().mockResolvedValue({ ok: false, error: "offline" });

    await expect(
      submitVisit({
        sale: { vendio: true, items: [{ tipo: "b20", cantidad: 1 }], total: 5000 },
        save,
      })
    ).resolves.toMatchObject({
      ok: false,
      inlineError: expect.stringMatching(/conexi.n.*reintent/i),
    });
  });

  it("converts a thrown connection failure into actionable inline feedback", async () => {
    const save = vi.fn().mockRejectedValue(new Error("Failed to fetch: offline"));
    const setPending = vi.fn();

    await expect(
      submitVisit({
        sale: { vendio: true, items: [{ tipo: "b20", cantidad: 1 }], total: 5000 },
        save,
        setPending,
      })
    ).resolves.toMatchObject({
      ok: false,
      inlineError: expect.stringMatching(/conexi.n.*reintent/i),
    });

    expect(setPending).toHaveBeenNthCalledWith(1, true);
    expect(setPending).toHaveBeenLastCalledWith(false);
  });

  it("accepts one x20 bidon sold fiado with a positive total and reaches the save callback", async () => {
    const result = { ok: true };
    const save = vi.fn().mockResolvedValue(result);

    await expect(
      submitVisit({
        sale: {
          vendio: true,
          items: [{ tipo: "b20", cantidad: 1, precioUnitario: 5000 }],
          total: 5000,
          metodoPago: "deuda",
        },
        save,
      })
    ).resolves.toEqual(result);

    expect(save).toHaveBeenCalledOnce();
  });
});
