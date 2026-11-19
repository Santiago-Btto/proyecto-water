import { describe, expect, it } from "vitest";
import { APP_VERSION } from "./appVersion";

describe("versión de la aplicación", () => {
  it("identifica esta publicación como la versión 1.0.9", () => {
    expect(APP_VERSION).toBe("1.0.9");
  });

  it("reemplaza el identificador de la publicación anterior", () => {
    expect(APP_VERSION).not.toBe("1.0.8");
  });
});
