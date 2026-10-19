import { describe, expect, it } from "vitest";
import {
  createInstallmentPlan,
  generateInstallmentExpenses,
} from "./installmentExpenses";

describe("installment expenses", () => {
  it("creates every due installment from its starting month through the current month", () => {
    const plan = createInstallmentPlan({
      id: "tarjeta-1",
      concepto: "Seguro de auto",
      categoria: "seguros",
      montoCuota: 15000,
      cuotasTotales: 3,
      periodoInicio: "2026-09",
    });

    const result = generateInstallmentExpenses({
      plans: [plan],
      expenses: [],
      currentPeriod: "2026-10",
    });

    expect(result.generated).toHaveLength(2);
    expect(result.expenses.map((expense) => [expense.fecha, expense.cuotaNumero])).toEqual([
      ["2026-09-01", 1],
      ["2026-10-01", 2],
    ]);
  });

  it("does not duplicate an installment that was already generated", () => {
    const plan = createInstallmentPlan({
      id: "tarjeta-1",
      concepto: "Seguro de auto",
      categoria: "seguros",
      montoCuota: 15000,
      cuotasTotales: 2,
      periodoInicio: "2026-10",
    });
    const firstSync = generateInstallmentExpenses({
      plans: [plan],
      expenses: [],
      currentPeriod: "2026-10",
    });

    const secondSync = generateInstallmentExpenses({
      plans: [plan],
      expenses: firstSync.expenses,
      currentPeriod: "2026-10",
    });

    expect(secondSync.generated).toEqual([]);
    expect(secondSync.expenses).toHaveLength(1);
  });
});
