import { describe, expect, it } from "vitest";
import {
  changeSubscriptionPromotion,
  canSelectSubscription,
  clientSubscriptionSummaryView,
  createSubscription,
  createPromotionSnapshot,
  deliveryQuotaFeedback,
  formatVisitProductsText,
  getPeriod,
  getSubscriptionStatus,
  prepareSubscriptionVisitEdition,
  recordSubscriptionPayment,
  renewMonthlySubscriptions,
  resolveClientSubscriptionForPeriod,
  splitX20Delivery,
  subscriptionMetrics,
  subscriptionPeriodMetrics,
  subscriptionSummaryFrom,
  subscriptionUsageHistory,
  upsertPromotion,
  validatePromotion,
} from "./dispenserSubscriptions";

describe("promotion validation", () => {
  it("accepts any positive integer quota of 20L bottles with a positive monthly price", () => {
    expect(validatePromotion({ cantidadX20: 1, precioMensual: 1000 })).toEqual({ ok: true });
    expect(validatePromotion({ cantidadX20: 3, precioMensual: 1000 })).toEqual({ ok: true });
    expect(validatePromotion({ cantidadX20: 4, precioMensual: 1000 })).toEqual({ ok: true });
    expect(validatePromotion({ cantidadX20: 5, precioMensual: 2500 })).toEqual({ ok: true });
    expect(validatePromotion({ cantidadX20: 10, precioMensual: 5000 })).toEqual({ ok: true });
    expect(validatePromotion({ cantidadX20: 12, precioMensual: 18000 })).toEqual({ ok: true });
    expect(validatePromotion({ cantidadX20: 20, precioMensual: 30000 })).toEqual({ ok: true });
  });

  it("rejects zero, negative, or non-integer quotas and a non-positive monthly price", () => {
    expect(validatePromotion({ cantidadX20: 0, precioMensual: 1000 }).ok).toBe(false);
    expect(validatePromotion({ cantidadX20: -4, precioMensual: 1000 }).ok).toBe(false);
    expect(validatePromotion({ cantidadX20: 2.5, precioMensual: 1000 }).ok).toBe(false);
    expect(validatePromotion({ cantidadX20: 6, precioMensual: 0 }).ok).toBe(false);
  });

  it("takes an immutable commercial snapshot", () => {
    const promotion = { id: "promo-6", nombre: "Seis", cantidadX20: 6, precioMensual: 6000 };
    const snapshot = createPromotionSnapshot(promotion);
    promotion.precioMensual = 9000;

    expect(snapshot).toEqual({ promocionId: "promo-6", promocionNombre: "Seis", cantidadX20: 6, precioMensual: 6000 });
  });
});

describe("promotion administration", () => {
  it("creates, edits, activates, and deactivates promotions with any custom quota without rewriting snapshots", () => {
    const created = upsertPromotion([], { id: "p1", nombre: "Cinco personalizado", cantidadX20: 5, precioMensual: 12000, activo: true });
    expect(created[0]).toMatchObject({ id: "p1", cantidadX20: 5, activo: true });
    const edited = upsertPromotion(created, { ...created[0], precioMensual: 14500, activo: false });
    expect(edited[0]).toMatchObject({ precioMensual: 14500, activo: false });
    expect(createPromotionSnapshot(created[0]).precioMensual).toBe(12000);
  });

  it("refuses invalid promotions before they can be persisted", () => {
    expect(() => upsertPromotion([], { id: "bad", cantidadX20: 0, precioMensual: 1000, activo: true })).toThrow(/bidón|bidones/i);
  });
});

