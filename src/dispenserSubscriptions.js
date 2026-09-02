export const SUBSCRIPTION_QUOTAS = [4, 6, 8, 10];

export function validatePromotion({ cantidadX20, precioMensual } = {}) {
  if (!SUBSCRIPTION_QUOTAS.includes(Number(cantidadX20))) {
    return { ok: false, error: "La promoción debe incluir 4, 6, 8 o 10 bidones de 20L." };
  }
  if (!(Number(precioMensual) > 0)) {
    return { ok: false, error: "El precio mensual debe ser mayor que cero." };
  }
  return { ok: true };
}

export function createPromotionSnapshot(promotion) {
  return {
    promocionId: promotion.id,
    promocionNombre: promotion.nombre,
    cantidadX20: Number(promotion.cantidadX20),
    precioMensual: Number(promotion.precioMensual),
  };
}

export function upsertPromotion(promotions = [], promotion) {
  const validation = validatePromotion(promotion);
  if (!validation.ok) throw new Error(validation.error);
  const normalized = {
    ...promotion,
    cantidadX20: Number(promotion.cantidadX20),
    precioMensual: Number(promotion.precioMensual),
    activo: promotion.activo !== false,
  };
  const index = promotions.findIndex((item) => item.id === normalized.id);
  if (index < 0) return [...promotions, normalized];
  const next = promotions.slice();
  next[index] = normalized;
  return next;
}

export function getPeriod(now = new Date()) {
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
}

function isUnpaidOverdue(subscription) {
  return subscription.estadoPago === "vencida" && !subscription.reciboPago;
}

export function canSelectSubscription({ client, subscriptions = [], now = new Date() }) {
  if (!client?.maquinaFrioCalor) return { ok: false, error: "Solo los clientes con máquina frío/calor pueden suscribirse." };
  const day = now.getDate();
  if (day < 1 || day > 10) return { ok: false, error: "La promoción se puede elegir del día 1 al 10." };
  const period = getPeriod(now);
  if (subscriptions.some((subscription) => subscription.clienteId === client.id && subscription.periodo === period)) {
    return { ok: false, error: "El cliente ya tiene una suscripción para este período." };
  }
  if (subscriptions.some((subscription) => subscription.clienteId === client.id && subscription.periodo < period && isUnpaidOverdue(subscription))) {
    return { ok: false, error: "El cliente tiene una suscripción vencida pendiente." };
  }
  return { ok: true };
}

export function getSubscriptionStatus(subscription, now = new Date()) {
  if (subscription.reciboPago || subscription.estadoPago === "pagada") return "pagada";
  return now.getDate() >= 16 && getPeriod(now) >= subscription.periodo ? "vencida" : "pendiente";
}

export function createSubscription({ client, promotion, subscriptions = [], now = new Date() }) {
  const selection = canSelectSubscription({ client, subscriptions, now });
  if (!selection.ok) throw new Error(selection.error);
  if (!promotion?.activo || !validatePromotion(promotion).ok) throw new Error("La promoción no está disponible.");
  const periodo = getPeriod(now);
  return {
    id: `${client.id}-${periodo}`,
    clienteId: client.id,
    periodo,
    ...createPromotionSnapshot(promotion),
    cantidadConsumida: 0,
    cantidadRestante: Number(promotion.cantidadX20),
    estadoPago: "pendiente",
    fechaSeleccion: now.toISOString(),
  };
}

export function changeSubscriptionPromotion({ subscription, promotion }) {
  if (!subscription) throw new Error("No se encontró el abono a corregir.");
  if (subscription.reciboPago) {
    throw new Error("No se puede cambiar un abono que ya tiene un cobro registrado.");
  }
  if (Number(subscription.cantidadConsumida) > 0) {
    throw new Error("No se puede cambiar un abono que ya tiene una entrega registrada.");
  }
  if (!promotion?.activo || !validatePromotion(promotion).ok) {
    throw new Error("La promoción elegida no está disponible.");
  }

  return {
    ...subscription,
    ...createPromotionSnapshot(promotion),
    cantidadConsumida: 0,
    cantidadRestante: Number(promotion.cantidadX20),
    estadoPago: "pendiente",
  };
}

