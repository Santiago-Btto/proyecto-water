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

  it("stores and propagates metodoPago from the installment plan to each generated expense", () => {
    const plan = createInstallmentPlan({
      id: "tarjeta-2",
      concepto: "Cubiertas",
      categoria: "mantenimiento",
      metodoPago: "tarjeta",
      montoCuota: 45000,
      cuotasTotales: 2,
      periodoInicio: "2026-09",
    });

    expect(plan.metodoPago).toBe("tarjeta");

    const result = generateInstallmentExpenses({
      plans: [plan],
      expenses: [],
      currentPeriod: "2026-10",
    });

    expect(result.generated.map((expense) => expense.metodoPago)).toEqual([
      "tarjeta",
      "tarjeta",
    ]);
  });

  it("defaults metodoPago to efectivo when omitted in plan or legacy plan", () => {
    const defaultPlan = createInstallmentPlan({
      id: "plan-default",
      concepto: "Herramientas",
      montoCuota: 10000,
      cuotasTotales: 1,
      periodoInicio: "2026-10",
    });

    expect(defaultPlan.metodoPago).toBe("efectivo");

    const legacyPlanWithoutMethod = {
      id: "legacy-1",
      concepto: "Plan viejo",
      categoria: "otros",
      montoCuota: 8000,
      cuotasTotales: 1,
      periodoInicio: "2026-10",
      activo: true,
    };

    const result = generateInstallmentExpenses({
      plans: [legacyPlanWithoutMethod],
      expenses: [],
      currentPeriod: "2026-10",
    });

    expect(result.generated[0].metodoPago).toBe("efectivo");
  });
});