describe("payment, delivery, and reporting stay isolated from ordinary debt", () => {
  const pending = { id: "s-1", clienteId: "cliente-1", periodo: "2026-08", cantidadX20: 4, cantidadConsumida: 1, precioMensual: 4000, estadoPago: "pendiente" };

  it("keeps payment pending through day 15 and overdue from day 16", () => {
    expect(getSubscriptionStatus(pending, new Date("2026-08-15T12:00:00"))).toBe("pendiente");
    expect(getSubscriptionStatus(pending, new Date("2026-08-16T12:00:00"))).toBe("vencida");
  });

  it("records a full subscription receipt without debt-payment fields", () => {
    const paid = recordSubscriptionPayment(pending, { metodo: "mercadoPago", now: new Date("2026-08-12T12:00:00") });
    expect(paid).toMatchObject({ estadoPago: "pagada", reciboPago: { monto: 4000, metodo: "mercadoPago" } });
    expect(paid.deudaCobrada).toBeUndefined();
    expect(paid.deudaGenerada).toBeUndefined();
  });

  it("accepts every existing ordinary payment method as an isolated receipt", () => {
    for (const metodo of ["efectivo", "mercadopago"]) {
      expect(recordSubscriptionPayment(pending, { metodo }).reciboPago).toMatchObject({ monto: 4000, metodo });
    }
  });

  it("covers quota first and charges only excess at the ordinary unit price", () => {
    expect(splitX20Delivery({ quantity: 2, subscription: { ...pending, cantidadConsumida: 1 }, unitPrice: 5000 })).toEqual({ covered: 2, excess: 0, ordinaryAmount: 0, attribution: { subscriptionId: "s-1", periodo: "2026-08", cantidadX20: 2 } });
    expect(splitX20Delivery({ quantity: 5, subscription: { ...pending, cantidadConsumida: 3 }, unitPrice: 5000 })).toMatchObject({ covered: 1, excess: 4, ordinaryAmount: 20000 });
    expect(splitX20Delivery({ quantity: 2, subscription: null, unitPrice: 5000 })).toMatchObject({ covered: 0, excess: 2, ordinaryAmount: 10000, attribution: null });
  });

  it("reports subscription aggregates separately", () => {
    expect(subscriptionMetrics([pending, { ...pending, id: "s-2", estadoPago: "pagada", reciboPago: { monto: 4000 } }, { ...pending, id: "s-3", estadoPago: "vencida" }])).toEqual({ total: 3, paidTotal: 4000, pendingTotal: 4000, overdueTotal: 4000, overdueCount: 1, quotaTotal: 12, consumedTotal: 3, remainingTotal: 9 });
  });

  it("keeps subscription collections and included deliveries separate for a selected period", () => {
    expect(subscriptionPeriodMetrics({
      payments: [
        { reciboPago: { monto: 4000, metodo: "efectivo" } },
        { reciboPago: { monto: 6000, metodo: "mercadopago" } },
      ],
      deliveries: [
        { subscriptionAttribution: { cantidadX20: 2 } },
        { subscriptionAttribution: { cantidadX20: 3 } },
        { subscriptionAttribution: null },
      ],
    })).toEqual({ collectedTotal: 10000, paymentCount: 2, cashTotal: 4000, mercadoPagoTotal: 6000, deliveredB20: 5 });
  });
});

