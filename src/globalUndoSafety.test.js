import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const appPath = fileURLToPath(new URL("./App.jsx", import.meta.url));

describe("seguridad de cambios globales", () => {
  it("no expone controles que restauren toda la base desde la cabecera", async () => {
    const app = await readFile(appPath, "utf8");

    expect(app).not.toContain("onClick={undo}");
    expect(app).not.toContain("onClick={redo}");
    expect(app).not.toContain("const pastRef");
    expect(app).not.toContain("function undo()");
  });
});
