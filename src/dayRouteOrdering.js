export function ordenClienteEnDia(cliente, dia) {
  const ordenDelDia = cliente?.ordenPorDia?.[dia];
  const ordenGuardado =
    ordenDelDia === undefined || ordenDelDia === null || ordenDelDia === ""
      ? cliente?.orden
      : ordenDelDia;
  const orden = Number(ordenGuardado);

  return Number.isFinite(orden) && orden > 0 ? orden : Infinity;
}

export function ordenarClientesPorDia(clientes = [], dia) {
  return clientes
    .map((cliente, indice) => ({ cliente, indice }))
    .sort((a, b) => {
      const ordenA = ordenClienteEnDia(a.cliente, dia);
      const ordenB = ordenClienteEnDia(b.cliente, dia);

      if (ordenA !== ordenB) return ordenA - ordenB;

      const porNombre = (a.cliente.nombre || "").localeCompare(
        b.cliente.nombre || ""
      );

      return porNombre || a.indice - b.indice;
    })
    .map(({ cliente }) => cliente);
}

export function ubicarClienteEnDia({
  clientes = [],
  cliente,
  dia,
  despuesDeId = null,
}) {
  if (!cliente?.id || !cliente.repartidorId || !dia) return clientes;

  const clienteActualizado = {
    ...clientes.find((item) => item.id === cliente.id),
    ...cliente,
  };

  if (!(clienteActualizado.diasVisita || []).includes(dia)) return clientes;

  const clientesSinObjetivo = clientes.filter(
    (item) => item.id !== cliente.id
  );
  const rutaDelDia = ordenarClientesPorDia(
    clientesSinObjetivo.filter(
      (item) =>
        item.repartidorId === clienteActualizado.repartidorId &&
        (item.diasVisita || []).includes(dia)
    ),
    dia
  );
  const indiceReferencia = despuesDeId
    ? rutaDelDia.findIndex((item) => item.id === despuesDeId)
    : -1;
  const posicionInsercion =
    indiceReferencia >= 0 ? indiceReferencia + 1 : rutaDelDia.length;

  rutaDelDia.splice(posicionInsercion, 0, clienteActualizado);

  const ordenPorCliente = new Map(
    rutaDelDia.map((item, indice) => [item.id, indice + 1])
  );

  return [...clientesSinObjetivo, clienteActualizado].map((item) => {
    const orden = ordenPorCliente.get(item.id);

    if (!orden) return item;

    return {
      ...item,
      ordenPorDia: {
        ...(item.ordenPorDia || {}),
        [dia]: orden,
      },
    };
  });
}
