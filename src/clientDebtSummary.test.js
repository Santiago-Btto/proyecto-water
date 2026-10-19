import { describe, expect, it } from "vitest";
import { summarizeClientsWithDebt } from "./clientDebtSummary";

describe("client debt summary", () => {
  it("lists debtors from the largest pending balance to the smallest", () => {
    const result = summarizeClientsWithDebt([
      { id: "a", nombre: "Ana", deudaAcumulada: 2500 },
      { id: "b", nombre: "Bruno", deudaAcumulada: 8000 },
    ]);

    expect(result.clients.map((client) => client.id)).toEqual(["b", "a"]);
    expect(result.total).toBe(10500);
  });

  it("excludes clients without a positive pending balance", () => {
    const result = summarizeClientsWithDebt([
      { id: "paid", deudaAcumulada: 0 },
      { id: "adjustment", deudaAcumulada: -50 },
      { id: "owing", deudaAcumulada: 300 },
    ]);

    expect(result.clients.map((client) => client.id)).toEqual(["owing"]);
    expect(result.total).toBe(300);
  });
});
