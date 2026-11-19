import { describe, expect, it } from "vitest";
import {
  esSesionAutenticada,
  parsearPerfilActivo,
  perfilInicialParaSesion,
  serializarPerfilActivo,
} from "./authAccess";

describe("acceso autenticado", () => {
  it("solo considera válida una sesión con identidad de Firebase", () => {
    expect(esSesionAutenticada(null)).toBe(false);
    expect(esSesionAutenticada({})).toBe(false);
    expect(esSesionAutenticada({ uid: "usuario-compartido" })).toBe(true);
  });

  it("muestra el selector de perfiles únicamente después de iniciar sesión", () => {
    expect(perfilInicialParaSesion(null)).toBeNull();
    expect(perfilInicialParaSesion({ uid: "usuario-compartido" })).toBe("picker");
  });

  it("serializa y parsea perfiles válidos de repartidor y admin, descartando valores inválidos", () => {
    const repRaw = serializarPerfilActivo({ type: "repartidor", id: "r1" });
    expect(parsearPerfilActivo(repRaw)).toEqual({ type: "repartidor", id: "r1" });

    const adminRaw = serializarPerfilActivo({ type: "admin" });
    expect(parsearPerfilActivo(adminRaw)).toEqual({ type: "admin" });

    expect(serializarPerfilActivo("picker")).toBeNull();
    expect(serializarPerfilActivo({ type: "repartidor", id: "   " })).toBeNull();
    expect(parsearPerfilActivo(null)).toBeNull();
    expect(parsearPerfilActivo("json-invalido")).toBeNull();
    expect(parsearPerfilActivo(JSON.stringify({ type: "repartidor", id: "" }))).toBeNull();
    expect(parsearPerfilActivo(JSON.stringify({ type: "otro" }))).toBeNull();
  });

  it("restaura el perfil activo guardado cuando la sesión está autenticada", () => {
    const user = { uid: "usuario-compartido" };
    expect(
      perfilInicialParaSesion(user, { type: "repartidor", id: "r1" })
    ).toEqual({ type: "repartidor", id: "r1" });
    expect(
      perfilInicialParaSesion(user, { type: "admin" })
    ).toEqual({ type: "admin" });
    expect(
      perfilInicialParaSesion(user, { type: "repartidor", id: "" })
    ).toBe("picker");
    expect(
      perfilInicialParaSesion(null, { type: "repartidor", id: "r1" })
    ).toBeNull();
  });
});
