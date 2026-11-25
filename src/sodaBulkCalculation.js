export const SIFONES_POR_BULTO = 6;

export function calcularBultosDeProducto(tipo, unidades) {
  const cantidad = Math.max(0, Number(unidades) || 0);
  if (tipo === "sifon") {
    return Math.round((cantidad / SIFONES_POR_BULTO) * 100) / 100;
  }
  return cantidad;
}

export function formatearNumeroBultos(valor) {
  const num = Math.round((Math.max(0, Number(valor) || 0)) * 100) / 100;
  if (Number.isInteger(num)) {
    return String(num);
  }
  return Number(num.toFixed(2)).toLocaleString("es-AR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
}

export function formatearDetalleBultosProducto(tipo, unidades) {
  const cantUnidades = Math.max(0, Number(unidades) || 0);
  if (tipo === "sifon") {
    const bultos = calcularBultosDeProducto("sifon", cantUnidades);
    return {
      unidades: cantUnidades,
      bultos,
      textoPrincipal: formatearNumeroBultos(bultos),
      subtexto: `${cantUnidades} unid. (${SIFONES_POR_BULTO} u = 1 bulto)`,
    };
  }
  return {
    unidades: cantUnidades,
    bultos: cantUnidades,
    textoPrincipal: String(cantUnidades),
    subtexto: null,
  };
}

export function calcularResumenBultosVendidos(visitas = [], productos = []) {
  const unidadesPorProducto = {};
  const bultosPorProducto = {};
  const detallePorProducto = {};

  (productos || []).forEach((p) => {
    unidadesPorProducto[p.key] = 0;
  });

  (visitas || []).forEach((visita) => {
    if (!visita?.vendio) return;

    (visita.items || []).forEach((item) => {
      if (!item || !(item.tipo in unidadesPorProducto)) return;
      unidadesPorProducto[item.tipo] += Math.max(0, Number(item.cantidad) || 0);
    });
  });

  let sumaBultos = 0;
  (productos || []).forEach((p) => {
    const unidades = unidadesPorProducto[p.key] || 0;
    const bultos = calcularBultosDeProducto(p.key, unidades);
    bultosPorProducto[p.key] = bultos;
    detallePorProducto[p.key] = formatearDetalleBultosProducto(p.key, unidades);
    sumaBultos += bultos;
  });

  const totalBultos = Math.round(sumaBultos * 100) / 100;

  return {
    unidadesPorProducto,
    bultosPorProducto,
    detallePorProducto,
    totalBultos,
    totalBultosFormateado: formatearNumeroBultos(totalBultos),
  };
}
