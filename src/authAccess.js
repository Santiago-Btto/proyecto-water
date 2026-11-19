export function esSesionAutenticada(usuario) {
  return Boolean(usuario?.uid);
}

export function parsearPerfilActivo(raw) {
  if (!raw) return null;
  let candidate = raw;
  if (typeof raw === "string") {
    try {
      candidate = JSON.parse(raw);
    } catch {
      return null;
    }
  }
  if (!candidate || typeof candidate !== "object") return null;
  if (candidate.type === "admin") {
    return { type: "admin" };
  }
  if (
    candidate.type === "repartidor" &&
    typeof candidate.id === "string" &&
    candidate.id.trim()
  ) {
    return { type: "repartidor", id: candidate.id.trim() };
  }
  return null;
}

export function serializarPerfilActivo(perfil) {
  const valid = parsearPerfilActivo(perfil);
  return valid ? JSON.stringify(valid) : null;
}

export function perfilInicialParaSesion(usuario, perfilGuardado = null) {
  if (!esSesionAutenticada(usuario)) return null;
  return parsearPerfilActivo(perfilGuardado) || "picker";
}
