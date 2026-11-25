const DEFAULT_RETORNABLES = [
  { key: "b20", label: "Bidón 20L", corto: "20L" },
  { key: "b12", label: "Bidón 12L", corto: "12L" },
  { key: "sifon", label: "Sifón", corto: "Sifón" },
];

export function getPendingExtraContainersAlert(
  cliente,
  productosRetornables = DEFAULT_RETORNABLES
) {
  const extras = cliente?.envasesExtra || {};
  const catalogo =
    Array.isArray(productosRetornables) && productosRetornables.length > 0
      ? productosRetornables
      : DEFAULT_RETORNABLES;

  const items = catalogo
    .map((prod) => ({
      key: prod.key,
      label: prod.label,
      corto: prod.corto || prod.label,
      cantidad: Math.max(0, Number(extras[prod.key]) || 0),
    }))
    .filter((item) => item.cantidad > 0);

  const totalUnits = items.reduce((acc, item) => acc + item.cantidad, 0);
  const summaryText = items.map((item) => `${item.cantidad}×${item.corto}`).join(", ");

  return {
    hasPendingExtras: totalUnits > 0,
    totalUnits,
    items,
    summaryText,
  };
}

export function convertExtraContainersToPermanent(cliente = {}) {
  const permanentesPrevios =
    cliente?.envasesPermanentes || cliente?.envasesPrestados || {};
  const extrasPrevios = cliente?.envasesExtra || {};

  const envasesPermanentes = {
    ...permanentesPrevios,
    b20:
      Math.max(0, Number(permanentesPrevios.b20) || 0) +
      Math.max(0, Number(extrasPrevios.b20) || 0),
    b12:
      Math.max(0, Number(permanentesPrevios.b12) || 0) +
      Math.max(0, Number(extrasPrevios.b12) || 0),
    sifon:
      Math.max(0, Number(permanentesPrevios.sifon) || 0) +
      Math.max(0, Number(extrasPrevios.sifon) || 0),
  };

  const envasesExtra = {
    ...(cliente?.envasesExtra || {}),
    b20: 0,
    b12: 0,
    sifon: 0,
  };

  return {
    ...cliente,
    envasesPermanentes,
    envasesExtra,
  };
}

export function buildFullExtraContainersReturn(cliente = {}) {
  const extras = cliente?.envasesExtra || {};
  return {
    b20: Math.max(0, Number(extras.b20) || 0),
    b12: Math.max(0, Number(extras.b12) || 0),
    sifon: Math.max(0, Number(extras.sifon) || 0),
  };
}
