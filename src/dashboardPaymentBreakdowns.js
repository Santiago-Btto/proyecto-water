export const METODOS_PAGO_GASTO = [
  { key: "efectivo", label: "Efectivo", corto: "Efectivo", tone: "success" },
  {
    key: "mercadopago",
    label: "Mercado Pago / Transferencia",
    corto: "Mercado Pago",
    tone: "accent",
  },
  {
    key: "tarjeta",
    label: "Tarjeta / Débito",
    corto: "Tarjeta",
    tone: "accent",
  },
  { key: "otro", label: "Otro", corto: "Otro", tone: "muted" },
];

const METODO_PAGO_GASTO_SIN_ESPECIFICAR = {
  key: "sin_especificar",
  label: "Sin especificar",
  corto: "Sin especificar",
  tone: "muted",
};

export function metodoPagoDeGasto(key) {
  if (!key) return METODO_PAGO_GASTO_SIN_ESPECIFICAR;
  return (
    METODOS_PAGO_GASTO.find((item) => item.key === key) ||
    METODO_PAGO_GASTO_SIN_ESPECIFICAR
  );
}

export function resumenGastosPorMetodoPago(gastos = []) {
  const todosLosMetodos = [
    ...METODOS_PAGO_GASTO,
    METODO_PAGO_GASTO_SIN_ESPECIFICAR,
  ];

  return todosLosMetodos
    .map((metodo) => {
      const coincidencias = (gastos || []).filter(
        (gasto) => metodoPagoDeGasto(gasto?.metodoPago).key === metodo.key
      );
      const total = coincidencias.reduce(
        (acc, gasto) => acc + (Number(gasto?.monto) || 0),
        0
      );
      return {
        ...metodo,
        total,
        cantidad: coincidencias.length,
      };
    })
    .filter((item) => item.total > 0);
}

function textoProductosVisita(visita, productosCatalogo = []) {
  const partes = [];
  const abonoX20 = Number(visita?.subscriptionAttribution?.cantidadX20) || 0;
  if (abonoX20 > 0) {
    partes.push(`Abono ${abonoX20}× 20L`);
  }
  (visita?.items || [])
    .filter((it) => (Number(it.cantidad) || 0) > 0)
    .forEach((it) => {
      const prod = (productosCatalogo || []).find((p) => p.key === it.tipo);
      partes.push(`${it.cantidad}× ${prod?.corto || prod?.label || it.tipo}`);
    });
  return partes.join(", ");
}

function etiquetaMetodoPagoVisita(visita) {
  const ef = Number(visita?.pagos?.efectivo) || 0;
  const mp = Number(visita?.pagos?.mercadopago) || 0;
  const fiado = Number(visita?.deudaGenerada) || 0;
  const etiquetas = [];
  if (ef > 0) etiquetas.push("Efectivo");
  if (mp > 0) etiquetas.push("Mercado Pago");
  if (fiado > 0) etiquetas.push("Fiado");
  if (etiquetas.length > 0) return etiquetas.join(" + ");
  if (visita?.metodoPago === "efectivo") return "Efectivo";
  if (visita?.metodoPago === "mercadopago") return "Mercado Pago";
  if (visita?.metodoPago === "deuda") return "Fiado";
  return "";
}

