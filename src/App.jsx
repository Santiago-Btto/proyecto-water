import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import {
  Droplet, Truck, Users, Receipt, Plus, Check, X,
  ChevronRight, Undo2, Redo2, LogOut, CreditCard, Banknote,
  HandCoins, AlertCircle, Search, Edit2, Trash2,
  ArrowLeft, Lock, ClipboardList, CheckCircle2, Circle, BarChart3,
  UserCog, MessageCircle, MapPin, Save, Minus, Settings2,
  Home as HomeIcon, WifiOff, Download, Boxes, CalendarDays
} from "lucide-react";
import {
  collection, doc, onSnapshot, setDoc, deleteDoc, getDoc, getDocs, increment
} from "firebase/firestore";
import { firestore, COLLECTION } from "./firebaseConfig";

/* ============================================================
   TOKENS DE DISEÑO
   ============================================================ */
const C = {
  bg: "#F2F8F9",
  surface: "#FFFFFF",
  ink: "#0B2B3C",
  muted: "#5E7A87",
  mutedLight: "#93A9B1",
  primary: "#0C6478",
  primaryDark: "#082C38",
  accent: "#0FA9B8",
  accentSoft: "#DFF4F6",
  success: "#1E9E5A",
  successBg: "#E7F7EE",
  warning: "#C97A17",
  warningBg: "#FBF0DF",
  danger: "#D14343",
  dangerBg: "#FBEAEA",
  border: "#DEE9EB",
};

const DIAS = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];
const DIAS_JS = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];
const PRODUCTOS = [
  {
    key: "b20",
    label: "Bidón 20L",
    corto: "20L",
    retornable: true,
  },
  {
    key: "b12",
    label: "Bidón 12L",
    corto: "12L",
    retornable: true,
  },
  {
    key: "sifon",
    label: "Sifón",
    corto: "Sifón",
    retornable: true,
  },
  {
    key: "jugo",
    label: "Jugo",
    corto: "Jugo",
    retornable: false,
  },
  {
    key: "jugo5",
    label: "Jugo 5L",
    corto: "Jugo 5L",
    retornable: false,
  },
  {
    key: "dispenserNatural",
    label: "Dispenser natural",
    corto: "Dispenser",
    retornable: false,
  },
];
const PRODUCTOS_RETORNABLES = PRODUCTOS.filter((p) => p.retornable);
const DEFAULT_CONFIG = {
  adminPin: "",
  repartidores: [],

  precios: {
    b20: 0,
    b12: 0,
    sifon: 0,
    jugo: 0,
    jugo5: 0,
    dispenserNatural: 0,
  },

  stockActivo: false,

  stockTotal: {
    b20: 0,
    b12: 0,
    sifon: 0,
  },
};

/* ============================================================
   UTILIDADES
   ============================================================ */
function uid() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  return "id-" + Math.random().toString(36).slice(2) + Date.now().toString(36);
}
function hoyISO() {
  const d = new Date();
  return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
}
function diaSemanaHoy() {
  return DIAS_JS[new Date().getDay()];
}
function fechaLegible(iso) {
  try {
    const [y, m, d] = iso.split("-");
    return `${d}/${m}/${y}`;
  } catch {
    return iso;
  }
}

// Convierte teléfonos argentinos al formato que espera WhatsApp.
//
// Admite, entre otros:
//   +54 9 261 5551234
//   54 9 261 5551234
//   0261 15 5551234
//   261 5551234
//
// WhatsApp necesita solamente números, con código de país,
// sin "+", espacios, guiones, 0 de característica ni "15".
function telefonoAWhatsApp(telefono) {
  if (!telefono) return "";

  let numero = String(telefono).replace(/\D/g, "");
  if (!numero) return "";

  // Prefijo internacional escrito como 0054...
  if (numero.startsWith("00")) {
    numero = numero.slice(2);
  }

  // Si ya viene con código de país Argentina.
  if (numero.startsWith("54")) {
    let resto = numero.slice(2);

    // Caso ya correcto: 549...
    if (resto.startsWith("9")) {
      resto = resto.slice(1).replace(/^0+/, "");
      return "549" + resto;
    }

    resto = resto.replace(/^0+/, "");

    // Formato viejo con 15: buscamos el "15" después
    // de una característica de 2, 3 o 4 dígitos.
    if (resto.length === 12) {
      for (const pos of [2, 3, 4]) {
        if (resto.slice(pos, pos + 2) === "15") {
          resto = resto.slice(0, pos) + resto.slice(pos + 2);
          break;
        }
      }
    }

    return "549" + resto;
  }

  // Número nacional/local.
  numero = numero.replace(/^0+/, "");

  // Formato argentino viejo: característica + 15 + número.
  // Ej.: 261155551234 -> 2615551234.
  if (numero.length === 12) {
    for (const pos of [2, 3, 4]) {
      if (numero.slice(pos, pos + 2) === "15") {
        numero = numero.slice(0, pos) + numero.slice(pos + 2);
        break;
      }
    }
  }

  return "549" + numero;
}

function urlWhatsApp(telefono) {
  const numero = telefonoAWhatsApp(telefono);
  return numero ? `https://wa.me/${numero}` : "";
}

function urlGoogleMaps(direccion) {
  if (!direccion) return "";
  return `https://maps.google.com/?q=${encodeURIComponent(direccion)}`;
}
function diaSemanaDeFecha(iso) {
  try {
    const [y, m, d] = iso.split("-").map(Number);
    return DIAS_JS[new Date(y, m - 1, d).getDay()];
  } catch {
    return "";
  }
}
function proximoSabadoISO(desdeISO = hoyISO()) {
  try {
    const [y, m, d] = desdeISO.split("-").map(Number);
    const fecha = new Date(y, m - 1, d);
    let diasHastaSabado = (6 - fecha.getDay() + 7) % 7;

    // Si hoy ya es sábado, programamos para el sábado siguiente.
    if (diasHastaSabado === 0) diasHastaSabado = 7;

    fecha.setDate(fecha.getDate() + diasHastaSabado);

    return (
      fecha.getFullYear() +
      "-" +
      String(fecha.getMonth() + 1).padStart(2, "0") +
      "-" +
      String(fecha.getDate()).padStart(2, "0")
    );
  } catch {
    return desdeISO;
  }
}
function formatMoney(n) {
  const val = Number(n) || 0;
  try {
    return val.toLocaleString("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 });
  } catch {
    return "$" + val.toFixed(0);
  }
}
function clone(o) {
  return JSON.parse(JSON.stringify(o));
}
function totalPedido(items) {
  return items.reduce((s, it) => s + it.cantidad * it.precioUnitario, 0);
}
function envasesVacio() {
  return { b20: 0, b12: 0, sifon: 0, jugo: 0 };
}
function stockVacio() {
  return { b20: 0, b12: 0, sifon: 0 };
}
function stockDeRepartidor(db, repartidorId) {
  const encontrado = (db.stock || []).find((s) => s.id === repartidorId);
  return { ...stockVacio(), ...(encontrado || {}) };
}
function envasesPermanentesDe(cliente) {
  return {
    ...envasesVacio(),
    ...(cliente?.envasesPermanentes || cliente?.envasesPrestados || {}),
  };
}
function envasesExtraDe(cliente) {
  return {
    ...envasesVacio(),
    ...(cliente?.envasesExtra || {}),
  };
}
function envasesTotalesDe(cliente) {
  const permanentes = envasesPermanentesDe(cliente);
  const extras = envasesExtraDe(cliente);
  const total = envasesVacio();
  PRODUCTOS_RETORNABLES.forEach((p) => {
    total[p.key] = (Number(permanentes[p.key]) || 0) + (Number(extras[p.key]) || 0);
  });
  return total;
}
function stockPermanenteClientes(clientes) {
  const resultado = stockVacio();
  clientes.forEach((c) => {
    const permanentes = envasesPermanentesDe(c);
    PRODUCTOS_RETORNABLES.forEach((p) => {
      resultado[p.key] += Number(permanentes[p.key]) || 0;
    });
  });
  return resultado;
}
function stockExtraClientes(clientes) {
  const resultado = stockVacio();
  clientes.forEach((c) => {
    const extras = envasesExtraDe(c);
    PRODUCTOS_RETORNABLES.forEach((p) => {
      resultado[p.key] += Number(extras[p.key]) || 0;
    });
  });
  return resultado;
}
function stockPrestadoClientes(clientes) {
  const permanentes = stockPermanenteClientes(clientes);
  const extras = stockExtraClientes(clientes);
  const resultado = stockVacio();
  PRODUCTOS_RETORNABLES.forEach((p) => {
    resultado[p.key] = permanentes[p.key] + extras[p.key];
  });
  return resultado;
}
function totalEnvasesCliente(cliente) {
  return totalEnvasesPrestados(envasesTotalesDe(cliente));
}
function stockTrabajando(stockRepartidores) {
  const resultado = stockVacio();
  Object.values(stockRepartidores || {}).forEach((stock) => {
    PRODUCTOS_RETORNABLES.forEach((p) => {
      resultado[p.key] += Number(stock?.[p.key]) || 0;
    });
  });
  return resultado;
}
function totalEnvasesPrestados(ep) {
  if (!ep) return 0;
  return PRODUCTOS.reduce((s, p) => s + (ep[p.key] || 0), 0);
}
function textoEnvasesPrestados(ep) {
  if (!ep) return "";
  return PRODUCTOS.filter((p) => (ep[p.key] || 0) > 0).map((p) => `${ep[p.key]}×${p.corto}`).join(", ");
}
/* delta = entregados - devueltos, solo para tipos retornables (no aplica a "jugo") */
function calcularDeltaEnvases(visita) {
  const delta = {};
  PRODUCTOS_RETORNABLES.forEach((p) => {
    const entregado = (visita.items || []).find((it) => it.tipo === p.key)?.cantidad || 0;
    const devuelto = (visita.retornos && visita.retornos[p.key]) || 0;
    const d = entregado - devuelto;
    if (d !== 0) delta[p.key] = d;
  });
  return delta;
}
function calcularDeltaExtras(visita) {
  // Visitas nuevas: usamos el sistema explícito de extras.
  if (visita.extrasPrestados || visita.extrasRetirados) {
    const delta = {};

    PRODUCTOS_RETORNABLES.forEach((p) => {
      const prestados =
        Number(visita.extrasPrestados?.[p.key]) || 0;

      const retirados =
        Number(visita.extrasRetirados?.[p.key]) || 0;

      const d = prestados - retirados;

      if (d !== 0) {
        delta[p.key] = d;
      }
    });

    return delta;
  }

  // Compatibilidad con visitas viejas.
  return calcularDeltaEnvases(visita);
}
function aplicarDeltaEnvases(envasesPrestados, delta, signo = 1) {
  const ep = { ...(envasesPrestados || envasesVacio()) };
  Object.keys(delta).forEach((tipo) => {
    ep[tipo] = Math.max(0, (ep[tipo] || 0) + signo * delta[tipo]);
  });
  return ep;
}
function aplicarRetiroPermanentes(permanentes, retirados, signo = 1) {
  const resultado = {
    ...envasesVacio(),
    ...(permanentes || {}),
  };

  PRODUCTOS_RETORNABLES.forEach((p) => {
    const cantidad = Number(retirados?.[p.key]) || 0;
    resultado[p.key] = Math.max(
      0,
      (Number(resultado[p.key]) || 0) - signo * cantidad
    );
  });

  return resultado;
}

// Movimiento físico de stock de la camioneta.
// Incluye extras prestados/retirados y también permanentes devueltos.
function calcularDeltaStockEnvases(visita) {
  // Formato nuevo.
  if (
    visita.extrasPrestados ||
    visita.extrasRetirados ||
    visita.permanentesRetirados
  ) {
    const delta = {};

    PRODUCTOS_RETORNABLES.forEach((p) => {
      const prestados = Number(visita.extrasPrestados?.[p.key]) || 0;
      const extrasRetirados = Number(visita.extrasRetirados?.[p.key]) || 0;
      const permanentesRetirados =
        Number(visita.permanentesRetirados?.[p.key]) || 0;

      const d = prestados - extrasRetirados - permanentesRetirados;
      if (d !== 0) delta[p.key] = d;
    });

    return delta;
  }

  // Compatibilidad con visitas antiguas.
  return calcularDeltaExtras(visita);
}
function textoDevoluciones(v) {
  if (!v.retornos) return "";
  return PRODUCTOS_RETORNABLES
    .filter((p) => (v.retornos[p.key] || 0) > 0)
    .map((p) => `${v.retornos[p.key]}×${p.corto}`)
    .join(", ");
}

function textoExtrasPrestados(v) {
  if (!v?.extrasPrestados) return "";
  return PRODUCTOS_RETORNABLES
    .filter((p) => (Number(v.extrasPrestados[p.key]) || 0) > 0)
    .map((p) => `${Number(v.extrasPrestados[p.key]) || 0}×${p.corto}`)
    .join(", ");
}

function textoExtrasRetirados(v) {
  if (!v?.extrasRetirados) return "";
  return PRODUCTOS_RETORNABLES
    .filter((p) => (Number(v.extrasRetirados[p.key]) || 0) > 0)
    .map((p) => `${Number(v.extrasRetirados[p.key]) || 0}×${p.corto}`)
    .join(", ");
}
function textoPermanentesRetirados(v) {
  if (!v?.permanentesRetirados) return "";
  return PRODUCTOS_RETORNABLES
    .filter((p) => (Number(v.permanentesRetirados[p.key]) || 0) > 0)
    .map(
      (p) =>
        `${Number(v.permanentesRetirados[p.key]) || 0}×${p.corto}`
    )
    .join(", ");
}

function resumenExtrasVisitas(visitas) {
  const prestados = stockVacio();
  const retirados = stockVacio();
  const balance = stockVacio();

  (visitas || []).forEach((v) => {
    PRODUCTOS_RETORNABLES.forEach((p) => {
      const prestado = Number(v.extrasPrestados?.[p.key]) || 0;
      const retirado = Number(v.extrasRetirados?.[p.key]) || 0;

      prestados[p.key] += prestado;
      retirados[p.key] += retirado;
      balance[p.key] += prestado - retirado;
    });
  });

  return { prestados, retirados, balance };
}

/* ============================================================
   EXPORTAR DATOS (CSV — se abre bien en Excel/Sheets/Numbers)
   ============================================================ */
function descargarCSV(filename, headers, rows) {
  const escape = (v) => {
    const s = String(v ?? "");
    return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  };
  const lineas = [headers.map(escape).join(","), ...rows.map((r) => r.map(escape).join(","))];
  const csv = "\uFEFF" + lineas.join("\r\n"); // BOM: para que Excel muestre bien tildes y "ñ"
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
function exportarClientesCSV(db) {
  const headers = ["Nombre", "Dirección", "Teléfono", "Días de visita", "Repartidor", "Deuda acumulada", "Envases permanentes", "Envases extra", "Máquina frío/calor", "Notas"];
  const rows = db.clientes.map((c) => {
    const rep = db.config.repartidores.find((r) => r.id === c.repartidorId);
    return [
      c.nombre, c.direccion, c.telefono || "", (c.diasVisita || []).join(" - "),
      rep?.nombre || "", c.deudaAcumulada || 0,
      textoEnvasesPrestados(envasesPermanentesDe(c)) || "Ninguno",
      textoEnvasesPrestados(envasesExtraDe(c)) || "Ninguno",
      c.maquinaFrioCalor ? "Sí" : "No", c.notas || "",
    ];
  });
  descargarCSV(`clientes_${hoyISO()}.csv`, headers, rows);
}
function exportarVisitasCSV(db) {
  const headers = [
    "Fecha",
    "Cliente",
    "Repartidor",
    "Vendió",
    "Productos",
    "Total",
    "Método de pago",
    "Deuda generada",
    "Deuda cobrada",
    "Extras prestados",
    "Extras retirados",
    "Permanentes retirados",
    "Devoluciones (registro antiguo)",
    "Notas",
  ];

  const metodos = {
    efectivo: "Efectivo",
    mercadopago: "Mercado Pago",
    deuda: "Fiado",
  };

  const rows = db.visitas
    .slice()
    .sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0))
    .map((v) => {
      const cliente = db.clientes.find((c) => c.id === v.clienteId);
      const rep = db.config.repartidores.find((r) => r.id === v.repartidorId);
      const productos = (v.items || [])
        .filter((it) => it.cantidad > 0)
        .map((it) => `${it.cantidad}x${PRODUCTOS.find((p) => p.key === it.tipo)?.corto}`)
        .join(" + ");

      return [
        fechaLegible(v.fecha),
        cliente?.nombre || v.clienteNombre || "Cliente eliminado",
        rep?.nombre || "",
        v.vendio ? "Sí" : "No",
        productos,
        v.total || 0,
        v.vendio ? (metodos[v.metodoPago] || "") : "",
        v.deudaGenerada || 0,
        v.deudaCobrada || 0,
        textoExtrasPrestados(v) || "",
        textoExtrasRetirados(v) || "",
        textoPermanentesRetirados(v) || "",
        !v.extrasPrestados && !v.extrasRetirados && !v.permanentesRetirados
          ? (textoDevoluciones(v) || "")
          : "",
        v.notas || "",
      ];
    });

  descargarCSV(`ventas_${hoyISO()}.csv`, headers, rows);
}

function exportarGastosCSV(db) {
  const headers = ["Fecha", "Concepto", "Monto"];
  const rows = db.gastos.slice().sort((a, b) => a.fecha.localeCompare(b.fecha) || (a.timestamp || 0) - (b.timestamp || 0)).map((g) => [fechaLegible(g.fecha), g.concepto, g.monto]);
  descargarCSV(`gastos_${hoyISO()}.csv`, headers, rows);
}

/* ============================================================
   ALMACENAMIENTO PERSISTENTE (Firebase Firestore)

   Cada cliente, cada visita y cada gasto es su PROPIO documento
   dentro de su colección (repartoAgua_clientes, repartoAgua_visitas,
   repartoAgua_gastos). Esto es clave: si dos repartidores guardan
   una venta al mismo tiempo, cada uno escribe SU documento propio y
   nunca pisa lo que guardó el otro (antes, los tres vivían juntos
   adentro de un array gigante en un solo documento, y el que guardaba
   último borraba lo que había cargado el otro sin que nadie lo notara).

   "config" (precios, repartidores, PIN) sigue siendo un único
   documento, porque solo lo edita el administrador.
   ============================================================ */
function colRef(name) {
  return collection(firestore, `${COLLECTION}_${name}`);
}

/* Movimiento atómico del stock de una camioneta.
   delta positivo = salió de camioneta y quedó con el cliente.
   delta negativo = volvió del cliente a la camioneta. */
async function moverStockRepartidor(repartidorId, delta, signo = 1) {
  const cambios = {};
  PRODUCTOS_RETORNABLES.forEach((p) => {
    const movimiento = Number(delta[p.key]) || 0;
    if (movimiento !== 0) cambios[p.key] = increment(-movimiento * signo);
  });
  if (Object.keys(cambios).length === 0) return true;
  try {
    await setDoc(doc(colRef("stock"), repartidorId), cambios, { merge: true });
    return true;
  } catch (e) {
    console.error("Error actualizando stock del repartidor", repartidorId, e);
    return false;
  }
}
function subscribeCollection(name, onData, onError) {
  return onSnapshot(
    colRef(name),
    (snap) => onData(snap.docs.map((d) => ({ ...d.data(), id: d.id }))),
    (err) => { console.error("Error escuchando", name, err); onError && onError(err); }
  );
}
async function upsertDoc(name, item) {
  try {
    await setDoc(doc(colRef(name), item.id), item);
    return true;
  } catch (e) {
    console.error("Error guardando", name, item.id, e);
    return false;
  }
}
async function removeDoc(name, id) {
  try {
    await deleteDoc(doc(colRef(name), id));
    return true;
  } catch (e) {
    console.error("Error borrando", name, id, e);
    return false;
  }
}
function subscribeConfigDoc(fallback, onData, onError) {
  const ref = doc(firestore, COLLECTION, "config");
  return onSnapshot(
    ref,
    (snap) => onData(snap.exists() ? snap.data().value : fallback),
    (err) => { console.error("Error escuchando config", err); onError && onError(err); }
  );
}
async function setConfigDoc(value) {
  try {
    await setDoc(doc(firestore, COLLECTION, "config"), { value });
    return true;
  } catch (e) {
    console.error("Error guardando config", e);
    return false;
  }
}

/* Compara el array anterior con el nuevo y devuelve solo lo que hay
   que escribir o borrar — así cada mutate() toca únicamente los
   documentos que realmente cambiaron. */
function diffArrayById(prevArr, nextArr) {
  const prevById = new Map(prevArr.map((x) => [x.id, x]));
  const nextById = new Map(nextArr.map((x) => [x.id, x]));
  const upserts = [];
  for (const [id, item] of nextById) {
    const anterior = prevById.get(id);
    if (!anterior || JSON.stringify(anterior) !== JSON.stringify(item)) upserts.push(item);
  }
  const deletes = [...prevById.keys()].filter((id) => !nextById.has(id));
  return { upserts, deletes };
}

/* Migración única desde el formato viejo (un array gigante por
   documento) al nuevo (un documento por registro). Si ya existen datos
   en el formato nuevo, no hace nada. Es segura de dejar en el código. */
async function migrarFormatoViejoSiHaceFalta() {
  try {
    for (const name of ["clientes", "visitas", "gastos"]) {
      const nuevaCol = await getDocs(colRef(name));
      if (!nuevaCol.empty) continue;
      const viejoDoc = await getDoc(doc(firestore, COLLECTION, name));
      if (!viejoDoc.exists()) continue;
      const arrViejo = viejoDoc.data().value || [];
      if (arrViejo.length === 0) continue;
      await Promise.all(arrViejo.map((item) => upsertDoc(name, item)));
    }
  } catch (e) {
    console.error("La migración de datos viejos falló (no crítico):", e);
  }
}

/* Migra una única vez stockRepartidores guardado dentro de config
   al nuevo formato: un documento por repartidor en repartoAgua_stock. */
async function migrarStockViejoSiHaceFalta() {
  try {
    const nuevaCol = await getDocs(colRef("stock"));
    if (!nuevaCol.empty) return;

    const configSnap = await getDoc(doc(firestore, COLLECTION, "config"));
    if (!configSnap.exists()) return;

    const config = configSnap.data().value || {};
    const viejo = config.stockRepartidores;
    if (!viejo || Object.keys(viejo).length === 0) return;

    await Promise.all(
      Object.entries(viejo).map(([repartidorId, stock]) =>
        upsertDoc("stock", {
          id: repartidorId,
          b20: Number(stock?.b20) || 0,
          b12: Number(stock?.b12) || 0,
          sifon: Number(stock?.sifon) || 0,
        })
      )
    );
  } catch (e) {
    console.error("La migración de stock viejo falló (no crítico):", e);
  }
}

/* Migra el antiguo campo envasesPrestados al nuevo modelo.
   Todo valor existente se toma como PERMANENTE, porque hasta ahora
   ese dato solo podía cargarse manualmente desde el administrador. */
async function migrarEnvasesClientesSiHaceFalta() {
  try {
    const snap = await getDocs(colRef("clientes"));
    const pendientes = snap.docs.map((d) => ({ ...d.data(), id: d.id })).filter(
      (c) => !c.envasesPermanentes || !c.envasesExtra || c.envasesPrestados
    );

    await Promise.all(
      pendientes.map((c) => {
        const actualizado = {
          ...c,
          envasesPermanentes: envasesPermanentesDe(c),
          envasesExtra: envasesExtraDe(c),
        };
        delete actualizado.envasesPrestados;
        return upsertDoc("clientes", actualizado);
      })
    );
  } catch (e) {
    console.error("La migración de envases de clientes falló (no crítico):", e);
  }
}

/* Perfil recordado en ESTE dispositivo (no se comparte entre celulares) */
function getLocalProfile() {
  try {
    const raw = localStorage.getItem("miPerfilReparto");
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}
function setLocalProfile(p) {
  try {
    if (p === null) localStorage.removeItem("miPerfilReparto");
    else localStorage.setItem("miPerfilReparto", JSON.stringify(p));
  } catch {
    /* ignorar si el navegador bloquea localStorage */
  }
}

/* ============================================================
   PRIMITIVOS DE UI
   ============================================================ */
function Screen({ children }) {
  return (
    <div
      style={{
        height: "100vh",
        maxWidth: 460,
        margin: "0 auto",
        background: C.bg,
        display: "flex",
        flexDirection: "column",
        fontFamily: "ui-sans-serif, system-ui, -apple-system, sans-serif",
        color: C.ink,
        position: "relative",
      }}
    >
      {children}
    </div>
  );
}

function TopBar({ title, subtitle, onBack, right, tone = "light" }) {
  const dark = tone === "dark";
  return (
    <div
      style={{
        background: dark ? C.primaryDark : C.surface,
        borderBottom: `1px solid ${dark ? C.primaryDark : C.border}`,
        flexShrink: 0,
      }}
      className="px-4 py-3 flex items-center gap-3"
    >
      {onBack && (
        <button onClick={onBack} className="p-1 -ml-1 rounded-full active:bg-black/5">
          <ArrowLeft size={20} color={dark ? "#fff" : C.ink} />
        </button>
      )}
      <div className="flex-1 min-w-0">
        <div
          className="font-extrabold tracking-tight text-lg truncate"
          style={{ color: dark ? "#fff" : C.ink }}
        >
          {title}
        </div>
        {subtitle && (
          <div className="text-xs truncate" style={{ color: dark ? C.accentSoft : C.muted }}>
            {subtitle}
          </div>
        )}
      </div>
      {right}
    </div>
  );
}

function Card({ children, style, className = "", onClick }) {
  return (
    <div
      onClick={onClick}
      className={"rounded-2xl p-4 " + className}
      style={{ background: C.surface, border: `1px solid ${C.border}`, ...style }}
    >
      {children}
    </div>
  );
}

function Btn({ children, onClick, variant = "primary", size = "md", full, disabled, type = "button", icon: Icon }) {
  const base = "inline-flex items-center justify-center gap-2 rounded-xl font-semibold active:scale-95 transition disabled:opacity-40 disabled:active:scale-100";
  const sizes = { sm: "px-3 py-1.5 text-xs", md: "px-4 py-2.5 text-sm", lg: "px-5 py-3.5 text-base" };
  const styles = {
    primary: { background: C.primary, color: "#fff" },
    accent: { background: C.accent, color: "#fff" },
    ghost: { background: "transparent", color: C.primary, border: `1px solid ${C.border}` },
    danger: { background: C.dangerBg, color: C.danger },
    dark: { background: C.primaryDark, color: "#fff" },
    subtle: { background: C.accentSoft, color: C.primary },
  };
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={base + " " + sizes[size] + (full ? " w-full" : "")}
      style={styles[variant]}
    >
      {Icon && <Icon size={size === "lg" ? 18 : 16} />}
      {children}
    </button>
  );
}

function Field({ label, children, hint }) {
  return (
    <div className="mb-3">
      {label && <div className="text-xs font-semibold mb-1" style={{ color: C.muted }}>{label}</div>}
      {children}
      {hint && <div className="text-xs mt-1" style={{ color: C.mutedLight }}>{hint}</div>}
    </div>
  );
}

function Input(props) {
  return (
    <input
      {...props}
      className={"w-full rounded-xl px-3 py-2.5 text-sm outline-none " + (props.className || "")}
      style={{ background: C.bg, border: `1px solid ${C.border}`, color: C.ink, ...(props.style || {}) }}
    />
  );
}

function Textarea(props) {
  return (
    <textarea
      {...props}
      className="w-full rounded-xl px-3 py-2.5 text-sm outline-none resize-none"
      style={{ background: C.bg, border: `1px solid ${C.border}`, color: C.ink }}
    />
  );
}

function DayPills({ value, onChange }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {DIAS.map((d) => {
        const active = value.includes(d);
        return (
          <button
            key={d}
            type="button"
            onClick={() => onChange(active ? value.filter((x) => x !== d) : [...value, d])}
            className="px-2.5 py-1.5 rounded-lg text-xs font-semibold"
            style={{
              background: active ? C.primary : C.bg,
              color: active ? "#fff" : C.muted,
              border: `1px solid ${active ? C.primary : C.border}`,
            }}
          >
            {d.slice(0, 3)}
          </button>
        );
      })}
    </div>
  );
}

