import { describe, expect, it } from "vitest";
import {
  changeSubscriptionPromotion,
  canSelectSubscription,
  clientSubscriptionSummaryView,
  createSubscription,
  createPromotionSnapshot,
  deliveryQuotaFeedback,
  getPeriod,
  getSubscriptionStatus,
  recordSubscriptionPayment,
  splitX20Delivery,
  subscriptionMetrics,
  subscriptionPeriodMetrics,
  upsertPromotion,
  validatePromotion,
} from "./dispenserSubscriptions";

describe("promotion validation", () => {
  it("accepts the supported boundary quotas with a positive inclusive price", () => {
    expect(validatePromotion({ cantidadX20: 4, precioMensual: 1000 })).toEqual({ ok: true });
    expect(validatePromotion({ cantidadX20: 10, precioMensual: 5000 })).toEqual({ ok: true });
  });

  it("rejects an unsupported quota and a non-positive monthly price", () => {
    expect(validatePromotion({ cantidadX20: 5, precioMensual: 1000 }).ok).toBe(false);
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
  it("creates, edits, activates, and deactivates promotions without rewriting snapshots", () => {
    const created = upsertPromotion([], { id: "p1", nombre: "Cuatro", cantidadX20: 4, precioMensual: 4000, activo: true });
    expect(created[0]).toMatchObject({ id: "p1", activo: true });
    const edited = upsertPromotion(created, { ...created[0], precioMensual: 4500, activo: false });
    expect(edited[0]).toMatchObject({ precioMensual: 4500, activo: false });
    expect(createPromotionSnapshot(created[0]).precioMensual).toBe(4000);
  });

  it("refuses invalid promotions before they can be persisted", () => {
    expect(() => upsertPromotion([], { id: "bad", cantidadX20: 3, precioMensual: 1000, activo: true })).toThrow(/4, 6, 8 o 10/i);
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
  const subscription = { id: "s1", clienteId: "c1", ...createPromotionSnapshot(plan4), cantidadConsumida: 0, cantidadRestante: 4, estadoPago: "pendiente" };

  it("replaces a mistaken plan before there is payment or delivery", () => {
    expect(changeSubscriptionPromotion({ subscription, promotion: plan6 })).toMatchObject({
      id: "s1", promocionId: "p6", promocionNombre: "Plan 6", cantidadX20: 6,
      precioMensual: 6000, cantidadConsumida: 0, cantidadRestante: 6, estadoPago: "pendiente",
    });
  });

  it("refuses corrections once payment or delivery gives the record accounting history", () => {
    expect(() => changeSubscriptionPromotion({ subscription: { ...subscription, cantidadConsumida: 1 }, promotion: plan6 })).toThrow(/entrega/i);
    expect(() => changeSubscriptionPromotion({ subscription: { ...subscription, reciboPago: { monto: 4000 } }, promotion: plan6 })).toThrow(/cobro/i);
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

  it("allows an eligible client from day 1 through day 10", () => {
    expect(getPeriod(clock)).toBe("2026-08");
    expect(canSelectSubscription({ client: eligible, subscriptions: [], now: clock })).toEqual({ ok: true });
    expect(canSelectSubscription({ client: eligible, subscriptions: [], now: new Date("2026-08-01T12:00:00") })).toEqual({ ok: true });
  });

  it("rejects ineligible clients, day 11, duplicates, and a prior overdue subscription", () => {
    expect(canSelectSubscription({ client: { ...eligible, maquinaFrioCalor: false }, subscriptions: [], now: clock }).ok).toBe(false);
    expect(canSelectSubscription({ client: eligible, subscriptions: [], now: new Date("2026-08-11T12:00:00") }).ok).toBe(false);
    expect(canSelectSubscription({ client: eligible, subscriptions: [{ id: "cliente-1-2026-08", clienteId: "cliente-1", periodo: "2026-08" }], now: clock }).ok).toBe(false);
    expect(canSelectSubscription({ client: eligible, subscriptions: [{ id: "cliente-1-2026-07", clienteId: "cliente-1", periodo: "2026-07", estadoPago: "vencida" }], now: clock }).ok).toBe(false);
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
});
