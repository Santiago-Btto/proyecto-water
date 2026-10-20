import { describe, expect, it } from "vitest";
import { MENDOZA_DEPARTMENTS, isMendozaDepartment } from "./mendozaDepartments";

describe("Mendoza departments", () => {
  it("includes the 18 official departments of Mendoza", () => {
    expect(MENDOZA_DEPARTMENTS).toHaveLength(18);
    expect(MENDOZA_DEPARTMENTS).toEqual(expect.arrayContaining([
      "Capital",
      "Godoy Cruz",
      "General San Martín",
      "San Rafael",
    ]));
  });

  it("accepts only a known department or an empty optional selection", () => {
    expect(isMendozaDepartment("Guaymallén")).toBe(true);
    expect(isMendozaDepartment("")).toBe(true);
    expect(isMendozaDepartment("Mendoza ciudad")).toBe(false);
  });
});
