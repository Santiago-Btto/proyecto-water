function nextDayCompactDate(dateISO) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(dateISO || "").trim());
  if (!match) {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, "0");
    const d = String(now.getDate()).padStart(2, "0");
    const next = new Date(Date.UTC(y, now.getMonth(), now.getDate() + 1));
    const ny = next.getUTCFullYear();
    const nm = String(next.getUTCMonth() + 1).padStart(2, "0");
    const nd = String(next.getUTCDate()).padStart(2, "0");
    return { start: `${y}${m}${d}`, end: `${ny}${nm}${nd}` };
  }

  const y = Number(match[1]);
  const m = Number(match[2]);
  const d = Number(match[3]);
  const start = `${match[1]}${match[2]}${match[3]}`;
  const next = new Date(Date.UTC(y, m - 1, d + 1));
  const ny = next.getUTCFullYear();
  const nm = String(next.getUTCMonth() + 1).padStart(2, "0");
  const nd = String(next.getUTCDate()).padStart(2, "0");
  return { start, end: `${ny}${nm}${nd}` };
}

export function buildGoogleCalendarUrl({
  title,
  dateISO,
  details = "",
  location = "",
} = {}) {
  const { start, end } = nextDayCompactDate(dateISO);
  const params = new URLSearchParams();
  params.set("action", "TEMPLATE");
  params.set("text", String(title || "Recordatorio de Reparto").trim());
  params.set("dates", `${start}/${end}`);
  if (details) params.set("details", String(details).trim());
  if (location) params.set("location", String(location).trim());

  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

export function buildClientCalendarReminderUrl({
  cliente = {},
  fechaISO,
  motivo = "Reparto de agua",
  notas = "",
} = {}) {
  const nombre = String(cliente?.nombre || "Cliente").trim();
  const title = `${String(motivo || "Reparto de agua").trim()} · ${nombre}`;

  const partesUbicacion = [
    cliente?.direccion,
    cliente?.departamento,
    cliente?.direccion ? "Mendoza, Argentina" : "",
  ]
    .map((p) => String(p || "").trim())
    .filter(Boolean);
  const location = partesUbicacion.join(", ");

  const detalleLineas = [];
  if (cliente?.nombre) detalleLineas.push(`Cliente: ${cliente.nombre}`);
  if (cliente?.direccion) {
    detalleLineas.push(
      `Dirección: ${[cliente.direccion, cliente.departamento].filter(Boolean).join(", ")}`
    );
  }
  if (cliente?.telefono) detalleLineas.push(`Teléfono: ${cliente.telefono}`);
  if (Number(cliente?.deudaAcumulada) > 0) {
    detalleLineas.push(`Saldo pendiente: $${Number(cliente.deudaAcumulada)}`);
  }

  const extras = cliente?.envasesExtra || {};
  const extrasTxt = [
    ["b20", "20L"],
    ["b12", "12L"],
    ["sifon", "Sifón"],
  ]
    .filter(([k]) => (Number(extras[k]) || 0) > 0)
    .map(([k, l]) => `${Number(extras[k])}×${l}`)
    .join(", ");

  if (extrasTxt) {
    detalleLineas.push(`Envases prestados pendientes: ${extrasTxt}`);
  }
  if (cliente?.maquinaFrioCalor) {
    detalleLineas.push(`Equipo: Máquina Frío/Calor`);
  }
  if (notas) {
    detalleLineas.push(`Notas: ${String(notas).trim()}`);
  } else if (cliente?.notas) {
    detalleLineas.push(`Notas cliente: ${String(cliente.notas).trim()}`);
  }

  return buildGoogleCalendarUrl({
    title,
    dateISO: fechaISO,
    details: detalleLineas.join("\n"),
    location,
  });
}
