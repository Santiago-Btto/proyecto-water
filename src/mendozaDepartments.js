export const MENDOZA_DEPARTMENTS = Object.freeze([
  "Capital",
  "General Alvear",
  "Godoy Cruz",
  "Guaymallén",
  "Junín",
  "La Paz",
  "Las Heras",
  "Lavalle",
  "Luján de Cuyo",
  "Maipú",
  "Malargüe",
  "Rivadavia",
  "San Carlos",
  "General San Martín",
  "San Rafael",
  "Santa Rosa",
  "Tunuyán",
  "Tupungato",
]);

export function isMendozaDepartment(value) {
  return value === "" || MENDOZA_DEPARTMENTS.includes(value);
}

export function formatClientAddress(direccion, departamento = "") {
  const cleanAddress = String(direccion || "").trim();
  if (!cleanAddress) return "";

  const cleanDepartment = String(departamento || "").trim();
  if (cleanDepartment && isMendozaDepartment(cleanDepartment)) {
    return `${cleanAddress}, ${cleanDepartment}`;
  }
  return cleanAddress;
}

export function buildGoogleMapsUrl(direccion, departamento = "") {
  const cleanAddress = String(direccion || "").trim();
  if (!cleanAddress) return "";

  const cleanDepartment = String(departamento || "").trim();
  const query =
    cleanDepartment && isMendozaDepartment(cleanDepartment)
      ? `${cleanAddress}, ${cleanDepartment}, Mendoza, Argentina`
      : cleanAddress;

  return `https://maps.google.com/?q=${encodeURIComponent(query)}`;
}
