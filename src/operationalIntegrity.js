export function isValidSale({ vendio, items = [], total }) {
  if (!vendio) return true;

  return (
    items.some((item) => Number(item.cantidad) > 0) &&
    Number(total) > 0
  );
}

const RETURNABLE_PRODUCTS = ["b20", "b12", "sifon"];

function emptyContainers() {
  return { b20: 0, b12: 0, sifon: 0, jugo: 0 };
}

function normalizedPermanentContainers(client) {
  return {
    ...emptyContainers(),
    ...(client?.envasesPermanentes || client?.envasesPrestados || {}),
  };
}

function normalizedExtraContainers(client) {
  return { ...emptyContainers(), ...(client?.envasesExtra || {}) };
}

function extraDelta(visit = {}) {
  const delta = {};
  RETURNABLE_PRODUCTS.forEach((type) => {
    const lent = visit.extrasPrestados
      ? Number(visit.extrasPrestados[type]) || 0
      : Number(visit.items?.find((item) => item.tipo === type)?.cantidad) || 0;
    const returned = visit.extrasRetirados
      ? Number(visit.extrasRetirados[type]) || 0
      : Number(visit.retornos?.[type]) || 0;
    delta[type] = lent - returned;
  });
  return delta;
}

function stockDelta(visit = {}) {
  const delta = {};
  RETURNABLE_PRODUCTS.forEach((type) => {
    const lent = Number(visit.extrasPrestados?.[type]) || 0;
    const extraReturned = Number(visit.extrasRetirados?.[type]) || 0;
    const permanentReturned = Number(visit.permanentesRetirados?.[type]) || 0;

    if (visit.extrasPrestados || visit.extrasRetirados || visit.permanentesRetirados) {
      delta[type] = lent - extraReturned - permanentReturned;
      return;
    }

    delta[type] = extraDelta(visit)[type];
  });
  return delta;
}

function applyExtraDelta(containers, delta, direction) {
  const result = { ...containers };
  RETURNABLE_PRODUCTS.forEach((type) => {
    result[type] = Math.max(0, (Number(result[type]) || 0) + direction * delta[type]);
  });
  return result;
}

function applyPermanentReturns(containers, returned, direction) {
  const result = { ...containers };
  RETURNABLE_PRODUCTS.forEach((type) => {
    result[type] = Math.max(
      0,
      (Number(result[type]) || 0) - direction * (Number(returned?.[type]) || 0)
    );
  });
  return result;
}

function visitDebtEffect(visit = {}) {
  return (
    (Number(visit.ajusteDeudaManual) || 0) -
    (Number(visit.deudaCobrada) || 0) +
    (Number(visit.deudaGenerada) || 0)
  );
}

export function deriveVisitEffects({ client, previousVisit = null, visit }) {
  let debt = Number(client.deudaAcumulada) || 0;
  let permanent = normalizedPermanentContainers(client);
  let extra = normalizedExtraContainers(client);

  if (previousVisit) {
    debt = Math.max(0, debt - visitDebtEffect(previousVisit));
    extra = applyExtraDelta(extra, extraDelta(previousVisit), -1);
    permanent = applyPermanentReturns(permanent, previousVisit.permanentesRetirados, -1);
  }

  debt = Math.max(0, debt + visitDebtEffect(visit));
  extra = applyExtraDelta(extra, extraDelta(visit), 1);
  permanent = applyPermanentReturns(permanent, visit.permanentesRetirados, 1);

  const nextClient = {
    ...client,
    deudaAcumulada: debt,
    envasesPermanentes: permanent,
    envasesExtra: extra,
  };
  delete nextClient.envasesPrestados;

  const oldStock = stockDelta(previousVisit || {});
  const newStock = stockDelta(visit);
  const netStock = {};
  RETURNABLE_PRODUCTS.forEach((type) => {
    netStock[type] = newStock[type] - oldStock[type];
  });

  return { client: nextClient, stockDelta: netStock };
}

export async function saveVisitAtomically({
  runTransaction,
  db,
  refs,
  stockActive,
  visit,
}) {
  try {
    await runTransaction(db, async (transaction) => {
      const clientSnapshot = await transaction.get(refs.client);
      if (!clientSnapshot.exists()) throw new Error("Cliente no encontrado");

      const visitSnapshot = await transaction.get(refs.visit);
      const stockSnapshot = stockActive
        ? await transaction.get(refs.stock)
        : null;
      const previousVisit = visitSnapshot.exists() ? visitSnapshot.data() : null;
      const { client, stockDelta } = deriveVisitEffects({
        client: clientSnapshot.data(),
        previousVisit,
        visit,
      });

      transaction.set(refs.visit, visit);
      transaction.set(refs.client, client);

      if (stockActive) {
        const currentStock = stockSnapshot.exists() ? stockSnapshot.data() : {};
        const nextStock = { ...currentStock };
        RETURNABLE_PRODUCTS.forEach((type) => {
          nextStock[type] = (Number(currentStock[type]) || 0) - stockDelta[type];
        });
        transaction.set(refs.stock, nextStock);
      }
    });
    return { ok: true };
  } catch (error) {
    console.error("No se pudo guardar la visita", error);
    return {
      ok: false,
      error: "No se pudo guardar la visita. Revisá la conexión e intentá nuevamente.",
    };
  }
}

export function saveDeliveryVisit({ saveAtomically = saveVisitAtomically, ...options }) {
  return saveAtomically(options);
}