describe("subscription corrections", () => {
  const plan4 = { id: "p4", nombre: "Plan 4", cantidadX20: 4, precioMensual: 4000, activo: true };
  const plan6 = { id: "p6", nombre: "Plan 6", cantidadX20: 6, precioMensual: 6000, activo: true };
  const plan8 = { id: "p8", nombre: "Plan 8", cantidadX20: 8, precioMensual: 8000, activo: true };
  const plan10 = { id: "p10", nombre: "Plan 10", cantidadX20: 10, precioMensual: 10000, activo: true };
  const subscription = { id: "s1", clienteId: "c1", ...createPromotionSnapshot(plan4), cantidadConsumida: 0, cantidadRestante: 4, estadoPago: "pendiente" };

  it("replaces a mistaken plan before there is payment or delivery", () => {
    expect(changeSubscriptionPromotion({ subscription, promotion: plan6 })).toMatchObject({
      id: "s1", promocionId: "p6", promocionNombre: "Plan 6", cantidadX20: 6,
      precioMensual: 6000, cantidadConsumida: 0, cantidadRestante: 6, estadoPago: "pendiente",
    });
  });

  it("allows changing from a larger plan (10x20L) to a smaller one (8x20L) while preserving consumed bottles", () => {
    const sub10With3Consumed = {
      id: "s-10",
      clienteId: "c1",
      ...createPromotionSnapshot(plan10),
      cantidadConsumida: 3,
      cantidadRestante: 7,
      estadoPago: "pendiente",
    };

    expect(changeSubscriptionPromotion({ subscription: sub10With3Consumed, promotion: plan8 })).toMatchObject({
      id: "s-10",
      promocionId: "p8",
      promocionNombre: "Plan 8",
      cantidadX20: 8,
      precioMensual: 8000,
      cantidadConsumida: 3,
      cantidadRestante: 5,
      estadoPago: "pendiente",
    });
  });

  it("clamps cantidadRestante to 0 without negative values when changing to a plan with quota <= already consumed", () => {
    const sub10With6Consumed = {
      id: "s-10",
      clienteId: "c1",
      ...createPromotionSnapshot(plan10),
      cantidadConsumida: 6,
      cantidadRestante: 4,
      estadoPago: "pendiente",
    };

    expect(changeSubscriptionPromotion({ subscription: sub10With6Consumed, promotion: plan4 })).toMatchObject({
      promocionId: "p4",
      cantidadX20: 4,
      cantidadConsumida: 6,
      cantidadRestante: 0,
    });
  });

  it("preserves paid status and updates receipt amount when changing the plan of an already paid subscription", () => {
    const paidSub = {
      id: "s-paid",
      clienteId: "c1",
      ...createPromotionSnapshot(plan10),
      cantidadConsumida: 2,
      cantidadRestante: 8,
      estadoPago: "pagada",
      reciboPago: { monto: 10000, metodo: "efectivo", fecha: "2026-11-05T10:00:00.000Z" },
    };

    expect(changeSubscriptionPromotion({ subscription: paidSub, promotion: plan8 })).toMatchObject({
      id: "s-paid",
      promocionId: "p8",
      promocionNombre: "Plan 8",
      cantidadX20: 8,
      precioMensual: 8000,
      cantidadConsumida: 2,
      cantidadRestante: 6,
      estadoPago: "pagada",
      reciboPago: {
        monto: 8000,
        metodo: "efectivo",
        fecha: "2026-11-05T10:00:00.000Z",
      },
    });
  });

  it("rejects missing subscription or inactive/invalid promotions", () => {
    expect(() => changeSubscriptionPromotion({ subscription: null, promotion: plan6 })).toThrow(/abono/i);
    expect(() => changeSubscriptionPromotion({ subscription, promotion: { ...plan6, activo: false } })).toThrow(/disponible/i);
    expect(() => changeSubscriptionPromotion({ subscription, promotion: { ...plan6, cantidadX20: 0 } })).toThrow(/disponible/i);
  });
});

describe("durable subscription records", () => {
  const promotion = { id: "promo-4", nombre: "Cuatro", cantidadX20: 4, precioMensual: 4000, activo: true };
  const client = { id: "cliente-1", maquinaFrioCalor: true };

  it("creates one immutable client-period record and summary", () => {
    const subscription = createSubscription({ client, promotion, now: new Date("2026-08-05T12:00:00") });
    expect(subscription).toMatchObject({ id: "cliente-1-2026-08", periodo: "2026-08", cantidadX20: 4, cantidadConsumida: 0, estadoPago: "pendiente" });
    expect(() => createSubscription({ client, promotion, now: new Date("2026-08-05T12:00:00"), subscriptions: [subscription] })).toThrow(/ya tiene/i);
  });
});

describe("monthly subscription selection", () => {
  const clock = new Date("2026-08-10T12:00:00");
  const eligible = { id: "cliente-1", maquinaFrioCalor: true };
  const promotion = { id: "promo-6", nombre: "Plan 6", cantidadX20: 6, precioMensual: 6000, activo: true };

  it("allows an eligible client on any day of the month and even with a prior overdue subscription", () => {
    expect(getPeriod(clock)).toBe("2026-08");
    expect(canSelectSubscription({ client: eligible, subscriptions: [], now: new Date("2026-08-01T12:00:00") })).toEqual({ ok: true });
    expect(canSelectSubscription({ client: eligible, subscriptions: [], now: clock })).toEqual({ ok: true });
    expect(canSelectSubscription({ client: eligible, subscriptions: [], now: new Date("2026-08-20T12:00:00") })).toEqual({ ok: true });
    expect(canSelectSubscription({ client: eligible, subscriptions: [], now: new Date("2026-08-31T12:00:00") })).toEqual({ ok: true });
    expect(
      canSelectSubscription({
        client: eligible,
        subscriptions: [{ id: "cliente-1-2026-07", clienteId: "cliente-1", periodo: "2026-07", estadoPago: "vencida" }],
        now: new Date("2026-08-20T12:00:00"),
      })
    ).toEqual({ ok: true });
    expect(
      createSubscription({
        client: eligible,
        promotion,
        subscriptions: [{ id: "cliente-1-2026-07", clienteId: "cliente-1", periodo: "2026-07", estadoPago: "vencida" }],
        now: new Date("2026-11-20T12:00:00"),
      })
    ).toMatchObject({
      id: "cliente-1-2026-11",
      clienteId: "cliente-1",
      periodo: "2026-11",
      promocionId: "promo-6",
      cantidadX20: 6,
      cantidadConsumida: 0,
      cantidadRestante: 6,
      estadoPago: "pendiente",
    });
  });

  it("rejects only ineligible clients and duplicate subscriptions for the same period", () => {
    expect(canSelectSubscription({ client: { ...eligible, maquinaFrioCalor: false }, subscriptions: [], now: clock })).toEqual({
      ok: false,
      error: "Solo los clientes con máquina frío/calor pueden suscribirse.",
    });
    expect(
      canSelectSubscription({
        client: eligible,
        subscriptions: [{ id: "cliente-1-2026-08", clienteId: "cliente-1", periodo: "2026-08" }],
        now: new Date("2026-08-20T12:00:00"),
      })
    ).toEqual({
      ok: false,
      error: "El cliente ya tiene una suscripción para este período.",
    });
  });
});

