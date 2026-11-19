import { describe, expect, it } from "vitest";
import {
  MENDOZA_DEPARTMENTS,
  buildGoogleMapsUrl,
  formatClientAddress,
  isMendozaDepartment,
} from "./mendozaDepartments";

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

  it("formats client addresses with and without a valid department", () => {
    expect(formatClientAddress("San Martín 1234", "Godoy Cruz")).toBe(
      "San Martín 1234, Godoy Cruz"
    );
    expect(formatClientAddress("  San Martín 1234  ", "")).toBe(
      "San Martín 1234"
    );
    expect(formatClientAddress("San Martín 1234", "Inexistente")).toBe(
      "San Martín 1234"
    );
    expect(formatClientAddress("", "Godoy Cruz")).toBe("");
    expect(formatClientAddress(null, "Godoy Cruz")).toBe("");
  });

  it("builds a Google Maps search URL disambiguated by department and Mendoza, Argentina when a valid department is set", () => {
    expect(buildGoogleMapsUrl("San Martín 1234", "Godoy Cruz")).toBe(
      `https://maps.google.com/?q=${encodeURIComponent(
        "San Martín 1234, Godoy Cruz, Mendoza, Argentina"
      )}`
    );
    expect(buildGoogleMapsUrl("San Martín 1234", "")).toBe(
      `https://maps.google.com/?q=${encodeURIComponent("San Martín 1234")}`
    );
    expect(buildGoogleMapsUrl("   ", "Godoy Cruz")).toBe("");
    expect(buildGoogleMapsUrl(null)).toBe("");
  });
});