export function obtenerDetalleMedidorDashboard({
  tipo,
  visitas = [],
  clientes = [],
  repartidores = [],
  productosCatalogo = [],
} = {}) {
  const clientePorId = new Map((clientes || []).map((c) => [c.id, c]));
  const repartidorPorId = new Map((repartidores || []).map((r) => [r.id, r]));

  const nombreClienteDeVisita = (v) =>
    clientePorId.get(v?.clienteId)?.nombre ||
    v?.clienteNombre ||
    "Cliente eliminado";

  const nombreRepartidorDeId = (repId) =>
    repartidorPorId.get(repId)?.nombre || "Sin repartidor";

  if (tipo === "efectivo") {
    const items = (visitas || [])
      .filter((v) => (Number(v?.pagos?.efectivo) || 0) > 0)
      .map((v) => {
        const monto = Number(v.pagos.efectivo) || 0;
        const productos = textoProductosVisita(v, productosCatalogo);
        const deudaCobrada = Number(v.deudaCobrada) || 0;
        const metodoDeuda = v.metodoDeuda || v.metodoPago || "efectivo";
        const esCobroDeuda = deudaCobrada > 0 && metodoDeuda === "efectivo";
        const partesDetalle = [];
        if (productos) partesDetalle.push(productos);
        if (esCobroDeuda) partesDetalle.push("Cobró fiado anterior");
        return {
          id: `${v.id}-efectivo`,
          visitaId: v.id,
          clienteId: v.clienteId,
          clienteNombre: nombreClienteDeVisita(v),
          repartidorNombre: nombreRepartidorDeId(v.repartidorId),
          fecha: v.fecha,
          monto,
          detalle: partesDetalle.join(" · ") || "Pago en efectivo",
          esCobroDeuda,
        };
      });

    return {
      tipo,
      titulo: "Pagos en Efectivo",
      total: items.reduce((acc, it) => acc + it.monto, 0),
      items,
    };
  }

  if (tipo === "mercadopago") {
    const items = (visitas || [])
      .filter((v) => (Number(v?.pagos?.mercadopago) || 0) > 0)
      .map((v) => {
        const monto = Number(v.pagos.mercadopago) || 0;
        const productos = textoProductosVisita(v, productosCatalogo);
        const deudaCobrada = Number(v.deudaCobrada) || 0;
        const metodoDeuda = v.metodoDeuda || v.metodoPago || "efectivo";
        const esCobroDeuda = deudaCobrada > 0 && metodoDeuda === "mercadopago";
        const partesDetalle = [];
        if (productos) partesDetalle.push(productos);
        if (esCobroDeuda) partesDetalle.push("Cobró fiado anterior");
        return {
          id: `${v.id}-mercadopago`,
          visitaId: v.id,
          clienteId: v.clienteId,
          clienteNombre: nombreClienteDeVisita(v),
          repartidorNombre: nombreRepartidorDeId(v.repartidorId),
          fecha: v.fecha,
          monto,
          detalle: partesDetalle.join(" · ") || "Pago por Mercado Pago",
          esCobroDeuda,
        };
      });

    return {
      tipo,
      titulo: "Pagos por Mercado Pago",
      total: items.reduce((acc, it) => acc + it.monto, 0),
      items,
    };
  }

  if (tipo === "fiado") {
    const items = (visitas || [])
      .filter((v) => (Number(v?.deudaGenerada) || 0) > 0)
      .map((v) => {
        const monto = Number(v.deudaGenerada) || 0;
        const productos = textoProductosVisita(v, productosCatalogo);
        return {
          id: `${v.id}-fiado`,
          visitaId: v.id,
          clienteId: v.clienteId,
          clienteNombre: nombreClienteDeVisita(v),
          repartidorNombre: nombreRepartidorDeId(v.repartidorId),
          fecha: v.fecha,
          monto,
          detalle: productos || "Dejó fiado",
          esCobroDeuda: false,
        };
      });

    return {
      tipo,
      titulo: "Fiado generado en el período",
      total: items.reduce((acc, it) => acc + it.monto, 0),
      items,
    };
  }

  if (tipo === "facturado") {
    const items = (visitas || [])
      .filter((v) => v?.vendio && (Number(v?.total) || 0) > 0)
      .map((v) => {
        const monto = Number(v.total) || 0;
        const productos = textoProductosVisita(v, productosCatalogo);
        const medio = etiquetaMetodoPagoVisita(v);
        const partes = [productos, medio].filter(Boolean);
        return {
          id: `${v.id}-facturado`,
          visitaId: v.id,
          clienteId: v.clienteId,
          clienteNombre: nombreClienteDeVisita(v),
          repartidorNombre: nombreRepartidorDeId(v.repartidorId),
          fecha: v.fecha,
          monto,
          medioPago: medio,
          detalle: partes.join(" · ") || "Venta registrada",
          esCobroDeuda: false,
        };
      });

    return {
      tipo,
      titulo: "Ventas facturadas en el período",
      total: items.reduce((acc, it) => acc + it.monto, 0),
      items,
    };
  }

  if (tipo === "plata_en_la_calle") {
    const items = (clientes || [])
      .filter((c) => (Number(c?.deudaAcumulada) || 0) > 0)
      .slice()
      .sort(
        (a, b) =>
          (Number(b.deudaAcumulada) || 0) - (Number(a.deudaAcumulada) || 0) ||
          String(a.nombre || "").localeCompare(String(b.nombre || ""))
      )
      .map((c) => ({
        id: c.id,
        clienteId: c.id,
        clienteNombre: c.nombre || "Cliente",
        repartidorNombre: nombreRepartidorDeId(c.repartidorId),
        direccion: c.direccion || "",
        diasTexto: (c.diasVisita || []).join(", "),
        monto: Number(c.deudaAcumulada) || 0,
      }));

    return {
      tipo,
      titulo: "Fiados generales · Plata en la calle",
      total: items.reduce((acc, it) => acc + it.monto, 0),
      items,
    };
  }

  return {
    tipo,
    titulo: "",
    total: 0,
    items: [],
  };
}