function Stepper({ value, onChange, min = 0 }) {
  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={() => onChange(Math.max(min, value - 1))}
        className="w-8 h-8 rounded-lg flex items-center justify-center font-bold"
        style={{ background: C.bg, border: `1px solid ${C.border}`, color: C.ink }}
      >
        <Minus size={14} />
      </button>
      <div className="w-8 text-center font-mono font-bold text-sm">{value}</div>
      <button
        type="button"
        onClick={() => onChange(value + 1)}
        className="w-8 h-8 rounded-lg flex items-center justify-center font-bold"
        style={{ background: C.primary, color: "#fff" }}
      >
        <Plus size={14} />
      </button>
    </div>
  );
}

function Sheet({ title, onClose, children, footer, closeOnBackdrop = true }) {
  return (
    <div className="absolute inset-0 z-50 flex flex-col justify-end" style={{ background: "rgba(11,43,60,0.45)" }} onClick={closeOnBackdrop ? onClose : undefined}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="rounded-t-3xl flex flex-col"
        style={{ background: C.surface, maxHeight: "88%" }}
      >
        <div className="flex items-center justify-between px-4 py-3 flex-shrink-0" style={{ borderBottom: `1px solid ${C.border}` }}>
          <div className="font-extrabold text-base">{title}</div>
          <button onClick={onClose} className="p-1 rounded-full active:bg-black/5">
            <X size={20} color={C.muted} />
          </button>
        </div>
        <div className="overflow-y-auto px-4 py-3">{children}</div>
        {footer && <div className="px-4 py-3 flex-shrink-0" style={{ borderTop: `1px solid ${C.border}` }}>{footer}</div>}
      </div>
    </div>
  );
}

function EmptyState({ icon: Icon, title, text, action }) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-12 px-6">
      <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-3" style={{ background: C.accentSoft }}>
        <Icon size={26} color={C.primary} />
      </div>
      <div className="font-bold text-sm mb-1">{title}</div>
      <div className="text-xs mb-4" style={{ color: C.muted }}>{text}</div>
      {action}
    </div>
  );
}

function Badge({ children, tone = "muted" }) {
  const tones = {
    muted: { bg: C.bg, fg: C.muted },
    success: { bg: C.successBg, fg: C.success },
    warning: { bg: C.warningBg, fg: C.warning },
    danger: { bg: C.dangerBg, fg: C.danger },
    accent: { bg: C.accentSoft, fg: C.primary },
  };
  const t = tones[tone];
  return (
    <span className="px-2 py-0.5 rounded-md text-xs font-bold" style={{ background: t.bg, color: t.fg }}>
      {children}
    </span>
  );
}

/* Elemento "medidor de agua" — la firma visual de la app */
function Meter({ label, value, unit }) {
  return (
    <div className="rounded-2xl p-3 flex-1" style={{ background: C.primaryDark, minWidth: 128 }}>
      <div className="text-xs font-bold uppercase tracking-wider mb-1" style={{ color: C.accentSoft, opacity: 0.75 }}>
        {label}
      </div>
      <div className="font-mono font-bold text-lg tabular-nums" style={{ color: "#fff", letterSpacing: "0.02em" }}>
        {value}
        {unit && <span className="text-xs font-semibold ml-1" style={{ color: C.accent }}>{unit}</span>}
      </div>
    </div>
  );
}

function BrandMark({ size = 22, color = C.accent }) {
  return <Droplet size={size} color={color} fill={color} fillOpacity={0.18} strokeWidth={2.2} />;
}

/* ============================================================
   PANTALLA: SELECCIÓN DE PERFIL
   ============================================================ */
function ProfileSelect({ config, onPickAdmin, onPickRepartidor }) {
  return (
    <Screen>
      <div className="flex-1 flex flex-col justify-center px-6">
        <div className="flex flex-col items-center mb-8">
          <div className="w-16 h-16 rounded-3xl flex items-center justify-center mb-3" style={{ background: C.primaryDark }}>
            <BrandMark size={30} />
          </div>
          <div className="font-extrabold text-2xl tracking-tight">Reparto de Agua</div>
          <div className="text-xs" style={{ color: C.muted }}>Elegí tu perfil para continuar</div>
        </div>

        <button
          onClick={onPickAdmin}
          className="w-full rounded-2xl p-4 flex items-center gap-3 mb-3 active:scale-95 transition"
          style={{ background: C.primaryDark }}
        >
          <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: "rgba(255,255,255,0.12)" }}>
            <UserCog size={20} color="#fff" />
          </div>
          <div className="text-left flex-1">
            <div className="font-bold text-sm" style={{ color: "#fff" }}>Administrador</div>
            <div className="text-xs" style={{ color: C.accentSoft }}>Clientes, precios, gastos y caja</div>
          </div>
          <ChevronRight size={18} color={C.accentSoft} />
        </button>

        {config.repartidores.length === 0 ? (
          <Card>
            <div className="text-xs text-center" style={{ color: C.muted }}>
              Todavía no hay repartidores creados. Entrá como Administrador → Ajustes para agregar el primero.
            </div>
          </Card>
        ) : (
          config.repartidores.map((r) => (
            <button
              key={r.id}
              onClick={() => onPickRepartidor(r)}
              className="w-full rounded-2xl p-4 flex items-center gap-3 mb-2 active:scale-95 transition"
              style={{ background: C.surface, border: `1px solid ${C.border}` }}
            >
              <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: C.accentSoft }}>
                <Truck size={18} color={C.primary} />
              </div>
              <div className="text-left flex-1">
                <div className="font-bold text-sm">{r.nombre}</div>
                <div className="text-xs" style={{ color: C.muted }}>Repartidor</div>
              </div>
              <ChevronRight size={18} color={C.mutedLight} />
            </button>
          ))
        )}
      </div>
    </Screen>
  );
}

/* ============================================================
   PANTALLA: PIN ADMINISTRADOR
   ============================================================ */
function AdminGate({ config, onUnlock, onBack, onSetPin }) {
  const [pin, setPin] = useState("");
  const [pin2, setPin2] = useState("");
  const [error, setError] = useState("");
  const creating = !config.adminPin;

  function submit() {
    if (creating) {
      if (pin.length < 4) return setError("Usá al menos 4 dígitos.");
      if (pin !== pin2) return setError("Los PIN no coinciden.");
      onSetPin(pin);
    } else {
      if (pin === config.adminPin) onUnlock();
      else setError("PIN incorrecto.");
    }
  }

  return (
    <Screen>
      <TopBar title="Administrador" onBack={onBack} tone="dark" />
      <div className="flex-1 flex flex-col justify-center px-6">
        <div className="flex flex-col items-center mb-6">
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-3" style={{ background: C.accentSoft }}>
            <Lock size={24} color={C.primary} />
          </div>
          <div className="font-bold text-sm">{creating ? "Creá un PIN de acceso" : "Ingresá tu PIN"}</div>
          <div className="text-xs text-center mt-1" style={{ color: C.muted }}>
            {creating ? "Vas a usarlo cada vez que entres como administrador." : "Protege la información de tu negocio."}
          </div>
        </div>

        <Field label={creating ? "Nuevo PIN (4 a 6 dígitos)" : "PIN"}>
          <Input
            type="password"
            inputMode="numeric"
            maxLength={6}
            value={pin}
            onChange={(e) => { setPin(e.target.value.replace(/\D/g, "")); setError(""); }}
            placeholder="••••"
            autoFocus
          />
        </Field>
        {creating && (
          <Field label="Repetí el PIN">
            <Input
              type="password"
              inputMode="numeric"
              maxLength={6}
              value={pin2}
              onChange={(e) => { setPin2(e.target.value.replace(/\D/g, "")); setError(""); }}
              placeholder="••••"
            />
          </Field>
        )}
        {error && <div className="text-xs font-semibold mb-3" style={{ color: C.danger }}>{error}</div>}
        <Btn full size="lg" onClick={submit}>{creating ? "Crear y entrar" : "Entrar"}</Btn>
      </div>
    </Screen>
  );
}

/* ============================================================
   APP ADMINISTRADOR
   ============================================================ */
function AdminApp({ db, mutate, onLogout, canUndo, canRedo, undo, redo, offline }) {
  const [tab, setTab] = useState("inicio");

  const tabs = [
    { key: "inicio", label: "Inicio", icon: BarChart3 },
    { key: "clientes", label: "Clientes", icon: Users },
    { key: "historial", label: "Recorridos", icon: ClipboardList },
    { key: "stock", label: "Stock", icon: Boxes },
    { key: "gastos", label: "Gastos", icon: Receipt },
    { key: "ajustes", label: "Ajustes", icon: Settings2 },
  ];

  return (
    <Screen>
      <TopBar
        title="Administrador"
        subtitle={fechaLegible(hoyISO()) + " · " + diaSemanaHoy()}
        tone="dark"
        right={
          <div className="flex items-center gap-1">
            <span className="flex items-center gap-1 px-1.5 mr-1">
              <span className="w-1.5 h-1.5 rounded-full" style={{ background: offline ? C.warning : C.accent }} />
              <span className="text-[10px] font-bold" style={{ color: C.accentSoft }}>{offline ? "sin conexión" : "en vivo"}</span>
            </span>
            <button onClick={undo} disabled={!canUndo} className="p-2 rounded-full active:bg-white/10 disabled:opacity-30"><Undo2 size={16} color="#fff" /></button>
            <button onClick={redo} disabled={!canRedo} className="p-2 rounded-full active:bg-white/10 disabled:opacity-30"><Redo2 size={16} color="#fff" /></button>
            <button onClick={onLogout} className="p-2 rounded-full active:bg-white/10"><LogOut size={16} color="#fff" /></button>
          </div>
        }
      />
      <div className="flex-1 overflow-y-auto px-4 py-4">
        {tab === "inicio" && <AdminDashboard db={db} />}
        {tab === "clientes" && <AdminClientes db={db} mutate={mutate} />}
        {tab === "historial" && <AdminHistorial db={db} mutate={mutate} />}
        {tab === "stock" && <AdminStock db={db} mutate={mutate} />}
        {tab === "gastos" && <AdminGastos db={db} mutate={mutate} />}
        {tab === "ajustes" && <AdminAjustes db={db} mutate={mutate} />}
      </div>
      <div className="flex-shrink-0 flex" style={{ background: C.surface, borderTop: `1px solid ${C.border}` }}>
        {tabs.map((t) => {
          const active = tab === t.key;
          const Icon = t.icon;
          return (
            <button key={t.key} onClick={() => setTab(t.key)} className="flex-1 flex flex-col items-center gap-0.5 py-2.5">
              <Icon size={18} color={active ? C.primary : C.mutedLight} strokeWidth={active ? 2.4 : 2} />
              <span className="text-xs font-semibold" style={{ color: active ? C.primary : C.mutedLight }}>{t.label}</span>
            </button>
          );
        })}
      </div>
    </Screen>
  );
}