describe("monthly subscription renewal and history", () => {
  const client = {
    id: "cliente-1",
    nombre: "Dani",
    maquinaFrioCalor: true,
    subscriptionSummary: { subscriptionId: "cliente-1-2026-09", periodo: "2026-09" },
  };
  const september = {
    id: "cliente-1-2026-09",
    clienteId: "cliente-1",
    periodo: "2026-09",
    promocionId: "p4",
    promocionNombre: "Plan 4",
    cantidadX20: 4,
    cantidadConsumida: 3,
    cantidadRestante: 1,
    precioMensual: 4000,
    estadoPago: "pagada",
    reciboPago: { monto: 4000, metodo: "efectivo" },
  };

  it("opens a fresh period from day 1 without rewriting the previous subscription", () => {
    const renewed = renewMonthlySubscriptions({ clients: [client], subscriptions: [september], now: new Date("2026-10-01T09:00:00") });

    expect(renewed.renewed).toEqual(["cliente-1"]);
    expect(renewed.subscriptions).toHaveLength(2);
    expect(renewed.subscriptions[0]).toEqual(september);
    expect(renewed.subscriptions[1]).toMatchObject({
      id: "cliente-1-2026-10", periodo: "2026-10", cantidadX20: 4,
      cantidadConsumida: 0, cantidadRestante: 4, estadoPago: "pendiente",
      renovadaAutomaticamente: true, suscripcionAnteriorId: "cliente-1-2026-09",
    });
    expect(renewed.subscriptions[1].reciboPago).toBeUndefined();
    expect(renewed.clients[0].subscriptionSummary).toMatchObject({ subscriptionId: "cliente-1-2026-10", periodo: "2026-10", cantidadRestante: 4 });
  });

  it("does not duplicate the current month and gives each period its own delivered history", () => {
    const october = { ...september, id: "cliente-1-2026-10", periodo: "2026-10", cantidadConsumida: 1, cantidadRestante: 3, estadoPago: "pendiente" };
    const result = renewMonthlySubscriptions({ clients: [client, { id: "sin-abono", maquinaFrioCalor: true }], subscriptions: [september, october], now: new Date("2026-10-03T09:00:00") });
    const history = subscriptionUsageHistory({
      clientId: client.id,
      subscriptions: result.subscriptions,
      visits: [
        { fecha: "2026-09-15", subscriptionAttribution: { subscriptionId: september.id, cantidadX20: 2 } },
        { fecha: "2026-10-02", subscriptionAttribution: { subscriptionId: october.id, cantidadX20: 1 } },
      ],
    });

    expect(result.renewed).toEqual([]);
    expect(result.synced).toEqual(["cliente-1"]);
    expect(result.subscriptions).toHaveLength(2);
    expect(result.clients[0].subscriptionSummary.subscriptionId).toBe(october.id);
    expect(history).toEqual([
      expect.objectContaining({ id: october.id, deliveredTotal: 1, deliveries: [expect.objectContaining({ fecha: "2026-10-02", cantidadX20: 1 })] }),
      expect.objectContaining({ id: september.id, deliveredTotal: 2, deliveries: [expect.objectContaining({ fecha: "2026-09-15", cantidadX20: 2 })] }),
    ]);
  });

  it("renews automatically even if client.subscriptionSummary was lost or stuck on an older month", () => {
    const clientWithoutSummary = {
      id: "cliente-1",
      nombre: "Dani",
      maquinaFrioCalor: true,
      subscriptionSummary: null,
    };
    const august = {
      ...september,
      id: "cliente-1-2026-08",
      periodo: "2026-08",
      promocionId: "p4",
      promocionNombre: "Plan 4",
      cantidadX20: 4,
    };
    const septemberUpgraded = {
      ...september,
      id: "cliente-1-2026-09",
      periodo: "2026-09",
      promocionId: "p6",
      promocionNombre: "Plan 6",
      cantidadX20: 6,
    };
    const clientStuckInAugust = {
      ...client,
      subscriptionSummary: { subscriptionId: "cliente-1-2026-08", periodo: "2026-08" },
    };

    const fromMissingSummary = renewMonthlySubscriptions({
      clients: [clientWithoutSummary],
      subscriptions: [septemberUpgraded],
      now: new Date("2026-10-05T10:00:00"),
    });
    expect(fromMissingSummary.renewed).toEqual(["cliente-1"]);
    expect(fromMissingSummary.clients[0].subscriptionSummary).toMatchObject({
      subscriptionId: "cliente-1-2026-10",
      periodo: "2026-10",
      cantidadRestante: 6,
    });

    const fromStuckSummary = renewMonthlySubscriptions({
      clients: [clientStuckInAugust],
      subscriptions: [august, septemberUpgraded],
      now: new Date("2026-10-05T10:00:00"),
    });
    expect(fromStuckSummary.renewed).toEqual(["cliente-1"]);
    expect(fromStuckSummary.subscriptions).toContainEqual(
      expect.objectContaining({
        id: "cliente-1-2026-10",
        periodo: "2026-10",
        cantidadX20: 6,
        suscripcionAnteriorId: "cliente-1-2026-09",
      })
    );
  });

  it("resolves or synthesizes the active subscription for the visit period so deliveries never fall back to normal sales", () => {
    const staleClient = {
      id: "cliente-1",
      nombre: "Dani",
      maquinaFrioCalor: true,
      subscriptionSummary: {
        subscriptionId: "cliente-1-2026-09",
        periodo: "2026-09",
        cantidadConsumida: 4,
        cantidadRestante: 0,
      },
    };
    const exhaustedSeptember = {
      ...september,
      cantidadConsumida: 4,
      cantidadRestante: 0,
    };

    const synthesizedOctober = resolveClientSubscriptionForPeriod({
      client: staleClient,
      subscriptions: [exhaustedSeptember],
      period: "2026-10",
      now: new Date("2026-10-02T12:00:00"),
    });
    expect(synthesizedOctober).toMatchObject({
      id: "cliente-1-2026-10",
      clienteId: "cliente-1",
      periodo: "2026-10",
      cantidadX20: 4,
      cantidadConsumida: 0,
      cantidadRestante: 4,
      renovadaAutomaticamente: true,
    });

    const beforeFirstSubscription = resolveClientSubscriptionForPeriod({
      client: staleClient,
      subscriptions: [exhaustedSeptember],
      period: "2026-08",
      now: new Date("2026-08-15T12:00:00"),
    });
    expect(beforeFirstSubscription).toBeNull();
  });

  it("automatically reconciles a current-month b20 visit that was recorded as a normal sale before the subscription renewed", () => {
    const clientWithOldSummary = {
      id: "cliente-1",
      nombre: "Cliente Abono",
      maquinaFrioCalor: true,
      deudaAcumulada: 7000,
      subscriptionSummary: {
        subscriptionId: "cliente-1-2026-10",
        periodo: "2026-10",
        cantidadConsumida: 4,
        cantidadRestante: 0,
      },
    };
    const octoberSub = {
      ...september,
      id: "cliente-1-2026-10",
      periodo: "2026-10",
      cantidadX20: 4,
      cantidadConsumida: 4,
      cantidadRestante: 0,
    };
    const mistakenNormalVisit = {
      id: "visita-11-nov",
      clienteId: "cliente-1",
      fecha: "2026-11-11",
      vendio: true,
      items: [
        { tipo: "b20", cantidad: 2, precioUnitario: 3500 },
        { tipo: "sifon", cantidad: 0, precioUnitario: 1500 },
      ],
      total: 7000,
      metodoPago: "deuda",
      pagos: {},
      deudaGenerada: 7000,
      deudaCobrada: 0,
      subscriptionAttribution: null,
    };

    const result = renewMonthlySubscriptions({
      clients: [clientWithOldSummary],
      subscriptions: [octoberSub],
      visits: [mistakenNormalVisit],
      now: new Date("2026-11-11T15:00:00"),
    });

    expect(result.renewed).toEqual(["cliente-1"]);
    expect(result.reconciledVisits).toEqual(["visita-11-nov"]);
    expect(result.subscriptions[1]).toMatchObject({
      id: "cliente-1-2026-11",
      periodo: "2026-11",
      cantidadConsumida: 2,
      cantidadRestante: 2,
    });
    expect(result.clients[0]).toMatchObject({
      id: "cliente-1",
      deudaAcumulada: 0,
      subscriptionSummary: {
        subscriptionId: "cliente-1-2026-11",
        periodo: "2026-11",
        cantidadConsumida: 2,
        cantidadRestante: 2,
      },
    });
    expect(result.visits[0]).toMatchObject({
      id: "visita-11-nov",
      total: 0,
      metodoPago: null,
      pagos: {},
      deudaGenerada: 0,
      subscriptionAttribution: {
        subscriptionId: "cliente-1-2026-11",
        periodo: "2026-11",
        cantidadX20: 2,
      },
    });
    expect(result.visits[0].items.find((i) => i.tipo === "b20").cantidad).toBe(0);
  });

  it("reconciles partial quota coverage and preserves excess b20 plus other products on a cash visit", () => {
    const clientWithOldSummary = {
      id: "cliente-1",
      nombre: "Cliente Abono",
      maquinaFrioCalor: true,
      deudaAcumulada: 0,
      subscriptionSummary: {
        subscriptionId: "cliente-1-2026-10",
        periodo: "2026-10",
      },
    };
    const octoberSub = {
      ...september,
      id: "cliente-1-2026-10",
      periodo: "2026-10",
      cantidadX20: 4,
      cantidadConsumida: 4,
      cantidadRestante: 0,
    };
    const mixedNormalVisit = {
      id: "visita-mixta",
      clienteId: "cliente-1",
      fecha: "2026-11-11",
      vendio: true,
      items: [
        { tipo: "b20", cantidad: 5, precioUnitario: 3000 },
        { tipo: "sifon", cantidad: 1, precioUnitario: 1500 },
      ],
      total: 16500,
      metodoPago: "efectivo",
      pagos: { efectivo: 16500 },
      deudaGenerada: 0,
      deudaCobrada: 0,
      subscriptionAttribution: null,
    };

    const result = renewMonthlySubscriptions({
      clients: [clientWithOldSummary],
      subscriptions: [octoberSub],
      visits: [mixedNormalVisit],
      now: new Date("2026-11-11T15:00:00"),
    });

    expect(result.reconciledVisits).toEqual(["visita-mixta"]);
    expect(result.subscriptions[1]).toMatchObject({
      id: "cliente-1-2026-11",
      cantidadConsumida: 4,
      cantidadRestante: 0,
    });
    expect(result.visits[0]).toMatchObject({
      id: "visita-mixta",
      total: 4500,
      metodoPago: "efectivo",
      pagos: { efectivo: 4500 },
      deudaGenerada: 0,
      subscriptionAttribution: {
        subscriptionId: "cliente-1-2026-11",
        periodo: "2026-11",
        cantidadX20: 4,
      },
    });
    expect(result.visits[0].items.find((i) => i.tipo === "b20").cantidad).toBe(1);
  });

  it("repairs a desynchronized 0/6 counter when attributed deliveries already exist and adds any unattributed delivery from today", () => {
    const flavia = {
      id: "flavia",
      nombre: "Flavia alvarez",
      maquinaFrioCalor: true,
      deudaAcumulada: 0,
      subscriptionSummary: {
        subscriptionId: "flavia-2026-11",
        periodo: "2026-11",
        estadoPago: "pendiente",
        promocionId: "promo-6",
        promocionNombre: "Abono 6 bidones",
        cantidadConsumida: 0,
        cantidadRestante: 6,
      },
    };
    const novemberDesynced = {
      id: "flavia-2026-11",
      clienteId: "flavia",
      periodo: "2026-11",
      promocionId: "promo-6",
      promocionNombre: "Abono 6 bidones",
      cantidadX20: 6,
      cantidadConsumida: 0,
      cantidadRestante: 6,
      precioMensual: 15000,
      estadoPago: "pendiente",
    };
    const visitNov6Attributed = {
      id: "v-nov-06",
      clienteId: "flavia",
      fecha: "2026-11-06",
      vendio: true,
      items: [{ tipo: "b20", cantidad: 0, precioUnitario: 3500 }],
      total: 0,
      subscriptionAttribution: {
        subscriptionId: "flavia-2026-11",
        periodo: "2026-11",
        cantidadX20: 2,
      },
    };
    const visitTodayNormal = {
      id: "v-nov-11",
      clienteId: "flavia",
      fecha: "2026-11-11",
      vendio: true,
      items: [{ tipo: "b20", cantidad: 2, precioUnitario: 3500 }],
      total: 7000,
      metodoPago: "efectivo",
      pagos: { efectivo: 7000 },
      deudaGenerada: 0,
      subscriptionAttribution: null,
    };

    const result = renewMonthlySubscriptions({
      clients: [flavia],
      subscriptions: [novemberDesynced],
      visits: [visitNov6Attributed, visitTodayNormal],
      now: new Date("2026-11-11T18:00:00"),
    });

    expect(result.synced).toEqual(["flavia"]);
    expect(result.reconciledVisits).toEqual(["v-nov-11"]);
    expect(result.subscriptions[0]).toMatchObject({
      id: "flavia-2026-11",
      cantidadConsumida: 4,
      cantidadRestante: 2,
    });
    expect(result.clients[0].subscriptionSummary).toMatchObject({
      subscriptionId: "flavia-2026-11",
      cantidadConsumida: 4,
      cantidadRestante: 2,
    });
  });
});

