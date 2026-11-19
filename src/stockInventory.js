export const ARTICULOS_STOCK = [
  { key: "b20", label: "Bidón 20L", seEntregaAClientes: true },
  { key: "b12", label: "Bidón 12L", seEntregaAClientes: true },
  { key: "sifon", label: "Sifón", seEntregaAClientes: true },
  { key: "esqueletos", label: "Esqueletos", seEntregaAClientes: false },
];

export const PRODUCTOS_CARGA_CAMIONETA = [
  { key: "b20", label: "Bidón 20L", corto: "20L" },
  { key: "b12", label: "Bidón 12L", corto: "12L" },
  { key: "sifon", label: "Sifón", corto: "Sifón" },
];

export function stockInventarioVacio() {
  return Object.fromEntries(ARTICULOS_STOCK.map(({ key }) => [key, 0]));
}

export function stockInventarioDeRepartidor(stock) {
  return { ...stockInventarioVacio(), ...(stock || {}) };
}

export function combinarStockAdminConSalidas({
  stockActual = null,
  stockEditado = null,
  repartidorId,
} = {}) {
  const resultado = {
    ...(stockActual || {}),
    ...stockInventarioVacio(),
    ...(stockEditado || {}),
    id: repartidorId || stockActual?.id,
  };

  ARTICULOS_STOCK.forEach(({ key }) => {
    const raw =
      stockEditado && key in stockEditado
        ? stockEditado[key]
        : stockActual?.[key];
    resultado[key] = Math.max(0, Number(raw) || 0);
  });

  if (Array.isArray(stockActual?.salidasDia)) {
    resultado.salidasDia = stockActual.salidasDia;
  }
  if (stockActual?.ultimaCargaFecha) {
    resultado.ultimaCargaFecha = stockActual.ultimaCargaFecha;
  }
  if (stockActual?.ultimaCargaTimestamp !== undefined) {
    resultado.ultimaCargaTimestamp = stockActual.ultimaCargaTimestamp;
  }

  return resultado;
}

export function calcularStockEnCamionetas(porRepartidor) {
  const trabajando = stockInventarioVacio();

  ARTICULOS_STOCK.forEach((articulo) => {
    trabajando[articulo.key] = Object.values(porRepartidor || {}).reduce(
      (acumulado, stock) => acumulado + (Number(stock?.[articulo.key]) || 0),
      0
    );
  });

  return trabajando;
}

export function calcularStockEnGalpon({ total, porRepartidor, enClientes }) {
  const galpon = stockInventarioVacio();
  const enCamionetas = calcularStockEnCamionetas(porRepartidor);

  ARTICULOS_STOCK.forEach((articulo) => {
    const enClientesDelArticulo = articulo.seEntregaAClientes
      ? Number(enClientes?.[articulo.key]) || 0
      : 0;

    galpon[articulo.key] =
      (Number(total?.[articulo.key]) || 0) - enCamionetas[articulo.key] - enClientesDelArticulo;
  });

  return galpon;
}

function normalizarCargaProductos(carga = {}) {
  return {
    b20: Math.max(0, Math.floor(Number(carga.b20) || 0)),
    b12: Math.max(0, Math.floor(Number(carga.b12) || 0)),
    sifon: Math.max(0, Math.floor(Number(carga.sifon) || 0)),
  };
}

function bultosEntregadosEnVisitas(visitas = []) {
  const entregados = { b20: 0, b12: 0, sifon: 0 };

  visitas.forEach((visita) => {
    if (!visita?.vendio) return;

    (visita.items || []).forEach((item) => {
      if (item.tipo in entregados) {
        entregados[item.tipo] += Math.max(0, Number(item.cantidad) || 0);
      }
    });

    const abonoB20 = Number(visita.subscriptionAttribution?.cantidadX20) || 0;
    if (abonoB20 > 0) {
      entregados.b20 += abonoB20;
    }
  });

  return entregados;
}

export function registrarCargaCamioneta({
  stockActual,
  repartidorId,
  carga,
  fecha,
  timestamp = Date.now(),
  id = `${repartidorId}-${timestamp}`,
} = {}) {
  const base = stockInventarioDeRepartidor(stockActual);
  const limpia = normalizarCargaProductos(carga);
  const salidasMismoDia = (stockActual?.salidasDia || [])
    .filter((salida) => salida?.fecha === fecha)
    .slice()
    .sort((a, b) => (Number(a.timestamp) || 0) - (Number(b.timestamp) || 0));

  const nuevaSalida = {
    id,
    fecha,
    timestamp,
    ...limpia,
  };

  return {
    ...stockActual,
    ...base,
    id: repartidorId || stockActual?.id,
    b20: limpia.b20,
    b12: limpia.b12,
    sifon: limpia.sifon,
    esqueletos: Math.max(0, Number(base.esqueletos) || 0),
    ultimaCargaFecha: fecha,
    ultimaCargaTimestamp: timestamp,
    salidasDia: [...salidasMismoDia, nuevaSalida],
  };
}

export function resumenCargaRepartidorDia({
  stockRepartidor,
  visitas = [],
  fecha,
} = {}) {
  const salidasHoy = (stockRepartidor?.salidasDia || [])
    .filter((salida) => salida?.fecha === fecha)
    .slice()
    .sort((a, b) => (Number(a.timestamp) || 0) - (Number(b.timestamp) || 0));

  const tieneSalidaHoy = salidasHoy.length > 0;
  const ultimaSalida = tieneSalidaHoy ? salidasHoy[salidasHoy.length - 1] : null;
  const visitasHoy = visitas.filter((visita) => visita?.fecha === fecha);
  const visitasDesdeUltimaSalida = ultimaSalida
    ? visitasHoy.filter(
        (visita) => (Number(visita.timestamp) || 0) >= (Number(ultimaSalida.timestamp) || 0)
      )
    : visitasHoy;

  const entregadosDesdeUltimaSalida = bultosEntregadosEnVisitas(visitasDesdeUltimaSalida);
  const entregadosTotalHoy = bultosEntregadosEnVisitas(visitasHoy);
  const baseActual = ultimaSalida
    ? normalizarCargaProductos(ultimaSalida)
    : normalizarCargaProductos(stockRepartidor);

  const restanteEnCamioneta = {
    b20: Math.max(0, baseActual.b20 - (tieneSalidaHoy ? entregadosDesdeUltimaSalida.b20 : 0)),
    b12: Math.max(0, baseActual.b12 - (tieneSalidaHoy ? entregadosDesdeUltimaSalida.b12 : 0)),
    sifon: Math.max(0, baseActual.sifon - (tieneSalidaHoy ? entregadosDesdeUltimaSalida.sifon : 0)),
  };

  return {
    tieneSalidaHoy,
    salidasHoy,
    ultimaSalida,
    entregadosDesdeUltimaSalida,
    entregadosTotalHoy,
    restanteEnCamioneta,
  };
}
