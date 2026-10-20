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
