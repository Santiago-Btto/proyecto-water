export function esSesionAutenticada(usuario) {
  return Boolean(usuario?.uid);
}

export function perfilInicialParaSesion(usuario) {
  return esSesionAutenticada(usuario) ? "picker" : null;
}
