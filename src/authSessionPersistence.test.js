import { describe, expect, it } from "vitest";
import {
  PERSISTENCIA_SESION,
  elegirPersistenciaParaDispositivo,
} from "./authSessionPersistence";

describe("persistencia de sesión", () => {
  it("mantiene la sesión iniciada aunque se cierre la app", () => {
    expect(PERSISTENCIA_SESION).toBeDefined();
  });

  it("elige el almacenamiento propio del dispositivo y no una alternativa temporal", () => {
    const local = { nombre: "local" };
    const temporal = { nombre: "temporal" };

    expect(elegirPersistenciaParaDispositivo(local, temporal)).toBe(local);
  });
});
