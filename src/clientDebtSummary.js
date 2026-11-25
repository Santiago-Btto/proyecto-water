import { ordenClienteEnDia } from "./dayRouteOrdering";

export const DIAS_REPARTO_DEUDA = [
  "Lunes",
  "Martes",
  "Miércoles",
  "Jueves",
  "Viernes",
  "Sábado",
  "Domingo",
];

export const SIN_DIA_ASIGNADO_LABEL = "Sin día asignado";

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

function obtenerOrdenEnDia(cliente, dia) {
  const ordenDirecto = Number(cliente?.ordenPorDia?.[dia]);
  if (Number.isFinite(ordenDirecto) && ordenDirecto > 0) {
    return ordenDirecto;
  }
  const ordenGeneral = ordenClienteEnDia(cliente, dia);
  return Number.isFinite(ordenGeneral) ? ordenGeneral : Number.POSITIVE_INFINITY;
}

export function groupClientsWithDebtByRoute({
  clientes = [],
  repartidores = [],
  repartidorId = "todos",
  dia = "todos",
} = {}) {
  const mapaRepartidores = new Map(
    (repartidores || []).map((r) => [r.id, r.nombre])
  );

  const deudoresPorRepartidor = (clientes || []).filter((c) => {
    if (!(Number(c?.deudaAcumulada) > 0)) return false;
    if (repartidorId && repartidorId !== "todos") {
      return c.repartidorId === repartidorId;
    }
    return true;
  });

  const perteneceADia = (cliente, diaObjetivo) => {
    const dias = Array.isArray(cliente?.diasVisita) ? cliente.diasVisita : [];
    if (diaObjetivo === SIN_DIA_ASIGNADO_LABEL) {
      return dias.length === 0;
    }
    return dias.includes(diaObjetivo);
  };

  const deudoresFiltrados =
    dia && dia !== "todos"
      ? deudoresPorRepartidor.filter((c) => perteneceADia(c, dia))
      : deudoresPorRepartidor;

  const diasAEvaluar =
    dia && dia !== "todos"
      ? [dia]
      : [...DIAS_REPARTO_DEUDA, SIN_DIA_ASIGNADO_LABEL];

  const grupos = diasAEvaluar
    .map((diaGrupo) => {
      const clientesDelDia = deudoresFiltrados
        .filter((c) => perteneceADia(c, diaGrupo))
        .map((c) => {
          const ordenCalculado =
            diaGrupo === SIN_DIA_ASIGNADO_LABEL
              ? Number.POSITIVE_INFINITY
              : obtenerOrdenEnDia(c, diaGrupo);

          return {
            ...c,
            ordenEnDia: Number.isFinite(ordenCalculado) ? ordenCalculado : null,
            _ordenSort: ordenCalculado,
            repartidorNombre:
              mapaRepartidores.get(c.repartidorId) || "Sin repartidor",
          };
        })
        .sort((a, b) => {
          if (a._ordenSort !== b._ordenSort) return a._ordenSort - b._ordenSort;
          return (a.nombre || "").localeCompare(b.nombre || "");
        })
        .map(({ _ordenSort, ...item }) => item);

      const subtotalDeuda = clientesDelDia.reduce(
        (acc, c) => acc + (Number(c.deudaAcumulada) || 0),
        0
      );

      return {
        dia: diaGrupo,
        clientes: clientesDelDia,
        subtotalDeuda,
      };
    })
    .filter((grupo) => grupo.clientes.length > 0);

  const totalDeudaFiltrada = deudoresFiltrados.reduce(
    (acc, c) => acc + (Number(c.deudaAcumulada) || 0),
    0
  );

  return {
    grupos,
    totalDeudaFiltrada,
    totalClientesFiltrados: deudoresFiltrados.length,
  };
}
