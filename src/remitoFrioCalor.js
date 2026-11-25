function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function formatFechaLegible(iso) {
  const str = String(iso || "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(str)) return str || "—";
  const [y, m, d] = str.split("-");
  return `${d}/${m}/${y}`;
}

function formatMoneda(monto) {
  const num = Math.max(0, Number(monto) || 0);
  return "$" + num.toLocaleString("es-AR", { maximumFractionDigits: 0 });
}

function resumirEnvasesCliente(cliente) {
  const perm = cliente?.envasesPermanentes || cliente?.envasesPrestados || {};
  const ext = cliente?.envasesExtra || {};
  const partes = [];
  const catalogo = [
    ["b20", "20L"],
    ["b12", "12L"],
    ["sifon", "Sifón"],
  ];

  const permTxt = catalogo
    .filter(([k]) => (Number(perm[k]) || 0) > 0)
    .map(([k, l]) => `${Number(perm[k])}×${l}`)
    .join(", ");

  const extTxt = catalogo
    .filter(([k]) => (Number(ext[k]) || 0) > 0)
    .map(([k, l]) => `${Number(ext[k])}×${l}`)
    .join(", ");

  if (permTxt) partes.push(`Permanentes: ${permTxt}`);
  if (extTxt) partes.push(`Prestados (extra): ${extTxt}`);

  return partes.length > 0 ? partes.join(" · ") : "Sin envases registrados";
}

export function createRemitoFrioCalor({
  cliente = {},
  visita = null,
  subscription = null,
  repartidorNombre = "",
  detalleEquipo = "Dispenser Frío/Calor en comodato",
  cantidadBidones20L = 0,
  monto = 0,
  observaciones = "",
  firmaDataUrl = "",
  fecha = "",
} = {}) {
  const fechaFinal =
    fecha ||
    visita?.fecha ||
    new Date().toISOString().slice(0, 10);

  const sufijoCliente = String(cliente?.id || "0000")
    .replace(/[^a-zA-Z0-9]/g, "")
    .slice(-4)
    .toUpperCase();
  const numeroRemito = `FC-${fechaFinal.replace(/-/g, "")}-${sufijoCliente || "0001"}`;

  const direccionCompleta = [cliente?.direccion, cliente?.departamento]
    .map((p) => String(p || "").trim())
    .filter(Boolean)
    .join(", ");

  const planNombre = subscription
    ? `${subscription.promocionNombre || `Plan ${subscription.cantidadX20} bidones`} (${subscription.cantidadX20}×20L)`
    : cliente?.subscriptionSummary?.promocionNombre
    ? cliente.subscriptionSummary.promocionNombre
    : "Abono Frío/Calor";

  return {
    numeroRemito,
    fecha: fechaFinal,
    fechaLegible: formatFechaLegible(fechaFinal),
    clienteId: cliente?.id || "",
    clienteNombre: cliente?.nombre || "Cliente",
    clienteDireccion: direccionCompleta || "Sin dirección",
    clienteTelefono: cliente?.telefono || "",
    repartidorNombre: repartidorNombre || "Agua Lukas",
    detalleEquipo: String(detalleEquipo || "Dispenser Frío/Calor en comodato").trim(),
    cantidadBidones20L: Math.max(0, Number(cantidadBidones20L) || 0),
    planNombre,
    monto: Math.max(0, Number(monto) || 0),
    envasesEnDomicilioTexto: resumirEnvasesCliente(cliente),
    observaciones: String(observaciones || "").trim(),
    firmaDataUrl: String(firmaDataUrl || "").trim(),
  };
}

export function buildRemitoWhatsAppMessage(remito = {}) {
  const lineas = [
    `*REMITO DE ENTREGA - FRÍO/CALOR*`,
    `Remito N°: ${remito.numeroRemito || "—"}`,
    `Fecha: ${remito.fechaLegible || formatFechaLegible(remito.fecha)}`,
    `Cliente: ${remito.clienteNombre || "—"}`,
    `Dirección: ${remito.clienteDireccion || "—"}`,
    `Repartidor: ${remito.repartidorNombre || "Agua Lukas"}`,
    `Equipo / Servicio: ${remito.detalleEquipo || "Dispenser Frío/Calor"}`,
    `Plan / Abono: ${remito.planNombre || "—"}`,
  ];

  if (Number(remito.cantidadBidones20L) > 0) {
    lineas.push(`Bidones 20L entregados: ${remito.cantidadBidones20L}`);
  }
  if (Number(remito.monto) > 0) {
    lineas.push(`Importe: ${formatMoneda(remito.monto)}`);
  }
  if (remito.envasesEnDomicilioTexto) {
    lineas.push(`Envases en domicilio: ${remito.envasesEnDomicilioTexto}`);
  }
  if (remito.observaciones) {
    lineas.push(`Observaciones: ${remito.observaciones}`);
  }
  lineas.push(
    remito.firmaDataUrl
      ? `Conformidad: Firmado digitalmente en pantalla ✓`
      : `Conformidad: Pendiente de firma`
  );

  return lineas.join("\n");
}

export function buildRemitoPrintableHtml(remito = {}) {
  const tieneFirma =
    typeof remito.firmaDataUrl === "string" &&
    remito.firmaDataUrl.startsWith("data:image/");

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Remito ${escapeHtml(remito.numeroRemito || "Frío/Calor")}</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif;
      color: #0B2B3C;
      background: #F2F8F9;
      margin: 0;
      padding: 20px;
    }
    .sheet {
      max-width: 680px;
      margin: 0 auto;
      background: #FFFFFF;
      border: 2px solid #0C6478;
      border-radius: 16px;
      padding: 24px;
      box-shadow: 0 6px 20px rgba(11, 43, 60, 0.08);
    }
    .header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      border-bottom: 2px solid #DEE9EB;
      padding-bottom: 14px;
      margin-bottom: 16px;
    }
    .brand {
      font-size: 20px;
      font-weight: 800;
      color: #0C6478;
    }
    .subtitle {
      font-size: 12px;
      color: #5E7A87;
      margin-top: 2px;
      font-weight: 700;
      text-transform: uppercase;
    }
    .meta {
      text-align: right;
      font-size: 12px;
    }
    .meta strong {
      font-size: 14px;
      color: #082C38;
    }
    .grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 10px;
      background: #F2F8F9;
      padding: 12px;
      border-radius: 12px;
      margin-bottom: 16px;
      font-size: 13px;
    }
    .field-label {
      font-size: 10px;
      text-transform: uppercase;
      color: #5E7A87;
      font-weight: 700;
    }
    .field-value {
      font-weight: 700;
      margin-top: 2px;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 16px;
      font-size: 13px;
    }
    th, td {
      border: 1px solid #DEE9EB;
      padding: 10px;
      text-align: left;
    }
    th {
      background: #DFF4F6;
      color: #0C6478;
      font-size: 11px;
      text-transform: uppercase;
    }
    .signature-box {
      border: 1px dashed #0C6478;
      border-radius: 12px;
      padding: 14px;
      text-align: center;
      background: #FAFEFF;
      margin-top: 12px;
    }
    .signature-box img {
      max-height: 120px;
      max-width: 100%;
      object-fit: contain;
    }
    .actions {
      text-align: center;
      margin-bottom: 16px;
    }
    .btn-print {
      background: #0C6478;
      color: #fff;
      border: none;
      padding: 10px 18px;
      border-radius: 10px;
      font-weight: 700;
      cursor: pointer;
    }
    @media print {
      body { background: #fff; padding: 0; }
      .actions { display: none; }
      .sheet { box-shadow: none; border: 1px solid #000; }
    }
  </style>
</head>
<body>
  <div class="actions">
    <button class="btn-print" onclick="window.print()">Imprimir / Guardar como PDF</button>
  </div>
  <div class="sheet">
    <div class="header">
      <div>
        <div class="brand">REPARTO DE AGUA · FRÍO/CALOR</div>
        <div class="subtitle">REMITO DE ENTREGA Y CONFORMIDAD</div>
      </div>
      <div class="meta">
        <div><strong>N° ${escapeHtml(remito.numeroRemito || "—")}</strong></div>
        <div>Fecha: ${escapeHtml(remito.fechaLegible || formatFechaLegible(remito.fecha))}</div>
      </div>
    </div>

    <div class="grid">
      <div>
        <div class="field-label">Cliente</div>
        <div class="field-value">${escapeHtml(remito.clienteNombre)}</div>
      </div>
      <div>
        <div class="field-label">Dirección</div>
        <div class="field-value">${escapeHtml(remito.clienteDireccion)}</div>
      </div>
      <div>
        <div class="field-label">Teléfono</div>
        <div class="field-value">${escapeHtml(remito.clienteTelefono || "—")}</div>
      </div>
      <div>
        <div class="field-label">Repartidor</div>
        <div class="field-value">${escapeHtml(remito.repartidorNombre)}</div>
      </div>
    </div>

    <table>
      <thead>
        <tr>
          <th>Concepto / Equipo</th>
          <th>Plan / Abono</th>
          <th>Bidones 20L</th>
          <th>Importe</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>${escapeHtml(remito.detalleEquipo)}</td>
          <td>${escapeHtml(remito.planNombre)}</td>
          <td>${escapeHtml(remito.cantidadBidones20L)}</td>
          <td>${escapeHtml(formatMoneda(remito.monto))}</td>
        </tr>
      </tbody>
    </table>

    <div style="font-size: 12px; margin-bottom: 8px;">
      <strong>Envases en domicilio:</strong> ${escapeHtml(remito.envasesEnDomicilioTexto)}
    </div>
    ${
      remito.observaciones
        ? `<div style="font-size: 12px; margin-bottom: 12px;"><strong>Observaciones:</strong> ${escapeHtml(
            remito.observaciones
          )}</div>`
        : ""
    }

    <div class="signature-box">
      <div class="field-label" style="margin-bottom: 8px;">Firma y conformidad del cliente</div>
      ${
        tieneFirma
          ? `<img src="${escapeHtml(remito.firmaDataUrl)}" alt="Firma del cliente" />`
          : `<div style="height: 70px; display: flex; align-items: center; justify-content: center; color: #93A9B1; font-size: 12px;">Firma en conformidad</div>`
      }
      <div style="font-size: 11px; color: #5E7A87; margin-top: 6px;">
        Recibí conforme el equipo y/o bidones detallados en el presente remito.
      </div>
    </div>
  </div>
</body>
</html>`;
}
