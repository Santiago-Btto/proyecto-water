export function summarizeClientsWithDebt(clients = []) {
  const debtors = clients
    .filter((client) => Number(client.deudaAcumulada) > 0)
    .slice()
    .sort((a, b) => Number(b.deudaAcumulada) - Number(a.deudaAcumulada));

  return {
    clients: debtors,
    total: debtors.reduce(
      (total, client) => total + (Number(client.deudaAcumulada) || 0),
      0
    ),
  };
}