/* ---------- Dashboard ---------- */
function CalendarioAdmin({ fechaSeleccionada, onSeleccionar, visitas, gastos }) {
  const [ySel, mSel, dSel] = fechaSeleccionada.split("-").map(Number);
  const [mesVisible, setMesVisible] = useState(
    () => new Date(ySel, mSel - 1, 1)
  );

  useEffect(() => {
    setMesVisible(new Date(ySel, mSel - 1, 1));
  }, [ySel, mSel]);

  const actividadPorFecha = useMemo(() => {
    const mapa = new Map();

    (visitas || []).forEach((v) => {
      if (!v.fecha) return;
      const actual = mapa.get(v.fecha) || { visitas: 0, gastos: 0 };
      actual.visitas += 1;
      mapa.set(v.fecha, actual);
    });

    (gastos || []).forEach((g) => {
      if (!g.fecha) return;
      const actual = mapa.get(g.fecha) || { visitas: 0, gastos: 0 };
      actual.gastos += 1;
      mapa.set(g.fecha, actual);
    });

    return mapa;
  }, [visitas, gastos]);

  const anio = mesVisible.getFullYear();
  const mes = mesVisible.getMonth();
  const nombresMeses = [
    "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
    "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
  ];

  const primerDia = new Date(anio, mes, 1);
  // Convertimos domingo=0 a una grilla que empieza en lunes.
  const espaciosIniciales = (primerDia.getDay() + 6) % 7;
  const cantidadDias = new Date(anio, mes + 1, 0).getDate();
  const hoy = hoyISO();

  function isoDelDia(dia) {
    return (
      anio +
      "-" +
      String(mes + 1).padStart(2, "0") +
      "-" +
      String(dia).padStart(2, "0")
    );
  }

  function moverMes(delta) {
    setMesVisible(new Date(anio, mes + delta, 1));
  }

  const celdas = [
    ...Array(espaciosIniciales).fill(null),
    ...Array.from({ length: cantidadDias }, (_, i) => i + 1),
  ];

  while (celdas.length % 7 !== 0) celdas.push(null);

  return (
    <Card className="mb-4">
      <div className="flex items-center justify-between gap-2 mb-3">
        <div>
          <div className="text-xs font-extrabold uppercase tracking-wide" style={{ color: C.muted }}>
            Calendario
          </div>
          <div className="text-sm font-bold mt-0.5">
            {diaSemanaDeFecha(fechaSeleccionada)} {fechaLegible(fechaSeleccionada)}
          </div>
        </div>

        {fechaSeleccionada !== hoy && (
          <Btn size="sm" variant="subtle" onClick={() => onSeleccionar(hoy)}>
            Hoy
          </Btn>
        )}
      </div>

      <div className="flex items-center justify-between mb-3">
        <button
          type="button"
          onClick={() => moverMes(-1)}
          className="w-9 h-9 rounded-xl font-extrabold text-lg"
          style={{ background: C.bg, color: C.primary, border: `1px solid ${C.border}` }}
          aria-label="Mes anterior"
        >
          ‹
        </button>

        <div className="font-extrabold text-sm">
          {nombresMeses[mes]} {anio}
        </div>

        <button
          type="button"
          onClick={() => moverMes(1)}
          className="w-9 h-9 rounded-xl font-extrabold text-lg"
          style={{ background: C.bg, color: C.primary, border: `1px solid ${C.border}` }}
          aria-label="Mes siguiente"
        >
          ›
        </button>
      </div>

      <div className="grid grid-cols-7 gap-1 mb-1">
        {["Lu", "Ma", "Mi", "Ju", "Vi", "Sá", "Do"].map((d) => (
          <div
            key={d}
            className="text-[10px] font-extrabold text-center py-1"
            style={{ color: C.mutedLight }}
          >
            {d}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1">
        {celdas.map((dia, idx) => {
          if (!dia) return <div key={`vacio-${idx}`} className="h-10" />;

          const iso = isoDelDia(dia);
          const seleccionado = iso === fechaSeleccionada;
          const esHoy = iso === hoy;
          const actividad = actividadPorFecha.get(iso);
          const tieneActividad = !!actividad && (actividad.visitas > 0 || actividad.gastos > 0);

          return (
            <button
              key={iso}
              type="button"
              onClick={() => onSeleccionar(iso)}
              className="h-10 rounded-xl flex flex-col items-center justify-center relative font-bold text-xs"
              style={{
                background: seleccionado ? C.primary : C.bg,
                color: seleccionado ? "#fff" : C.ink,
                border: `1px solid ${
                  seleccionado ? C.primary : esHoy ? C.accent : C.border
                }`,
              }}
            >
              <span>{dia}</span>

              {tieneActividad && (
                <span
                  className="w-1.5 h-1.5 rounded-full absolute bottom-1"
                  style={{ background: seleccionado ? "#fff" : C.accent }}
                />
              )}
            </button>
          );
        })}
      </div>

      <div className="text-[10px] mt-2" style={{ color: C.mutedLight }}>
        Los días con un punto tienen visitas o gastos registrados.
      </div>
    </Card>
  );
}

function AdminDashboard({ db }) {
  const hoy = hoyISO();
  const [rango, setRango] = useState("hoy"); // hoy | semana | mes | todo | dia
  const [fechaSeleccionada, setFechaSeleccionada] = useState(hoy);
  const [mostrarCalendario, setMostrarCalendario] = useState(false);
  const [mostrarVisitas, setMostrarVisitas] = useState(false);

  function fechaLocal(iso) {
    try {
      const [y, m, d] = iso.split("-").map(Number);
      return new Date(y, m - 1, d);
    } catch {
      return new Date(0);
    }
  }

  function perteneceAlRango(fecha) {
    if (!fecha) return false;

    if (rango === "dia") return fecha === fechaSeleccionada;
    if (rango === "hoy") return fecha === hoy;

    if (rango === "semana") {
      const fechaDato = fechaLocal(fecha);
      const fechaHoy = fechaLocal(hoy);
      const diferenciaDias = (fechaHoy - fechaDato) / 86400000;
      return diferenciaDias >= 0 && diferenciaDias < 7;
    }

    if (rango === "mes") {
      return fecha.slice(0, 7) === hoy.slice(0, 7);
    }

    return true;
  }

  const visitasFiltradas = useMemo(
    () =>
      db.visitas
        .filter((v) => perteneceAlRango(v.fecha))
        .slice()
        .sort(
          (a, b) =>
            (b.fecha || "").localeCompare(a.fecha || "") ||
            (b.timestamp || 0) - (a.timestamp || 0)
        ),
    [db.visitas, rango, fechaSeleccionada, hoy]
  );

  const gastosFiltrados = useMemo(
    () =>
      db.gastos
        .filter((g) => perteneceAlRango(g.fecha))
        .slice()
        .sort(
          (a, b) =>
            (b.fecha || "").localeCompare(a.fecha || "") ||
            (b.timestamp || 0) - (a.timestamp || 0)
        ),
    [db.gastos, rango, fechaSeleccionada, hoy]
  );

  const efectivo = visitasFiltradas.reduce(
    (s, v) => s + (Number(v.pagos?.efectivo) || 0),
    0
  );
  const mp = visitasFiltradas.reduce(
    (s, v) => s + (Number(v.pagos?.mercadopago) || 0),
    0
  );
  const fiado = visitasFiltradas.reduce(
    (s, v) => s + (Number(v.deudaGenerada) || 0),
    0
  );
  const facturado = visitasFiltradas.reduce(
    (s, v) => s + (Number(v.total) || 0),
    0
  );
  const deudaCobrada = visitasFiltradas.reduce(
    (s, v) => s + (Number(v.deudaCobrada) || 0),
    0
  );
  const ajustesDeuda = visitasFiltradas.reduce(
    (s, v) => s + (Number(v.ajusteDeudaManual) || 0),
    0
  );
  const totalGastos = gastosFiltrados.reduce(
    (s, g) => s + (Number(g.monto) || 0),
    0
  );

  // Fórmula pedida:
  // Efectivo + Mercado Pago + Fiado generado - Gastos.
  const balance = efectivo + mp + fiado - totalGastos;
  const movimientosExtras = resumenExtrasVisitas(visitasFiltradas);

  // ======================================================
// BULTOS VENDIDOS EN EL PERÍODO SELECCIONADO
// Solo cuenta productos de visitas donde hubo venta.
// No mezcla envases prestados, retirados ni permanentes.
// ======================================================
const bultosVendidos = useMemo(() => {
  const resultado = {};

  PRODUCTOS.forEach((p) => {
    resultado[p.key] = 0;
  });

  visitasFiltradas.forEach((visita) => {
    if (!visita.vendio) return;

    (visita.items || []).forEach((item) => {
      if (!(item.tipo in resultado)) return;

      resultado[item.tipo] +=
        Number(item.cantidad) || 0;
    });
  });

  return resultado;
}, [visitasFiltradas]);

const totalBultosVendidos = PRODUCTOS.reduce(
  (total, producto) =>
    total + (Number(bultosVendidos[producto.key]) || 0),
  0
);

  const deudaTotalClientes = db.clientes.reduce(
    (s, c) => s + (Number(c.deudaAcumulada) || 0),
    0
  );
  const envasesEnCalle = db.clientes.reduce(
    (s, c) => s + totalEnvasesCliente(c),
    0
  );

  const preciosSinConfigurar = Object.values(db.config.precios).some((p) => !p);
  const esHoy = rango === "hoy";

  const etiquetaRango =
    rango === "hoy"
      ? "Hoy"
      : rango === "semana"
      ? "Últimos 7 días"
      : rango === "mes"
      ? "Este mes"
      : rango === "todo"
      ? "Todo el historial"
      : `${diaSemanaDeFecha(fechaSeleccionada)} ${fechaLegible(fechaSeleccionada)}`;

  useEffect(() => {
    setMostrarVisitas(false);
  }, [rango, fechaSeleccionada]);

  function elegirRango(nuevoRango) {
    setRango(nuevoRango);
    if (nuevoRango === "hoy") setFechaSeleccionada(hoy);
  }

  function elegirDia(fecha) {
    setFechaSeleccionada(fecha);
    setRango(fecha === hoy ? "hoy" : "dia");
    setMostrarCalendario(false);
  }

  return (
    <div>
      {preciosSinConfigurar && (
        <Card style={{ background: C.warningBg, border: "none" }} className="mb-3">
          <div className="flex items-center gap-2 text-xs font-semibold" style={{ color: C.warning }}>
            <AlertCircle size={16} /> Todavía tenés precios en $0. Configurálos en Ajustes.
          </div>
        </Card>
      )}

      {/* FILTROS RÁPIDOS */}
      <div className="flex gap-2 mb-3 overflow-x-auto">
        {[
          ["hoy", "Hoy"],
          ["semana", "Semana"],
          ["mes", "Mes"],
          ["todo", "Todo"],
        ].map(([k, label]) => {
          const activo = rango === k;
          return (
            <button
              key={k}
              type="button"
              onClick={() => elegirRango(k)}
              className="px-3 py-1.5 rounded-lg text-xs font-bold flex-shrink-0"
              style={{
                background: activo ? C.primary : C.surface,
                color: activo ? "#fff" : C.muted,
                border: `1px solid ${activo ? C.primary : C.border}`,
              }}
            >
              {label}
            </button>
          );
        })}
      </div>

      {/* CALENDARIO DESPLEGABLE */}
      <div className="mb-4">
        <button
          type="button"
          onClick={() => setMostrarCalendario(!mostrarCalendario)}
          className="w-full rounded-xl px-3 py-3 flex items-center justify-between"
          style={{
            background: rango === "dia" ? C.accentSoft : C.surface,
            border: `1px solid ${rango === "dia" ? C.accent : C.border}`,
          }}
        >
          <div className="flex items-center gap-2">
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center"
              style={{ background: rango === "dia" ? C.primary : C.bg }}
            >
              <CalendarDays
                size={17}
                color={rango === "dia" ? "#fff" : C.primary}
              />
            </div>

            <div className="text-left">
              <div className="text-xs font-bold" style={{ color: C.ink }}>
                {rango === "dia" ? "Día seleccionado" : "Elegir día específico"}
              </div>
              <div className="text-[10px]" style={{ color: C.muted }}>
                {rango === "dia"
                  ? `${diaSemanaDeFecha(fechaSeleccionada)} ${fechaLegible(fechaSeleccionada)}`
                  : "Abrir calendario"}
              </div>
            </div>
          </div>

          <ChevronRight
            size={18}
            color={C.muted}
            style={{
              transform: mostrarCalendario ? "rotate(90deg)" : "rotate(0deg)",
              transition: "transform 0.2s",
            }}
          />
        </button>

        {mostrarCalendario && (
          <div className="mt-2">
            <CalendarioAdmin
              fechaSeleccionada={fechaSeleccionada}
              onSeleccionar={elegirDia}
              visitas={db.visitas}
              gastos={db.gastos}
            />
          </div>
        )}
      </div>

      <div className="flex items-center justify-between mb-2">
        <div>
          <div className="text-xs font-extrabold uppercase tracking-wide" style={{ color: C.muted }}>
            Resumen
          </div>
          <div className="text-sm font-bold">{etiquetaRango}</div>
        </div>
        {esHoy && <Badge tone="accent">Hoy</Badge>}
        {rango === "dia" && <Badge tone="accent">Día específico</Badge>}
      </div>

      <div className="flex flex-wrap gap-2 mb-4">
        <Meter label="Facturado" value={formatMoney(facturado)} />
        <Meter label="Efectivo" value={formatMoney(efectivo)} />
        <Meter label="Mercado Pago" value={formatMoney(mp)} />
        <Meter label="Fiado generado" value={formatMoney(fiado)} />
      </div>

      {/* =====================================================
          PLATA EN LA CALLE
          Es el saldo ACTUAL de todos los clientes.
          No depende del filtro Hoy / Semana / Mes / Todo.
          ===================================================== */}
      <Card
        className="mb-4"
        style={{
          background: deudaTotalClientes > 0 ? C.dangerBg : C.successBg,
          border: `1px solid ${
            deudaTotalClientes > 0 ? C.danger : C.success
          }`,
        }}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <div
              className="text-xs font-extrabold uppercase tracking-wide"
              style={{
                color: deudaTotalClientes > 0 ? C.danger : C.success,
              }}
            >
              Plata en la calle
            </div>

            <div
              className="text-[10px] mt-1"
              style={{ color: C.muted }}
            >
              Saldo pendiente actual de todos los clientes
            </div>

            <div
              className="text-[10px] mt-0.5"
              style={{ color: C.mutedLight }}
            >
              Este valor es actual y no cambia con el filtro del período.
            </div>
          </div>

          <div
            className="font-mono font-extrabold text-2xl text-right"
            style={{
              color: deudaTotalClientes > 0 ? C.danger : C.success,
            }}
          >
            {formatMoney(deudaTotalClientes)}
          </div>
        </div>
      </Card>

      <Card
        className="mb-4"
        style={{
          background: balance >= 0 ? C.successBg : C.dangerBg,
          border: "none",
        }}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <div
              className="text-xs font-extrabold uppercase tracking-wide"
              style={{ color: balance >= 0 ? C.success : C.danger }}
            >
              Balance
            </div>
            <div className="text-[11px] mt-1" style={{ color: C.muted }}>
              Efectivo + Mercado Pago + Fiado generado - Gastos
            </div>
          </div>

          <div
            className="font-mono font-extrabold text-xl text-right"
            style={{ color: balance >= 0 ? C.success : C.danger }}
          >
            {formatMoney(balance)}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 mt-3">
          <div className="rounded-xl p-2" style={{ background: C.surface }}>
            <div className="text-[10px] font-bold uppercase" style={{ color: C.muted }}>
              Gastos
            </div>
            <div className="font-mono font-bold text-sm">{formatMoney(totalGastos)}</div>
          </div>
          <div className="rounded-xl p-2" style={{ background: C.surface }}>
            <div className="text-[10px] font-bold uppercase" style={{ color: C.muted }}>
              Cobro deuda anterior
            </div>
            <div className="font-mono font-bold text-sm">{formatMoney(deudaCobrada)}</div>
          </div>
        </div>
      </Card>

      {ajustesDeuda !== 0 && (
        <Card
          className="mb-4"
          style={{
            background: ajustesDeuda > 0 ? C.dangerBg : C.successBg,
            border: "none",
          }}
        >
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-xs font-bold" style={{ color: C.muted }}>
                Ajustes manuales de deuda
              </div>
              <div className="text-[10px] mt-0.5" style={{ color: C.mutedLight }}>
                No forman parte del fiado generado por ventas.
              </div>
            </div>
            <div
              className="font-mono font-extrabold"
              style={{ color: ajustesDeuda > 0 ? C.danger : C.success }}
            >
              {ajustesDeuda > 0 ? "+" : ""}{formatMoney(ajustesDeuda)}
            </div>
          </div>
        </Card>
      )}

      {/* =====================================================
    BULTOS VENDIDOS
    ===================================================== */}
<Card className="mb-4">
  <div className="flex items-start justify-between gap-3 mb-3">
    <div>
      <div
        className="text-xs font-extrabold uppercase tracking-wide"
        style={{ color: C.muted }}
      >
        Bultos vendidos
      </div>

      <div
        className="text-[10px] mt-0.5"
        style={{ color: C.mutedLight }}
      >
        {etiquetaRango}
      </div>
    </div>

    <div
      className="rounded-xl px-3 py-2 text-center"
      style={{
        background: C.primaryDark,
        minWidth: 74,
      }}
    >
      <div
        className="text-[9px] font-bold uppercase"
        style={{
          color: C.accentSoft,
          opacity: 0.8,
        }}
      >
        Total
      </div>

      <div
        className="font-mono font-extrabold text-xl"
        style={{ color: "#fff" }}
      >
        {totalBultosVendidos}
      </div>
    </div>
  </div>

  <div className="grid grid-cols-2 gap-2">
    {PRODUCTOS.map((p) => {
      const cantidad =
        Number(bultosVendidos[p.key]) || 0;

      return (
        <div
          key={p.key}
          className="rounded-xl px-3 py-2.5 flex items-center justify-between gap-2"
          style={{
            background:
              cantidad > 0
                ? C.accentSoft
                : C.bg,
            border: `1px solid ${
              cantidad > 0
                ? C.accent
                : C.border
            }`,
          }}
        >
          <div className="min-w-0">
            <div
              className="text-[10px] font-bold truncate"
              style={{
                color:
                  cantidad > 0
                    ? C.primary
                    : C.muted,
              }}
            >
              {p.label}
            </div>
          </div>

          <div
            className="font-mono font-extrabold text-lg flex-shrink-0"
            style={{
              color:
                cantidad > 0
                  ? C.primary
                  : C.mutedLight,
            }}
          >
            {cantidad}
          </div>
        </div>
      );
    })}
  </div>

  {totalBultosVendidos === 0 && (
    <div
      className="text-[10px] text-center mt-3"
      style={{ color: C.mutedLight }}
    >
      No hay productos vendidos en este período.
    </div>
  )}
</Card>

      <Card className="mb-4">
        <div className="flex items-center justify-between mb-2">
          <div className="text-xs font-bold uppercase tracking-wide" style={{ color: C.muted }}>
            Movimiento de envases · {etiquetaRango}
          </div>
          <Boxes size={16} color={C.primary} />
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr style={{ color: C.muted }}>
                <th className="text-left py-1.5">Producto</th>
                <th className="text-center py-1.5">Prestados</th>
                <th className="text-center py-1.5">Retirados</th>
                <th className="text-center py-1.5">Balance</th>
              </tr>
            </thead>
            <tbody>
              {PRODUCTOS_RETORNABLES.map((p) => {
                const balanceEnvases = movimientosExtras.balance[p.key] || 0;
                return (
                  <tr key={p.key} style={{ borderTop: `1px solid ${C.border}` }}>
                    <td className="py-2 font-semibold">{p.corto}</td>
                    <td className="text-center font-bold" style={{ color: C.warning }}>
                      {movimientosExtras.prestados[p.key] || 0}
                    </td>
                    <td className="text-center font-bold" style={{ color: C.success }}>
                      {movimientosExtras.retirados[p.key] || 0}
                    </td>
                    <td
                      className="text-center font-bold"
                      style={{
                        color:
                          balanceEnvases > 0
                            ? C.warning
                            : balanceEnvases < 0
                            ? C.success
                            : C.muted,
                      }}
                    >
                      {balanceEnvases > 0 ? `+${balanceEnvases}` : balanceEnvases}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      <div className="text-xs font-bold uppercase tracking-wide mb-2" style={{ color: C.muted }}>
        Por repartidor · {etiquetaRango}
      </div>

      {db.config.repartidores.length === 0 ? (
        <div className="text-xs mb-4" style={{ color: C.mutedLight }}>
          Agregá repartidores en Ajustes para ver el desglose.
        </div>
      ) : (
        <div className="flex flex-col gap-2 mb-4">
          {db.config.repartidores.map((r) => {
            const vr = visitasFiltradas.filter((v) => v.repartidorId === r.id);
            const fact = vr.reduce((s, v) => s + (Number(v.total) || 0), 0);
            const ef = vr.reduce((s, v) => s + (Number(v.pagos?.efectivo) || 0), 0);
            const mpr = vr.reduce((s, v) => s + (Number(v.pagos?.mercadopago) || 0), 0);
            const fiadoRep = vr.reduce((s, v) => s + (Number(v.deudaGenerada) || 0), 0);
            const actividad = ef + mpr + fiadoRep;

            return (
              <Card key={r.id}>
                <div className="flex items-center justify-between mb-1.5">
                  <div className="font-bold text-sm flex items-center gap-1.5">
                    <Truck size={14} color={C.primary} />
                    {r.nombre}
                  </div>
                  <div className="font-mono font-extrabold text-sm">
                    {formatMoney(actividad)}
                  </div>
                </div>
                <div className="text-[10px] mb-1.5" style={{ color: C.mutedLight }}>
                  Facturado {formatMoney(fact)} · {vr.length} visita{vr.length !== 1 ? "s" : ""}
                </div>
                <div className="flex gap-1.5 flex-wrap">
                  <Badge tone="success">Efectivo {formatMoney(ef)}</Badge>
                  <Badge tone="accent">MP {formatMoney(mpr)}</Badge>
                  <Badge tone={fiadoRep > 0 ? "danger" : "muted"}>
                    Fiado generado {formatMoney(fiadoRep)}
                  </Badge>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* =====================================================
          VISITAS - DESPLEGABLE
          ===================================================== */}
      <div className="mb-4">
        <button
          type="button"
          onClick={() => setMostrarVisitas(!mostrarVisitas)}
          className="w-full rounded-xl px-3 py-3 flex items-center justify-between"
          style={{
            background: C.surface,
            border: `1px solid ${C.border}`,
          }}
        >
          <div className="flex items-center gap-2">
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center"
              style={{ background: C.accentSoft }}
            >
              <ClipboardList size={16} color={C.primary} />
            </div>

            <div className="text-left">
              <div
                className="text-xs font-extrabold uppercase tracking-wide"
                style={{ color: C.muted }}
              >
                Visitas · {etiquetaRango}
              </div>
              <div className="text-[10px]" style={{ color: C.mutedLight }}>
                {visitasFiltradas.length} visita
                {visitasFiltradas.length !== 1 ? "s" : ""} registrada
                {visitasFiltradas.length !== 1 ? "s" : ""}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div
              className="rounded-lg px-2.5 py-1 font-mono font-extrabold text-sm"
              style={{
                background: C.primaryDark,
                color: "#fff",
                minWidth: 38,
                textAlign: "center",
              }}
            >
              {visitasFiltradas.length}
            </div>

            <ChevronRight
              size={18}
              color={C.muted}
              style={{
                transform: mostrarVisitas ? "rotate(90deg)" : "rotate(0deg)",
                transition: "transform 0.2s",
              }}
            />
          </div>
        </button>

        {mostrarVisitas && (
          <div className="mt-2">
            {visitasFiltradas.length === 0 ? (
              <Card>
                <div
                  className="text-xs text-center"
                  style={{ color: C.mutedLight }}
                >
                  No hay visitas registradas para este período.
                </div>
              </Card>
            ) : (
              <div className="flex flex-col gap-2">
                {visitasFiltradas.map((v) => {
                  const cliente = db.clientes.find((c) => c.id === v.clienteId);
                  const rep = db.config.repartidores.find(
                    (r) => r.id === v.repartidorId
                  );
                  const productos = (v.items || [])
                    .filter((it) => (Number(it.cantidad) || 0) > 0)
                    .map((it) => {
                      const prod = PRODUCTOS.find((p) => p.key === it.tipo);
                      return `${it.cantidad}× ${prod?.corto || it.tipo}`;
                    })
                    .join(", ");

                  return (
                    <Card key={v.id}>
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <div className="font-bold text-sm">
                            {cliente?.nombre ||
                              v.clienteNombre ||
                              "Cliente eliminado"}
                          </div>
                          <div className="text-xs" style={{ color: C.muted }}>
                            {rango === "dia" || rango === "hoy"
                              ? ""
                              : `${fechaLegible(v.fecha)} · `}
                            {rep?.nombre || "—"}
                          </div>
                        </div>

                        {v.vendio ? (
                          <Badge tone="success">{formatMoney(v.total)}</Badge>
                        ) : (
                          <Badge tone="muted">No vendió</Badge>
                        )}
                      </div>

                      {v.vendio && productos && (
                        <div className="text-xs mt-1">{productos}</div>
                      )}

                      <div className="flex flex-wrap gap-1 mt-2">
                        {(Number(v.pagos?.efectivo) || 0) > 0 && (
                          <Badge tone="success">
                            Efectivo {formatMoney(v.pagos.efectivo)}
                          </Badge>
                        )}
                        {(Number(v.pagos?.mercadopago) || 0) > 0 && (
                          <Badge tone="accent">
                            MP {formatMoney(v.pagos.mercadopago)}
                          </Badge>
                        )}
                        {(Number(v.deudaGenerada) || 0) > 0 && (
                          <Badge tone="danger">
                            Fiado {formatMoney(v.deudaGenerada)}
                          </Badge>
                        )}
                      </div>

                      {(Number(v.deudaCobrada) || 0) > 0 && (
                        <div className="text-xs mt-1" style={{ color: C.success }}>
                          Cobró deuda anterior: {formatMoney(v.deudaCobrada)}
                        </div>
                      )}

                      {v.ajusteDeudaManual !== undefined &&
                        Number(v.ajusteDeudaManual) !== 0 && (
                          <div
                            className="text-xs mt-1"
                            style={{
                              color:
                                Number(v.ajusteDeudaManual) > 0
                                  ? C.danger
                                  : C.success,
                            }}
                          >
                            Ajuste manual de saldo: {
                              Number(v.ajusteDeudaManual) > 0 ? "+" : ""
                            }
                            {formatMoney(v.ajusteDeudaManual)}
                          </div>
                        )}

                      {textoExtrasPrestados(v) && (
                        <div className="text-xs mt-1" style={{ color: C.warning }}>
                          Prestó extra: {textoExtrasPrestados(v)}
                        </div>
                      )}
                      {textoExtrasRetirados(v) && (
                        <div className="text-xs mt-1" style={{ color: C.success }}>
                          Retiró extra: {textoExtrasRetirados(v)}
                        </div>
                      )}
                      {textoPermanentesRetirados(v) && (
                        <div className="text-xs mt-1" style={{ color: C.success }}>
                          Devolvió permanente: {textoPermanentesRetirados(v)}
                        </div>
                      )}
                      {v.volverSabadoFecha && (
                        <div className="text-xs mt-1" style={{ color: C.warning }}>
                          Volver el sábado: {fechaLegible(v.volverSabadoFecha)}
                        </div>
                      )}
                      {v.notas && (
                        <div
                          className="text-xs mt-1 italic"
                          style={{ color: C.mutedLight }}
                        >
                          {v.notas}
                        </div>
                      )}
                    </Card>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      <div className="text-xs font-bold uppercase tracking-wide mb-2" style={{ color: C.muted }}>
        Gastos · {etiquetaRango} ({gastosFiltrados.length})
      </div>

      {gastosFiltrados.length === 0 ? (
        <Card className="mb-4">
          <div className="text-xs text-center" style={{ color: C.mutedLight }}>
            No hay gastos registrados para este período.
          </div>
        </Card>
      ) : (
        <div className="flex flex-col gap-2 mb-4">
          {gastosFiltrados.map((g) => (
            <Card key={g.id} className="flex items-center justify-between gap-3">
              <div>
                <div className="font-bold text-sm">{g.concepto}</div>
                <div className="text-[10px]" style={{ color: C.mutedLight }}>
                  {fechaLegible(g.fecha)}
                </div>
              </div>
              <div className="font-mono font-extrabold" style={{ color: C.danger }}>
                -{formatMoney(g.monto)}
              </div>
            </Card>
          ))}
        </div>
      )}

      <div className="text-xs font-bold uppercase tracking-wide mb-2" style={{ color: C.muted }}>
        Estado actual
      </div>
      <Card className="mb-4">
        <div className="text-xs font-bold uppercase tracking-wide mb-1" style={{ color: C.muted }}>
          Envases en clientes
        </div>
        <div className="font-mono font-extrabold text-xl">{envasesEnCalle}</div>
        <div className="text-[10px] mt-1" style={{ color: C.mutedLight }}>
          Permanentes + extras actuales.
        </div>
      </Card>
    </div>
  );
}

/* ---------- Clientes (admin) ---------- */
function ClienteForm({ initial, repartidores, onSave, onCancel, isAdmin }) {
  const [f, setF] = useState(() => {
    if (initial) {
      return {
        ...initial,
        envasesPermanentes: envasesPermanentesDe(initial),
        envasesExtra: envasesExtraDe(initial),
        maquinaFrioCalor: initial.maquinaFrioCalor ?? false,
      };
    }
    return {
      nombre: "", direccion: "", telefono: "", notas: "",
      diasVisita: [], repartidorId: repartidores[0]?.id || "",
      envasesPermanentes: envasesVacio(), envasesExtra: envasesVacio(),
      maquinaFrioCalor: false, deudaAcumulada: 0, orden: "", activo: true,
    };
  });
  const [error, setError] = useState("");
  const [mostrarSaldoPendiente, setMostrarSaldoPendiente] =
  useState(() => Number(initial?.deudaAcumulada || 0) > 0);
    const [extrasEditadosManualmente, setExtrasEditadosManualmente] =
    useState(false);

  function submit() {
    if (!f.nombre.trim()) return setError("Ingresá el nombre del cliente.");
    if (!f.direccion.trim()) return setError("Ingresá la dirección.");
    if (f.diasVisita.length === 0) return setError("Elegí al menos un día de visita.");
    if (isAdmin && !f.repartidorId) return setError("Asigná un repartidor.");
    onSave(
  isAdmin
    ? {
        ...f,
        _extrasEditadosManualmente:
          extrasEditadosManualmente,
      }
    : f
);
}

  return (
    <div>
      <Field label="Nombre *"><Input value={f.nombre} onChange={(e) => setF({ ...f, nombre: e.target.value })} placeholder="Ej: Familia Gómez" /></Field>
      <Field label="Dirección *"><Input value={f.direccion} onChange={(e) => setF({ ...f, direccion: e.target.value })} placeholder="Calle 123" /></Field>
      <Field label="Teléfono"><Input value={f.telefono} onChange={(e) => setF({ ...f, telefono: e.target.value })} placeholder="Ej: 261 555 5555" inputMode="tel" /></Field>
      <Field label="Día(s) de visita *"><DayPills value={f.diasVisita} onChange={(v) => setF({ ...f, diasVisita: v })} /></Field>
      {isAdmin && (
        <Field label="Repartidor asignado *">
          <select
            value={f.repartidorId}
            onChange={(e) => setF({ ...f, repartidorId: e.target.value })}
            className="w-full rounded-xl px-3 py-2.5 text-sm outline-none"
            style={{ background: C.bg, border: `1px solid ${C.border}`, color: C.ink }}
          >
            <option value="">Elegir…</option>
            {repartidores.map((r) => <option key={r.id} value={r.id}>{r.nombre}</option>)}
          </select>
        </Field>
      )}
      <Field label="¿Tiene máquina de frío/calor?">
        <div className="flex gap-2">
          <button type="button" onClick={() => setF({ ...f, maquinaFrioCalor: true })} className="flex-1 py-2 rounded-xl font-bold text-sm" style={{ background: f.maquinaFrioCalor ? C.primary : C.bg, color: f.maquinaFrioCalor ? "#fff" : C.muted }}>Sí</button>
          <button type="button" onClick={() => setF({ ...f, maquinaFrioCalor: false })} className="flex-1 py-2 rounded-xl font-bold text-sm" style={{ background: !f.maquinaFrioCalor ? C.primary : C.bg, color: !f.maquinaFrioCalor ? "#fff" : C.muted }}>No</button>
        </div>
      </Field>

{isAdmin && (
  <div className="mb-3">
    <button
      type="button"
      onClick={() =>
        setMostrarSaldoPendiente(!mostrarSaldoPendiente)
      }
      className="w-full rounded-xl px-3 py-3 flex items-center justify-between"
      style={{
        background:
          Number(f.deudaAcumulada || 0) > 0
            ? C.dangerBg
            : C.surface,
        border: `1px solid ${
          Number(f.deudaAcumulada || 0) > 0
            ? C.danger
            : C.border
        }`,
      }}
    >
      <div className="text-left">
        <div
          className="text-xs font-bold"
          style={{
            color:
              Number(f.deudaAcumulada || 0) > 0
                ? C.danger
                : C.ink,
          }}
        >
          Saldo antes de esta visita
        </div>

        <div
          className="text-[10px]"
          style={{ color: C.muted }}
        >
          {Number(f.deudaAcumulada || 0) > 0
            ? formatMoney(f.deudaAcumulada)
            : "Sin deuda registrada"}
        </div>
      </div>

      <ChevronRight
        size={17}
        color={
          Number(f.deudaAcumulada || 0) > 0
            ? C.danger
            : C.muted
        }
        style={{
          transform: mostrarSaldoPendiente
            ? "rotate(90deg)"
            : "rotate(0deg)",
          transition: "transform 0.2s",
        }}
      />
    </button>

    {mostrarSaldoPendiente && (
      <Card
        className="mt-1"
        style={{
          background: C.dangerBg,
          border: "none",
          borderTopLeftRadius: 0,
          borderTopRightRadius: 0,
        }}
      >
        <Field
          label="Saldo pendiente actual"
          hint="Usá este campo para cargar una deuda anterior o corregir manualmente el saldo del cliente."
        >
          <Input
            type="number"
            inputMode="decimal"
            min="0"
            value={f.deudaAcumulada || ""}
            onChange={(e) =>
              setF({
                ...f,
                deudaAcumulada: Math.max(
                  0,
                  Number(e.target.value) || 0
                ),
              })
            }
            placeholder="0"
          />
        </Field>

        {Number(f.deudaAcumulada || 0) > 0 && (
          <div
            className="rounded-xl px-3 py-2"
            style={{ background: "#fff" }}
          >
            <div
              className="text-[10px] font-bold uppercase"
              style={{ color: C.danger }}
            >
              Saldo que verá el repartidor
            </div>

            <div
              className="font-mono font-extrabold text-lg"
              style={{ color: C.danger }}
            >
              {formatMoney(f.deudaAcumulada)}
            </div>
          </div>
        )}
      </Card>
    )}
  </div>
)}

      {isAdmin && (
        <>
          <Field label="Envases permanentes" hint="Stock fijo asignado al cliente. Solo el administrador puede modificarlo.">
            <div className="flex flex-col gap-2">
              {PRODUCTOS_RETORNABLES.map((p) => (
                <div key={p.key} className="flex items-center justify-between">
                  <span className="text-xs font-semibold">{p.label}</span>
                  <Stepper value={f.envasesPermanentes[p.key] || 0} onChange={(v) => setF({ ...f, envasesPermanentes: { ...f.envasesPermanentes, [p.key]: v } })} />
                </div>
              ))}
            </div>
          </Field>
          <Field
  label="Envases extra"
  hint="Envases adicionales que actualmente tiene el cliente. El administrador puede corregirlos manualmente."
>
  <Card
    style={{
      background: C.warningBg,
      border: "none",
    }}
  >
    <div className="flex flex-col gap-2">
      {PRODUCTOS_RETORNABLES.map((p) => (
        <div
          key={p.key}
          className="flex items-center justify-between"
        >
          <div>
            <div className="text-xs font-semibold">
              {p.label}
            </div>

            <div
              className="text-[10px]"
              style={{ color: C.muted }}
            >
              Extra actual
            </div>
          </div>

          <Stepper
            value={
              Number(f.envasesExtra?.[p.key]) || 0
            }
            onChange={(v) => {
              setExtrasEditadosManualmente(true);

              setF((prev) => ({
                ...prev,
                envasesExtra: {
                  ...envasesExtraDe(prev),
                  [p.key]: v,
                },
              }));
            }}
          />
        </div>
      ))}
    </div>
  </Card>
</Field>
        </>
      )}
      {!isAdmin && totalEnvasesPrestados(f.envasesPermanentes) > 0 && (
        <Card style={{ background: C.accentSoft, border: "none" }} className="mb-3">
          <div className="text-xs font-bold" style={{ color: C.primary }}>Envases permanentes</div>
          <div className="text-xs mt-1" style={{ color: C.muted }}>{textoEnvasesPrestados(f.envasesPermanentes)}</div>
        </Card>
      )}
      {!isAdmin && totalEnvasesPrestados(f.envasesExtra) > 0 && (
        <Card style={{ background: C.warningBg, border: "none" }} className="mb-3">
          <div className="text-xs font-bold" style={{ color: C.warning }}>Envases extra</div>
          <div className="text-xs mt-1" style={{ color: C.muted }}>{textoEnvasesPrestados(f.envasesExtra)}</div>
        </Card>
      )}
      <Field label="Orden en el recorrido (opcional)" hint="Número más bajo = se visita antes.">
        <Input type="number" inputMode="numeric" value={f.orden} onChange={(e) => setF({ ...f, orden: e.target.value })} placeholder="Ej: 1" />
      </Field>
      <Field label="Dato extra / notas"><Textarea rows={2} value={f.notas} onChange={(e) => setF({ ...f, notas: e.target.value })} placeholder="Ej: dejar en portón, perro suelto, etc." /></Field>
      {error && <div className="text-xs font-semibold mb-2" style={{ color: C.danger }}>{error}</div>}
      <div className="flex gap-2 mt-2">
        <Btn variant="ghost" onClick={onCancel} full>Cancelar</Btn>
        <Btn onClick={submit} full icon={Save}>Guardar</Btn>
      </div>
    </div>
  );
}

function AdminClientes({ db, mutate }) {
  const [busca, setBusca] = useState("");
  const [sheet, setSheet] = useState(null); // null | 'nuevo' | cliente
  const [confirmDel, setConfirmDel] = useState(null);
  const [detalleId, setDetalleId] = useState(null);
  const [ordenLista, setOrdenLista] = useState("nombre");
  const [diasAbiertos, setDiasAbiertos] = useState(
    () => new Set([diaSemanaHoy()])
  );

  function toggleDia(dia) {
    setDiasAbiertos((prev) => {
      const siguiente = new Set(prev);
      if (siguiente.has(dia)) siguiente.delete(dia);
      else siguiente.add(dia);
      return siguiente;
    });
  }

  const lista = db.clientes
    .filter(
      (c) =>
        (c.nombre || "").toLowerCase().includes(busca.toLowerCase()) ||
        (c.direccion || "").toLowerCase().includes(busca.toLowerCase())
    )
    .sort((a, b) => {
      if (ordenLista === "nombre") {
        return a.nombre.localeCompare(b.nombre);
      }

      const ordenA =
        a.orden === "" || a.orden === null || a.orden === undefined
          ? Infinity
          : Number(a.orden);
      const ordenB =
        b.orden === "" || b.orden === null || b.orden === undefined
          ? Infinity
          : Number(b.orden);

      if (ordenA !== ordenB) return ordenA - ordenB;
      return a.nombre.localeCompare(b.nombre);
    });

  const clientesPorDia = DIAS.map((dia) => ({
    dia,
    clientes: lista.filter((c) => (c.diasVisita || []).includes(dia)),
  }));

  const clientesSinDia = lista.filter(
    (c) => !c.diasVisita || c.diasVisita.length === 0
  );

  const clienteDetalle = detalleId
    ? db.clientes.find((c) => c.id === detalleId)
    : null;

function guardarCliente(f) {
  const next = clone(db);

  const extrasEditadosManualmente =
    !!f._extrasEditadosManualmente;

  // Sacamos este dato auxiliar para que
  // NO se guarde dentro de Firebase.
  const {
    _extrasEditadosManualmente,
    ...datosCliente
  } = f;

  if (f.id) {
    const i = next.clientes.findIndex(
      (c) => c.id === f.id
    );

    if (i < 0) return;

    const actual = next.clientes[i];

    const permanentesAntes =
      envasesPermanentesDe(actual);

    const extrasAntes =
      envasesExtraDe(actual);

    const permanentesNuevos = {
      ...envasesVacio(),
      ...(f.envasesPermanentes || {}),
    };

    let extrasNuevos;

    // ==========================================
    // SI EL ADMINISTRADOR EDITÓ LOS EXTRAS
    // MANUALMENTE, RESPETAMOS EXACTAMENTE
    // LOS VALORES QUE INGRESÓ.
    // ==========================================
    if (extrasEditadosManualmente) {
      extrasNuevos = {
        ...envasesVacio(),
        ...(f.envasesExtra || {}),
      };
    } else {
      // ==========================================
      // SI NO TOCÓ LOS EXTRAS, mantenemos
      // la lógica automática que ya teníamos
      // al modificar permanentes.
      // ==========================================
      extrasNuevos = {
        ...extrasAntes,
      };

      PRODUCTOS_RETORNABLES.forEach((p) => {
        const antes =
          Number(permanentesAntes[p.key]) || 0;

        const despues =
          Number(permanentesNuevos[p.key]) || 0;

        const diferencia =
          despues - antes;

        if (diferencia > 0) {
          // Si aumentamos permanentes y había
          // extras, primero convertimos extras
          // existentes en permanentes.
          const convertir = Math.min(
            diferencia,
            Number(extrasNuevos[p.key]) || 0
          );

          extrasNuevos[p.key] = Math.max(
            0,
            (Number(extrasNuevos[p.key]) || 0) -
              convertir
          );
        } else if (diferencia < 0) {
          // Si reducimos permanentes,
          // esos envases pasan a ser extras.
          extrasNuevos[p.key] =
            (Number(extrasNuevos[p.key]) || 0) +
            Math.abs(diferencia);
        }
      });
    }

    const actualizado = {
  ...actual,
  ...datosCliente,

  deudaAcumulada:
    Math.max(0, Number(f.deudaAcumulada) || 0),

  envasesPermanentes:
    permanentesNuevos,

  envasesExtra:
    extrasNuevos,
};

    delete actualizado.envasesPrestados;

    next.clientes[i] = actualizado;
  } else {
    // ==========================================
    // CLIENTE NUEVO
    // ==========================================
    const nuevo = {
  ...datosCliente,

  id: uid(),

  deudaAcumulada:
    Math.max(0, Number(f.deudaAcumulada) || 0),

  envasesPermanentes: {
    ...envasesVacio(),
    ...(f.envasesPermanentes || {}),
  },

  envasesExtra: {
    ...envasesVacio(),
    ...(f.envasesExtra || {}),
  },

  creadoEl: hoyISO(),
};

    delete nuevo.envasesPrestados;

    next.clientes.push(nuevo);
  }

  mutate(next);
  setSheet(null);
}

  function eliminarCliente(c) {
    if (totalEnvasesCliente(c) > 0) return;
    const next = clone(db);
    next.clientes = next.clientes.filter((x) => x.id !== c.id);
    mutate(next);
    setConfirmDel(null);
    if (detalleId === c.id) setDetalleId(null);
  }

  if (clienteDetalle) {
    return (
      <div>
        <ClienteHistorial
          cliente={clienteDetalle}
          db={db}
          onBack={() => setDetalleId(null)}
          onEditar={() => setSheet(clienteDetalle)}
        />
        {sheet && (
          <Sheet
            title="Editar cliente"
            onClose={() => setSheet(null)}
            closeOnBackdrop={false}
          >
            <ClienteForm
              initial={sheet === "nuevo" ? null : sheet}
              repartidores={db.config.repartidores}
              isAdmin
              onSave={guardarCliente}
              onCancel={() => setSheet(null)}
            />
          </Sheet>
        )}
      </div>
    );
  }

  return (
    <div>
      <div className="flex gap-2 mb-3">
        <div className="flex-1 relative">
          <Search
            size={16}
            color={C.mutedLight}
            style={{ position: "absolute", left: 10, top: 11 }}
          />
          <input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar cliente…"
            className="w-full rounded-xl pl-8 pr-3 py-2.5 text-sm outline-none"
            style={{ background: C.surface, border: `1px solid ${C.border}` }}
          />
        </div>
        <Btn icon={Plus} onClick={() => setSheet("nuevo")}>
          Nuevo
        </Btn>
      </div>

      <div className="flex items-center gap-2 mb-3">
        <span className="text-xs font-semibold mr-1" style={{ color: C.muted }}>
          Ordenar por:
        </span>

        <button
          type="button"
          onClick={() => setOrdenLista("nombre")}
          className="px-3 py-1.5 rounded-lg text-xs font-bold"
          style={{
            background: ordenLista === "nombre" ? C.primary : C.surface,
            color: ordenLista === "nombre" ? "#fff" : C.muted,
            border: `1px solid ${
              ordenLista === "nombre" ? C.primary : C.border
            }`,
          }}
        >
          Nombre
        </button>

        <button
          type="button"
          onClick={() => setOrdenLista("recorrido")}
          className="px-3 py-1.5 rounded-lg text-xs font-bold"
          style={{
            background: ordenLista === "recorrido" ? C.primary : C.surface,
            color: ordenLista === "recorrido" ? "#fff" : C.muted,
            border: `1px solid ${
              ordenLista === "recorrido" ? C.primary : C.border
            }`,
          }}
        >
          Recorrido
        </button>
      </div>

      {lista.length === 0 ? (
        <EmptyState
          icon={Users}
          title={busca ? "Sin resultados" : "Sin clientes todavía"}
          text={
            busca
              ? "No encontramos clientes con esa búsqueda."
              : "Agregá el primer cliente para empezar a armar los recorridos."
          }
          action={
            !busca && (
              <Btn icon={Plus} onClick={() => setSheet("nuevo")}>
                Nuevo cliente
              </Btn>
            )
          }
        />
      ) : (
        <div className="flex flex-col gap-3">
          {clientesPorDia.map(({ dia, clientes }) => {
            if (clientes.length === 0) return null;

            const abierto = busca.trim() ? true : diasAbiertos.has(dia);
            const esHoy = dia === diaSemanaHoy();

            return (
              <div key={dia}>
                <button
                  type="button"
                  onClick={() => toggleDia(dia)}
                  className="w-full rounded-xl px-3 py-3 flex items-center justify-between"
                  style={{
                    background: esHoy ? C.accentSoft : C.surface,
                    border: `1px solid ${esHoy ? C.accent : C.border}`,
                  }}
                >
                  <div className="flex items-center gap-2">
                    <div
                      className="w-8 h-8 rounded-lg flex items-center justify-center font-extrabold text-xs"
                      style={{
                        background: esHoy ? C.primary : C.bg,
                        color: esHoy ? "#fff" : C.primary,
                      }}
                    >
                      {dia.slice(0, 3)}
                    </div>

                    <div className="text-left">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm">{dia}</span>
                        {esHoy && <Badge tone="accent">Hoy</Badge>}
                      </div>
                      <div className="text-[10px]" style={{ color: C.muted }}>
                        {clientes.length} cliente{clientes.length !== 1 ? "s" : ""}
                      </div>
                    </div>
                  </div>

                  <ChevronRight
                    size={18}
                    color={C.muted}
                    style={{
                      transform: abierto ? "rotate(90deg)" : "rotate(0deg)",
                      transition: "transform 0.2s",
                    }}
                  />
                </button>

                {abierto && (
                  <div className="flex flex-col gap-2 mt-2">
                    {clientes.map((c) => {
                      const rep = db.config.repartidores.find(
                        (r) => r.id === c.repartidorId
                      );

                      return (
                        <Card key={`${dia}-${c.id}`}>
                          <div className="flex items-start justify-between gap-2">
                            <div
                              className="min-w-0 flex-1"
                              onClick={() => setDetalleId(c.id)}
                            >
                              <div className="flex items-center gap-2">
                                <div className="font-bold text-sm truncate">
                                  {c.nombre}
                                </div>

                                {c.orden !== "" &&
                                  c.orden !== null &&
                                  c.orden !== undefined && (
                                    <span
                                      className="px-2 py-0.5 rounded-md text-[10px] font-bold flex-shrink-0"
                                      style={{
                                        background: C.primaryDark,
                                        color: "#fff",
                                      }}
                                    >
                                      Orden {c.orden}
                                    </span>
                                  )}
                              </div>

                              <a
                                href={urlGoogleMaps(c.direccion)}
                                target="_blank"
                                rel="noreferrer"
                                onClick={(e) => e.stopPropagation()}
                                className="text-xs truncate flex items-center gap-1"
                                style={{ color: C.primary }}
                              >
                                <MapPin size={12} className="flex-shrink-0" />
                                <span className="truncate">{c.direccion}</span>
                              </a>

                              {c.telefono && (
                                <a
                                  href={urlWhatsApp(c.telefono)}
                                  target="_blank"
                                  rel="noreferrer"
                                  onClick={(e) => e.stopPropagation()}
                                  className="text-xs mt-1 flex items-center gap-1 w-fit"
                                  style={{ color: C.success }}
                                >
                                  <MessageCircle size={12} />
                                  <span>{c.telefono}</span>
                                </a>
                              )}

                              <div className="flex flex-wrap gap-1 mt-1.5">
                                {rep && <Badge tone="muted">{rep.nombre}</Badge>}
                                {c.deudaAcumulada > 0 && (
                                  <Badge tone="danger">
                                    Debe {formatMoney(c.deudaAcumulada)}
                                  </Badge>
                                )}
                                {totalEnvasesPrestados(
                                  envasesPermanentesDe(c)
                                ) > 0 && (
                                  <Badge tone="accent">
                                    Permanentes: {textoEnvasesPrestados(
                                      envasesPermanentesDe(c)
                                    )}
                                  </Badge>
                                )}
                                {totalEnvasesPrestados(envasesExtraDe(c)) > 0 && (
                                  <Badge tone="warning">
                                    Extra: {textoEnvasesPrestados(envasesExtraDe(c))}
                                  </Badge>
                                )}
                                {c.maquinaFrioCalor && (
                                  <Badge tone="accent">Máquina F/C</Badge>
                                )}
                              </div>
                            </div>

                            <div className="flex flex-col gap-1">
                              <button
                                onClick={() => setSheet(c)}
                                className="p-1.5 rounded-lg active:bg-black/5"
                              >
                                <Edit2 size={15} color={C.muted} />
                              </button>
                              <button
                                onClick={() => setConfirmDel(c)}
                                className="p-1.5 rounded-lg active:bg-black/5"
                              >
                                <Trash2 size={15} color={C.danger} />
                              </button>
                            </div>
                          </div>
                        </Card>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}

          {clientesSinDia.length > 0 && (
            <div>
              <div
                className="text-xs font-bold uppercase tracking-wide mb-2"
                style={{ color: C.danger }}
              >
                Sin día asignado ({clientesSinDia.length})
              </div>

              <div className="flex flex-col gap-2">
                {clientesSinDia.map((c) => (
                  <Card
                    key={`sin-dia-${c.id}`}
                    onClick={() => setDetalleId(c.id)}
                  >
                    <div className="font-bold text-sm">{c.nombre}</div>
                    <a
                      href={urlGoogleMaps(c.direccion)}
                      target="_blank"
                      rel="noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="text-xs flex items-center gap-1 w-fit"
                      style={{ color: C.primary }}
                    >
                      <MapPin size={12} />
                      <span>{c.direccion}</span>
                    </a>
                    {c.telefono && (
                      <a
                        href={urlWhatsApp(c.telefono)}
                        target="_blank"
                        rel="noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="text-xs mt-1 flex items-center gap-1 w-fit"
                        style={{ color: C.success }}
                      >
                        <MessageCircle size={12} />
                        <span>{c.telefono}</span>
                      </a>
                    )}
                    <div className="mt-1">
                      <Badge tone="danger">Falta asignar día</Badge>
                    </div>
                  </Card>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {sheet && (
        <Sheet
          title={sheet === "nuevo" ? "Nuevo cliente" : "Editar cliente"}
          onClose={() => setSheet(null)}
          closeOnBackdrop={false}
        >
          <ClienteForm
            initial={sheet === "nuevo" ? null : sheet}
            repartidores={db.config.repartidores}
            isAdmin
            onSave={guardarCliente}
            onCancel={() => setSheet(null)}
          />
        </Sheet>
      )}

      {confirmDel && (
        <Sheet title="Eliminar cliente" onClose={() => setConfirmDel(null)}>
          {totalEnvasesCliente(confirmDel) > 0 ? (
            <>
              <Card
                style={{ background: C.warningBg, border: "none" }}
                className="mb-3"
              >
                <div className="text-sm font-bold" style={{ color: C.warning }}>
                  No se puede eliminar este cliente.
                </div>
                <div className="text-xs mt-1" style={{ color: C.muted }}>
                  La empresa todavía tiene envases en poder de este cliente.
                </div>
                <div
                  className="font-bold text-sm mt-2"
                  style={{ color: C.danger }}
                >
                  {totalEnvasesPrestados(
                    envasesPermanentesDe(confirmDel)
                  ) > 0 && (
                    <div>
                      Permanentes: {textoEnvasesPrestados(
                        envasesPermanentesDe(confirmDel)
                      )}
                    </div>
                  )}
                  {totalEnvasesPrestados(envasesExtraDe(confirmDel)) > 0 && (
                    <div>
                      Extras: {textoEnvasesPrestados(envasesExtraDe(confirmDel))}
                    </div>
                  )}
                </div>
                <div className="text-xs mt-2" style={{ color: C.muted }}>
                  Primero registrá la devolución de los envases y después vas a
                  poder eliminarlo.
                </div>
              </Card>
              <Btn variant="ghost" full onClick={() => setConfirmDel(null)}>
                Volver
              </Btn>
            </>
          ) : (
            <>
              <div className="text-sm mb-4">
                ¿Seguro que querés eliminar a <b>{confirmDel.nombre}</b>? Podés
                deshacerlo después con el botón deshacer.
              </div>
              <div className="flex gap-2">
                <Btn variant="ghost" full onClick={() => setConfirmDel(null)}>
                  Cancelar
                </Btn>
                <Btn variant="danger" full onClick={() => eliminarCliente(confirmDel)}>
                  Eliminar
                </Btn>
              </div>
            </>
          )}
        </Sheet>
      )}
    </div>
  );
}

/* ---------- Historial de compras de un cliente (admin) ---------- */
const NOMBRES_MES = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];

function ClienteHistorial({ cliente, db, onBack, onEditar }) {
  const visitas = db.visitas
    .filter((v) => v.clienteId === cliente.id)
    .sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));

  const grupos = {};
  visitas.forEach((v) => {
    const mes = v.fecha.slice(0, 7);
    if (!grupos[mes]) grupos[mes] = [];
    grupos[mes].push(v);
  });
  const meses = Object.keys(grupos).sort().reverse();

  function nombreMes(mesKey) {
    const [y, m] = mesKey.split("-");
    return `${NOMBRES_MES[Number(m) - 1]} ${y}`;
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <button onClick={onBack} className="text-xs font-bold flex items-center gap-1" style={{ color: C.primary }}><ArrowLeft size={14} /> Volver a clientes</button>
        <Btn size="sm" variant="ghost" icon={Edit2} onClick={onEditar}>Editar</Btn>
      </div>

      <Card className="mb-4">
        <div className="font-extrabold text-base">{cliente.nombre}</div>

        <div className="flex flex-wrap gap-2 mt-1.5">
          {cliente.direccion && (
            <a
              href={urlGoogleMaps(cliente.direccion)}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold"
              style={{ background: C.accentSoft, color: C.primary }}
            >
              <MapPin size={13} />
              <span>{cliente.direccion}</span>
            </a>
          )}

          {cliente.telefono && (
            <a
              href={urlWhatsApp(cliente.telefono)}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold"
              style={{ background: C.successBg, color: C.success }}
            >
              <MessageCircle size={13} />
              <span>WhatsApp · {cliente.telefono}</span>
            </a>
          )}
        </div>

        {cliente.deudaAcumulada > 0 && (
          <div
            className="rounded-xl px-3 py-2 mt-2"
            style={{
              background: C.dangerBg,
              border: `1px solid ${C.danger}`,
            }}
          >
            <div
              className="text-[10px] font-extrabold uppercase tracking-wide"
              style={{ color: C.danger }}
            >
              Saldo pendiente
            </div>

            <div
              className="font-mono font-extrabold text-base"
              style={{ color: C.danger }}
            >
              {formatMoney(cliente.deudaAcumulada)}
            </div>
          </div>
        )}
        <div className="flex flex-wrap gap-1.5 mt-2">
          {cliente.diasVisita.map((d) => <Badge key={d} tone="accent">{d.slice(0, 3)}</Badge>)}
          {totalEnvasesPrestados(envasesPermanentesDe(cliente)) > 0 && <Badge tone="accent">Permanentes: {textoEnvasesPrestados(envasesPermanentesDe(cliente))}</Badge>}
          {totalEnvasesPrestados(envasesExtraDe(cliente)) > 0 && <Badge tone="warning">Extra: {textoEnvasesPrestados(envasesExtraDe(cliente))}</Badge>}
          {cliente.maquinaFrioCalor && <Badge tone="accent">Máquina F/C</Badge>}
        </div>
      </Card>

      {meses.length === 0 ? (
        <EmptyState icon={ClipboardList} title="Sin compras registradas" text="Todavía no hay historial para este cliente." />
      ) : (
        meses.map((mes) => {
          const items = grupos[mes];
          const facturado = items.reduce((s, v) => s + (v.total || 0), 0);
          const efectivo = items.reduce((s, v) => s + (v.pagos?.efectivo || 0), 0);
          const mp = items.reduce((s, v) => s + (v.pagos?.mercadopago || 0), 0);
          const fiado = items.reduce((s, v) => s + (v.deudaGenerada || 0), 0);
          return (
            <div key={mes} className="mb-4">
              <div className="flex items-center justify-between mb-2">
                <div className="text-xs font-extrabold uppercase tracking-wide" style={{ color: C.muted }}>{nombreMes(mes)}</div>
                <div className="font-mono text-xs font-bold">{formatMoney(facturado)}</div>
              </div>
              {(efectivo > 0 || mp > 0 || fiado > 0) && (
                <div className="flex gap-1.5 mb-2 flex-wrap">
                  {efectivo > 0 && <Badge tone="success">Efectivo {formatMoney(efectivo)}</Badge>}
                  {mp > 0 && <Badge tone="accent">MP {formatMoney(mp)}</Badge>}
                  {fiado > 0 && <Badge tone="danger">Fiado {formatMoney(fiado)}</Badge>}
                </div>
              )}
              <div className="flex flex-col gap-2">
                {items.map((v) => (
                  <Card key={v.id}>
                    <div className="flex items-center justify-between">
                      <div className="text-xs font-bold" style={{ color: C.muted }}>{fechaLegible(v.fecha)}</div>
                      {v.vendio ? <Badge tone="success">{formatMoney(v.total)}</Badge> : <Badge tone="muted">No vendió</Badge>}
                    </div>
                    {v.vendio && (
                      <div className="text-xs mt-1">
                        {v.items.filter((it) => it.cantidad > 0).map((it) => `${it.cantidad}× ${PRODUCTOS.find((p) => p.key === it.tipo)?.corto}`).join(", ")}
                        {" · "}{({ efectivo: "Efectivo", mercadopago: "Mercado Pago", deuda: "Fiado" })[v.metodoPago]}
                      </div>
                    )}
                    {v.deudaCobrada > 0 && <div className="text-xs mt-0.5" style={{ color: C.success }}>Cobró deuda vieja: {formatMoney(v.deudaCobrada)}</div>}
                    {textoExtrasPrestados(v) && (
                      <div className="text-xs mt-0.5" style={{ color: C.warning }}>
                        Prestó extra: {textoExtrasPrestados(v)}
                      </div>
                    )}
                    {textoExtrasRetirados(v) && (
                      <div className="text-xs mt-0.5" style={{ color: C.success }}>
                        Retiró extra: {textoExtrasRetirados(v)}
                      </div>
                    )}
                    {textoPermanentesRetirados(v) && (
                      <div className="text-xs mt-0.5" style={{ color: C.success }}>
                        Devolvió permanente: {textoPermanentesRetirados(v)}
                      </div>
                    )}
                    {v.volverSabadoFecha && (
                      <div className="text-xs mt-0.5" style={{ color: C.warning }}>
                        Volver el sábado: {fechaLegible(v.volverSabadoFecha)}
                      </div>
                    )}
                    {!v.extrasPrestados && !v.extrasRetirados && !v.permanentesRetirados && textoDevoluciones(v) && (
                      <div className="text-xs mt-0.5" style={{ color: C.success }}>
                        Devolvió (registro anterior): {textoDevoluciones(v)}
                      </div>
                    )}
                    {v.notas && <div className="text-xs mt-0.5 italic" style={{ color: C.mutedLight }}>{v.notas}</div>}
                  </Card>
                ))}
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}

/* ---------- Recorridos + historial (admin) ---------- */
function AdminHistorial({ db, mutate }) {
  const [filtroRep, setFiltroRep] = useState("todos");
  const [confirmDel, setConfirmDel] = useState(null);

  const hoy = diaSemanaHoy();
  const fechaHoy = hoyISO();

  // Todos los clientes programados para hoy, más las visitas especiales
  // marcadas como "Volver el sábado" para la fecha de hoy.
  const idsVolverSabadoHoy = new Set(
    db.visitas
      .filter((v) => v.volverSabadoFecha === fechaHoy)
      .map((v) => v.clienteId)
  );

  const clientesHoy = db.clientes
    .filter(
      (c) =>
        c.diasVisita?.includes(hoy) ||
        idsVolverSabadoHoy.has(c.id)
    )
    .filter((c) => filtroRep === "todos" || c.repartidorId === filtroRep)
    .map((c) => ({
      ...c,
      citaSabado: idsVolverSabadoHoy.has(c.id),
    }))
    .sort((a, b) => (Number(a.orden) || 999) - (Number(b.orden) || 999) || a.nombre.localeCompare(b.nombre));

  const idsVisitadosHoy = new Set(
    db.visitas.filter((v) => v.fecha === fechaHoy).map((v) => v.clienteId)
  );

  // En el historial no mostramos visitas de clientes que ya fueron eliminados.
  // Los registros siguen guardados en Firebase y siguen contando en los totales contables.
  const visitas = db.visitas
    .filter((v) => db.clientes.some((c) => c.id === v.clienteId))
    .filter((v) => filtroRep === "todos" || v.repartidorId === filtroRep)
    .slice()
    .sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));

  const visitasHoyResumen = db.visitas.filter(
    (v) =>
      v.fecha === fechaHoy &&
      (filtroRep === "todos" || v.repartidorId === filtroRep)
  );

  const movimientosExtrasHoy = resumenExtrasVisitas(visitasHoyResumen);

  function borrarVisita(v) {
    const next = clone(db);
    const deltaExtras = calcularDeltaExtras(v);
    const deltaStock = calcularDeltaStockEnvases(v);

    next.visitas = next.visitas.filter((x) => x.id !== v.id);
    const ci = next.clientes.findIndex((c) => c.id === v.clienteId);
    if (ci >= 0) {
      next.clientes[ci].deudaAcumulada = Math.max(
  0,
  (next.clientes[ci].deudaAcumulada || 0) -
    (v.ajusteDeudaManual || 0) -
    (v.deudaGenerada || 0) +
    (v.deudaCobrada || 0)
);

      next.clientes[ci].envasesExtra = aplicarDeltaEnvases(
        envasesExtraDe(next.clientes[ci]),
        deltaExtras,
        -1
      );

      next.clientes[ci].envasesPermanentes = aplicarRetiroPermanentes(
        envasesPermanentesDe(next.clientes[ci]),
        v.permanentesRetirados,
        -1
      );

      delete next.clientes[ci].envasesPrestados;
    }

    if (db.config.stockActivo) {
      moverStockRepartidor(v.repartidorId, deltaStock, -1);
    }

    mutate(next);
    setConfirmDel(null);
  }

  return (
    <div>
      <div className="flex gap-2 mb-3 overflow-x-auto">
        <button onClick={() => setFiltroRep("todos")} className="px-3 py-1.5 rounded-lg text-xs font-bold flex-shrink-0" style={{ background: filtroRep === "todos" ? C.primary : C.surface, color: filtroRep === "todos" ? "#fff" : C.muted, border: `1px solid ${filtroRep === "todos" ? C.primary : C.border}` }}>Todos</button>
        {db.config.repartidores.map((r) => (
          <button key={r.id} onClick={() => setFiltroRep(r.id)} className="px-3 py-1.5 rounded-lg text-xs font-bold flex-shrink-0" style={{ background: filtroRep === r.id ? C.primary : C.surface, color: filtroRep === r.id ? "#fff" : C.muted, border: `1px solid ${filtroRep === r.id ? C.primary : C.border}` }}>{r.nombre}</button>
        ))}
      </div>

      <div className="text-xs font-bold uppercase tracking-wide mb-2" style={{ color: C.muted }}>
        Movimiento de envases extra hoy
      </div>
      <Card className="mb-5">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr style={{ color: C.muted }}>
                <th className="text-left py-1.5">Producto</th>
                <th className="text-center py-1.5">Prestados</th>
                <th className="text-center py-1.5">Retirados</th>
                <th className="text-center py-1.5">Balance</th>
              </tr>
            </thead>
            <tbody>
              {PRODUCTOS_RETORNABLES.map((p) => {
                const balance = movimientosExtrasHoy.balance[p.key] || 0;
                return (
                  <tr key={p.key} style={{ borderTop: `1px solid ${C.border}` }}>
                    <td className="py-2 font-semibold">{p.label}</td>
                    <td className="text-center font-bold" style={{ color: C.warning }}>
                      {movimientosExtrasHoy.prestados[p.key] || 0}
                    </td>
                    <td className="text-center font-bold" style={{ color: C.success }}>
                      {movimientosExtrasHoy.retirados[p.key] || 0}
                    </td>
                    <td
                      className="text-center font-bold"
                      style={{
                        color:
                          balance > 0
                            ? C.warning
                            : balance < 0
                            ? C.success
                            : C.muted,
                      }}
                    >
                      {balance > 0 ? `+${balance}` : balance}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="text-[10px] mt-2" style={{ color: C.mutedLight }}>
          Balance positivo = quedaron más envases extra en clientes. Balance negativo = se recuperaron más extras de los que se prestaron.
        </div>
      </Card>

      <div className="text-xs font-bold uppercase tracking-wide mb-2" style={{ color: C.muted }}>Recorrido de hoy</div>
      {clientesHoy.length === 0 ? (
        <Card className="mb-5">
          <div className="text-xs text-center" style={{ color: C.mutedLight }}>No hay clientes programados para hoy.</div>
        </Card>
      ) : (
        <div className="flex flex-col gap-2 mb-5">
          {clientesHoy.map((c) => {
            const rep = db.config.repartidores.find((r) => r.id === c.repartidorId);
            const visitado = idsVisitadosHoy.has(c.id);
            return (
              <Card key={c.id}>
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="font-bold text-sm">{c.nombre}</div>
                    <div className="text-xs" style={{ color: C.muted }}>{c.direccion}</div>
                    <div className="flex gap-1 mt-1.5 flex-wrap">
                      {rep && <Badge tone="muted">{rep.nombre}</Badge>}
                      {c.orden && <Badge tone="accent">Orden {c.orden}</Badge>}
                      {c.citaSabado && <Badge tone="warning">Volver sábado</Badge>}
                    </div>
                  </div>
                  <Badge tone={visitado ? "success" : "warning"}>{visitado ? "Visitado" : "Pendiente"}</Badge>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <div className="text-xs font-bold uppercase tracking-wide mb-2" style={{ color: C.muted }}>Historial</div>
      {visitas.length === 0 ? (
        <EmptyState icon={ClipboardList} title="Sin visitas registradas" text="Cuando los repartidores registren visitas, van a aparecer acá." />
      ) : (
        <div className="flex flex-col gap-2">
          {visitas.map((v) => {
            const cliente = db.clientes.find((c) => c.id === v.clienteId);
            const rep = db.config.repartidores.find((r) => r.id === v.repartidorId);
            return (
              <Card key={v.id}>
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="font-bold text-sm">{cliente?.nombre || v.clienteNombre || "Cliente"}</div>
                    <div className="text-xs" style={{ color: C.muted }}>{fechaLegible(v.fecha)} · {rep?.nombre || "—"}</div>
                    {v.vendio ? (
                      <div className="text-xs mt-1">
                        {(v.items || []).filter((it) => it.cantidad > 0).map((it) => `${it.cantidad}× ${PRODUCTOS.find((p) => p.key === it.tipo)?.corto}`).join(", ")}
                        {" — "}<span className="font-mono font-bold">{formatMoney(v.total)}</span>
                      </div>
                    ) : (
                      <div className="text-xs mt-1" style={{ color: C.mutedLight }}>No vendió{v.notas ? " · " + v.notas : ""}</div>
                    )}
                    {v.deudaCobrada > 0 && <div className="text-xs mt-0.5" style={{ color: C.success }}>Cobró deuda: {formatMoney(v.deudaCobrada)}</div>}
                    {textoExtrasPrestados(v) && (
                      <div className="text-xs mt-0.5" style={{ color: C.warning }}>
                        Prestó extra: {textoExtrasPrestados(v)}
                      </div>
                    )}
                    {textoExtrasRetirados(v) && (
                      <div className="text-xs mt-0.5" style={{ color: C.success }}>
                        Retiró extra: {textoExtrasRetirados(v)}
                      </div>
                    )}
                    {textoPermanentesRetirados(v) && (
                      <div className="text-xs mt-0.5" style={{ color: C.success }}>
                        Devolvió permanente: {textoPermanentesRetirados(v)}
                      </div>
                    )}
                    {v.volverSabadoFecha && (
                      <div className="text-xs mt-0.5" style={{ color: C.warning }}>
                        Volver el sábado: {fechaLegible(v.volverSabadoFecha)}
                      </div>
                    )}
                    {!v.extrasPrestados && !v.extrasRetirados && !v.permanentesRetirados && textoDevoluciones(v) && (
                      <div className="text-xs mt-0.5" style={{ color: C.success }}>
                        Devolvió (registro anterior): {textoDevoluciones(v)}
                      </div>
                    )}
                  </div>
                  <button onClick={() => setConfirmDel(v)} className="p-1.5 rounded-lg active:bg-black/5 flex-shrink-0"><Trash2 size={15} color={C.danger} /></button>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {confirmDel && (
        <Sheet title="Eliminar visita" onClose={() => setConfirmDel(null)}>
          <div className="text-sm mb-4">Se va a revertir el efecto en la deuda, los envases del cliente y el stock de la camioneta.</div>
          <div className="flex gap-2">
            <Btn variant="ghost" full onClick={() => setConfirmDel(null)}>Cancelar</Btn>
            <Btn variant="danger" full onClick={() => borrarVisita(confirmDel)}>Eliminar</Btn>
          </div>
        </Sheet>
      )}
    </div>
  );
}

/* ---------- Stock general (admin) ---------- */
function AdminStock({ db, mutate }) {
  const [total, setTotal] = useState(() => ({ ...stockVacio(), ...(db.config.stockTotal || {}) }));
  const [porRepartidor, setPorRepartidor] = useState(() => {
    const resultado = {};
    db.config.repartidores.forEach((r) => { resultado[r.id] = stockDeRepartidor(db, r.id); });
    return resultado;
  });
  const [mensaje, setMensaje] = useState("");

  // Si cambian los repartidores o llega stock nuevo desde Firestore,
  // mantenemos la pantalla sincronizada.
  useEffect(() => {
    setTotal({ ...stockVacio(), ...(db.config.stockTotal || {}) });
    const resultado = {};
    db.config.repartidores.forEach((r) => { resultado[r.id] = stockDeRepartidor(db, r.id); });
    setPorRepartidor(resultado);
  }, [db.config.stockTotal, db.config.repartidores, db.stock]);

  const permanentes = stockPermanenteClientes(db.clientes);
  const extras = stockExtraClientes(db.clientes);
  const enClientes = stockPrestadoClientes(db.clientes);
  const trabajando = stockTrabajando(porRepartidor);
  const galpon = stockVacio();
  PRODUCTOS_RETORNABLES.forEach((p) => {
    galpon[p.key] = (Number(total[p.key]) || 0) - (trabajando[p.key] || 0) - (enClientes[p.key] || 0);
  });

  function cambiarStockRep(repId, tipo, valor) {
    setMensaje("");
    setPorRepartidor((prev) => ({
      ...prev,
      [repId]: { ...stockVacio(), ...(prev[repId] || {}), [tipo]: Math.max(0, Number(valor) || 0) },
    }));
  }

  function guardarStock() {
    const productoConError = PRODUCTOS_RETORNABLES.find((p) => galpon[p.key] < 0);
    if (productoConError) {
      setMensaje(`Error: asignaste más ${productoConError.label} de los que posee la empresa.`);
      return;
    }

    const next = clone(db);
    next.config.stockActivo = true;
    delete next.config.stockRepartidores;
    next.config.stockTotal = {
      b20: Number(total.b20) || 0,
      b12: Number(total.b12) || 0,
      sifon: Number(total.sifon) || 0,
    };
    next.stock = db.config.repartidores.map((r) => ({
      id: r.id,
      ...stockVacio(),
      ...(porRepartidor[r.id] || {}),
    }));

    mutate(next);
    setMensaje("Stock guardado ✓");
  }

  return (
    <div>
      {!db.config.stockActivo && (
        <Card style={{ background: C.warningBg, border: "none" }} className="mb-3">
          <div className="text-xs font-semibold" style={{ color: C.warning }}>
            Cargá el stock total y el stock de cada camioneta. Al guardar se activa el control automático de stock.
          </div>
        </Card>
      )}

      <div className="text-xs font-bold uppercase tracking-wide mb-2" style={{ color: C.muted }}>Stock general</div>
      <Card className="mb-4">
        <div className="text-xs mb-3" style={{ color: C.muted }}>
          Total propiedad = Galpón + Camionetas + Permanentes en clientes + Extras en clientes.
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs" style={{ minWidth: Math.max(820, 510 + db.config.repartidores.length * 90) }}>
            <thead>
              <tr style={{ color: C.muted }}>
                <th className="text-left py-2 pr-2">Producto</th>
                <th className="text-center py-2">Total</th>
                <th className="text-center py-2">Galpón</th>
                {db.config.repartidores.map((r) => <th key={r.id} className="text-center py-2 px-1">{r.nombre}</th>)}
                <th className="text-center py-2">Permanentes</th>
                <th className="text-center py-2">Extras</th>
                <th className="text-center py-2">En clientes</th>
                <th className="text-center py-2">Trabajando</th>
              </tr>
            </thead>
            <tbody>
              {PRODUCTOS_RETORNABLES.map((p) => (
                <tr key={p.key} style={{ borderTop: `1px solid ${C.border}` }}>
                  <td className="py-2 pr-2 font-bold whitespace-nowrap">{p.label}</td>
                  <td className="p-1">
                    <Input type="number" inputMode="numeric" value={total[p.key]} onChange={(e) => setTotal({ ...total, [p.key]: Math.max(0, Number(e.target.value) || 0) })} style={{ width: 70, textAlign: "center" }} />
                  </td>
                  <td className="text-center font-bold" style={{ color: galpon[p.key] < 0 ? C.danger : C.ink }}>{galpon[p.key]}</td>
                  {db.config.repartidores.map((r) => (
                    <td key={r.id} className="p-1">
                      <Input type="number" inputMode="numeric" value={porRepartidor[r.id]?.[p.key] || 0} onChange={(e) => cambiarStockRep(r.id, p.key, e.target.value)} style={{ width: 65, textAlign: "center" }} />
                    </td>
                  ))}
                  <td className="text-center font-bold" style={{ color: C.primary }}>{permanentes[p.key]}</td>
                  <td className="text-center font-bold" style={{ color: C.warning }}>{extras[p.key]}</td>
                  <td className="text-center font-bold" style={{ color: C.danger }}>{enClientes[p.key]}</td>
                  <td className="text-center font-bold" style={{ color: C.primary }}>{trabajando[p.key]}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="text-[11px] mt-3" style={{ color: C.mutedLight }}>
          Galpón se calcula solo. Para pasar envases del galpón a una camioneta, aumentá la cantidad de ese repartidor y guardá.
        </div>

        {mensaje && <div className="text-xs font-bold mt-3" style={{ color: mensaje.includes("✓") ? C.success : C.danger }}>{mensaje}</div>}
        <div className="mt-3"><Btn full icon={Save} onClick={guardarStock}>Guardar stock</Btn></div>
      </Card>
    </div>
  );
}

/* ---------- Gastos (admin) ---------- */
function AdminGastos({ db, mutate }) {
  const [sheet, setSheet] = useState(false);
  const [concepto, setConcepto] = useState("");
  const [monto, setMonto] = useState("");
  const [confirmDel, setConfirmDel] = useState(null);

  function guardar() {
    if (!concepto.trim() || !monto) return;
    const next = clone(db);
    next.gastos.push({
      id: uid(),
      concepto: concepto.trim(),
      monto: Number(monto),
      fecha: hoyISO(),
      timestamp: Date.now(),
    });
    mutate(next);
    setConcepto("");
    setMonto("");
    setSheet(false);
  }

  function borrar(g) {
    const next = clone(db);
    next.gastos = next.gastos.filter((x) => x.id !== g.id);
    mutate(next);
    setConfirmDel(null);
  }

  const total = db.gastos.reduce((s, g) => s + (Number(g.monto) || 0), 0);

  // Agrupamos por FECHA, no solamente por mes.
  // Así se ve rápido cuánto se gastó cada día y qué gastos formaron ese total.
  const gruposFecha = useMemo(() => {
    const grupos = {};

    db.gastos.forEach((g) => {
      if (!g.fecha) return;
      if (!grupos[g.fecha]) grupos[g.fecha] = [];
      grupos[g.fecha].push(g);
    });

    return Object.entries(grupos)
      .sort(([fechaA], [fechaB]) => fechaB.localeCompare(fechaA))
      .map(([fecha, items]) => ({
        fecha,
        items: items
          .slice()
          .sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0)),
        subtotal: items.reduce((s, g) => s + (Number(g.monto) || 0), 0),
      }));
  }, [db.gastos]);

  return (
    <div>
      <Card
        style={{ background: C.primaryDark, border: "none" }}
        className="mb-4"
      >
        <div className="flex items-center justify-between gap-3">
          <div>
            <div
              className="text-xs font-bold uppercase tracking-wide"
              style={{ color: C.accentSoft, opacity: 0.8 }}
            >
              Total gastado
            </div>
            <div
              className="font-mono font-extrabold text-2xl mt-0.5"
              style={{ color: "#fff" }}
            >
              {formatMoney(total)}
            </div>
            <div className="text-[10px] mt-1" style={{ color: C.accentSoft, opacity: 0.7 }}>
              {db.gastos.length} gasto{db.gastos.length !== 1 ? "s" : ""} registrado{db.gastos.length !== 1 ? "s" : ""}
            </div>
          </div>

          <Btn variant="accent" icon={Plus} onClick={() => setSheet(true)}>
            Gasto
          </Btn>
        </div>
      </Card>

      {gruposFecha.length === 0 ? (
        <EmptyState
          icon={Receipt}
          title="Sin gastos cargados"
          text="Registrá combustible, mantenimiento u otros gastos del negocio."
        />
      ) : (
        <div className="flex flex-col gap-4">
          {gruposFecha.map(({ fecha, items, subtotal }) => {
            const esHoy = fecha === hoyISO();
            const numeroDia = fecha.split("-")[2];
            const nombreDia = diaSemanaDeFecha(fecha);

            return (
              <div key={fecha}>
                <div className="flex items-center justify-between gap-3 mb-2 px-1">
                  <div className="flex items-center gap-2 min-w-0">
                    <div
                      className="w-10 h-10 rounded-xl flex flex-col items-center justify-center flex-shrink-0"
                      style={{
                        background: esHoy ? C.primary : C.accentSoft,
                        color: esHoy ? "#fff" : C.primary,
                      }}
                    >
                      <div className="text-[9px] font-extrabold uppercase leading-none">
                        {nombreDia.slice(0, 3)}
                      </div>
                      <div className="text-sm font-extrabold leading-tight">
                        {numeroDia}
                      </div>
                    </div>

                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <div className="font-extrabold text-sm">{nombreDia}</div>
                        {esHoy && <Badge tone="accent">Hoy</Badge>}
                      </div>
                      <div className="text-[10px]" style={{ color: C.muted }}>
                        {fechaLegible(fecha)} · {items.length} gasto{items.length !== 1 ? "s" : ""}
                      </div>
                    </div>
                  </div>

                  <div className="text-right flex-shrink-0">
                    <div className="text-[9px] font-bold uppercase" style={{ color: C.mutedLight }}>
                      Total del día
                    </div>
                    <div className="font-mono font-extrabold text-sm" style={{ color: C.danger }}>
                      {formatMoney(subtotal)}
                    </div>
                  </div>
                </div>

                <Card className="p-0 overflow-hidden">
                  {items.map((g, idx) => (
                    <div
                      key={g.id}
                      className="px-4 py-3 flex items-center justify-between gap-3"
                      style={{
                        borderTop: idx === 0 ? "none" : `1px solid ${C.border}`,
                      }}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="font-bold text-sm truncate">{g.concepto}</div>
                        <div className="text-[10px] mt-0.5" style={{ color: C.mutedLight }}>
                          Gasto registrado el {fechaLegible(g.fecha)}
                        </div>
                      </div>

                      <div className="flex items-center gap-2 flex-shrink-0">
                        <div
                          className="font-mono font-extrabold text-sm"
                          style={{ color: C.danger }}
                        >
                          -{formatMoney(g.monto)}
                        </div>
                        <button
                          type="button"
                          onClick={() => setConfirmDel(g)}
                          className="w-8 h-8 rounded-lg flex items-center justify-center active:scale-95"
                          style={{ background: C.dangerBg }}
                          aria-label={`Eliminar gasto ${g.concepto}`}
                        >
                          <Trash2 size={14} color={C.danger} />
                        </button>
                      </div>
                    </div>
                  ))}
                </Card>
              </div>
            );
          })}
        </div>
      )}

      {sheet && (
        <Sheet title="Nuevo gasto" onClose={() => setSheet(false)} closeOnBackdrop={false}>
          <Field label="Concepto">
            <Input
              value={concepto}
              onChange={(e) => setConcepto(e.target.value)}
              placeholder="Ej: Nafta, agua, repuesto..."
              autoFocus
            />
          </Field>
          <Field label="Monto">
            <Input
              type="number"
              inputMode="decimal"
              min="0"
              value={monto}
              onChange={(e) => setMonto(e.target.value)}
              placeholder="0"
            />
          </Field>
          <Card style={{ background: C.bg, border: "none" }} className="mb-3">
            <div className="text-[10px] font-bold uppercase" style={{ color: C.muted }}>
              Fecha
            </div>
            <div className="text-sm font-bold mt-0.5">
              {diaSemanaHoy()} {fechaLegible(hoyISO())}
            </div>
          </Card>
          <div className="flex gap-2 mt-2">
            <Btn variant="ghost" full onClick={() => setSheet(false)}>Cancelar</Btn>
            <Btn full onClick={guardar}>Guardar</Btn>
          </div>
        </Sheet>
      )}

      {confirmDel && (
        <Sheet title="Eliminar gasto" onClose={() => setConfirmDel(null)}>
          <div className="text-sm mb-1">
            ¿Eliminar <b>{confirmDel.concepto}</b>?
          </div>
          <div className="font-mono font-extrabold text-lg mb-4" style={{ color: C.danger }}>
            {formatMoney(confirmDel.monto)}
          </div>
          <div className="flex gap-2">
            <Btn variant="ghost" full onClick={() => setConfirmDel(null)}>Cancelar</Btn>
            <Btn variant="danger" full onClick={() => borrar(confirmDel)}>Eliminar</Btn>
          </div>
        </Sheet>
      )}
    </div>
  );
}

/* ---------- Ajustes (admin) ---------- */
function AdminAjustes({ db, mutate }) {
  const [precios, setPrecios] = useState(db.config.precios);
  const [nuevoRep, setNuevoRep] = useState("");
  const [confirmDelRep, setConfirmDelRep] = useState(null);
  const [pinActual, setPinActual] = useState("");
  const [pinNuevo, setPinNuevo] = useState("");
  const [pinMsg, setPinMsg] = useState("");

  function guardarPrecios() {
  const next = clone(db);

  next.config.precios = {
    b20: Number(precios.b20) || 0,
    b12: Number(precios.b12) || 0,
    sifon: Number(precios.sifon) || 0,
    jugo: Number(precios.jugo) || 0,
    jugo5: Number(precios.jugo5) || 0,
    dispenserNatural:
      Number(precios.dispenserNatural) || 0,
  };

  mutate(next);
}

  function agregarRepartidor() {
    if (!nuevoRep.trim()) return;
    const next = clone(db);
    next.config.repartidores.push({ id: uid(), nombre: nuevoRep.trim() });
    mutate(next);
    setNuevoRep("");
  }

  function eliminarRepartidor(r) {
    const next = clone(db);
    next.config.repartidores = next.config.repartidores.filter((x) => x.id !== r.id);
    next.stock = (next.stock || []).filter((x) => x.id !== r.id);
    mutate(next);
    setConfirmDelRep(null);
  }

  function cambiarPin() {
    if (pinActual !== db.config.adminPin) return setPinMsg("El PIN actual no coincide.");
    if (pinNuevo.length < 4) return setPinMsg("El nuevo PIN debe tener al menos 4 dígitos.");
    const next = clone(db);
    next.config.adminPin = pinNuevo;
    mutate(next);
    setPinActual(""); setPinNuevo("");
    setPinMsg("PIN actualizado ✓");
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <div className="text-xs font-bold uppercase tracking-wide mb-2" style={{ color: C.muted }}>Precios de envases</div>
        <Card>
          {PRODUCTOS.map((p) => (
            <div key={p.key} className="flex items-center justify-between mb-2 last:mb-0">
              <span className="text-sm font-semibold">{p.label}</span>
              <Input
                type="number" inputMode="decimal"
                value={precios[p.key]}
                onChange={(e) => setPrecios({ ...precios, [p.key]: e.target.value })}
                style={{ width: 110, textAlign: "right" }}
              />
            </div>
          ))}
          <Btn full size="sm" onClick={guardarPrecios} icon={Save}>Guardar precios</Btn>
        </Card>
      </div>

      <div>
        <div className="text-xs font-bold uppercase tracking-wide mb-2" style={{ color: C.muted }}>Repartidores</div>
        <Card>
          {db.config.repartidores.length === 0 && <div className="text-xs mb-2" style={{ color: C.mutedLight }}>Agregá al menos uno para poder asignar clientes.</div>}
          {db.config.repartidores.map((r) => (
            <div key={r.id} className="flex items-center justify-between py-1.5">
              <span className="text-sm font-semibold">{r.nombre}</span>
              <button onClick={() => setConfirmDelRep(r)}><Trash2 size={15} color={C.danger} /></button>
            </div>
          ))}
          <div className="flex gap-2 mt-2">
            <Input value={nuevoRep} onChange={(e) => setNuevoRep(e.target.value)} placeholder="Nombre del repartidor" />
            <Btn onClick={agregarRepartidor} icon={Plus}>Agregar</Btn>
          </div>
        </Card>
      </div>

      <div>
        <div className="text-xs font-bold uppercase tracking-wide mb-2" style={{ color: C.muted }}>Seguridad</div>
        <Card>
          <Field label="PIN actual"><Input type="password" inputMode="numeric" value={pinActual} onChange={(e) => setPinActual(e.target.value.replace(/\D/g, ""))} /></Field>
          <Field label="PIN nuevo"><Input type="password" inputMode="numeric" value={pinNuevo} onChange={(e) => setPinNuevo(e.target.value.replace(/\D/g, ""))} /></Field>
          {pinMsg && <div className="text-xs font-semibold mb-2" style={{ color: pinMsg.includes("✓") ? C.success : C.danger }}>{pinMsg}</div>}
          <Btn full size="sm" onClick={cambiarPin}>Cambiar PIN</Btn>
        </Card>
      </div>

      <div>
        <div className="text-xs font-bold uppercase tracking-wide mb-2" style={{ color: C.muted }}>Exportar datos</div>
        <Card>
          <div className="text-xs mb-3" style={{ color: C.muted }}>
            Descarga archivos CSV (se abren con Excel, Google Sheets o Numbers) para respaldo propio o para pasarle a un contador.
          </div>
          <div className="flex flex-col gap-2">
            <Btn variant="ghost" size="sm" icon={Download} onClick={() => exportarClientesCSV(db)}>Exportar clientes ({db.clientes.length})</Btn>
            <Btn variant="ghost" size="sm" icon={Download} onClick={() => exportarVisitasCSV(db)}>Exportar ventas ({db.visitas.length})</Btn>
            <Btn variant="ghost" size="sm" icon={Download} onClick={() => exportarGastosCSV(db)}>Exportar gastos ({db.gastos.length})</Btn>
          </div>
        </Card>
      </div>

      {confirmDelRep && (
        <Sheet title="Eliminar repartidor" onClose={() => setConfirmDelRep(null)}>
          <div className="text-sm mb-4">¿Eliminar a <b>{confirmDelRep.nombre}</b>? Los clientes que tenía asignados van a quedar sin repartidor.</div>
          <div className="flex gap-2">
            <Btn variant="ghost" full onClick={() => setConfirmDelRep(null)}>Cancelar</Btn>
            <Btn variant="danger" full onClick={() => eliminarRepartidor(confirmDelRep)}>Eliminar</Btn>
          </div>
        </Sheet>
      )}
    </div>
  );
}

/* ============================================================
   APP REPARTIDOR
   ============================================================ */
function RepartidorApp({ db, mutate, repartidor, onLogout, offline }) {
  const [vista, setVista] = useState("inicio"); // inicio | clientes | recorrido

  const misClientes = db.clientes.filter(
    (c) => c.repartidorId === repartidor.id
  );

  const hoy = diaSemanaHoy();
  const fechaHoy = hoyISO();

  const deHoy = misClientes
    .filter((c) => c.diasVisita.includes(hoy))
    .sort((a, b) => {
      const ordenA =
        a.orden === "" || a.orden === null || a.orden === undefined
          ? Infinity
          : Number(a.orden);
      const ordenB =
        b.orden === "" || b.orden === null || b.orden === undefined
          ? Infinity
          : Number(b.orden);

      if (ordenA !== ordenB) return ordenA - ordenB;
      return a.nombre.localeCompare(b.nombre);
    });

  const visitasHoy = db.visitas.filter(
    (v) => v.repartidorId === repartidor.id && v.fecha === fechaHoy
  );

  // Tomamos la visita más reciente de hoy para cada cliente.
  const visitaHoyPorCliente = new Map();
  visitasHoy
    .slice()
    .sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0))
    .forEach((v) => {
      visitaHoyPorCliente.set(v.clienteId, v);
    });

  // Última visita ANTERIOR a hoy de cada cliente.
  // Si esa última visita quedó en "Volver más tarde", el pendiente se
  // arrastra al recorrido de hoy aunque el cliente no tenga hoy asignado.
  const ultimaVisitaAnteriorPorCliente = new Map();
  db.visitas
    .filter((v) => v.fecha < fechaHoy)
    .slice()
    .sort((a, b) => {
      const porFecha = (a.fecha || "").localeCompare(b.fecha || "");
      if (porFecha !== 0) return porFecha;
      return (a.timestamp || 0) - (b.timestamp || 0);
    })
    .forEach((v) => {
      ultimaVisitaAnteriorPorCliente.set(v.clienteId, v);
    });

  const pendientesAnteriores = misClientes
    .map((c) => {
      const visitaAnterior = ultimaVisitaAnteriorPorCliente.get(c.id);
      if (!esVolverMasTarde(visitaAnterior)) return null;

      return {
        ...c,
        // Dato solo visual: no se persiste en Firebase.
        pendienteDesde: visitaAnterior.fecha,
      };
    })
    .filter(Boolean);

  // Citas puntuales programadas con "Volver el sábado".
  // Solo aparecen en la fecha exacta del sábado y NO se arrastran después.
  const idsCitaSabadoHoy = new Set(
    db.visitas
      .filter((v) => v.volverSabadoFecha === fechaHoy)
      .map((v) => v.clienteId)
  );

  const pendienteAnteriorPorId = new Map(
    pendientesAnteriores.map((c) => [c.id, c.pendienteDesde])
  );

  // Los clientes programados para hoy conservan marcas especiales.
  const clientesHoyConPendientes = deHoy.map((c) => {
    const pendienteDesde = pendienteAnteriorPorId.get(c.id);
    return {
      ...c,
      ...(pendienteDesde ? { pendienteDesde } : {}),
      citaSabado: idsCitaSabadoHoy.has(c.id),
    };
  });

  // Sumamos los pendientes viejos que no estaban programados para hoy.
  const idsDeHoy = new Set(deHoy.map((c) => c.id));
  const pendientesAnterioresExtra = pendientesAnteriores
    .filter((c) => !idsDeHoy.has(c.id))
    .map((c) => ({
      ...c,
      citaSabado: idsCitaSabadoHoy.has(c.id),
    }));

  const idsYaIncluidos = new Set([
    ...clientesHoyConPendientes.map((c) => c.id),
    ...pendientesAnterioresExtra.map((c) => c.id),
  ]);

  const citasSabadoExtra = misClientes
    .filter(
      (c) =>
        idsCitaSabadoHoy.has(c.id) &&
        !idsYaIncluidos.has(c.id)
    )
    .map((c) => ({ ...c, citaSabado: true }))
    .sort((a, b) => {
      const ordenA =
        a.orden === "" || a.orden === null || a.orden === undefined
          ? Infinity
          : Number(a.orden);
      const ordenB =
        b.orden === "" || b.orden === null || b.orden === undefined
          ? Infinity
          : Number(b.orden);

      if (ordenA !== ordenB) return ordenA - ordenB;
      return (a.nombre || "").localeCompare(b.nombre || "");
    });

  const clientesRecorrido = [
    ...clientesHoyConPendientes,
    ...pendientesAnterioresExtra,
    ...citasSabadoExtra,
  ];

  // Todavía no tuvo visita hoy y no viene de un día anterior ni de cita sábado.
  const pendientes = clientesRecorrido.filter(
    (c) =>
      !visitaHoyPorCliente.has(c.id) &&
      !c.pendienteDesde &&
      !c.citaSabado
  );

  // Citas especiales del sábado que todavía no fueron atendidas hoy.
  const citasSabadoActivas = clientesRecorrido.filter(
    (c) => !visitaHoyPorCliente.has(c.id) && !!c.citaSabado
  );

  // Pendientes de días anteriores que aún no fueron atendidos hoy.
  const pendientesAnterioresActivos = clientesRecorrido.filter(
    (c) =>
      !visitaHoyPorCliente.has(c.id) &&
      !!c.pendienteDesde &&
      !c.citaSabado
  );

  // Hoy ya se visitó, pero nuevamente quedó para volver más tarde.
  const volverMasTarde = clientesRecorrido.filter((c) =>
    esVolverMasTarde(visitaHoyPorCliente.get(c.id))
  );

  // Visitas de hoy ya finalizadas, con o sin venta.
  const visitadosFinalizados = clientesRecorrido.filter((c) => {
    const visita = visitaHoyPorCliente.get(c.id);
    return visita && !esVolverMasTarde(visita);
  });

 

  const completadosCount = visitadosFinalizados.length;

  const enProgreso =
    completadosCount > 0 ||
    volverMasTarde.length > 0 ||
    pendientesAnterioresActivos.length > 0 ||
    citasSabadoActivas.length > 0;

  return (
    <Screen>
      <TopBar
        title={repartidor.nombre}
        subtitle={fechaLegible(fechaHoy) + " · " + hoy}
        tone="dark"
        right={
          <div className="flex items-center gap-1">
            <span className="flex items-center gap-1 px-1.5 mr-1">
              <span
                className="w-1.5 h-1.5 rounded-full"
                style={{ background: offline ? C.warning : C.accent }}
              />
              <span
                className="text-[10px] font-bold"
                style={{ color: C.accentSoft }}
              >
                {offline ? "sin conexión" : "en vivo"}
              </span>
            </span>
            <button
              onClick={onLogout}
              className="p-2 rounded-full active:bg-white/10"
            >
              <LogOut size={16} color="#fff" />
            </button>
          </div>
        }
      />

      <div className="flex-1 overflow-y-auto px-4 py-4">
        {vista === "inicio" && (
          <RepartidorInicio
            deHoy={deHoy}
            totalRecorridoCount={clientesRecorrido.length}
            pendientes={pendientes}
            pendientesAnterioresCount={pendientesAnterioresActivos.length}
            citasSabadoCount={citasSabadoActivas.length}
            visitadosCount={completadosCount}
            porReintentarCount={volverMasTarde.length}
            enProgreso={enProgreso}
            onEmpezar={() => setVista("recorrido")}
          />
        )}

        {vista === "clientes" && (
          <RepartidorClientes db={db} mutate={mutate} repartidor={repartidor} />
        )}

        {vista === "recorrido" && (
          <RepartidorRecorrido
            db={db}
            mutate={mutate}
            repartidor={repartidor}
            clientes={clientesRecorrido}
            todosLosClientes={misClientes}
            visitasHoy={visitasHoy}
            onSalir={() => setVista("inicio")}
          />
        )}
      </div>

      {vista !== "recorrido" && (
        <div
          className="flex-shrink-0 flex"
          style={{ background: C.surface, borderTop: `1px solid ${C.border}` }}
        >
          {[
            ["inicio", "Inicio", HomeIcon],
            ["clientes", "Mis clientes", Users],
          ].map(([key, label, Icon]) => {
            const active = vista === key;
            return (
              <button
                key={key}
                onClick={() => setVista(key)}
                className="flex-1 flex flex-col items-center gap-0.5 py-2.5"
              >
                <Icon
                  size={18}
                  color={active ? C.primary : C.mutedLight}
                  strokeWidth={active ? 2.4 : 2}
                />
                <span
                  className="text-xs font-semibold"
                  style={{ color: active ? C.primary : C.mutedLight }}
                >
                  {label}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </Screen>
  );
}

function RepartidorInicio({
  deHoy,
  totalRecorridoCount,
  pendientes,
  pendientesAnterioresCount = 0,
  citasSabadoCount = 0,
  visitadosCount,
  porReintentarCount = 0,
  enProgreso,
  onEmpezar,
}) {
  const quedanPorAtender =
    pendientes.length > 0 ||
    pendientesAnterioresCount > 0 ||
    citasSabadoCount > 0 ||
    porReintentarCount > 0;

  return (
    <div className="flex flex-col items-center justify-center text-center pt-10">
      <div
        className="w-20 h-20 rounded-3xl flex items-center justify-center mb-4"
        style={{ background: C.primaryDark }}
      >
        <Truck size={34} color="#fff" />
      </div>

      {totalRecorridoCount === 0 ? (
        <>
          <div className="font-bold text-base mb-1">
            No tenés clientes para hoy
          </div>
          <div className="text-xs mb-6" style={{ color: C.muted }}>
            Revisá "Mis clientes" para ver tus días de visita.
          </div>
        </>
      ) : (
        <>
          <div className="font-extrabold text-xl mb-1">
            {deHoy.length > 0
              ? `${deHoy.length} cliente${deHoy.length !== 1 ? "s" : ""} hoy`
              : `${totalRecorridoCount} cliente${
                  totalRecorridoCount !== 1 ? "s" : ""
                } en el recorrido`}
          </div>

          <div className="text-xs mb-6" style={{ color: C.muted }}>
            {visitadosCount > 0 ||
            pendientesAnterioresCount > 0 ||
            citasSabadoCount > 0 ||
            porReintentarCount > 0 ? (
              <>
                {visitadosCount} de {totalRecorridoCount} completados
                {pendientesAnterioresCount > 0 &&
                  ` · ${pendientesAnterioresCount} pendiente${
                    pendientesAnterioresCount !== 1 ? "s" : ""
                  } anterior${
                    pendientesAnterioresCount !== 1 ? "es" : ""
                  }`}
                {citasSabadoCount > 0 &&
                  ` · ${citasSabadoCount} para volver el sábado`}
                {porReintentarCount > 0 &&
                  ` · ${porReintentarCount} para volver hoy`}
              </>
            ) : (
              "Todavía no arrancaste el recorrido"
            )}
          </div>

          <Btn
            size="lg"
            onClick={onEmpezar}
            icon={!quedanPorAtender ? CheckCircle2 : Truck}
          >
            {!quedanPorAtender
              ? "Ver recorrido completo"
              : enProgreso
              ? "Continuar recorrido"
              : "Empezar recorrido"}
          </Btn>
        </>
      )}
    </div>
  );
}

function RepartidorClientes({ db, mutate, repartidor }) {
  const [sheet, setSheet] = useState(null);
  const [busca, setBusca] = useState("");
  const [detalleId, setDetalleId] = useState(null);

  // Base completa de clientes de este repartidor.
  // El historial solo puede abrirse para clientes que le pertenecen.
  const clientesDelRepartidor = db.clientes
    .filter((c) => c.repartidorId === repartidor.id);

  const misClientes = clientesDelRepartidor
    .filter((c) => {
      const texto = busca.toLowerCase();
      const nombre = (c.nombre || "").toLowerCase();
      const direccion = (c.direccion || "").toLowerCase();
      return nombre.includes(texto) || direccion.includes(texto);
    })
    .sort((a, b) => (a.nombre || "").localeCompare(b.nombre || ""));

  const clienteDetalle = detalleId
    ? clientesDelRepartidor.find((c) => c.id === detalleId)
    : null;

  function guardar(f) {
    const next = clone(db);

    if (f.id) {
      const i = next.clientes.findIndex((c) => c.id === f.id);
      if (i < 0) return;

      // Seguridad adicional: el repartidor solo puede modificar
      // un cliente que siga asignado a su perfil.
      if (next.clientes[i].repartidorId !== repartidor.id) return;

      const actualizado = {
        ...next.clientes[i],
        ...f,
        repartidorId: repartidor.id,
        envasesPermanentes: envasesPermanentesDe(next.clientes[i]),
        envasesExtra: envasesExtraDe(next.clientes[i]),
      };

      delete actualizado.envasesPrestados;
      next.clientes[i] = actualizado;
    } else {
      const nuevo = {
        ...f,
        id: uid(),
        repartidorId: repartidor.id,
        deudaAcumulada: Math.max(0, Number(f.deudaAcumulada) || 0),
        envasesPermanentes: envasesVacio(),
        envasesExtra: envasesVacio(),
        creadoEl: hoyISO(),
      };

      delete nuevo.envasesPrestados;
      next.clientes.push(nuevo);
    }

    mutate(next);
    setSheet(null);
  }

  // Al tocar un cliente, primero mostramos su historial.
  // Desde ahí el repartidor todavía puede entrar a Editar.
  if (clienteDetalle) {
    return (
      <div>
        <ClienteHistorial
          cliente={clienteDetalle}
          db={db}
          onBack={() => setDetalleId(null)}
          onEditar={() => setSheet(clienteDetalle)}
        />

        {sheet && (
          <Sheet
            title="Editar cliente"
            onClose={() => setSheet(null)}
            closeOnBackdrop={false}
          >
            <ClienteForm
              initial={sheet === "nuevo" ? null : sheet}
              repartidores={db.config.repartidores}
              isAdmin={false}
              onSave={guardar}
              onCancel={() => setSheet(null)}
            />
          </Sheet>
        )}
      </div>
    );
  }

  return (
    <div>
      <div className="flex gap-2 mb-3">
        <div className="flex-1 relative">
          <Search
            size={16}
            color={C.mutedLight}
            style={{ position: "absolute", left: 10, top: 11 }}
          />
          <input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar cliente…"
            className="w-full rounded-xl pl-8 pr-3 py-2.5 text-sm outline-none"
            style={{ background: C.surface, border: `1px solid ${C.border}` }}
          />
        </div>

        <Btn icon={Plus} onClick={() => setSheet("nuevo")}>
          Nuevo
        </Btn>
      </div>

      {misClientes.length === 0 ? (
        <EmptyState
          icon={Users}
          title={busca ? "Sin resultados" : "Todavía no tenés clientes"}
          text={
            busca
              ? "Probá con otro nombre o dirección."
              : "Agregá tu primer cliente para que aparezca en tu recorrido."
          }
          action={
            !busca && (
              <Btn icon={Plus} onClick={() => setSheet("nuevo")}>
                Nuevo cliente
              </Btn>
            )
          }
        />
      ) : (
        <div className="flex flex-col gap-2">
          {misClientes.map((c) => (
            <Card
              key={c.id}
              onClick={() => setDetalleId(c.id)}
              style={{ cursor: "pointer" }}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <div className="font-bold text-sm">{c.nombre}</div>

                  <a
                    href={urlGoogleMaps(c.direccion)}
                    target="_blank"
                    rel="noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className="text-xs flex items-center gap-1 w-fit"
                    style={{ color: C.primary }}
                  >
                    <MapPin size={12} />
                    <span>{c.direccion}</span>
                  </a>

                  {c.telefono && (
                    <a
                      href={urlWhatsApp(c.telefono)}
                      target="_blank"
                      rel="noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="text-xs mt-1 flex items-center gap-1 w-fit"
                      style={{ color: C.success }}
                    >
                      <MessageCircle size={12} />
                      <span>{c.telefono}</span>
                    </a>
                  )}

                  {c.deudaAcumulada > 0 && (
                    <div
                      className="rounded-xl px-3 py-2 mt-2"
                      style={{
                        background: C.dangerBg,
                        border: `1px solid ${C.danger}`,
                      }}
                    >
                      <div
                        className="text-[10px] font-extrabold uppercase tracking-wide"
                        style={{ color: C.danger }}
                      >
                        Saldo pendiente
                      </div>
                      <div
                        className="font-mono font-extrabold text-base"
                        style={{ color: C.danger }}
                      >
                        {formatMoney(c.deudaAcumulada)}
                      </div>
                    </div>
                  )}

                  <div className="flex flex-wrap gap-1 mt-1.5">
                    {(c.diasVisita || []).map((d) => (
                      <Badge key={d} tone="accent">
                        {d.slice(0, 3)}
                      </Badge>
                    ))}

                    {totalEnvasesPrestados(envasesPermanentesDe(c)) > 0 && (
                      <Badge tone="accent">
                        Permanentes: {textoEnvasesPrestados(envasesPermanentesDe(c))}
                      </Badge>
                    )}

                    {totalEnvasesPrestados(envasesExtraDe(c)) > 0 && (
                      <Badge tone="warning">
                        Extra: {textoEnvasesPrestados(envasesExtraDe(c))}
                      </Badge>
                    )}

                    {c.maquinaFrioCalor && (
                      <Badge tone="accent">Máquina F/C</Badge>
                    )}
                  </div>

                  <div
                    className="text-[10px] mt-2 font-semibold"
                    style={{ color: C.primary }}
                  >
                    Tocar para ver historial de compras
                  </div>
                </div>

                <ChevronRight size={18} color={C.mutedLight} />
              </div>
            </Card>
          ))}
        </div>
      )}

      {sheet && (
        <Sheet
          title={sheet === "nuevo" ? "Nuevo cliente" : "Editar cliente"}
          onClose={() => setSheet(null)}
          closeOnBackdrop={false}
        >
          <ClienteForm
            initial={sheet === "nuevo" ? null : sheet}
            repartidores={db.config.repartidores}
            isAdmin={false}
            onSave={guardar}
            onCancel={() => setSheet(null)}
          />
        </Sheet>
      )}
    </div>
  );
}

/* ---------- Recorrido activo (repartidor) ---------- */
function RepartidorRecorrido({
  db,
  mutate,
  repartidor,
  clientes,
  todosLosClientes = [],
  visitasHoy,
  onSalir,
}) {
  const [activo, setActivo] = useState(null);
  const [visitaEditando, setVisitaEditando] = useState(null);
  const [mostrarVisitados, setMostrarVisitados] = useState(false);
  const [busca, setBusca] = useState("");
  // Clientes cuyo día normal ya pasó durante esta semana.
// Empieza cerrado.
const [mostrarDiasAnteriores, setMostrarDiasAnteriores] =
  useState(false);

const [buscaDiasAnteriores, setBuscaDiasAnteriores] =
  useState("");

  // Si hubiese más de una visita del mismo cliente hoy, tomamos la más reciente.
  const visitaPorCliente = new Map();
  visitasHoy
    .slice()
    .sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0))
    .forEach((v) => {
      visitaPorCliente.set(v.clienteId, v);
    });

  const textoBusqueda = busca.trim().toLowerCase();

  const clientesFiltrados = clientes.filter((c) => {
    if (!textoBusqueda) return true;
    const nombre = (c.nombre || "").toLowerCase();
    const direccion = (c.direccion || "").toLowerCase();
    return nombre.includes(textoBusqueda) || direccion.includes(textoBusqueda);
  });

  // ==========================================================
// CLIENTES DE DÍAS ANTERIORES DE ESTA SEMANA
//
// Ejemplo:
// si hoy es jueves:
//   lunes, martes y miércoles.
//
// No incluimos:
// - clientes que ya forman parte del recorrido actual;
// - clientes que ya fueron visitados hoy;
// - días futuros;
// - el día de hoy.
//
// Si un cliente tiene más de un día asignado, tomamos
// como referencia el día anterior más cercano a hoy.
// ==========================================================
const indiceHoy = DIAS.indexOf(diaSemanaHoy());

const diasAnterioresSemana =
  indiceHoy > 0
    ? DIAS.slice(0, indiceHoy)
    : [];

const idsClientesRecorrido = new Set(
  clientes.map((c) => c.id)
);

const textoBuscaDiasAnteriores =
  buscaDiasAnteriores.trim().toLowerCase();

const clientesDiasAnteriores = todosLosClientes
  .filter((c) => {
    // Ya está incluido normalmente en el recorrido.
    if (idsClientesRecorrido.has(c.id)) return false;

    // Ya fue atendido hoy.
    if (visitaPorCliente.has(c.id)) return false;

    // Buscamos qué días anteriores tiene asignados.
    const diasCliente = c.diasVisita || [];

    const tieneDiaAnterior =
      diasAnterioresSemana.some((dia) =>
        diasCliente.includes(dia)
      );

    if (!tieneDiaAnterior) return false;

    // Buscador interno.
    if (textoBuscaDiasAnteriores) {
      const nombre =
        (c.nombre || "").toLowerCase();

      const direccion =
        (c.direccion || "").toLowerCase();

      if (
        !nombre.includes(textoBuscaDiasAnteriores) &&
        !direccion.includes(textoBuscaDiasAnteriores)
      ) {
        return false;
      }
    }

    return true;
  })
  .map((c) => {
    // Si tiene varios días anteriores, usamos el más cercano.
    const diasCliente = c.diasVisita || [];

    const diaAnteriorReferencia =
      [...diasAnterioresSemana]
        .reverse()
        .find((dia) =>
          diasCliente.includes(dia)
        ) || "";

    return {
      ...c,
      diaAnteriorReferencia,
    };
  })
  .sort((a, b) => {
    const ia = DIAS.indexOf(
      a.diaAnteriorReferencia
    );

    const ib = DIAS.indexOf(
      b.diaAnteriorReferencia
    );

    if (ia !== ib) return ia - ib;

    const ordenA =
      a.orden === "" ||
      a.orden === null ||
      a.orden === undefined
        ? Infinity
        : Number(a.orden);

    const ordenB =
      b.orden === "" ||
      b.orden === null ||
      b.orden === undefined
        ? Infinity
        : Number(b.orden);

    if (ordenA !== ordenB) {
      return ordenA - ordenB;
    }

    return (a.nombre || "").localeCompare(
      b.nombre || ""
    );
  });

// Agrupamos visualmente por lunes, martes, miércoles, etc.
const gruposDiasAnteriores =
  diasAnterioresSemana
    .map((dia) => ({
      dia,
      clientes: clientesDiasAnteriores.filter(
        (c) =>
          c.diaAnteriorReferencia === dia
      ),
    }))
    .filter(
      (grupo) => grupo.clientes.length > 0
    );

  // ==========================================
  // TOTALES REALES DEL RECORRIDO
  // No dependen del buscador.
  // ==========================================
  const pendientesTotales = clientes.filter(
    (c) =>
      !visitaPorCliente.has(c.id) &&
      !c.pendienteDesde &&
      !c.citaSabado
  );

  const citasSabadoTotales = clientes.filter(
    (c) => !visitaPorCliente.has(c.id) && !!c.citaSabado
  );

  const pendientesAnterioresTotales = clientes.filter(
    (c) =>
      !visitaPorCliente.has(c.id) &&
      !!c.pendienteDesde &&
      !c.citaSabado
  );

  const volverMasTardeTotales = clientes.filter((c) =>
    esVolverMasTarde(visitaPorCliente.get(c.id))
  );

  const visitadosFinalizadosTotales = clientes.filter((c) => {
    const visita = visitaPorCliente.get(c.id);
    return visita && !esVolverMasTarde(visita);
  });

  // ==========================================
  // LISTAS VISIBLES - respetan el buscador.
  // ==========================================
  const pendientes = clientesFiltrados.filter(
    (c) =>
      !visitaPorCliente.has(c.id) &&
      !c.pendienteDesde &&
      !c.citaSabado
  );

  const citasSabado = clientesFiltrados
    .filter((c) => !visitaPorCliente.has(c.id) && !!c.citaSabado)
    .sort((a, b) => {
      const ordenA =
        a.orden === "" || a.orden === null || a.orden === undefined
          ? Infinity
          : Number(a.orden);
      const ordenB =
        b.orden === "" || b.orden === null || b.orden === undefined
          ? Infinity
          : Number(b.orden);

      if (ordenA !== ordenB) return ordenA - ordenB;
      return (a.nombre || "").localeCompare(b.nombre || "");
    });

  const pendientesAnteriores = clientesFiltrados.filter(
    (c) =>
      !visitaPorCliente.has(c.id) &&
      !!c.pendienteDesde &&
      !c.citaSabado
  );

  const volverMasTarde = clientesFiltrados.filter((c) =>
    esVolverMasTarde(visitaPorCliente.get(c.id))
  );

  const visitadosFinalizados = clientesFiltrados.filter((c) => {
    const visita = visitaPorCliente.get(c.id);
    return visita && !esVolverMasTarde(visita);
  });

  // ==========================================================
  // CLIENTES ATENDIDOS HOY DE MANERA EXTRAORDINARIA
  // No estaban originalmente en el recorrido del día.
  // ==========================================================
  const idsRecorridoActual = new Set(
    clientes.map((c) => c.id)
  );

  const visitadosExtraHoy = todosLosClientes.filter((c) => {
    // Si ya estaba en el recorrido normal, no lo agregamos nuevamente.
    if (idsRecorridoActual.has(c.id)) return false;

    const visita = visitaPorCliente.get(c.id);

    // Solamente mostramos clientes que efectivamente tuvieron una visita hoy.
    if (!visita) return false;

    // Si quedó para volver más tarde, todavía no lo consideramos finalizado.
    if (esVolverMasTarde(visita)) return false;

    // Respetamos también el buscador general.
    if (textoBusqueda) {
      const nombre = (c.nombre || "").toLowerCase();
      const direccion = (c.direccion || "").toLowerCase();

      if (
        !nombre.includes(textoBusqueda) &&
        !direccion.includes(textoBusqueda)
      ) {
        return false;
      }
    }

    return true;
  });

  const visitadosParaMostrar = [
    ...visitadosFinalizados,
    ...visitadosExtraHoy,
  ];

  function abrirNuevaVisita(cliente) {
    setActivo(cliente);
    setVisitaEditando(null);
  }

  function abrirVisitaExistente(cliente) {
    const visita = visitaPorCliente.get(cliente.id);
    if (!visita) return;
    setActivo(cliente);
    setVisitaEditando(visita);
  }

  // Devuelve al cliente al estado que tenía justo antes de la visita editada.
  function clienteAntesDeVisita(cliente, visita) {
    if (!visita) return cliente;

    const copia = clone(cliente);
    copia.deudaAcumulada = Math.max(
  0,
  (copia.deudaAcumulada || 0) -
    (visita.ajusteDeudaManual || 0) -
    (visita.deudaGenerada || 0) +
    (visita.deudaCobrada || 0)
);

    copia.envasesExtra = aplicarDeltaEnvases(
      envasesExtraDe(copia),
      calcularDeltaExtras(visita),
      -1
    );

    copia.envasesPermanentes = aplicarRetiroPermanentes(
      envasesPermanentesDe(copia),
      visita.permanentesRetirados,
      -1
    );

    return copia;
  }

  // Reconstruimos cuánto stock tenía la camioneta antes de la visita original.
  function stockAntesDeVisita(visita) {
    const actual = {
      ...stockVacio(),
      ...stockDeRepartidor(db, repartidor.id),
    };

    if (!visita) return actual;

    const deltaAnterior = calcularDeltaStockEnvases(visita);
    PRODUCTOS_RETORNABLES.forEach((p) => {
      actual[p.key] =
        (actual[p.key] || 0) + (deltaAnterior[p.key] || 0);
    });

    return actual;
  }

  function guardarVisita(cliente, nuevaVisita) {
    const next = clone(db);
    const anterior = visitaEditando;
    const ci = next.clientes.findIndex((c) => c.id === cliente.id);

    if (ci < 0) return;

    // Si editamos, primero revertimos el efecto de la visita anterior.
    if (anterior) {
      next.clientes[ci].deudaAcumulada = Math.max(
  0,
  (next.clientes[ci].deudaAcumulada || 0) -
    (anterior.ajusteDeudaManual || 0) -
    (anterior.deudaGenerada || 0) +
    (anterior.deudaCobrada || 0)
);

      next.clientes[ci].envasesExtra = aplicarDeltaEnvases(
        envasesExtraDe(next.clientes[ci]),
        calcularDeltaExtras(anterior),
        -1
      );

      next.clientes[ci].envasesPermanentes = aplicarRetiroPermanentes(
        envasesPermanentesDe(next.clientes[ci]),
        anterior.permanentesRetirados,
        -1
      );
    }

    // Aplicamos la nueva visita.
    let deuda = next.clientes[ci].deudaAcumulada || 0;

// Primero aplicamos cualquier corrección manual
// realizada por el repartidor.
deuda += nuevaVisita.ajusteDeudaManual || 0;

// Después descontamos lo que cobró.
deuda -= nuevaVisita.deudaCobrada || 0;

// Y finalmente agregamos el fiado nuevo
// generado por la venta de hoy.
deuda += nuevaVisita.deudaGenerada || 0;

next.clientes[ci].deudaAcumulada = Math.max(0, deuda);

    const deltaNuevo = calcularDeltaExtras(nuevaVisita);
    next.clientes[ci].envasesExtra = aplicarDeltaEnvases(
      envasesExtraDe(next.clientes[ci]),
      deltaNuevo,
      1
    );

    next.clientes[ci].envasesPermanentes = aplicarRetiroPermanentes(
      envasesPermanentesDe(next.clientes[ci]),
      nuevaVisita.permanentesRetirados,
      1
    );

    delete next.clientes[ci].envasesPrestados;

    // Guardamos o reemplazamos la visita del día.
    if (anterior) {
      const vi = next.visitas.findIndex((v) => v.id === anterior.id);
      if (vi >= 0) next.visitas[vi] = nuevaVisita;
    } else {
      next.visitas.push(nuevaVisita);
    }

    mutate(next, { history: false });

    // En stock aplicamos solamente la diferencia entre versión anterior y nueva.
    if (db.config.stockActivo) {
      const deltaStockNuevo = calcularDeltaStockEnvases(nuevaVisita);
      const deltaStockAnterior = anterior
        ? calcularDeltaStockEnvases(anterior)
        : {};
      const deltaNeto = {};

      PRODUCTOS_RETORNABLES.forEach((p) => {
        deltaNeto[p.key] =
          (deltaStockNuevo[p.key] || 0) -
          (deltaStockAnterior[p.key] || 0);
      });

      moverStockRepartidor(repartidor.id, deltaNeto);
    }

    setActivo(null);
    setVisitaEditando(null);
  }

  const clienteParaSheet =
    activo && visitaEditando
      ? clienteAntesDeVisita(activo, visitaEditando)
      : activo;

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <button
          onClick={onSalir}
          className="text-xs font-bold flex items-center gap-1"
          style={{ color: C.primary }}
        >
          <ArrowLeft size={14} />
          Volver a inicio
        </button>

        <Badge tone="accent">
          {visitadosFinalizadosTotales.length}/{clientes.length} completados
        </Badge>
      </div>

      <div className="relative mb-4">
        <Search
          size={16}
          color={C.mutedLight}
          style={{ position: "absolute", left: 11, top: 12 }}
        />
        <input
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="Buscar por nombre o dirección..."
          className="w-full rounded-xl pl-9 pr-9 py-2.5 text-sm outline-none"
          style={{
            background: C.surface,
            border: `1px solid ${C.border}`,
            color: C.ink,
          }}
        />
        {busca && (
          <button
            type="button"
            onClick={() => setBusca("")}
            style={{ position: "absolute", right: 10, top: 10 }}
          >
            <X size={18} color={C.muted} />
          </button>
        )}
      </div>

      {busca.trim() &&
        pendientes.length === 0 &&
        pendientesAnteriores.length === 0 &&
        citasSabado.length === 0 &&
        volverMasTarde.length === 0 &&
        visitadosFinalizados.length === 0 && (
          <Card className="mb-4">
            <div className="text-xs text-center" style={{ color: C.muted }}>
              No se encontraron clientes con "{busca}".
            </div>
          </Card>
        )}

      {/* PENDIENTES NORMALES DE HOY */}
      {pendientes.length > 0 && (
        <>
          <div
            className="text-xs font-bold uppercase tracking-wide mb-2"
            style={{ color: C.muted }}
          >
            Pendientes ({pendientes.length})
          </div>
          <div className="flex flex-col gap-2 mb-4">
            {pendientes.map((c) => (
              <ClienteVisitaCard
                key={c.id}
                cliente={c}
                onClick={() => abrirNuevaVisita(c)}
              />
            ))}
          </div>
        </>
      )}

      {/* PENDIENTES ARRASTRADOS DE DÍAS ANTERIORES */}
      {pendientesAnteriores.length > 0 && (
        <>
          <div
            className="text-xs font-bold uppercase tracking-wide mb-2"
            style={{ color: C.warning }}
          >
            Pendientes de días anteriores ({pendientesAnteriores.length})
          </div>
          <div className="flex flex-col gap-2 mb-4">
            {pendientesAnteriores.map((c) => (
              <ClienteVisitaCard
                key={c.id}
                cliente={c}
                pendienteAnterior
                pendienteDesde={c.pendienteDesde}
                onClick={() => abrirNuevaVisita(c)}
              />
            ))}
          </div>
        </>
      )}

      {/* CITAS PUNTUALES: VOLVER EL SÁBADO */}
      {citasSabado.length > 0 && (
        <>
          <div
            className="text-xs font-bold uppercase tracking-wide mb-2"
            style={{ color: C.warning }}
          >
            Volver el sábado ({citasSabado.length})
          </div>
          <div className="flex flex-col gap-2 mb-4">
            {citasSabado.map((c) => (
              <ClienteVisitaCard
                key={c.id}
                cliente={c}
                citaSabado
                onClick={() => abrirNuevaVisita(c)}
              />
            ))}
          </div>
        </>
      )}

      {/* CLIENTES PARA VOLVER MÁS TARDE EN EL MISMO DÍA */}
      {volverMasTarde.length > 0 && (
        <>
          <div
            className="text-xs font-bold uppercase tracking-wide mb-2"
            style={{ color: C.warning }}
          >
            Volver más tarde hoy ({volverMasTarde.length})
          </div>
          <div className="flex flex-col gap-2 mb-4">
            {volverMasTarde.map((c) => {
              const visita = visitaPorCliente.get(c.id);
              return (
                <ClienteVisitaCard
                  key={c.id}
                  cliente={c}
                  noVendido
                  volverMasTarde
                  visita={visita}
                  onClick={() => abrirVisitaExistente(c)}
                />
              );
            })}
          </div>
        </>
      )}

      {/* =====================================================
    CLIENTES DE DÍAS ANTERIORES
    ===================================================== */}
{diasAnterioresSemana.length > 0 && (
  <div className="mb-4">
    <button
      type="button"
      onClick={() =>
        setMostrarDiasAnteriores(
          !mostrarDiasAnteriores
        )
      }
      className="w-full rounded-xl px-3 py-3 flex items-center justify-between"
      style={{
        background: C.surface,
        border: `1px solid ${C.border}`,
      }}
    >
      <div className="flex items-center gap-2">
        <div
          className="w-8 h-8 rounded-lg flex items-center justify-center"
          style={{
            background: C.accentSoft,
          }}
        >
          <Users
            size={16}
            color={C.primary}
          />
        </div>

        <div className="text-left">
          <div className="text-sm font-bold">
            Clientes de días anteriores
          </div>

          <div
            className="text-[10px]"
            style={{ color: C.muted }}
          >
            {clientesDiasAnteriores.length} cliente
            {clientesDiasAnteriores.length !== 1
              ? "s"
              : ""}{" "}
            disponible
            {clientesDiasAnteriores.length !== 1
              ? "s"
              : ""}
          </div>
        </div>
      </div>

      <ChevronRight
        size={17}
        color={C.muted}
        style={{
          transform: mostrarDiasAnteriores
            ? "rotate(90deg)"
            : "rotate(0deg)",
          transition: "transform 0.2s",
        }}
      />
    </button>

    {mostrarDiasAnteriores && (
      <div className="mt-2">
        {/* BUSCADOR INTERNO */}
        <div className="relative mb-3">
          <Search
            size={15}
            color={C.mutedLight}
            style={{
              position: "absolute",
              left: 10,
              top: 11,
            }}
          />

          <input
            value={buscaDiasAnteriores}
            onChange={(e) =>
              setBuscaDiasAnteriores(
                e.target.value
              )
            }
            placeholder="Buscar cliente anterior..."
            className="w-full rounded-xl pl-8 pr-8 py-2.5 text-sm outline-none"
            style={{
              background: C.surface,
              border: `1px solid ${C.border}`,
              color: C.ink,
            }}
          />

          {buscaDiasAnteriores && (
            <button
              type="button"
              onClick={() =>
                setBuscaDiasAnteriores("")
              }
              style={{
                position: "absolute",
                right: 10,
                top: 10,
              }}
            >
              <X
                size={17}
                color={C.muted}
              />
            </button>
          )}
        </div>

        {clientesDiasAnteriores.length === 0 ? (
          <Card>
            <div
              className="text-xs text-center"
              style={{
                color: C.mutedLight,
              }}
            >
              {buscaDiasAnteriores
                ? "No encontramos clientes con esa búsqueda."
                : "No hay clientes disponibles de días anteriores."}
            </div>
          </Card>
        ) : (
          <div className="flex flex-col gap-4">
            {gruposDiasAnteriores.map(
              ({ dia, clientes: clientesGrupo }) => (
                <div key={dia}>
                  <div
                    className="text-[10px] font-extrabold uppercase tracking-wide mb-2 px-1"
                    style={{
                      color: C.primary,
                    }}
                  >
                    {dia}
                  </div>

                  <div className="flex flex-col gap-2">
                    {clientesGrupo.map((c) => (
                      <Card
                        key={`anterior-${c.id}`}
                        onClick={() =>
                          abrirNuevaVisita(c)
                        }
                        style={{
                          cursor: "pointer",
                        }}
                      >
                        <div className="flex items-start gap-2">
                          <div
                            className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
                            style={{
                              background:
                                C.accentSoft,
                              color: C.primary,
                            }}
                          >
                            <Plus size={15} />
                          </div>

                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <div className="font-bold text-sm">
                                {c.nombre}
                              </div>

                              <Badge tone="accent">
                                {dia.slice(0, 3)}
                              </Badge>
                            </div>

                            <div
                              className="text-xs"
                              style={{
                                color: C.muted,
                              }}
                            >
                              {c.direccion}
                            </div>

                            {Number(
                              c.deudaAcumulada
                            ) > 0 && (
                              <div className="mt-1">
                                <Badge tone="danger">
                                  Debe{" "}
                                  {formatMoney(
                                    c.deudaAcumulada
                                  )}
                                </Badge>
                              </div>
                            )}

                            <div
                              className="text-[10px] mt-1.5"
                              style={{
                                color:
                                  C.mutedLight,
                              }}
                            >
                              Tocar para registrar una
                              visita extraordinaria hoy
                            </div>
                          </div>

                          <ChevronRight
                            size={17}
                            color={C.mutedLight}
                          />
                        </div>
                      </Card>
                    ))}
                  </div>
                </div>
              )
            )}
          </div>
        )}
      </div>
    )}
  </div>
)}

      {/* CLIENTES VISITADOS Y FINALIZADOS */}
      {visitadosParaMostrar.length > 0 && (
        <div className="mb-4">
          <button
            type="button"
            onClick={() => setMostrarVisitados(!mostrarVisitados)}
            className="w-full rounded-xl px-3 py-3 flex items-center justify-between"
            style={{
              background: C.surface,
              border: `1px solid ${C.border}`,
            }}
          >
            <div className="flex items-center gap-2">
              <CheckCircle2 size={16} color={C.success} />
              <span className="text-sm font-bold">
                Clientes visitados ({visitadosParaMostrar.length})
              </span>
            </div>

            <ChevronRight
              size={17}
              color={C.muted}
              style={{
                transform:
                  mostrarVisitados || busca.trim()
                    ? "rotate(90deg)"
                    : "rotate(0deg)",
                transition: "transform 0.2s",
              }}
            />
          </button>

          {(mostrarVisitados || busca.trim()) && (
            <div className="flex flex-col gap-2 mt-2">
              {visitadosParaMostrar.map((c) => {
                const visita = visitaPorCliente.get(c.id);
                const fueVenta = visita?.vendio === true;

                return (
                  <ClienteVisitaCard
                    key={c.id}
                    cliente={c}
                    hecho={fueVenta}
                    noVendido={!fueVenta}
                    visita={visita}
                    onClick={() => abrirVisitaExistente(c)}
                  />
                );
              })}
            </div>
          )}
        </div>
      )}

      {pendientesTotales.length === 0 &&
        pendientesAnterioresTotales.length === 0 &&
        citasSabadoTotales.length === 0 &&
        volverMasTardeTotales.length === 0 &&
        clientes.length > 0 && (
          <Card
            style={{ background: C.successBg, border: "none" }}
            className="mt-3 flex items-center gap-2"
          >
            <CheckCircle2 size={20} color={C.success} />
            <div className="text-sm font-bold" style={{ color: C.success }}>
              ¡Recorrido completo!
            </div>
          </Card>
        )}

      {clienteParaSheet && (
        <VisitaSheet
          cliente={clienteParaSheet}
          visitaInicial={visitaEditando}
          precios={db.config.precios}
          stockActivo={db.config.stockActivo}
          stockRepartidor={stockAntesDeVisita(visitaEditando)}
          historialVisitas={db.visitas.filter(
            (v) => v.clienteId === clienteParaSheet.id
          )}
          onClose={() => {
            setActivo(null);
            setVisitaEditando(null);
          }}
          onGuardar={(visita) => guardarVisita(activo, visita)}
        />
      )}
    </div>
  );
}

function ClienteVisitaCard({
  cliente,
  hecho,
  noVendido,
  volverMasTarde = false,
  pendienteAnterior = false,
  pendienteDesde = null,
  citaSabado = false,
  visita,
  onClick,
}) {
  const permanentes = envasesPermanentesDe(cliente);
  const extras = envasesExtraDe(cliente);

  const tieneOrden =
    cliente.orden !== "" &&
    cliente.orden !== null &&
    cliente.orden !== undefined;

  return (
    <Card
      onClick={onClick}
      style={{
        opacity: hecho ? 0.8 : 1,
        cursor: "pointer",
      }}
    >
      <div className="flex items-start gap-2">
        <div
          className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 font-extrabold text-xs"
          style={{
            background: hecho
              ? C.successBg
              : noVendido || pendienteAnterior
              ? C.warningBg
              : C.accentSoft,
            color: hecho
              ? C.success
              : noVendido || pendienteAnterior
              ? C.warning
              : C.primary,
          }}
        >
          {tieneOrden ? (
            cliente.orden
          ) : hecho ? (
            <Check size={15} />
          ) : (
            <Circle size={15} />
          )}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <div className="font-bold text-sm">{cliente.nombre}</div>

            {pendienteAnterior && (
              <Badge tone="warning">Pendiente anterior</Badge>
            )}

            {citaSabado && (
              <Badge tone="warning">Volver sábado</Badge>
            )}

            {hecho && <Badge tone="success">Vendido</Badge>}

            {noVendido && (
              <Badge tone="warning">
                {volverMasTarde ? "Volver más tarde" : "No se vendió"}
              </Badge>
            )}
          </div>

          <a
            href={urlGoogleMaps(cliente.direccion)}
            target="_blank"
            rel="noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="text-xs flex items-center gap-1 w-fit"
            style={{ color: C.primary }}
          >
            <MapPin size={12} />
            <span>{cliente.direccion}</span>
          </a>

          {cliente.deudaAcumulada > 0 && (
            <div
              className="rounded-xl px-3 py-2 mt-2"
              style={{
                background: C.dangerBg,
                border: `1px solid ${C.danger}`,
              }}
            >
              <div
                className="text-[10px] font-extrabold uppercase tracking-wide"
                style={{ color: C.danger }}
              >
                Saldo pendiente
              </div>

              <div
                className="font-mono font-extrabold text-base"
                style={{ color: C.danger }}
              >
                {formatMoney(cliente.deudaAcumulada)}
              </div>
            </div>
          )}

          {pendienteAnterior && pendienteDesde && (
            <div
              className="text-xs font-semibold mt-1"
              style={{ color: C.warning }}
            >
              Pendiente desde: {diaSemanaDeFecha(pendienteDesde)}{" "}
              {fechaLegible(pendienteDesde)}
            </div>
          )}

          {noVendido && visita?.notas && !volverMasTarde && (
            <div
              className="text-xs font-semibold mt-1"
              style={{ color: C.warning }}
            >
              {visita.notas}
            </div>
          )}

          <div className="flex flex-wrap gap-1 mt-1">
            {totalEnvasesPrestados(permanentes) > 0 && (
              <Badge tone="accent">
                Permanentes: {textoEnvasesPrestados(permanentes)}
              </Badge>
            )}

            {totalEnvasesPrestados(extras) > 0 && (
              <Badge tone="warning">
                Extra: {textoEnvasesPrestados(extras)}
              </Badge>
            )}

            {cliente.maquinaFrioCalor && (
              <Badge tone="accent">Máquina F/C</Badge>
            )}

            {cliente.notas && <Badge tone="muted">Nota</Badge>}
          </div>

          {citaSabado && !pendienteAnterior && (
            <div className="text-[10px] mt-1.5" style={{ color: C.mutedLight }}>
              Visita especial programada para hoy
            </div>
          )}

          {pendienteAnterior && (
            <div className="text-[10px] mt-1.5" style={{ color: C.mutedLight }}>
              Tocar para atender este pendiente
            </div>
          )}

          {(hecho || noVendido) && (
            <div className="text-[10px] mt-1.5" style={{ color: C.mutedLight }}>
              {volverMasTarde
                ? "Tocar para registrar el segundo intento"
                : "Tocar para editar la visita de hoy"}
            </div>
          )}
        </div>

        <div
          className="flex gap-1 flex-shrink-0"
          onClick={(e) => e.stopPropagation()}
        >
          {cliente.telefono && (
            <a
              href={urlWhatsApp(cliente.telefono)}
              target="_blank"
              rel="noreferrer"
              className="p-1.5 rounded-lg"
              style={{ background: C.successBg }}
              aria-label={`Abrir WhatsApp de ${cliente.nombre}`}
              title="Abrir WhatsApp"
            >
              <MessageCircle size={13} color={C.success} />
            </a>
          )}

          <a
            href={urlGoogleMaps(cliente.direccion)}
            target="_blank"
            rel="noreferrer"
            className="p-1.5 rounded-lg"
            style={{ background: C.bg }}
            aria-label={`Abrir ubicación de ${cliente.nombre}`}
            title="Abrir en Google Maps"
          >
            <MapPin size={13} color={C.primary} />
          </a>
        </div>
      </div>
    </Card>
  );
}

function esVolverMasTarde(visita) {
  return (
    visita &&
    !visita.vendio &&
    (visita.notas || "").trim() === "Volver más tarde"
  );
}

const NOTAS_RAPIDAS = ["No estaba", "No quiso hoy", "Volver más tarde"];

function VisitaSheet({
  cliente,
  visitaInicial = null,
  precios,
  stockActivo,
  stockRepartidor,
  historialVisitas = [],
  onClose,
  onGuardar,
}) {
  const permanentes = envasesPermanentesDe(cliente);
  const saldoActual = envasesExtraDe(cliente);
  // Deuda que tenía el cliente ANTES de esta visita.
const deudaBase = Number(cliente.deudaAcumulada) || 0;

  const esVisitaVieja =
    visitaInicial &&
    !visitaInicial.extrasPrestados &&
    !visitaInicial.extrasRetirados;

  const deltaViejo = esVisitaVieja
    ? calcularDeltaEnvases(visitaInicial)
    : {};

  const [vendio, setVendio] = useState(
    visitaInicial ? visitaInicial.vendio : true
  );

  const [items, setItems] = useState(() =>
    PRODUCTOS.map((p) => {
      const anterior = visitaInicial?.items?.find(
        (it) => it.tipo === p.key
      );

      return {
        tipo: p.key,
        cantidad: anterior?.cantidad || 0,
        // Al editar conservamos el precio que tenía la visita original.
        precioUnitario:
          anterior?.precioUnitario ??
          precios[p.key] ??
          0,
      };
    })
  );

  const [extrasPrestados, setExtrasPrestados] = useState(() => {
    const inicial = stockVacio();

    PRODUCTOS_RETORNABLES.forEach((p) => {
      if (visitaInicial?.extrasPrestados) {
        inicial[p.key] =
          Number(visitaInicial.extrasPrestados[p.key]) || 0;
      } else {
        inicial[p.key] = Math.max(
          0,
          Number(deltaViejo[p.key]) || 0
        );
      }
    });

    return inicial;
  });

  // Este estado representa el TOTAL retirado por producto.
  // Al guardar se reparte: primero extras, y si no alcanzan, permanentes.
  const [extrasRetirados, setExtrasRetirados] = useState(() => {
    const inicial = stockVacio();

    PRODUCTOS_RETORNABLES.forEach((p) => {
      if (
        visitaInicial?.extrasRetirados ||
        visitaInicial?.permanentesRetirados
      ) {
        inicial[p.key] =
          (Number(visitaInicial?.extrasRetirados?.[p.key]) || 0) +
          (Number(visitaInicial?.permanentesRetirados?.[p.key]) || 0);
      } else {
        inicial[p.key] = Math.max(
          0,
          -(Number(deltaViejo[p.key]) || 0)
        );
      }
    });

    return inicial;
  });

  const [extrasTocados, setExtrasTocados] = useState(() => {
    const tocados = new Set();

    PRODUCTOS_RETORNABLES.forEach((p) => {
      const prestados = visitaInicial?.extrasPrestados
        ? Number(visitaInicial.extrasPrestados[p.key]) || 0
        : Math.max(0, Number(deltaViejo[p.key]) || 0);

      const retirados =
        visitaInicial?.extrasRetirados || visitaInicial?.permanentesRetirados
          ? (Number(visitaInicial?.extrasRetirados?.[p.key]) || 0) +
            (Number(visitaInicial?.permanentesRetirados?.[p.key]) || 0)
          : Math.max(0, -(Number(deltaViejo[p.key]) || 0));

      if (prestados > 0 || retirados > 0) {
        tocados.add(p.key);
      }
    });

    return tocados;
  });

  const [metodoPago, setMetodoPago] = useState(
    visitaInicial?.metodoPago || "efectivo"
  );

  const [montoPagado, setMontoPagado] = useState(() => {
    if (
      !visitaInicial ||
      !visitaInicial.vendio ||
      visitaInicial.metodoPago === "deuda"
    ) {
      return null;
    }

    // Si estaba totalmente pago usamos null para que siga
    // automáticamente el nuevo total si cambia la cantidad.
    if ((visitaInicial.deudaGenerada || 0) === 0) {
      return null;
    }

    return Math.max(
      0,
      (visitaInicial.total || 0) -
        (visitaInicial.deudaGenerada || 0)
    );
  });

  const [mostrarAjusteSaldo, setMostrarAjusteSaldo] =
  useState(false);

const [saldoPendienteManual, setSaldoPendienteManual] =
  useState(() =>
    Math.max(
      0,
      deudaBase +
        (Number(visitaInicial?.ajusteDeudaManual) || 0)
    )
  );

  const [cobrarDeuda, setCobrarDeuda] = useState(
    (visitaInicial?.deudaCobrada || 0) > 0
  );

const [montoDeuda, setMontoDeuda] = useState(
  visitaInicial?.deudaCobrada > 0
    ? visitaInicial.deudaCobrada
    : Math.max(
        0,
        deudaBase +
          (Number(visitaInicial?.ajusteDeudaManual) || 0)
      )
);

  const [metodoDeuda, setMetodoDeuda] = useState(
    visitaInicial?.metodoDeuda || "efectivo"
  );

  const [notas, setNotas] = useState(
    visitaInicial?.notas || ""
  );

  const [volverSabado, setVolverSabado] = useState(
    !!visitaInicial?.volverSabadoFecha
  );

  const fechaVolverSabado =
    visitaInicial?.volverSabadoFecha ||
    proximoSabadoISO(visitaInicial?.fecha || hoyISO());

  const [errorStock, setErrorStock] = useState("");

  // Historial rápido dentro de la visita. Se mantiene cerrado por defecto
  // para no molestar durante el reparto y se consulta solo cuando hace falta.
  const [mostrarHistorialCompras, setMostrarHistorialCompras] =
    useState(false);

  // Al editar una visita, excluimos esa misma visita del historial porque
  // ya está abierta en el formulario actual. El resto queda ordenado de
  // más reciente a más antiguo.
  const visitasHistorialCliente = useMemo(() => {
    return (historialVisitas || [])
      .filter((v) => v.id !== visitaInicial?.id)
      .slice()
      .sort((a, b) => {
        const porFecha = (b.fecha || "").localeCompare(a.fecha || "");
        if (porFecha !== 0) return porFecha;
        return (b.timestamp || 0) - (a.timestamp || 0);
      });
  }, [historialVisitas, visitaInicial?.id]);

  const gruposHistorialCliente = useMemo(() => {
    const grupos = {};

    visitasHistorialCliente.forEach((v) => {
      const mes = (v.fecha || "").slice(0, 7) || "sin-fecha";
      if (!grupos[mes]) grupos[mes] = [];
      grupos[mes].push(v);
    });

    return Object.entries(grupos);
  }, [visitasHistorialCliente]);

  const [mostrarExtras, setMostrarExtras] = useState(() => {
  // Si estamos editando una visita que ya tuvo
  // préstamos o retiros, abrir automáticamente.
  if (!visitaInicial) return false;

  return PRODUCTOS_RETORNABLES.some((p) => {
    const prestados =
      Number(visitaInicial.extrasPrestados?.[p.key]) || 0;

    const retirados =
      (Number(visitaInicial.extrasRetirados?.[p.key]) || 0) +
      (Number(visitaInicial.permanentesRetirados?.[p.key]) || 0);

    return prestados > 0 || retirados > 0;
  });
});

useEffect(() => {
  const hayMovimientoExtra =
    PRODUCTOS_RETORNABLES.some((p) => {
      const prestados =
        Number(extrasPrestados[p.key]) || 0;

      const retirados =
        Number(extrasRetirados[p.key]) || 0;

      return prestados > 0 || retirados > 0;
    });

  if (hayMovimientoExtra) {
    setMostrarExtras(true);
  }
}, [extrasPrestados, extrasRetirados]);

  const total = totalPedido(items);

  const pagadoFinal =
    montoPagado === null
      ? total
      : Math.max(0, Number(montoPagado) || 0);

  const restante = Math.max(0, total - pagadoFinal);

  // ==========================================================
  // DEUDA / FIADO DE ESTA VISITA
  //
  // IMPORTANTE:
  // - saldoBaseEditado = deuda que el cliente tenía antes de
  //   considerar el cobro y la venta actual.
  // - deudaCobradaPrevista = lo que paga de deuda anterior.
  // - deudaGeneradaPrevista = lo nuevo que queda fiado HOY.
  // - saldoFinalPrevisto = lo que realmente quedará debiendo.
  //
  // Esta MISMA cuenta se usa luego al guardar, para evitar que
  // la pantalla muestre una cosa y Firebase guarde otra.
  // ==========================================================
  const saldoBaseEditado = Math.max(
    0,
    Number(saldoPendienteManual) || 0
  );

  const deudaCobradaPrevista = cobrarDeuda
    ? Math.max(0, Number(montoDeuda) || 0)
    : 0;

  const deudaGeneradaPrevista = vendio
    ? metodoPago === "deuda"
      ? total
      : restante
    : 0;

  const ajusteManualPrevisto =
    saldoBaseEditado - deudaBase;

  const saldoFinalPrevisto = Math.max(
    0,
    saldoBaseEditado -
      deudaCobradaPrevista +
      deudaGeneradaPrevista
  );

  function actualizarCantidad(idx, valor) {
    const p = PRODUCTOS[idx];

    setErrorStock("");

    setItems((prev) =>
      prev.map((it, i) =>
        i === idx ? { ...it, cantidad: valor } : it
      )
    );

    // Sugerimos el préstamo extra necesario según los envases
    // que el cliente ya tiene (permanentes + extras actuales).
    if (p.retornable && !extrasTocados.has(p.key)) {
      const permanentesActuales =
        Number(permanentes[p.key]) || 0;
      const extrasActuales =
        Number(saldoActual[p.key]) || 0;
      const envasesQueYaTiene =
        permanentesActuales + extrasActuales;

      const sugerido = Math.max(
        0,
        Number(valor) - envasesQueYaTiene
      );

      setExtrasPrestados((prev) => ({
        ...prev,
        [p.key]: sugerido,
      }));
    }
  }

  function cambiarExtraPrestado(tipo, valor) {
    setErrorStock("");

    setExtrasTocados((prev) => {
      const siguiente = new Set(prev);
      siguiente.add(tipo);
      return siguiente;
    });

    setExtrasPrestados((prev) => ({
      ...prev,
      [tipo]: Math.max(0, Number(valor) || 0),
    }));
  }

  function cambiarExtraRetirado(tipo, valor) {
    setErrorStock("");

    setExtrasTocados((prev) => {
      const siguiente = new Set(prev);
      siguiente.add(tipo);
      return siguiente;
    });

    setExtrasRetirados((prev) => ({
      ...prev,
      [tipo]: Math.max(0, Number(valor) || 0),
    }));
  }

  function guardar() {
    setErrorStock("");

    // Los únicos movimientos que cambian el stock físico de envases
    // de la camioneta son los extras prestados o retirados.
    if (stockActivo) {
      for (const p of PRODUCTOS_RETORNABLES) {
        const prestados =
          Number(extrasPrestados[p.key]) || 0;
        const retirados =
          Number(extrasRetirados[p.key]) || 0;
        const disponible =
          Number(stockRepartidor?.[p.key]) || 0;

        // Lo retirado vuelve a la camioneta y puede compensar
        // un préstamo realizado en la misma visita.
        const disponibleFinal =
          disponible + retirados;

        if (prestados > disponibleFinal) {
          setErrorStock(
            `No hay suficientes ${p.label} para prestar. La camioneta tiene ${disponible}, retira ${retirados} y estás intentando prestar ${prestados}.`
          );
          return;
        }
      }
    }

    // Se pueden retirar envases EXTRA y, si no alcanzan,
    // también PERMANENTES. Nunca más de los que el cliente tiene en total.
    for (const p of PRODUCTOS_RETORNABLES) {
      const extraActual = Number(saldoActual[p.key]) || 0;
      const permanenteActual = Number(permanentes[p.key]) || 0;
      const totalCliente = extraActual + permanenteActual;
      const retirados = Number(extrasRetirados[p.key]) || 0;

      if (retirados > totalCliente) {
        setErrorStock(
          `${cliente.nombre} tiene ${totalCliente} ${p.label} en total (${extraActual} extra + ${permanenteActual} permanentes). No podés retirar ${retirados}.`
        );
        return;
      }
    }

    // Repartimos lo retirado: primero salen extras y después permanentes.
    const extrasRetiradosSeparados = stockVacio();
    const permanentesRetiradosSeparados = stockVacio();

    PRODUCTOS_RETORNABLES.forEach((p) => {
      const totalRetirado = Number(extrasRetirados[p.key]) || 0;
      const extraActual = Number(saldoActual[p.key]) || 0;

      const deExtras = Math.min(totalRetirado, extraActual);
      const dePermanentes = Math.max(0, totalRetirado - deExtras);

      extrasRetiradosSeparados[p.key] = deExtras;
      permanentesRetiradosSeparados[p.key] = dePermanentes;
    });

    // Usamos exactamente los mismos valores que se muestran
    // en la previsualización de "Saldo final".
    const saldoManualFinal = saldoBaseEditado;
    const deudaCobradaFinal = deudaCobradaPrevista;
    const deudaGeneradaFinal = deudaGeneradaPrevista;

// No permitimos cobrar más deuda de la que
// el cliente tiene registrada en este momento.
if (deudaCobradaFinal > saldoManualFinal) {
  setErrorStock(
    `No podés cobrar ${formatMoney(
      deudaCobradaFinal
    )}. El saldo pendiente actual es ${formatMoney(
      saldoManualFinal
    )}.`
  );
  return;
}

// Puede ser positivo o negativo.
// Ej:
// tenía $0 y ponemos $15.000  => +15.000
// tenía $20.000 y ponemos $15.000 => -5.000
const ajusteDeudaManual =
  saldoManualFinal - deudaBase;

    const visita = {
      id: visitaInicial?.id || uid(),
      clienteId: cliente.id,
      clienteNombre: cliente.nombre,
      repartidorId: cliente.repartidorId,
      fecha: hoyISO(),
      diaSemana: diaSemanaHoy(),
      vendio,
      items: vendio ? items : [],
      extrasPrestados: {
        b20: Number(extrasPrestados.b20) || 0,
        b12: Number(extrasPrestados.b12) || 0,
        sifon: Number(extrasPrestados.sifon) || 0,
      },
      extrasRetirados: {
        b20: Number(extrasRetiradosSeparados.b20) || 0,
        b12: Number(extrasRetiradosSeparados.b12) || 0,
        sifon: Number(extrasRetiradosSeparados.sifon) || 0,
      },
      permanentesRetirados: {
        b20: Number(permanentesRetiradosSeparados.b20) || 0,
        b12: Number(permanentesRetiradosSeparados.b12) || 0,
        sifon: Number(permanentesRetiradosSeparados.sifon) || 0,
      },
      total: vendio ? total : 0,
      metodoPago: vendio ? metodoPago : null,
      pagos:
        vendio && metodoPago !== "deuda"
          ? { [metodoPago]: pagadoFinal }
          : {},
      // Deuda NUEVA generada por esta venta.
      // Ej.: 7 sifones × $1.200 fiados = $8.400.
      deudaGenerada: deudaGeneradaFinal,
      ajusteDeudaManual,

deudaCobrada: deudaCobradaFinal,

      metodoDeuda: cobrarDeuda
        ? metodoDeuda
        : null,
      notas,
      volverSabadoFecha: volverSabado ? fechaVolverSabado : null,
      timestamp:
        visitaInicial?.timestamp || Date.now(),
      editadoEl: visitaInicial ? Date.now() : null,
    };

    // Las visitas nuevas ya no usan "retornos".
    // Si estamos editando una visita antigua, al guardarla queda
    // migrada automáticamente al nuevo modelo de extras.
    if (visita.deudaCobrada) {
      visita.pagos = {
        ...visita.pagos,
        [metodoDeuda]:
          (visita.pagos[metodoDeuda] || 0) +
          visita.deudaCobrada,
      };
    }

    onGuardar(visita);
  }

  return (
    <Sheet
      title={
        visitaInicial
          ? `${cliente.nombre} · Editar visita`
          : cliente.nombre
      }
      onClose={onClose}
      closeOnBackdrop={false}
      footer={
        <Btn
          full
          size="lg"
          onClick={guardar}
          icon={Check}
        >
          {visitaInicial
            ? "Guardar cambios"
            : "Guardar visita"}
        </Btn>
      }
    >
      <div className="flex flex-wrap gap-2 mb-3">
        {cliente.direccion && (
          <a
            href={urlGoogleMaps(cliente.direccion)}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold"
            style={{ background: C.accentSoft, color: C.primary }}
          >
            <MapPin size={13} />
            <span>{cliente.direccion}</span>
          </a>
        )}

        {cliente.telefono && (
          <a
            href={urlWhatsApp(cliente.telefono)}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold"
            style={{ background: C.successBg, color: C.success }}
          >
            <MessageCircle size={13} />
            <span>WhatsApp · {cliente.telefono}</span>
          </a>
        )}
      </div>

      {(totalEnvasesPrestados(permanentes) > 0 ||
        totalEnvasesPrestados(saldoActual) > 0) && (
        <Card className="mb-3">
          <div
            className="text-[11px] font-bold uppercase tracking-wide mb-1"
            style={{ color: C.muted }}
          >
            Envases del cliente
          </div>

          <div className="flex gap-1.5 flex-wrap">
            {totalEnvasesPrestados(permanentes) > 0 && (
              <Badge tone="accent">
                Permanentes:{" "}
                {textoEnvasesPrestados(permanentes)}
              </Badge>
            )}

            {totalEnvasesPrestados(saldoActual) > 0 && (
              <Badge tone="warning">
                Extra:{" "}
                {textoEnvasesPrestados(saldoActual)}
              </Badge>
            )}
          </div>
        </Card>
      )}

      {stockActivo && (
        <Card
          style={{
            background: C.accentSoft,
            border: "none",
          }}
          className="mb-3"
        >
          <div
            className="text-[11px] font-bold uppercase tracking-wide mb-1"
            style={{ color: C.primary }}
          >
            Stock de envases en camioneta
          </div>

          <div className="flex gap-2 flex-wrap">
            {PRODUCTOS_RETORNABLES.map((p) => (
              <Badge key={p.key} tone="accent">
                {p.corto}:{" "}
                {Number(stockRepartidor?.[p.key]) || 0}
              </Badge>
            ))}
          </div>
        </Card>
      )}


      {/* =====================================================
          HISTORIAL RÁPIDO DEL CLIENTE DURANTE EL REPARTO
          Cerrado por defecto. No permite editar visitas viejas.
          ===================================================== */}
      <div className="mb-3">
        <button
          type="button"
          onClick={() =>
            setMostrarHistorialCompras(!mostrarHistorialCompras)
          }
          className="w-full rounded-xl px-3 py-3 flex items-center justify-between"
          style={{
            background: C.surface,
            border: `1px solid ${C.border}`,
          }}
        >
          <div className="flex items-center gap-2 min-w-0">
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{ background: C.accentSoft }}
            >
              <ClipboardList size={17} color={C.primary} />
            </div>

            <div className="text-left min-w-0">
              <div className="text-xs font-extrabold" style={{ color: C.ink }}>
                Historial de compras
              </div>
              <div className="text-[10px] truncate" style={{ color: C.muted }}>
                {visitasHistorialCliente.length === 0
                  ? "Sin visitas anteriores"
                  : `${visitasHistorialCliente.length} visita${
                      visitasHistorialCliente.length !== 1 ? "s" : ""
                    } anterior${
                      visitasHistorialCliente.length !== 1 ? "es" : ""
                    }`}
              </div>
            </div>
          </div>

          <ChevronRight
            size={18}
            color={C.muted}
            style={{
              transform: mostrarHistorialCompras
                ? "rotate(90deg)"
                : "rotate(0deg)",
              transition: "transform 0.2s",
            }}
          />
        </button>

        {mostrarHistorialCompras && (
          <div
            className="mt-1 rounded-2xl p-3"
            style={{
              background: C.bg,
              border: `1px solid ${C.border}`,
              borderTopLeftRadius: 0,
              borderTopRightRadius: 0,
            }}
          >
            {visitasHistorialCliente.length === 0 ? (
              <div
                className="text-xs text-center py-4"
                style={{ color: C.mutedLight }}
              >
                Este cliente todavía no tiene visitas anteriores registradas.
              </div>
            ) : (
              <div className="flex flex-col gap-4">
                {gruposHistorialCliente.map(([mes, visitasMes]) => {
                  let tituloMes = mes;

                  if (mes !== "sin-fecha") {
                    const [anio, numeroMes] = mes.split("-");
                    const nombreMes = NOMBRES_MES[Number(numeroMes) - 1];
                    tituloMes = nombreMes
                      ? `${nombreMes} ${anio}`
                      : mes;
                  }

                  return (
                    <div key={mes}>
                      <div
                        className="text-[10px] font-extrabold uppercase tracking-wide mb-2 px-1"
                        style={{ color: C.primary }}
                      >
                        {tituloMes}
                      </div>

                      <div className="flex flex-col gap-2">
                        {visitasMes.map((v) => {
                          const productos = (v.items || [])
                            .filter((it) => (Number(it.cantidad) || 0) > 0)
                            .map((it) => {
                              const producto = PRODUCTOS.find(
                                (p) => p.key === it.tipo
                              );
                              return `${it.cantidad}× ${
                                producto?.corto || it.tipo
                              }`;
                            })
                            .join(", ");

                          const metodo = {
                            efectivo: "Efectivo",
                            mercadopago: "Mercado Pago",
                            deuda: "Fiado",
                          }[v.metodoPago];

                          return (
                            <div
                              key={v.id}
                              className="rounded-xl px-3 py-2.5"
                              style={{
                                background: C.surface,
                                border: `1px solid ${C.border}`,
                              }}
                            >
                              <div className="flex items-start justify-between gap-2">
                                <div>
                                  <div
                                    className="text-[10px] font-bold"
                                    style={{ color: C.muted }}
                                  >
                                    {v.fecha ? fechaLegible(v.fecha) : "Sin fecha"}
                                  </div>

                                  {v.vendio && productos && (
                                    <div className="text-xs font-semibold mt-0.5">
                                      {productos}
                                    </div>
                                  )}
                                </div>

                                {v.vendio ? (
                                  <Badge tone="success">
                                    {formatMoney(v.total || 0)}
                                  </Badge>
                                ) : (
                                  <Badge tone="muted">No vendió</Badge>
                                )}
                              </div>

                              {v.vendio && metodo && (
                                <div
                                  className="text-[10px] mt-1"
                                  style={{ color: C.muted }}
                                >
                                  {metodo}
                                  {(Number(v.deudaGenerada) || 0) > 0 &&
                                    ` · Fiado ${formatMoney(
                                      v.deudaGenerada
                                    )}`}
                                </div>
                              )}

                              {(Number(v.deudaCobrada) || 0) > 0 && (
                                <div
                                  className="text-[10px] mt-1 font-semibold"
                                  style={{ color: C.success }}
                                >
                                  Cobró deuda anterior: {formatMoney(v.deudaCobrada)}
                                </div>
                              )}

                              {textoExtrasPrestados(v) && (
                                <div
                                  className="text-[10px] mt-1"
                                  style={{ color: C.warning }}
                                >
                                  Prestó extra: {textoExtrasPrestados(v)}
                                </div>
                              )}

                              {textoExtrasRetirados(v) && (
                                <div
                                  className="text-[10px] mt-1"
                                  style={{ color: C.success }}
                                >
                                  Retiró extra: {textoExtrasRetirados(v)}
                                </div>
                              )}

                              {textoPermanentesRetirados(v) && (
                                <div
                                  className="text-[10px] mt-1"
                                  style={{ color: C.success }}
                                >
                                  Devolvió permanente: {textoPermanentesRetirados(v)}
                                </div>
                              )}

                              {v.volverSabadoFecha && (
                                <div
                                  className="text-[10px] mt-1"
                                  style={{ color: C.warning }}
                                >
                                  Volver sábado: {fechaLegible(v.volverSabadoFecha)}
                                </div>
                              )}

                              {v.notas && (
                                <div
                                  className="text-[10px] mt-1 italic"
                                  style={{ color: C.mutedLight }}
                                >
                                  {v.notas}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      <div className="mb-3">
  <button
    type="button"
    onClick={() =>
      setMostrarAjusteSaldo(!mostrarAjusteSaldo)
    }
    className="w-full rounded-xl px-3 py-3 flex items-center justify-between"
    style={{
      background:
        Number(saldoPendienteManual) > 0
          ? C.dangerBg
          : C.surface,
      border: `1px solid ${
        Number(saldoPendienteManual) > 0
          ? C.danger
          : C.border
      }`,
    }}
  >
    <div className="text-left">
      <div
        className="text-xs font-bold"
        style={{
          color:
            Number(saldoPendienteManual) > 0
              ? C.danger
              : C.ink,
        }}
      >
        Saldo pendiente
      </div>

      <div
        className="text-[10px]"
        style={{ color: C.muted }}
      >
        {Number(saldoPendienteManual) > 0
          ? formatMoney(saldoPendienteManual)
          : "Sin deuda anterior"}
      </div>
    </div>

    <ChevronRight
      size={17}
      color={
        Number(saldoPendienteManual) > 0
          ? C.danger
          : C.muted
      }
      style={{
        transform: mostrarAjusteSaldo
          ? "rotate(90deg)"
          : "rotate(0deg)",
        transition: "transform 0.2s",
      }}
    />
  </button>

  {mostrarAjusteSaldo && (
    <Card
      className="mt-1"
      style={{
        background: C.dangerBg,
        border: "none",
        borderTopLeftRadius: 0,
        borderTopRightRadius: 0,
      }}
    >
      <Field
        label="Saldo anterior / pendiente"
        hint="Es la deuda que tenía el cliente antes de aplicar el cobro y el fiado de esta visita. También podés corregirla manualmente."
      >
        <Input
          type="number"
          inputMode="decimal"
          min="0"
          value={saldoPendienteManual || ""}
          onChange={(e) => {
            const nuevoSaldo = Math.max(
              0,
              Number(e.target.value) || 0
            );

            setSaldoPendienteManual(nuevoSaldo);

            // Si todavía no está cobrando,
            // dejamos preparado el total como
            // monto sugerido para cobrar.
            if (!cobrarDeuda) {
              setMontoDeuda(nuevoSaldo);
            } else {
              // Si ya estaba cobrando y reduce
              // la deuda, evitamos cobrar más
              // que el nuevo saldo.
              setMontoDeuda((anterior) =>
                Math.min(
                  Number(anterior) || 0,
                  nuevoSaldo
                )
              );
            }

            if (nuevoSaldo === 0) {
              setCobrarDeuda(false);
              setMontoDeuda(0);
            }
          }}
          placeholder="0"
        />
      </Field>

      {Number(saldoPendienteManual) !== deudaBase && (
        <div
          className="text-[10px] font-semibold"
          style={{ color: C.danger }}
        >
          Saldo anterior: {formatMoney(deudaBase)}
          {" → "}
          Nuevo saldo:{" "}
          {formatMoney(saldoPendienteManual)}
        </div>
      )}
    </Card>
  )}
</div>

      {Number(saldoPendienteManual) > 0 && (
        <Card
          style={{
            background: C.dangerBg,
            border: "none",
          }}
          className="mb-3"
        >
          <div className="flex items-center justify-between mb-2">
            <div
              className="text-xs font-bold"
              style={{ color: C.danger }}
            >
              Deuda anterior: {formatMoney(saldoPendienteManual)}
            </div>

            <button
              onClick={() =>
                setCobrarDeuda(!cobrarDeuda)
              }
              className="px-2.5 py-1 rounded-lg text-xs font-bold"
              style={{
                background: cobrarDeuda
                  ? C.danger
                  : "#fff",
                color: cobrarDeuda
                  ? "#fff"
                  : C.danger,
                border: `1px solid ${C.danger}`,
              }}
            >
              {cobrarDeuda
                ? "Cobrando"
                : "Cobrar deuda"}
            </button>
          </div>

          {cobrarDeuda && (
            <div className="flex gap-2 items-center">
              <Input
                type="number"
                inputMode="decimal"
                value={montoDeuda}
                onChange={(e) =>
                  setMontoDeuda(e.target.value)
                }
                style={{ flex: 1 }}
              />

              <select
                value={metodoDeuda}
                onChange={(e) =>
                  setMetodoDeuda(e.target.value)
                }
                className="rounded-xl px-2 py-2.5 text-xs"
                style={{
                  background: "#fff",
                  border: `1px solid ${C.border}`,
                }}
              >
                <option value="efectivo">
                  Efectivo
                </option>
                <option value="mercadopago">
                  Mercado Pago
                </option>
              </select>
            </div>
          )}
        </Card>
      )}

      <div className="flex gap-2 mb-4">
        <button
          onClick={() => setVendio(true)}
          className="flex-1 py-3 rounded-xl font-bold text-sm"
          style={{
            background: vendio
              ? C.success
              : C.bg,
            color: vendio
              ? "#fff"
              : C.muted,
          }}
        >
          Sí vendió
        </button>

        <button
          onClick={() => setVendio(false)}
          className="flex-1 py-3 rounded-xl font-bold text-sm"
          style={{
            background: !vendio
              ? C.danger
              : C.bg,
            color: !vendio
              ? "#fff"
              : C.muted,
          }}
        >
          No vendió
        </button>
      </div>

      {vendio ? (
        <>
          {/* La venta muestra solamente lo vendido. */}
          <div className="flex flex-col gap-2 mb-3">
            {PRODUCTOS.map((p, idx) => {
              const cant = items[idx].cantidad;

              return (
                <div key={p.key}>
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-sm font-semibold">
                        {p.label}
                      </div>

                      <div
                        className="text-xs font-mono"
                        style={{
                          color: C.mutedLight,
                        }}
                      >
                        {formatMoney(
                          precios[p.key] || 0
                        )}{" "}
                        c/u
                      </div>
                    </div>

                    <Stepper
                      value={cant}
                      onChange={(v) =>
                        actualizarCantidad(idx, v)
                      }
                    />
                  </div>
                </div>
              );
            })}
          </div>

          <div
            className="flex items-center justify-between mb-3 pt-2"
            style={{
              borderTop: `1px dashed ${C.border}`,
            }}
          >
            <span className="text-sm font-bold">
              Total
            </span>
            <span className="font-mono font-extrabold text-lg">
              {formatMoney(total)}
            </span>
          </div>

          <Field label="Forma de pago">
            <div className="flex gap-2">
              {[
                [
                  "efectivo",
                  "Efectivo",
                  Banknote,
                ],
                [
                  "mercadopago",
                  "Mercado Pago",
                  CreditCard,
                ],
                [
                  "deuda",
                  "Fía (deuda)",
                  HandCoins,
                ],
              ].map(([k, l, Icon]) => (
                <button
                  key={k}
                  onClick={() =>
                    setMetodoPago(k)
                  }
                  className="flex-1 flex flex-col items-center gap-1 py-2 rounded-xl"
                  style={{
                    background:
                      metodoPago === k
                        ? C.primary
                        : C.bg,
                    color:
                      metodoPago === k
                        ? "#fff"
                        : C.muted,
                  }}
                >
                  <Icon size={16} />
                  <span className="text-xs font-bold text-center">
                    {l}
                  </span>
                </button>
              ))}
            </div>
          </Field>

          {metodoPago !== "deuda" && (
            <Field
              label="Monto pagado ahora"
              hint={
                restante > 0
                  ? `Queda pendiente ${formatMoney(
                      restante
                    )}, se suma a la deuda.`
                  : null
              }
            >
              <Input
                type="number"
                inputMode="decimal"
                value={
                  montoPagado === null
                    ? total
                    : montoPagado
                }
                onChange={(e) =>
                  setMontoPagado(
                    e.target.value
                  )
                }
              />
            </Field>
          )}

          <Field label="Notas de la visita">
            <Textarea
              rows={2}
              value={notas}
              onChange={(e) =>
                setNotas(e.target.value)
              }
            />
          </Field>
          <Field label="Próxima visita especial">
            <button
              type="button"
              onClick={() => setVolverSabado(!volverSabado)}
              className="w-full rounded-xl px-3 py-3 flex items-center justify-between"
              style={{
                background: volverSabado ? C.warningBg : C.bg,
                border: `1px solid ${volverSabado ? C.warning : C.border}`,
              }}
            >
              <div className="text-left">
                <div
                  className="text-xs font-bold"
                  style={{ color: volverSabado ? C.warning : C.ink }}
                >
                  Volver el sábado
                </div>
                <div className="text-[10px]" style={{ color: C.muted }}>
                  {fechaLegible(fechaVolverSabado)} · aparece solo ese sábado
                </div>
              </div>

              <div
                className="w-5 h-5 rounded-md flex items-center justify-center"
                style={{
                  background: volverSabado ? C.warning : C.surface,
                  border: `1px solid ${volverSabado ? C.warning : C.border}`,
                }}
              >
                {volverSabado && <Check size={13} color="#fff" />}
              </div>
            </button>
          </Field>
        </>
      ) : (
        <>
          <Field label="Motivo (opcional)">
            <div className="flex flex-wrap gap-1.5 mb-2">
              {NOTAS_RAPIDAS.map((n) => (
                <button
                  key={n}
                  onClick={() => setNotas(n)}
                  className="px-2.5 py-1 rounded-lg text-xs font-semibold"
                  style={{
                    background:
                      notas === n
                        ? C.primary
                        : C.bg,
                    color:
                      notas === n
                        ? "#fff"
                        : C.muted,
                  }}
                >
                  {n}
                </button>
              ))}
            </div>
          </Field>
          <Field label="Próxima visita especial">
            <button
              type="button"
              onClick={() => setVolverSabado(!volverSabado)}
              className="w-full rounded-xl px-3 py-3 flex items-center justify-between"
              style={{
                background: volverSabado ? C.warningBg : C.bg,
                border: `1px solid ${volverSabado ? C.warning : C.border}`,
              }}
            >
              <div className="text-left">
                <div
                  className="text-xs font-bold"
                  style={{ color: volverSabado ? C.warning : C.ink }}
                >
                  Volver el sábado
                </div>
                <div className="text-[10px]" style={{ color: C.muted }}>
                  {fechaLegible(fechaVolverSabado)} · aparece solo ese sábado
                </div>
              </div>

              <div
                className="w-5 h-5 rounded-md flex items-center justify-center"
                style={{
                  background: volverSabado ? C.warning : C.surface,
                  border: `1px solid ${volverSabado ? C.warning : C.border}`,
                }}
              >
                {volverSabado && <Check size={13} color="#fff" />}
              </div>
            </button>
          </Field>
        </>
      )}

      {/* =====================================================
          SALDO FINAL DE LA CUENTA
          Se actualiza en tiempo real antes de guardar.
          ===================================================== */}
      <Card
        className="mb-3"
        style={{
          background:
            saldoFinalPrevisto > 0
              ? C.dangerBg
              : C.successBg,
          border: `1px solid ${
            saldoFinalPrevisto > 0
              ? C.danger
              : C.success
          }`,
        }}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <div
              className="text-[10px] font-extrabold uppercase tracking-wide"
              style={{
                color:
                  saldoFinalPrevisto > 0
                    ? C.danger
                    : C.success,
              }}
            >
              Saldo final después de esta visita
            </div>

            <div className="text-[10px] mt-1" style={{ color: C.muted }}>
              Lo que quedará debiendo el cliente al guardar.
            </div>
          </div>

          <div
            className="font-mono font-extrabold text-xl"
            style={{
              color:
                saldoFinalPrevisto > 0
                  ? C.danger
                  : C.success,
            }}
          >
            {formatMoney(saldoFinalPrevisto)}
          </div>
        </div>

        <div
          className="mt-3 pt-2 flex flex-col gap-1"
          style={{ borderTop: `1px solid ${C.border}` }}
        >
          <div className="flex items-center justify-between text-xs">
            <span style={{ color: C.muted }}>
              Saldo anterior
            </span>
            <span className="font-mono font-bold">
              {formatMoney(deudaBase)}
            </span>
          </div>

          {ajusteManualPrevisto !== 0 && (
            <div className="flex items-center justify-between text-xs">
              <span style={{ color: C.muted }}>
                Ajuste manual
              </span>
              <span
                className="font-mono font-bold"
                style={{
                  color:
                    ajusteManualPrevisto > 0
                      ? C.danger
                      : C.success,
                }}
              >
                {ajusteManualPrevisto > 0 ? "+" : ""}
                {formatMoney(ajusteManualPrevisto)}
              </span>
            </div>
          )}

          {deudaCobradaPrevista > 0 && (
            <div className="flex items-center justify-between text-xs">
              <span style={{ color: C.muted }}>
                Cobro de deuda anterior
              </span>
              <span
                className="font-mono font-bold"
                style={{ color: C.success }}
              >
                -{formatMoney(deudaCobradaPrevista)}
              </span>
            </div>
          )}

          {deudaGeneradaPrevista > 0 && (
            <div className="flex items-center justify-between text-xs">
              <span style={{ color: C.muted }}>
                Nuevo fiado de esta visita
              </span>
              <span
                className="font-mono font-bold"
                style={{ color: C.danger }}
              >
                +{formatMoney(deudaGeneradaPrevista)}
              </span>
            </div>
          )}

          {deudaCobradaPrevista > saldoBaseEditado && (
            <div
              className="text-[10px] font-semibold mt-1"
              style={{ color: C.danger }}
            >
              El cobro supera la deuda anterior. Corregí el monto antes de guardar.
            </div>
          )}
        </div>
      </Card>

      {/* Esta sección aparece SIEMPRE, venda o no venda. */}
{/* ENVASES EXTRA PLEGABLE */}
<div className="mb-3">
  <button
    type="button"
    onClick={() => setMostrarExtras(!mostrarExtras)}
    className="w-full rounded-xl px-3 py-3 flex items-center justify-between"
    style={{
      background: C.warningBg,
      border: `1px solid ${C.border}`,
    }}
  >
    <div className="flex items-center gap-2">
      <Boxes
        size={16}
        color={C.warning}
      />

      <div className="text-left">
        <div
          className="text-xs font-bold"
          style={{ color: C.warning }}
        >
          Movimiento de envases
        </div>

        <div
          className="text-[10px]"
          style={{ color: C.muted }}
        >
          Prestar extras o retirar envases
        </div>
      </div>
    </div>

    <ChevronRight
      size={17}
      color={C.warning}
      style={{
        transform: mostrarExtras
          ? "rotate(90deg)"
          : "rotate(0deg)",
        transition: "transform 0.2s",
      }}
    />
  </button>

  {mostrarExtras && (
    <Card
      style={{
        background: C.warningBg,
        border: "none",
        borderTopLeftRadius: 0,
        borderTopRightRadius: 0,
      }}
      className="mt-1"
    >
      <div
        className="text-[11px] mb-3"
        style={{ color: C.muted }}
      >
        Si retirás envases, primero se descuentan de los extras.
        Si no alcanzan, el resto se descuenta de los permanentes.
      </div>

      <div className="flex flex-col gap-3">
        {PRODUCTOS_RETORNABLES.map((p) => {
          const actuales =
            Number(saldoActual[p.key]) || 0;

          const permanentesActuales =
            Number(permanentes[p.key]) || 0;

          const prestados =
            Number(extrasPrestados[p.key]) || 0;

          const retirados =
            Number(extrasRetirados[p.key]) || 0;

          const balance =
            prestados - retirados;

          return (
            <div
              key={p.key}
              className="pb-3 last:pb-0"
              style={{
                borderBottom:
                  p.key !== "sifon"
                    ? `1px solid ${C.border}`
                    : "none",
              }}
            >
              <div className="flex items-center justify-between mb-2">
                <div>
                  <div className="text-xs font-bold">
                    {p.label}
                  </div>

                  <div
                    className="text-[10px]"
                    style={{ color: C.muted }}
                  >
                    Extras: {actuales} · Permanentes: {permanentesActuales}
                  </div>
                </div>

                {(prestados > 0 ||
                  retirados > 0) && (
                  <Badge
                    tone={
                      balance > 0
                        ? "warning"
                        : balance < 0
                        ? "success"
                        : "muted"
                    }
                  >
                    {balance > 0
                      ? `+${balance}`
                      : balance}
                  </Badge>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <div
                    className="text-[10px] font-bold mb-1 text-center"
                    style={{ color: C.warning }}
                  >
                    Prestó
                  </div>

                  <div className="flex justify-center">
                    <Stepper
                      value={prestados}
                      onChange={(v) =>
                        cambiarExtraPrestado(
                          p.key,
                          v
                        )
                      }
                    />
                  </div>
                </div>

                <div>
                  <div
                    className="text-[10px] font-bold mb-1 text-center"
                    style={{ color: C.success }}
                  >
                    Retiró
                  </div>

                  <div className="flex justify-center">
                    <Stepper
                      value={retirados}
                      onChange={(v) =>
                        cambiarExtraRetirado(
                          p.key,
                          v
                        )
                      }
                    />
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  )}
</div>

      {errorStock && (
        <Card
          style={{
            background: C.dangerBg,
            border: "none",
          }}
          className="mt-3"
        >
          <div
            className="text-xs font-bold flex items-start gap-1.5"
            style={{ color: C.danger }}
          >
            <AlertCircle
              size={14}
              className="flex-shrink-0 mt-0.5"
            />
            <span>{errorStock}</span>
          </div>
        </Card>
      )}
    </Sheet>
  );
}

/* ============================================================
   RAÍZ DE LA APLICACIÓN
   ============================================================ */
export default function App() {
  const [loading, setLoading] = useState(true);
  const [db, setDb] = useState({ clientes: [], visitas: [], gastos: [], stock: [], config: clone(DEFAULT_CONFIG) });
  const [profile, setProfile] = useState(null); // null(cargando) | 'picker' | {type:'admin'} | {type:'repartidor', id}
  const [adminUnlocked, setAdminUnlocked] = useState(() => {
  return sessionStorage.getItem("adminUnlocked") === "true";
});
  const [connError, setConnError] = useState(null);
  const [offline, setOffline] = useState(typeof navigator !== "undefined" ? !navigator.onLine : false);

  const pastRef = useRef([]);
  const futureRef = useRef([]);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);

  useEffect(() => {
    const onOnline = () => setOffline(false);
    const onOffline = () => setOffline(true);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, []);

  useEffect(() => {
    const loaded = new Set();
    function markLoaded(key) {
      loaded.add(key);
      if (loaded.size === 5) {
        setProfile(getLocalProfile() || "picker");
        setLoading(false);
      }
    }
    migrarFormatoViejoSiHaceFalta();
    migrarStockViejoSiHaceFalta();
    migrarEnvasesClientesSiHaceFalta();
    const unsubs = [
      subscribeCollection("clientes", (v) => { setDb((p) => ({ ...p, clientes: v })); markLoaded("clientes"); setConnError(null); }, setConnError),
      subscribeCollection("visitas", (v) => { setDb((p) => ({ ...p, visitas: v })); markLoaded("visitas"); setConnError(null); }, setConnError),
      subscribeCollection("gastos", (v) => { setDb((p) => ({ ...p, gastos: v })); markLoaded("gastos"); setConnError(null); }, setConnError),
      subscribeCollection("stock", (v) => { setDb((p) => ({ ...p, stock: v })); markLoaded("stock"); setConnError(null); }, setConnError),
      subscribeConfigDoc(clone(DEFAULT_CONFIG), (v) => {
        const normalizada = {
          ...clone(DEFAULT_CONFIG),
          ...v,
          precios: { ...DEFAULT_CONFIG.precios, ...(v?.precios || {}) },
          stockTotal: { ...DEFAULT_CONFIG.stockTotal, ...(v?.stockTotal || {}) },
        };
        setDb((p) => ({ ...p, config: normalizada }));
        markLoaded("config");
        setConnError(null);
      }, setConnError),
    ];
    return () => unsubs.forEach((u) => u());
  }, []);

  function persistChanged(prevDb, nextDb) {
    if (nextDb.clientes !== prevDb.clientes) {
      const { upserts, deletes } = diffArrayById(prevDb.clientes, nextDb.clientes);
      upserts.forEach((c) => upsertDoc("clientes", c));
      deletes.forEach((id) => removeDoc("clientes", id));
    }
    if (nextDb.visitas !== prevDb.visitas) {
      const { upserts, deletes } = diffArrayById(prevDb.visitas, nextDb.visitas);
      upserts.forEach((v) => upsertDoc("visitas", v));
      deletes.forEach((id) => removeDoc("visitas", id));
    }
    if (nextDb.gastos !== prevDb.gastos) {
      const { upserts, deletes } = diffArrayById(prevDb.gastos, nextDb.gastos);
      upserts.forEach((g) => upsertDoc("gastos", g));
      deletes.forEach((id) => removeDoc("gastos", id));
    }
    if (nextDb.stock !== prevDb.stock) {
      const { upserts, deletes } = diffArrayById(prevDb.stock || [], nextDb.stock || []);
      upserts.forEach((st) => upsertDoc("stock", st));
      deletes.forEach((id) => removeDoc("stock", id));
    }
    if (nextDb.config !== prevDb.config) setConfigDoc(nextDb.config);
  }

  const mutate = useCallback((nextDb, opts = { history: true }) => {
    setDb((prevDb) => {
      if (opts.history) {
        pastRef.current = [...pastRef.current.slice(-29), prevDb];
        futureRef.current = [];
        setCanUndo(true);
        setCanRedo(false);
      }
      persistChanged(prevDb, nextDb);
      return nextDb;
    });
  }, []);

  function undo() {
    if (!pastRef.current.length) return;
    setDb((current) => {
      const prev = pastRef.current[pastRef.current.length - 1];
      pastRef.current = pastRef.current.slice(0, -1);
      futureRef.current = [current, ...futureRef.current].slice(0, 30);
      persistChanged(current, prev);
      setCanUndo(pastRef.current.length > 0);
      setCanRedo(true);
      return prev;
    });
  }
  function redo() {
    if (!futureRef.current.length) return;
    setDb((current) => {
      const next = futureRef.current[0];
      futureRef.current = futureRef.current.slice(1);
      pastRef.current = [...pastRef.current, current].slice(-30);
      persistChanged(current, next);
      setCanRedo(futureRef.current.length > 0);
      setCanUndo(true);
      return next;
    });
  }

  function elegirAdmin() {
  const p = { type: "admin" };

  setProfile(p);
  setLocalProfile(p);
  setAdminUnlocked(false);
}
  function elegirRepartidor(r) {
    const p = { type: "repartidor", id: r.id };
    setProfile(p);
    setLocalProfile(p);
  }
  function desloguear() {
  setProfile("picker");
  setAdminUnlocked(false);
  setLocalProfile(null);
  sessionStorage.removeItem("adminUnlocked");
}
  function volverAlPicker() { setProfile("picker"); }

  if (connError) {
    return (
      <Screen>
        <div className="flex-1 flex flex-col items-center justify-center px-6 text-center">
          <WifiOff size={28} color={C.danger} />
          <div className="text-sm font-bold mt-2">No se pudo conectar a la base de datos</div>
          <div className="text-xs mt-1" style={{ color: C.muted }}>
            Revisá que hayas pegado tus credenciales reales de Firebase en <code>src/firebaseConfig.js</code> y que Firestore esté creado y en modo de prueba.
          </div>
          <div className="text-[11px] mt-3 font-mono" style={{ color: C.mutedLight }}>{String(connError.message || connError)}</div>
        </div>
      </Screen>
    );
  }

  if (loading || profile === null) {
    return (
      <Screen>
        <div className="flex-1 flex flex-col items-center justify-center">
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-3 animate-pulse" style={{ background: C.primaryDark }}>
            <BrandMark size={26} />
          </div>
          <div className="text-xs" style={{ color: C.muted }}>Cargando…</div>
        </div>
      </Screen>
    );
  }

  if (profile === "picker") {
    return <ProfileSelect config={db.config} onPickAdmin={elegirAdmin} onPickRepartidor={elegirRepartidor} />;
  }

  if (profile.type === "admin") {
    if (!adminUnlocked) {
      return (
        <AdminGate
          config={db.config}
          onBack={volverAlPicker}
          onUnlock={() => {
  setAdminUnlocked(true);
  sessionStorage.setItem("adminUnlocked", "true");
}}
          onSetPin={(pin) => {
  mutate({ ...db, config: { ...db.config, adminPin: pin } });
  setAdminUnlocked(true);
  sessionStorage.setItem("adminUnlocked", "true");
}}
        />
      );
    }
    return (
      <AdminApp
        db={db}
        mutate={mutate}
        onLogout={desloguear}
        canUndo={canUndo}
        canRedo={canRedo}
        undo={undo}
        redo={redo}
        offline={offline}
      />
    );
  }

  if (profile.type === "repartidor") {
    const rep = db.config.repartidores.find((r) => r.id === profile.id);
    if (!rep) {
      return (
        <Screen>
          <div className="flex-1 flex flex-col items-center justify-center px-6 text-center">
            <AlertCircle size={28} color={C.danger} />
            <div className="text-sm font-bold mt-2">Tu perfil ya no existe</div>
            <div className="text-xs mb-4" style={{ color: C.muted }}>Puede que el administrador lo haya eliminado.</div>
            <Btn onClick={desloguear}>Volver a elegir perfil</Btn>
          </div>
        </Screen>
      );
    }
    return <RepartidorApp db={db} mutate={mutate} repartidor={rep} onLogout={desloguear} offline={offline} />;
  }

  return null;
}
