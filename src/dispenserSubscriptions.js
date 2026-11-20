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

export function canSelectSubscription({ client, subscriptions = [], now = new Date() }) {
  if (!client?.maquinaFrioCalor) return { ok: false, error: "Solo los clientes con máquina frío/calor pueden suscribirse." };
  const period = getPeriod(now);
  if (subscriptions.some((subscription) => subscription.clienteId === client.id && subscription.periodo === period)) {
    return { ok: false, error: "El cliente ya tiene una suscripción para este período." };
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

export function subscriptionSummaryFrom(subscription) {
  return {
    subscriptionId: subscription.id,
    periodo: subscription.periodo,
    estadoPago: subscription.estadoPago,
    promocionId: subscription.promocionId,
    promocionNombre: subscription.promocionNombre,
    cantidadConsumida: Number(subscription.cantidadConsumida) || 0,
    cantidadRestante: Math.max(0, Number(subscription.cantidadX20) - (Number(subscription.cantidadConsumida) || 0)),
  };
}

function createMonthlyRenewal(subscription, period, now) {
  const {
    id,
    periodo,
    cantidadConsumida,
    cantidadRestante,
    estadoPago,
    reciboPago,
    fechaSeleccion,
    fechaRenovacionAutomatica,
    suscripcionAnteriorId,
    renovadaAutomaticamente,
    ...planSnapshot
  } = subscription;
  const quota = Number(subscription.cantidadX20) || 0;
  return {
    ...planSnapshot,
    id: `${subscription.clienteId}-${period}`,
    periodo: period,
    cantidadConsumida: 0,
    cantidadRestante: quota,
    estadoPago: "pendiente",
    fechaSeleccion: now.toISOString(),
    fechaRenovacionAutomatica: now.toISOString(),
    renovadaAutomaticamente: true,
    suscripcionAnteriorId: subscription.id,
  };
}

function isSameSubscriptionSummary(currentSummary, nextSummary) {
  if (!currentSummary || !nextSummary) return false;
  return (
    currentSummary.subscriptionId === nextSummary.subscriptionId &&
    currentSummary.periodo === nextSummary.periodo &&
    currentSummary.estadoPago === nextSummary.estadoPago &&
    currentSummary.promocionId === nextSummary.promocionId &&
    currentSummary.promocionNombre === nextSummary.promocionNombre &&
    Number(currentSummary.cantidadConsumida || 0) === Number(nextSummary.cantidadConsumida || 0) &&
    Number(currentSummary.cantidadRestante || 0) === Number(nextSummary.cantidadRestante || 0)
  );
}

export function resolveClientSubscriptionForPeriod({
  client,
  subscriptions = [],
  period,
  now = new Date(),
} = {}) {
  if (!client?.id) return null;
  const targetPeriod = String(period || getPeriod(now));
  const clientSubscriptions = subscriptions
    .filter((subscription) => subscription?.clienteId === client.id)
    .slice()
    .sort((a, b) => String(b.periodo || "").localeCompare(String(a.periodo || "")));

  const exact = clientSubscriptions.find((subscription) => subscription.periodo === targetPeriod);
  if (exact) return exact;

  if (!client.maquinaFrioCalor) return null;

  const latestPrior = clientSubscriptions.find(
    (subscription) => String(subscription.periodo || "") < targetPeriod
  );
  if (!latestPrior) return null;

  return createMonthlyRenewal(latestPrior, targetPeriod, now);
}

// El reinicio es deliberadamente local: se ejecuta al abrir o sincronizar la app
// desde el día 1 y Firestore conserva tanto el mes anterior como sus entregas.
export function renewMonthlySubscriptions({
  clients = [],
  subscriptions = [],
  visits = [],
  now = new Date(),
} = {}) {
  const period = getPeriod(now);
  const subscriptionsByClient = new Map();
  subscriptions.forEach((subscription) => {
    const current = subscriptionsByClient.get(subscription.clienteId) || [];
    current.push(subscription);
    subscriptionsByClient.set(subscription.clienteId, current);
  });

  const renewed = [];
  const synced = [];
  const reconciledVisits = [];
  const nextSubscriptions = subscriptions.slice();
  const nextVisits = visits.slice();

  function reconcileClientVisits(client, subscription) {
    let updatedSub = subscription;
    let debtDelta = 0;

    const attributedTotal = nextVisits
      .filter(
        (visit) =>
          visit?.subscriptionAttribution?.subscriptionId === subscription.id
      )
      .reduce(
        (sum, visit) =>
          sum + (Number(visit.subscriptionAttribution?.cantidadX20) || 0),
        0
      );

    if (
      attributedTotal > 0 &&
      (Number(updatedSub.cantidadConsumida) || 0) < attributedTotal
    ) {
      const quota = Number(updatedSub.cantidadX20) || 0;
      const syncedConsumed = quota > 0 ? Math.min(quota, attributedTotal) : attributedTotal;
      updatedSub = {
        ...updatedSub,
        cantidadConsumida: syncedConsumed,
        cantidadRestante: Math.max(0, quota - syncedConsumed),
      };
    }

    const candidateIndices = nextVisits
      .map((visit, index) => ({ visit, index }))
      .filter(
        ({ visit }) =>
          visit?.clienteId === client.id &&
          String(visit.fecha || "").slice(0, 7) === period &&
          visit.vendio &&
          !visit.subscriptionAttribution &&
          (visit.items || []).some(
            (item) => item.tipo === "b20" && Number(item.cantidad) > 0
          )
      )
      .sort(
        (a, b) =>
          String(a.visit.fecha || "").localeCompare(String(b.visit.fecha || "")) ||
          (Number(a.visit.timestamp) || 0) - (Number(b.visit.timestamp) || 0)
      );

    candidateIndices.forEach(({ index }) => {
      const visit = nextVisits[index];
      const b20Item = (visit.items || []).find((item) => item.tipo === "b20");
      const requested = Number(b20Item?.cantidad) || 0;
      const unitPrice = Number(b20Item?.precioUnitario) || 0;
      const split = splitX20Delivery({
        quantity: requested,
        subscription: updatedSub,
        unitPrice,
      });
      if (split.covered <= 0) return;

      const cantidadConsumida =
        (Number(updatedSub.cantidadConsumida) || 0) + split.covered;
      updatedSub = {
        ...updatedSub,
        cantidadConsumida,
        cantidadRestante: Math.max(
          0,
          (Number(updatedSub.cantidadX20) || 0) - cantidadConsumida
        ),
      };

      const nextItems = (visit.items || []).map((item) =>
        item.tipo === "b20" ? { ...item, cantidad: split.excess } : item
      );
      const nextTotal = nextItems.reduce(
        (sum, item) =>
          sum + (Number(item.cantidad) || 0) * (Number(item.precioUnitario) || 0),
        0
      );
      const previousDebtGenerated = Number(visit.deudaGenerada) || 0;
      const previousOrdinaryPaid = Math.max(
        0,
        (Number(visit.total) || 0) - previousDebtGenerated
      );

      let nextDebtGenerated = 0;
      let nextOrdinaryPaid = 0;
      if (visit.metodoPago === "deuda") {
        nextDebtGenerated = nextTotal;
      } else if (previousDebtGenerated === 0) {
        nextOrdinaryPaid = nextTotal;
      } else {
        nextOrdinaryPaid = Math.min(nextTotal, previousOrdinaryPaid);
        nextDebtGenerated = Math.max(0, nextTotal - nextOrdinaryPaid);
      }

      debtDelta += nextDebtGenerated - previousDebtGenerated;
      const nextMetodoPago = nextTotal > 0 ? visit.metodoPago : null;
      const nextPagos = {};
      if (
        nextTotal > 0 &&
        nextMetodoPago &&
        nextMetodoPago !== "deuda" &&
        nextOrdinaryPaid > 0
      ) {
        nextPagos[nextMetodoPago] = nextOrdinaryPaid;
      }
      if ((Number(visit.deudaCobrada) || 0) > 0 && visit.metodoDeuda) {
        nextPagos[visit.metodoDeuda] =
          (nextPagos[visit.metodoDeuda] || 0) + Number(visit.deudaCobrada);
      }

      nextVisits[index] = {
        ...visit,
        items: nextItems,
        total: nextTotal,
        metodoPago: nextMetodoPago,
        pagos: nextPagos,
        deudaGenerada: nextDebtGenerated,
        subscriptionAttribution: split.attribution,
      };
      reconciledVisits.push(visit.id);
    });

    return { subscription: updatedSub, debtDelta };
  }

  const nextClients = clients.map((client) => {
    if (!client?.maquinaFrioCalor) return client;
    const clientSubscriptions = subscriptionsByClient.get(client.id) || [];
    if (!client.subscriptionSummary?.subscriptionId && clientSubscriptions.length === 0) {
      return client;
    }

    const current = clientSubscriptions.find((subscription) => subscription.periodo === period);
    if (current) {
      const reconciled = reconcileClientVisits(client, current);
      if (reconciled.subscription !== current) {
        const subIdx = nextSubscriptions.findIndex((item) => item.id === current.id);
        if (subIdx >= 0) nextSubscriptions[subIdx] = reconciled.subscription;
      }
      const summary = subscriptionSummaryFrom(reconciled.subscription);
      const nextDebt = Math.max(
        0,
        (Number(client.deudaAcumulada) || 0) + reconciled.debtDelta
      );
      if (
        reconciled.subscription === current &&
        isSameSubscriptionSummary(client.subscriptionSummary, summary) &&
        nextDebt === (Number(client.deudaAcumulada) || 0)
      ) {
        return client;
      }
      synced.push(client.id);
      return {
        ...client,
        deudaAcumulada: nextDebt,
        subscriptionSummary: summary,
      };
    }

    const latestByPeriod = clientSubscriptions
      .slice()
      .sort((a, b) => String(b.periodo || "").localeCompare(String(a.periodo || "")))[0];
    const selected = clientSubscriptions.find(
      (subscription) => subscription.id === client.subscriptionSummary?.subscriptionId
    );
    const latest = latestByPeriod || selected;
    if (!latest || String(latest.periodo) >= period) return client;

    const initialRenewal = createMonthlyRenewal(latest, period, now);
    const reconciled = reconcileClientVisits(client, initialRenewal);
    nextSubscriptions.push(reconciled.subscription);
    renewed.push(client.id);
    return {
      ...client,
      deudaAcumulada: Math.max(
        0,
        (Number(client.deudaAcumulada) || 0) + reconciled.debtDelta
      ),
      subscriptionSummary: subscriptionSummaryFrom(reconciled.subscription),
    };
  });

  return {
    period,
    clients: nextClients,
    subscriptions: nextSubscriptions,
    visits: nextVisits,
    renewed,
    synced,
    reconciledVisits,
  };
}

export function subscriptionUsageHistory({ clientId, subscriptions = [], visits = [] } = {}) {
  return subscriptions
    .filter((subscription) => subscription.clienteId === clientId)
    .sort((a, b) => String(b.periodo).localeCompare(String(a.periodo)))
    .map((subscription) => {
      const deliveries = visits
        .filter((visit) => visit.subscriptionAttribution?.subscriptionId === subscription.id)
        .map((visit) => ({ fecha: visit.fecha, cantidadX20: Number(visit.subscriptionAttribution?.cantidadX20) || 0 }))
        .sort((a, b) => String(b.fecha).localeCompare(String(a.fecha)));
      const deliveredTotal = deliveries.reduce((total, delivery) => total + delivery.cantidadX20, 0);
      const quota = Number(subscription.cantidadX20) || 0;
      const cantidadConsumida = Math.max(
        Number(subscription.cantidadConsumida) || 0,
        quota > 0 ? Math.min(quota, deliveredTotal) : deliveredTotal
      );
      return {
        ...subscription,
        cantidadConsumida,
        cantidadRestante: Math.max(0, quota - cantidadConsumida),
        deliveredTotal,
        deliveries,
      };
    });
}

export function changeSubscriptionPromotion({ subscription, promotion }) {
  if (!subscription) throw new Error("No se encontró el abono a corregir.");
  if (!promotion?.activo || !validatePromotion(promotion).ok) {
    throw new Error("La promoción elegida no está disponible.");
  }

  const cantidadConsumida = Math.max(0, Number(subscription.cantidadConsumida) || 0);
  const cantidadRestante = Math.max(0, Number(promotion.cantidadX20) - cantidadConsumida);
  const next = {
    ...subscription,
    ...createPromotionSnapshot(promotion),
    cantidadConsumida,
    cantidadRestante,
    estadoPago: subscription.estadoPago || "pendiente",
  };
  if (subscription.reciboPago) {
    next.reciboPago = {
      ...subscription.reciboPago,
      monto: Number(promotion.precioMensual),
    };
  }
  return next;
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

export function prepareSubscriptionVisitEdition({
  visitaInicial = null,
  currentSubscription = null,
} = {}) {
  const esEdicion = Boolean(visitaInicial);
  const anteriorB20 = (visitaInicial?.items || []).find(
    (it) => it.tipo === "b20"
  );
  const cantidadAtribuidaOriginal =
    esEdicion &&
    (!currentSubscription ||
      visitaInicial?.subscriptionAttribution?.subscriptionId ===
        currentSubscription.id)
      ? Number(visitaInicial?.subscriptionAttribution?.cantidadX20) || 0
      : 0;
  const initialB20Quantity =
    (Number(anteriorB20?.cantidad) || 0) +
    (esEdicion
      ? Number(visitaInicial?.subscriptionAttribution?.cantidadX20) || 0
      : 0);

  let subscriptionForCalculation = currentSubscription || null;
  if (esEdicion && currentSubscription) {
    const quota = Number(currentSubscription.cantidadX20) || 0;
    const cantidadConsumida = Math.max(
      0,
      (Number(currentSubscription.cantidadConsumida) || 0) -
        cantidadAtribuidaOriginal
    );
    subscriptionForCalculation = {
      ...currentSubscription,
      cantidadConsumida,
      cantidadRestante: Math.max(0, quota - cantidadConsumida),
    };
  }

  return {
    esEdicion,
    initialB20Quantity,
    cantidadAtribuidaOriginal,
    subscriptionForCalculation,
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

export function formatVisitProductsText(
  visita,
  productosCatalogo = [],
  separator = ", "
) {
  const parts = [];
  const abonoB20 = Number(visita?.subscriptionAttribution?.cantidadX20) || 0;
  if (abonoB20 > 0) {
    parts.push(`${abonoB20}× 20L (Abono)`);
  }

  (visita?.items || []).forEach((it) => {
    const cantidad = Number(it?.cantidad) || 0;
    if (cantidad <= 0) return;
    const producto = productosCatalogo.find((p) => p.key === it.tipo);
    parts.push(`${cantidad}× ${producto?.corto || it.tipo}`);
  });

  return parts.join(separator);
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
