import { ordenClienteEnDia } from "./dayRouteOrdering";

const DIAS_SEMANA = [
  "Lunes",
  "Martes",
  "Miércoles",
  "Jueves",
  "Viernes",
  "Sábado",
  "Domingo",
];

function textoNormalizado(valor) {
  return String(valor || "").trim().toLocaleLowerCase();
}

function coincideBusquedaCliente(cliente, textoNormalizadoBusqueda) {
  if (!textoNormalizadoBusqueda) return true;
  const nombre = textoNormalizado(cliente?.nombre);
  const direccion = textoNormalizado(cliente?.direccion);
  const departamento = textoNormalizado(cliente?.departamento);
  return (
    nombre.includes(textoNormalizadoBusqueda) ||
    direccion.includes(textoNormalizadoBusqueda) ||
    departamento.includes(textoNormalizadoBusqueda)
  );
}

export function buscarClientesParaRepartidor({
  clientes = [],
  repartidores = [],
  repartidorId,
  textoBusqueda,
}) {
  const texto = textoNormalizado(textoBusqueda);
  if (!texto) return [];

  const repartidorPorId = new Map(
    repartidores.map((repartidor) => [repartidor.id, repartidor.nombre])
  );

  return clientes
    .filter((cliente) => coincideBusquedaCliente(cliente, texto))
    .map((cliente) => ({
      ...cliente,
      esDeOtroRepartidor: cliente.repartidorId !== repartidorId,
      nombreRepartidor:
        repartidorPorId.get(cliente.repartidorId) || "Sin repartidor asignado",
    }))
    .sort((a, b) => (a.nombre || "").localeCompare(b.nombre || ""));
}

function ordenarClientesEnGrupoPorDia(clientesGrupo = [], dia) {
  return clientesGrupo.slice().sort((a, b) => {
    const ordenA = ordenClienteEnDia(a, dia);
    const ordenB = ordenClienteEnDia(b, dia);
    if (ordenA !== ordenB) return ordenA - ordenB;
    return (a.nombre || "").localeCompare(b.nombre || "");
  });
}

export function filtrarYAgruparClientesOtrosDias({
  clientes = [],
  diaActual = "Lunes",
  idsRecorridoActual = [],
  idsVisitadosHoy = [],
  diaFiltro = "todos",
  textoBusqueda = "",
} = {}) {
  const otrosDias = DIAS_SEMANA.filter((dia) => dia !== diaActual);
  const setRecorrido = new Set(idsRecorridoActual);
  const setVisitados = new Set(idsVisitadosHoy);
  const texto = textoNormalizado(textoBusqueda);

  // Priorizamos días anteriores en la semana (del más reciente hacia atrás),
  // seguidos de los días posteriores (del final de la semana hacia adelante, ej. Viernes/Sábado si hoy es Lunes)
  const indiceHoy = DIAS_SEMANA.indexOf(diaActual);
  const diasAnteriores =
    indiceHoy > 0 ? DIAS_SEMANA.slice(0, indiceHoy).reverse() : [];
  const diasPosteriores =
    indiceHoy >= 0
      ? DIAS_SEMANA.slice(indiceHoy + 1).reverse()
      : [...otrosDias].reverse();
  const prioridadReferencia = [...diasAnteriores, ...diasPosteriores];

  const clientesOtrosDiasBase = clientes.filter((cliente) => {
    if (!cliente || setRecorrido.has(cliente.id) || setVisitados.has(cliente.id)) {
      return false;
    }
    const diasCliente = Array.isArray(cliente.diasVisita)
      ? cliente.diasVisita
      : [];
    return otrosDias.some((dia) => diasCliente.includes(dia));
  });

  const conteoPorDia = {};
  otrosDias.forEach((dia) => {
    conteoPorDia[dia] = clientesOtrosDiasBase.filter((c) =>
      (c.diasVisita || []).includes(dia)
    ).length;
  });

  const diasDisponibles = otrosDias.filter((dia) => conteoPorDia[dia] > 0);

  const clientesConBusqueda = clientesOtrosDiasBase.filter((cliente) =>
    coincideBusquedaCliente(cliente, texto)
  );

  if (diaFiltro && diaFiltro !== "todos") {
    const clientesDelDia = ordenarClientesEnGrupoPorDia(
      clientesConBusqueda.filter((c) =>
        (c.diasVisita || []).includes(diaFiltro)
      ),
      diaFiltro
    ).map((c) => ({
      ...c,
      diaReferencia: diaFiltro,
    }));

    const grupos =
      clientesDelDia.length > 0
        ? [{ dia: diaFiltro, clientes: clientesDelDia }]
        : [];

    return {
      grupos,
      clientes: clientesDelDia,
      conteoPorDia,
      diasDisponibles,
      totalDisponibles: clientesOtrosDiasBase.length,
      totalFiltrados: clientesDelDia.length,
    };
  }

  const clientesConReferencia = clientesConBusqueda.map((cliente) => {
    const diasCliente = cliente.diasVisita || [];
    const diaReferencia =
      prioridadReferencia.find((dia) => diasCliente.includes(dia)) ||
      otrosDias.find((dia) => diasCliente.includes(dia)) ||
      "";
    return {
      ...cliente,
      diaReferencia,
    };
  });

  const grupos = otrosDias
    .map((dia) => ({
      dia,
      clientes: ordenarClientesEnGrupoPorDia(
        clientesConReferencia.filter((c) => c.diaReferencia === dia),
        dia
      ),
    }))
    .filter((grupo) => grupo.clientes.length > 0);

  const clientesOrdenados = grupos.flatMap((grupo) => grupo.clientes);

  return {
    grupos,
    clientes: clientesOrdenados,
    conteoPorDia,
    diasDisponibles,
    totalDisponibles: clientesOtrosDiasBase.length,
    totalFiltrados: clientesOrdenados.length,
  };
}
