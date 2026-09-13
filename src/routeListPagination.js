export const CLIENTES_POR_BLOQUE = 25;

export function clientesVisiblesEnRecorrido(
  clientes = [],
  limite = CLIENTES_POR_BLOQUE
) {
  return clientes.slice(0, Math.max(0, Number(limite) || 0));
}

export function siguienteLimiteVisible(
  limiteActual,
  totalClientes,
  bloque = CLIENTES_POR_BLOQUE
) {
  const limite = Math.max(0, Number(limiteActual) || 0);
  const total = Math.max(0, Number(totalClientes) || 0);
  const tamanoBloque = Math.max(1, Number(bloque) || CLIENTES_POR_BLOQUE);

  return Math.min(total, limite + tamanoBloque);
}
