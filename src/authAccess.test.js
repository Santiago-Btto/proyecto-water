import { describe, expect, it } from "vitest";
import {
  esSesionAutenticada,
  perfilInicialParaSesion,
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
});
