function textoNormalizado(valor) {
  return String(valor || "").trim().toLocaleLowerCase();
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
    .filter((cliente) => {
      const nombre = textoNormalizado(cliente.nombre);
      const direccion = textoNormalizado(cliente.direccion);
      return nombre.includes(texto) || direccion.includes(texto);
    })
    .map((cliente) => ({
      ...cliente,
      esDeOtroRepartidor: cliente.repartidorId !== repartidorId,
      nombreRepartidor:
        repartidorPorId.get(cliente.repartidorId) || "Sin repartidor asignado",
    }))
    .sort((a, b) => (a.nombre || "").localeCompare(b.nombre || ""));
}
