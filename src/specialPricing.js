function validSpecialPrice(value) {
  if (value === "" || value === null || value === undefined) return false;
  const price = Number(value);
  return Number.isFinite(price) && price >= 0;
}

export function clientSpecialPriceEntries(client) {
  return Object.entries(client?.preciosEspeciales || {})
    .filter(([, value]) => validSpecialPrice(value))
    .map(([product, value]) => [product, Number(value)]);
}

export function savedSpecialPrices(client, enabled) {
  return enabled ? Object.fromEntries(clientSpecialPriceEntries(client)) : {};
}

export function resolveClientUnitPrice(client, product, normalPrice) {
  const special = client?.preciosEspeciales?.[product];
  return validSpecialPrice(special) ? Number(special) : Number(normalPrice) || 0;
}

export function chargeableVisitTotal(items, coveredX20 = 0) {
  const total = items.reduce(
    (sum, item) => sum + (Number(item.cantidad) || 0) * (Number(item.precioUnitario) || 0),
    0
  );
  const b20 = items.find((item) => item.tipo === "b20");
  const covered = Math.min(
    Math.max(0, Number(coveredX20) || 0),
    Math.max(0, Number(b20?.cantidad) || 0)
  );
  return Math.max(0, total - covered * (Number(b20?.precioUnitario) || 0));
}

export function isComplimentaryVisit(visit) {
  const delivered = visit?.items?.filter((item) => Number(item.cantidad) > 0) || [];
  return Boolean(
    visit?.vendio &&
    Number(visit.total) === 0 &&
    !Number(visit.subscriptionAttribution?.cantidadX20) &&
    delivered.length > 0 &&
    delivered.every((item) => Number(item.precioUnitario) === 0)
  );
}