export function recordSubscriptionPayment(subscription, { metodo, now = new Date() }) {
  if (!metodo) throw new Error("Seleccioná un método de pago.");
  return {
    ...subscription,
    estadoPago: "pagada",
    reciboPago: { monto: Number(subscription.precioMensual), metodo, fecha: now.toISOString() },
  };
}

export function splitX20Delivery({ quantity, subscription, unitPrice }) {
  const requested = Math.max(0, Number(quantity) || 0);
  const remaining = subscription ? Math.max(0, Number(subscription.cantidadX20) - Number(subscription.cantidadConsumida || 0)) : 0;
  const covered = Math.min(requested, remaining);
  const excess = requested - covered;
  return {
    covered,
    excess,
    ordinaryAmount: excess * (Number(unitPrice) || 0),
    attribution: covered ? { subscriptionId: subscription.id, periodo: subscription.periodo, cantidadX20: covered } : null,
  };
}

export function clientSubscriptionSummaryView({ client, subscription, now = new Date() }) {
  if (!client?.maquinaFrioCalor) return { eligible: false, state: "ineligible", label: "No elegible" };
  if (!subscription) return { eligible: true, state: "none", label: "Sin suscripción" };
  const state = getSubscriptionStatus(subscription, now);
  const consumed = Number(subscription.cantidadConsumida) || 0;
  return {
    eligible: true,
    state,
    label: state === "vencida" ? "Vencida" : state === "pagada" ? "Pagada" : "Pendiente",
    period: subscription.periodo,
    consumed,
    remaining: Math.max(0, (Number(subscription.cantidadX20) || 0) - consumed),
    overdue: state === "vencida",
  };
}

export function deliveryQuotaFeedback({ quantity, subscription, unitPrice, mutationError = null }) {
  const split = splitX20Delivery({ quantity, subscription, unitPrice });
  const quota = Number(subscription?.cantidadX20) || 0;
  const consumed = Number(subscription?.cantidadConsumida) || 0;
  return {
    quota,
    covered: split.covered,
    remaining: Math.max(0, quota - consumed - split.covered),
    excess: split.excess,
    ordinaryAmount: split.ordinaryAmount,
    retryableError: mutationError ? "No se pudo guardar por conexión. Revisá la conexión y reintentá." : null,
  };
}

export function subscriptionMetrics(subscriptions = []) {
  return subscriptions.reduce((metrics, subscription) => {
    const price = Number(subscription.precioMensual) || 0;
    const quota = Number(subscription.cantidadX20) || 0;
    const consumed = Number(subscription.cantidadConsumida) || 0;
    metrics.total += 1;
    metrics.quotaTotal += quota;
    metrics.consumedTotal += consumed;
    metrics.remainingTotal += Math.max(0, quota - consumed);
    if (subscription.estadoPago === "pagada") metrics.paidTotal += price;
    else if (subscription.estadoPago === "vencida") { metrics.overdueTotal += price; metrics.overdueCount += 1; }
    else metrics.pendingTotal += price;
    return metrics;
  }, { total: 0, paidTotal: 0, pendingTotal: 0, overdueTotal: 0, overdueCount: 0, quotaTotal: 0, consumedTotal: 0, remainingTotal: 0 });
}

export function subscriptionPeriodMetrics({ payments = [], deliveries = [] } = {}) {
  return payments.reduce(
    (metrics, subscription) => {
      const receipt = subscription.reciboPago || {};
      const amount = Number(receipt.monto) || 0;
      metrics.collectedTotal += amount;
      metrics.paymentCount += 1;
      if (receipt.metodo === "efectivo") metrics.cashTotal += amount;
      if (receipt.metodo === "mercadopago") metrics.mercadoPagoTotal += amount;
      return metrics;
    },
    {
      collectedTotal: 0,
      paymentCount: 0,
      cashTotal: 0,
      mercadoPagoTotal: 0,
      deliveredB20: deliveries.reduce(
        (total, visit) =>
          total + (Number(visit.subscriptionAttribution?.cantidadX20) || 0),
        0
      ),
    }
  );
}
