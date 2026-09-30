import { isDashboardDateInRange } from "./dashboardCalendarFilters";

export const ENVASES_FILTRABLES = [
  { key: "b20", label: "Bidón 20L" },
  { key: "b12", label: "Bidón 12L" },
  { key: "sifon", label: "Sifón" },
];

export const PERIODOS_MOVIMIENTOS_ENVASES = [
  { key: "hoy", label: "Hoy" },
  { key: "semana", label: "Semana" },
  { key: "mes", label: "Mes" },
  { key: "fecha", label: "Fecha específica" },
];

function fechaEnPeriodo(fecha, { periodo, fechaActual, fechaEspecifica }) {
  if (periodo === "todo") return true;
  if (periodo === "fecha") return fecha === fechaEspecifica;
  if (periodo === "hoy") return fecha === fechaActual;

  return isDashboardDateInRange({
    date: fecha,
    range: periodo,
    currentDate: fechaActual,
  });
}

function crearMovimiento({ visita, producto, cantidad, movimiento, origen, cliente, repartidor }) {
  return {
    id: `${visita.id}-${producto.key}-${movimiento}-${origen}`,
    visitaId: visita.id,
    clienteId: visita.clienteId,
    clienteNombre: cliente?.nombre || visita.clienteNombre || "Cliente eliminado",
    repartidorId: visita.repartidorId,
    repartidorNombre: repartidor?.nombre || visita.repartidorNombre || "Sin repartidor",
    fecha: visita.fecha,
    timestamp: Number(visita.timestamp) || 0,
    tipo: producto.key,
    producto: producto.label,
    cantidad,
    movimiento,
    origen,
  };
}

function movimientosDeUnaVisita(visita, clientesPorId, repartidoresPorId) {
  const cliente = clientesPorId.get(visita.clienteId);
  const repartidor = repartidoresPorId.get(visita.repartidorId);
  const registros = [];
  const usaFormatoActual = Boolean(
    visita.extrasPrestados || visita.extrasRetirados || visita.permanentesRetirados
  );

  const fuentes = usaFormatoActual
    ? [
        [visita.extrasPrestados, "prestado", "Extra"],
        [visita.extrasRetirados, "retirado", "Extra"],
        [visita.permanentesRetirados, "retirado", "Permanente"],
      ]
    : [[visita.retornos, "retirado", "Registro anterior"]];

  fuentes.forEach(([envases, movimiento, origen]) => {
    ENVASES_FILTRABLES.forEach((producto) => {
      const cantidad = Number(envases?.[producto.key]) || 0;
      if (cantidad <= 0) return;

      registros.push(
        crearMovimiento({
          visita,
          producto,
          cantidad,
          movimiento,
          origen,
          cliente,
          repartidor,
        })
      );
    });
  });

  return registros;
}

export function movimientosDeEnvases({ visitas = [], clientes = [], repartidores = [], filtros }) {
  const clientesPorId = new Map(clientes.map((cliente) => [cliente.id, cliente]));
  const repartidoresPorId = new Map(repartidores.map((repartidor) => [repartidor.id, repartidor]));

  return visitas
    .filter((visita) => fechaEnPeriodo(visita.fecha, filtros))
    .flatMap((visita) => movimientosDeUnaVisita(visita, clientesPorId, repartidoresPorId))
    .filter((movimiento) => filtros.tipo === "todos" || movimiento.tipo === filtros.tipo)
    .filter(
      (movimiento) =>
        filtros.movimiento === "todos" || movimiento.movimiento === filtros.movimiento
    )
    .sort(
      (a, b) =>
        b.timestamp - a.timestamp ||
        b.fecha.localeCompare(a.fecha) ||
        a.clienteNombre.localeCompare(b.clienteNombre)
    );
}
