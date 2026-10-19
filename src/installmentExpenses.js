function isPeriod(value) {
  return /^\d{4}-(0[1-9]|1[0-2])$/.test(String(value || ""));
}

function nextPeriod(period) {
  const [year, month] = period.split("-").map(Number);
  const nextMonth = month === 12 ? 1 : month + 1;
  const nextYear = month === 12 ? year + 1 : year;
  return `${nextYear}-${String(nextMonth).padStart(2, "0")}`;
}

function periodForInstallment(plan, installmentNumber) {
  let period = plan.periodoInicio;
  for (let index = 1; index < installmentNumber; index += 1) {
    period = nextPeriod(period);
  }
  return period;
}

function installmentId(planId, period) {
  return `cuota-${planId}-${period}`;
}

export function createInstallmentPlan({
  id,
  concepto,
  categoria = "otros",
  montoCuota,
  cuotasTotales,
  periodoInicio,
} = {}) {
  if (!id) throw new Error("No se pudo identificar el gasto en cuotas.");
  if (!String(concepto || "").trim()) throw new Error("Ingresá el concepto del gasto.");
  if (!(Number(montoCuota) > 0)) throw new Error("El monto de cada cuota debe ser mayor que cero.");
  if (!Number.isInteger(Number(cuotasTotales)) || Number(cuotasTotales) < 1) {
    throw new Error("Indicá una cantidad válida de cuotas.");
  }
  if (!isPeriod(periodoInicio)) throw new Error("Elegí el mes de inicio.");

  return {
    id,
    concepto: String(concepto).trim(),
    categoria,
    montoCuota: Number(montoCuota),
    cuotasTotales: Number(cuotasTotales),
    periodoInicio,
    activo: true,
  };
}

export function generateInstallmentExpenses({
  plans = [],
  expenses = [],
  currentPeriod,
} = {}) {
  if (!isPeriod(currentPeriod)) throw new Error("El período actual no es válido.");

  const existingIds = new Set(expenses.map((expense) => expense.id));
  const generated = [];

  plans.filter((plan) => plan?.activo !== false).forEach((plan) => {
    for (let installmentNumber = 1; installmentNumber <= Number(plan.cuotasTotales || 0); installmentNumber += 1) {
      const period = periodForInstallment(plan, installmentNumber);
      if (period > currentPeriod) break;

      const id = installmentId(plan.id, period);
      if (existingIds.has(id)) continue;

      generated.push({
        id,
        concepto: `${plan.concepto} · cuota ${installmentNumber}/${plan.cuotasTotales}`,
        monto: Number(plan.montoCuota),
        categoria: plan.categoria || "otros",
        fecha: `${period}-01`,
        timestamp: Date.UTC(Number(period.slice(0, 4)), Number(period.slice(5, 7)) - 1, 1, 12),
        cuotaPlanId: plan.id,
        cuotaNumero: installmentNumber,
        cuotasTotales: Number(plan.cuotasTotales),
        periodoCuota: period,
      });
      existingIds.add(id);
    }
  });

  return {
    expenses: generated.length ? [...expenses, ...generated] : expenses,
    generated,
  };
}

export function installmentPlanProgress(plan, expenses = []) {
  const generated = expenses.filter((expense) => expense.cuotaPlanId === plan.id).length;
  return {
    generated,
    total: Number(plan.cuotasTotales) || 0,
    completed: generated >= Number(plan.cuotasTotales || 0),
  };
}
