export const ARTICULOS_STOCK = [
  { key: "b20", label: "Bidón 20L", seEntregaAClientes: true },
  { key: "b12", label: "Bidón 12L", seEntregaAClientes: true },
  { key: "sifon", label: "Sifón", seEntregaAClientes: true },
  { key: "esqueletos", label: "Esqueletos", seEntregaAClientes: false },
];

export function stockInventarioVacio() {
  return Object.fromEntries(ARTICULOS_STOCK.map(({ key }) => [key, 0]));
}

export function stockInventarioDeRepartidor(stock) {
  return { ...stockInventarioVacio(), ...(stock || {}) };
}

export function calcularStockEnCamionetas(porRepartidor) {
  const trabajando = stockInventarioVacio();

  ARTICULOS_STOCK.forEach((articulo) => {
    trabajando[articulo.key] = Object.values(porRepartidor || {}).reduce(
      (acumulado, stock) => acumulado + (Number(stock?.[articulo.key]) || 0),
      0
    );
  });

  return trabajando;
}

export function calcularStockEnGalpon({ total, porRepartidor, enClientes }) {
  const galpon = stockInventarioVacio();
  const enCamionetas = calcularStockEnCamionetas(porRepartidor);

  ARTICULOS_STOCK.forEach((articulo) => {
    const enClientesDelArticulo = articulo.seEntregaAClientes
      ? Number(enClientes?.[articulo.key]) || 0
      : 0;

    galpon[articulo.key] =
      (Number(total?.[articulo.key]) || 0) - enCamionetas[articulo.key] - enClientesDelArticulo;
  });

  return galpon;
}
