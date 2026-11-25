import { describe, expect, it } from "vitest";
import {
  METODOS_PAGO_GASTO,
  metodoPagoDeGasto,
  obtenerDetalleMedidorDashboard,
  resumenGastosPorMetodoPago,
} from "./dashboardPaymentBreakdowns";

const PRODUCTOS_CATALOGO = [
  { key: "b20", label: "Bidón 20L", corto: "20L" },
  { key: "b12", label: "Bidón 12L", corto: "12L" },
  { key: "sifon", label: "Sifón", corto: "Sifón" },
];

describe("dashboardPaymentBreakdowns", () => {
  describe("metodoPagoDeGasto y resumenGastosPorMetodoPago", () => {
    it("resuelve cada método configurado y cae en Sin especificar para gastos antiguos", () => {
      expect(METODOS_PAGO_GASTO.map((m) => m.key)).toEqual([
        "efectivo",
        "mercadopago",
        "tarjeta",
        "otro",
      ]);
      expect(metodoPagoDeGasto("mercadopago").corto).toBe("Mercado Pago");
      expect(metodoPagoDeGasto(undefined)).toEqual({
        key: "sin_especificar",
        label: "Sin especificar",
        corto: "Sin especificar",
        tone: "muted",
      });
    });

    it("agrupa y suma gastos por medio de pago excluyendo los que tienen total 0", () => {
      const gastos = [
        { id: "g1", concepto: "Nafta", monto: 25000, metodoPago: "efectivo" },
        { id: "g2", concepto: "Peaje", monto: 5000, metodoPago: "efectivo" },
        { id: "g3", concepto: "Repuesto", monto: 40000, metodoPago: "mercadopago" },
        { id: "g4", concepto: "Seguro cuota 1/3", monto: 15000, metodoPago: "tarjeta" },
        { id: "g5", concepto: "Gasto viejo", monto: 3000 },
      ];

      const resumen = resumenGastosPorMetodoPago(gastos);

      expect(resumen).toEqual([
        expect.objectContaining({
          key: "efectivo",
          corto: "Efectivo",
          total: 30000,
          cantidad: 2,
        }),
        expect.objectContaining({
          key: "mercadopago",
          corto: "Mercado Pago",
          total: 40000,
          cantidad: 1,
        }),
        expect.objectContaining({
          key: "tarjeta",
          corto: "Tarjeta",
          total: 15000,
          cantidad: 1,
        }),
        expect.objectContaining({
          key: "sin_especificar",
          corto: "Sin especificar",
          total: 3000,
          cantidad: 1,
        }),
      ]);
    });
  });

  describe("obtenerDetalleMedidorDashboard", () => {
    const clientes = [
      {
        id: "c1",
        nombre: "Ana Gómez",
        direccion: "San Martín 123",
        diasVisita: ["Lunes", "Jueves"],
        repartidorId: "r1",
        deudaAcumulada: 4000,
      },
      {
        id: "c2",
        nombre: "Carlos Ruiz",
        direccion: "Belgrano 456",
        diasVisita: ["Martes"],
        repartidorId: "r2",
        deudaAcumulada: 9500,
      },
      {
        id: "c3",
        nombre: "Marta Díaz",
        direccion: "Mitre 789",
        diasVisita: ["Miércoles"],
        repartidorId: "r1",
        deudaAcumulada: 0,
      },
    ];

    const repartidores = [
      { id: "r1", nombre: "Lukas" },
      { id: "r2", nombre: "Maxi" },
    ];

    const visitas = [
      {
        id: "v1",
        clienteId: "c1",
        repartidorId: "r1",
        fecha: "2026-11-24",
        vendio: true,
        items: [{ tipo: "b20", cantidad: 2, precioUnitario: 3000 }],
        total: 6000,
        metodoPago: "efectivo",
        pagos: { efectivo: 8000, mercadopago: 0 },
        deudaGenerada: 0,
        deudaCobrada: 2000,
        metodoDeuda: "efectivo",
      },
      {
        id: "v2",
        clienteId: "c2",
        repartidorId: "r2",
        fecha: "2026-11-24",
        vendio: true,
        items: [
          { tipo: "b20", cantidad: 1, precioUnitario: 3000 },
          { tipo: "sifon", cantidad: 3, precioUnitario: 1000 },
        ],
        total: 6000,
        metodoPago: "mercadopago",
        pagos: { efectivo: 0, mercadopago: 6000 },
        deudaGenerada: 0,
        deudaCobrada: 0,
      },
      {
        id: "v3",
        clienteId: "c3",
        repartidorId: "r1",
        fecha: "2026-11-24",
        vendio: true,
        items: [{ tipo: "b12", cantidad: 2, precioUnitario: 2000 }],
        total: 4000,
        metodoPago: "deuda",
        pagos: { efectivo: 0, mercadopago: 0 },
        deudaGenerada: 4000,
        deudaCobrada: 0,
      },
    ];

    it("devuelve quiénes pagaron en Efectivo con su detalle y cobro de deuda", () => {
      const detalle = obtenerDetalleMedidorDashboard({
        tipo: "efectivo",
        visitas,
        clientes,
        repartidores,
        productosCatalogo: PRODUCTOS_CATALOGO,
      });

      expect(detalle.titulo).toBe("Pagos en Efectivo");
      expect(detalle.total).toBe(8000);
      expect(detalle.items).toHaveLength(1);
      expect(detalle.items[0]).toMatchObject({
        visitaId: "v1",
        clienteId: "c1",
        clienteNombre: "Ana Gómez",
        repartidorNombre: "Lukas",
        fecha: "2026-11-24",
        monto: 8000,
        esCobroDeuda: true,
      });
      expect(detalle.items[0].detalle).toContain("2× 20L");
      expect(detalle.items[0].detalle).toContain("Cobró fiado");
    });

    it("devuelve quiénes pagaron por Mercado Pago", () => {
      const detalle = obtenerDetalleMedidorDashboard({
        tipo: "mercadopago",
        visitas,
        clientes,
        repartidores,
        productosCatalogo: PRODUCTOS_CATALOGO,
      });

      expect(detalle.titulo).toBe("Pagos por Mercado Pago");
      expect(detalle.total).toBe(6000);
      expect(detalle.items).toHaveLength(1);
      expect(detalle.items[0]).toMatchObject({
        visitaId: "v2",
        clienteId: "c2",
        clienteNombre: "Carlos Ruiz",
        repartidorNombre: "Maxi",
        monto: 6000,
        esCobroDeuda: false,
      });
      expect(detalle.items[0].detalle).toContain("1× 20L");
      expect(detalle.items[0].detalle).toContain("3× Sifón");
    });

    it("devuelve el detalle de Fiado generado en el período", () => {
      const detalle = obtenerDetalleMedidorDashboard({
        tipo: "fiado",
        visitas,
        clientes,
        repartidores,
        productosCatalogo: PRODUCTOS_CATALOGO,
      });

      expect(detalle.titulo).toBe("Fiado generado en el período");
      expect(detalle.total).toBe(4000);
      expect(detalle.items).toHaveLength(1);
      expect(detalle.items[0]).toMatchObject({
        visitaId: "v3",
        clienteNombre: "Marta Díaz",
        repartidorNombre: "Lukas",
        monto: 4000,
      });
      expect(detalle.items[0].detalle).toContain("2× 12L");
    });

    it("devuelve todas las ventas facturadas en el período con productos y medio de pago", () => {
      const detalle = obtenerDetalleMedidorDashboard({
        tipo: "facturado",
        visitas,
        clientes,
        repartidores,
        productosCatalogo: PRODUCTOS_CATALOGO,
      });

      expect(detalle.titulo).toBe("Ventas facturadas en el período");
      expect(detalle.total).toBe(16000);
      expect(detalle.items).toHaveLength(3);
      expect(detalle.items.map((item) => item.clienteNombre)).toEqual([
        "Ana Gómez",
        "Carlos Ruiz",
        "Marta Díaz",
      ]);
    });

    it("devuelve los fiados generales de Plata en la calle ordenados de mayor a menor deuda", () => {
      const detalle = obtenerDetalleMedidorDashboard({
        tipo: "plata_en_la_calle",
        visitas,
        clientes,
        repartidores,
        productosCatalogo: PRODUCTOS_CATALOGO,
      });

      expect(detalle.titulo).toBe("Fiados generales · Plata en la calle");
      expect(detalle.total).toBe(13500);
      expect(detalle.items).toEqual([
        {
          id: "c2",
          clienteId: "c2",
          clienteNombre: "Carlos Ruiz",
          repartidorNombre: "Maxi",
          direccion: "Belgrano 456",
          diasTexto: "Martes",
          monto: 9500,
        },
        {
          id: "c1",
          clienteId: "c1",
          clienteNombre: "Ana Gómez",
          repartidorNombre: "Lukas",
          direccion: "San Martín 123",
          diasTexto: "Lunes, Jueves",
          monto: 4000,
        },
      ]);
    });

    it("incluye cobros de fiado sin venta del día en Mercado Pago y soporta clientes o repartidores eliminados", () => {
      const visitasConCobroSinVenta = [
        {
          id: "v-cobro",
          clienteId: "cliente-inexistente",
          clienteNombre: "Cliente Histórico",
          repartidorId: "rep-inexistente",
          fecha: "2026-11-25",
          vendio: false,
          items: [],
          total: 0,
          pagos: { efectivo: 0, mercadopago: 5000 },
          deudaGenerada: 0,
          deudaCobrada: 5000,
          metodoDeuda: "mercadopago",
        },
      ];

      const mpDetalle = obtenerDetalleMedidorDashboard({
        tipo: "mercadopago",
        visitas: visitasConCobroSinVenta,
        clientes: [],
        repartidores: [],
        productosCatalogo: PRODUCTOS_CATALOGO,
      });

      expect(mpDetalle.total).toBe(5000);
      expect(mpDetalle.items[0]).toMatchObject({
        clienteNombre: "Cliente Histórico",
        repartidorNombre: "Sin repartidor",
        monto: 5000,
        esCobroDeuda: true,
        detalle: "Cobró fiado anterior",
      });

      const facturadoDetalle = obtenerDetalleMedidorDashboard({
        tipo: "facturado",
        visitas: visitasConCobroSinVenta,
        clientes: [],
        repartidores: [],
        productosCatalogo: PRODUCTOS_CATALOGO,
      });
      expect(facturadoDetalle.items).toEqual([]);
    });
  });
});
