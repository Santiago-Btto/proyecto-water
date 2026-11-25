import { describe, expect, it } from "vitest";
import {
  createRemitoFrioCalor,
  buildRemitoWhatsAppMessage,
  buildRemitoPrintableHtml,
} from "./remitoFrioCalor";

describe("remito de entrega y firma para máquina frío/calor", () => {
  const cliente = {
    id: "cli-123456",
    nombre: "Estudio Jurídico Gómez",
    direccion: "San Martín 1250",
    departamento: "Ciudad",
    telefono: "2615551234",
    envasesPermanentes: { b20: 2, b12: 0, sifon: 6 },
    envasesExtra: { b20: 1, b12: 0, sifon: 0 },
  };

  const subscription = {
    id: "sub-1",
    periodo: "2026-11",
    promocionNombre: "Plan 6 bidones",
    cantidadX20: 6,
    precioMensual: 18000,
  };

  it("crea el modelo normalizado del remito con datos del cliente, plan, equipo y firma", () => {
    const remito = createRemitoFrioCalor({
      cliente,
      subscription,
      repartidorNombre: "Lukas",
      detalleEquipo: "Dispenser Frío/Calor en comodato",
      cantidadBidones20L: 2,
      monto: 18000,
      observaciones: "Equipo instalado en recepción",
      firmaDataUrl: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUg==",
      fecha: "2026-11-24",
    });

    expect(remito.numeroRemito).toBe("FC-20261124-3456");
    expect(remito.clienteNombre).toBe("Estudio Jurídico Gómez");
    expect(remito.clienteDireccion).toContain("San Martín 1250");
    expect(remito.repartidorNombre).toBe("Lukas");
    expect(remito.planNombre).toContain("Plan 6 bidones");
    expect(remito.cantidadBidones20L).toBe(2);
    expect(remito.monto).toBe(18000);
    expect(remito.firmaDataUrl).toContain("data:image/png;base64,");
    expect(remito.envasesEnDomicilioTexto).toContain("Permanentes: 2×20L, 6×Sifón");
    expect(remito.envasesEnDomicilioTexto).toContain("Prestados (extra): 1×20L");
  });

  it("construye el mensaje de WhatsApp del remito con estado de firma", () => {
    const remito = createRemitoFrioCalor({
      cliente,
      subscription,
      repartidorNombre: "Lukas",
      cantidadBidones20L: 3,
      monto: 18000,
      observaciones: "Se dejó funcionando",
      firmaDataUrl: "data:image/png;base64,abc",
      fecha: "2026-11-24",
    });

    const texto = buildRemitoWhatsAppMessage(remito);
    expect(texto).toContain("*REMITO DE ENTREGA - FRÍO/CALOR*");
    expect(texto).toContain("Estudio Jurídico Gómez");
    expect(texto).toContain("Bidones 20L entregados: 3");
    expect(texto).toContain("Firmado digitalmente en pantalla ✓");
  });

  it("genera el HTML imprimible del remito incluyendo la imagen de la firma cuando existe", () => {
    const remitoFirmado = createRemitoFrioCalor({
      cliente,
      subscription,
      repartidorNombre: "Lukas",
      cantidadBidones20L: 2,
      monto: 18000,
      firmaDataUrl: "data:image/png;base64,FIRMA123",
      fecha: "2026-11-24",
    });

    const html = buildRemitoPrintableHtml(remitoFirmado);
    expect(html).toContain("REMITO DE ENTREGA Y CONFORMIDAD");
    expect(html).toContain("Estudio Jurídico Gómez");
    expect(html).toContain('src="data:image/png;base64,FIRMA123"');

    const remitoSinFirma = createRemitoFrioCalor({
      cliente,
      fecha: "2026-11-24",
    });
    const htmlSinFirma = buildRemitoPrintableHtml(remitoSinFirma);
    expect(htmlSinFirma).not.toContain("<img");
    expect(htmlSinFirma).toContain("Firma en conformidad");
  });
});
