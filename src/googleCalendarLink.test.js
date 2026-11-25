import { describe, expect, it } from "vitest";
import {
  buildGoogleCalendarUrl,
  buildClientCalendarReminderUrl,
} from "./googleCalendarLink";

describe("integración con Google Calendar", () => {
  it("genera el enlace de evento de día completo en Google Calendar con fechas inicio/fin válidas", () => {
    const url = buildGoogleCalendarUrl({
      title: "Visitar a Familia Gómez",
      dateISO: "2026-11-28",
      details: "Reclamar envase prestado",
      location: "San Martín 500, Godoy Cruz, Mendoza, Argentina",
    });

    expect(url).toContain("https://calendar.google.com/calendar/render?action=TEMPLATE");
    expect(url).toContain("dates=20261128%2F20261129");
    expect(url).toContain("text=Visitar+a+Familia+G%C3%B3mez");
  });

  it("calcula correctamente el día siguiente al cambiar de mes o de año", () => {
    const finDeMes = buildGoogleCalendarUrl({
      title: "Cambio de mes",
      dateISO: "2026-11-30",
    });
    expect(finDeMes).toContain("dates=20261130%2F20261201");

    const finDeAnio = buildGoogleCalendarUrl({
      title: "Cambio de año",
      dateISO: "2026-12-31",
    });
    expect(finDeAnio).toContain("dates=20261231%2F20270101");
  });

  it("construye el recordatorio completo para un cliente con dirección, teléfono, deuda, envases extra y notas", () => {
    const cliente = {
      id: "c1",
      nombre: "Clínica Central",
      direccion: "Belgrano 850",
      departamento: "Ciudad",
      telefono: "2614445566",
      deudaAcumulada: 7500,
      maquinaFrioCalor: true,
      envasesExtra: { b20: 2, b12: 0, sifon: 0 },
    };

    const url = buildClientCalendarReminderUrl({
      cliente,
      fechaISO: "2026-12-05",
      motivo: "Mantenimiento y cobro F/C",
      notas: "Llevar recibo impreso",
    });

    const parsed = new URL(url);
    expect(parsed.searchParams.get("action")).toBe("TEMPLATE");
    expect(parsed.searchParams.get("text")).toBe(
      "Mantenimiento y cobro F/C · Clínica Central"
    );
    expect(parsed.searchParams.get("dates")).toBe("20261205/20261206");
    expect(parsed.searchParams.get("location")).toBe(
      "Belgrano 850, Ciudad, Mendoza, Argentina"
    );
    const details = parsed.searchParams.get("details");
    expect(details).toContain("Teléfono: 2614445566");
    expect(details).toContain("Saldo pendiente: $7500");
    expect(details).toContain("Envases prestados pendientes: 2×20L");
    expect(details).toContain("Equipo: Máquina Frío/Calor");
    expect(details).toContain("Notas: Llevar recibo impreso");
  });
});
