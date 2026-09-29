import { browserLocalPersistence } from "firebase/auth";

export function elegirPersistenciaParaDispositivo(local) {
  return local;
}

// Mantiene la sesión en este dispositivo hasta que la persona elija cerrarla.
export const PERSISTENCIA_SESION = elegirPersistenciaParaDispositivo(browserLocalPersistence);
