export function summarizeClientsWithDebt(clients = []) {
  const debtors = clients
    .filter((client) => Number(client.deudaAcumulada) > 0)
    .slice()
    .sort((a, b) => Number(b.deudaAcumulada) - Number(a.deudaAcumulada));

  return {
    clients: debtors,
    total: debtors.reduce(
      (total, client) => total + (Number(client.deudaAcumulada) || 0),
      0
    ),
  };
}

export function calcularLiquidacionVisitaConDeuda({
  importeVentaHoy = 0,
  registraVenta = true,
  cobrarDeuda = false,
  montoDeuda = 0,
  saldoAnterior = 0,
  metodoPago = "efectivo",
  montoPagadoInput = null,
} = {}) {
  const ventaHoy = registraVenta ? Math.max(0, Number(importeVentaHoy) || 0) : 0;
  const saldoBase = Math.max(0, Number(saldoAnterior) || 0);
  const fiadoMarcadoParaCobrar = cobrarDeuda
    ? Math.min(saldoBase, Math.max(0, Number(montoDeuda) || 0))
    : 0;
  const totalFiadoMasPedido = ventaHoy + fiadoMarcadoParaCobrar;

  let totalACobrarAhora = 0;
  let montoPagadoEfectivo = 0;
  let deudaCobradaFinal = 0;
  let pagadoVentaHoy = 0;
  let deudaGeneradaFinal = 0;

  if (metodoPago === "deuda") {
    totalACobrarAhora = fiadoMarcadoParaCobrar;
    montoPagadoEfectivo = fiadoMarcadoParaCobrar;
    deudaCobradaFinal = fiadoMarcadoParaCobrar;
    pagadoVentaHoy = 0;
    deudaGeneradaFinal = ventaHoy;
  } else {
    totalACobrarAhora = totalFiadoMasPedido;
    montoPagadoEfectivo =
      montoPagadoInput === null || montoPagadoInput === ""
        ? totalACobrarAhora
        : Math.max(0, Number(montoPagadoInput) || 0);

    if (cobrarDeuda && fiadoMarcadoParaCobrar > 0) {
      deudaCobradaFinal = Math.min(fiadoMarcadoParaCobrar, montoPagadoEfectivo);
      pagadoVentaHoy = Math.min(
        ventaHoy,
        Math.max(0, montoPagadoEfectivo - deudaCobradaFinal)
      );
      deudaGeneradaFinal = Math.max(0, ventaHoy - pagadoVentaHoy);
    } else {
      deudaCobradaFinal = 0;
      pagadoVentaHoy = Math.min(ventaHoy, montoPagadoEfectivo);
      deudaGeneradaFinal = Math.max(0, ventaHoy - pagadoVentaHoy);
    }
  }

  const restanteSinPagarHoy = Math.max(
    0,
    totalACobrarAhora - (deudaCobradaFinal + pagadoVentaHoy)
  );
  const saldoFinalPrevisto = Math.max(
    0,
    saldoBase - deudaCobradaFinal + deudaGeneradaFinal
  );

  return {
    ventaHoy,
    saldoBase,
    fiadoMarcadoParaCobrar,
    totalFiadoMasPedido,
    totalACobrarAhora,
    montoPagadoEfectivo,
    deudaCobradaFinal,
    pagadoVentaHoy,
    deudaGeneradaFinal,
    restanteSinPagarHoy,
    saldoFinalPrevisto,
  };
}