describe("subscription UI boundaries", () => {
  it("shows no subscription for a legacy eligible client without changing ordinary sales", () => {
    expect(clientSubscriptionSummaryView({ client: { id: "c1", maquinaFrioCalor: true }, subscription: null, now: new Date("2026-08-16T12:00:00") })).toEqual({ eligible: true, state: "none", label: "Sin suscripción" });
  });

  it("shows the current period, payment state, consumption, remaining quota, and overdue status", () => {
    expect(clientSubscriptionSummaryView({ client: { id: "c1", maquinaFrioCalor: true }, subscription: { id: "s1", periodo: "2026-08", cantidadX20: 6, cantidadConsumida: 2, estadoPago: "pendiente" }, now: new Date("2026-08-16T12:00:00") })).toEqual({ eligible: true, state: "vencida", label: "Vencida", period: "2026-08", consumed: 2, remaining: 4, overdue: true });
  });

  it("provides covered, remaining, excess, and retryable error feedback for delivery UI", () => {
    expect(deliveryQuotaFeedback({ quantity: 3, subscription: { id: "s1", periodo: "2026-08", cantidadX20: 4, cantidadConsumida: 2 }, unitPrice: 5000 })).toEqual({ quota: 4, covered: 2, remaining: 0, excess: 1, ordinaryAmount: 5000, retryableError: null });
    expect(deliveryQuotaFeedback({ quantity: 1, subscription: null, unitPrice: 5000, mutationError: "offline" })).toMatchObject({ quota: 0, covered: 0, excess: 1, retryableError: expect.stringMatching(/conexi.n.*reintent/i) });
  });

  it("prepares subscription visit edition so drivers and admins can lower, raise, keep, or zero out an attributed b20 delivery", () => {
    const currentSubscription = {
      id: "c1-2026-11",
      clienteId: "c1",
      periodo: "2026-11",
      promocionId: "p6",
      promocionNombre: "Plan 6",
      cantidadX20: 6,
      cantidadConsumida: 3,
      cantidadRestante: 3,
      estadoPago: "pendiente",
    };
    const visitaInicial = {
      id: "v1",
      clienteId: "c1",
      fecha: "2026-11-12",
      vendio: true,
      items: [{ tipo: "b20", cantidad: 0, precioUnitario: 3500 }],
      subscriptionAttribution: {
        subscriptionId: "c1-2026-11",
        periodo: "2026-11",
        cantidadX20: 2,
      },
    };

    const prep = prepareSubscriptionVisitEdition({
      visitaInicial,
      currentSubscription,
    });

    expect(prep.esEdicion).toBe(true);
    expect(prep.initialB20Quantity).toBe(2);
    expect(prep.subscriptionForCalculation).toMatchObject({
      id: "c1-2026-11",
      cantidadConsumida: 1,
      cantidadRestante: 5,
    });

    // Mantener cantidad (ej. editando notas o deuda): no duplica consumo
    expect(
      splitX20Delivery({
        quantity: prep.initialB20Quantity,
        subscription: prep.subscriptionForCalculation,
        unitPrice: 3500,
      })
    ).toEqual({
      covered: 2,
      excess: 0,
      ordinaryAmount: 0,
      attribution: {
        subscriptionId: "c1-2026-11",
        periodo: "2026-11",
        cantidadX20: 2,
      },
    });

    // Bajar de 2 a 1
    expect(
      splitX20Delivery({
        quantity: 1,
        subscription: prep.subscriptionForCalculation,
        unitPrice: 3500,
      })
    ).toEqual({
      covered: 1,
      excess: 0,
      ordinaryAmount: 0,
      attribution: {
        subscriptionId: "c1-2026-11",
        periodo: "2026-11",
        cantidadX20: 1,
      },
    });

    // Subir de 2 a 6 (5 cubiertos por el remanente previo 5, 1 excedente)
    expect(
      splitX20Delivery({
        quantity: 6,
        subscription: prep.subscriptionForCalculation,
        unitPrice: 3500,
      })
    ).toEqual({
      covered: 5,
      excess: 1,
      ordinaryAmount: 3500,
      attribution: {
        subscriptionId: "c1-2026-11",
        periodo: "2026-11",
        cantidadX20: 5,
      },
    });

    // Bajar a 0 (ej. cliente no estaba)
    expect(
      splitX20Delivery({
        quantity: 0,
        subscription: prep.subscriptionForCalculation,
        unitPrice: 3500,
      })
    ).toEqual({
      covered: 0,
      excess: 0,
      ordinaryAmount: 0,
      attribution: null,
    });
  });

  it("includes promocionId and promocionNombre in subscriptionSummaryFrom", () => {
    const sub = {
      id: "c1-2026-11",
      periodo: "2026-11",
      estadoPago: "pendiente",
      promocionId: "p6",
      promocionNombre: "Plan 6",
      cantidadX20: 6,
      cantidadConsumida: 0,
    };
    expect(subscriptionSummaryFrom(sub)).toEqual({
      subscriptionId: "c1-2026-11",
      periodo: "2026-11",
      estadoPago: "pendiente",
      promocionId: "p6",
      promocionNombre: "Plan 6",
      cantidadConsumida: 0,
      cantidadRestante: 6,
    });
  });

  it("formats visit product texts including 100% subscription deliveries, mixed deliveries, and ordinary sales", () => {
    const catalogo = [
      { key: "b20", corto: "20L" },
      { key: "b12", corto: "12L" },
      { key: "sifon", corto: "Sifón" },
    ];

    const soloAbono = {
      vendio: true,
      items: [{ tipo: "b20", cantidad: 0 }],
      subscriptionAttribution: { subscriptionId: "s-1", cantidadX20: 2 },
    };
    expect(formatVisitProductsText(soloAbono, catalogo)).toBe("2× 20L (Abono)");

    const mixta = {
      vendio: true,
      items: [
        { tipo: "b20", cantidad: 1 },
        { tipo: "sifon", cantidad: 3 },
      ],
      subscriptionAttribution: { subscriptionId: "s-1", cantidadX20: 2 },
    };
    expect(formatVisitProductsText(mixta, catalogo)).toBe(
      "2× 20L (Abono), 1× 20L, 3× Sifón"
    );
    expect(formatVisitProductsText(mixta, catalogo, " + ")).toBe(
      "2× 20L (Abono) + 1× 20L + 3× Sifón"
    );

    const comun = {
      vendio: true,
      items: [
        { tipo: "b20", cantidad: 2 },
        { tipo: "b12", cantidad: 1 },
      ],
      subscriptionAttribution: null,
    };
    expect(formatVisitProductsText(comun, catalogo)).toBe("2× 20L, 1× 12L");
  });
});
