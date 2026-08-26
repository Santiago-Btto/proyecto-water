import { describe, expect, it } from "vitest";
import { isDashboardDateInRange } from "./dashboardCalendarFilters";

describe("dashboard calendar filters", () => {
  it("starts a new week on Sunday", () => {
    expect(
      isDashboardDateInRange({
        date: "2026-08-02",
        range: "semana",
        currentDate: "2026-08-02",
      })
    ).toBe(true);
    expect(
      isDashboardDateInRange({
        date: "2026-08-01",
        range: "semana",
        currentDate: "2026-08-02",
      })
    ).toBe(false);
  });

  it("keeps Sunday through Saturday in the same week on Saturday", () => {
    for (const date of ["2026-08-02", "2026-08-08"]) {
      expect(
        isDashboardDateInRange({
          date,
          range: "semana",
          currentDate: "2026-08-08",
        })
      ).toBe(true);
    }
    expect(
      isDashboardDateInRange({
        date: "2026-08-09",
        range: "semana",
        currentDate: "2026-08-08",
      })
    ).toBe(false);
  });

  it("includes the final day of the current month only", () => {
    expect(
      isDashboardDateInRange({
        date: "2026-08-31",
        range: "mes",
        currentDate: "2026-08-31",
      })
    ).toBe(true);
    expect(
      isDashboardDateInRange({
        date: "2026-07-31",
        range: "mes",
        currentDate: "2026-08-31",
      })
    ).toBe(false);
  });

  it("resets the month range on the first day of a new month", () => {
    expect(
      isDashboardDateInRange({
        date: "2026-09-01",
        range: "mes",
        currentDate: "2026-09-01",
      })
    ).toBe(true);
    expect(
      isDashboardDateInRange({
        date: "2026-08-31",
        range: "mes",
        currentDate: "2026-09-01",
      })
    ).toBe(false);
  });
});
