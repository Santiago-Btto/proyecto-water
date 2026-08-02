import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import {
  Droplet, Truck, Users, Receipt, Plus, Check, X,
  ChevronRight, Undo2, Redo2, LogOut, CreditCard, Banknote,
  HandCoins, AlertCircle, Search, Edit2, Trash2,
  ArrowLeft, Lock, ClipboardList, CheckCircle2, Circle, BarChart3,
  UserCog, Phone, MapPin, Save, Minus, Settings2,
  Home as HomeIcon, WifiOff, Download
} from "lucide-react";
import { collection, doc, onSnapshot, setDoc, deleteDoc, getDoc, getDocs } from "firebase/firestore";
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
  { key: "b20", label: "Bidón 20L", corto: "20L", retornable: true },
  { key: "b12", label: "Bidón 12L", corto: "12L", retornable: true },
  { key: "sifon", label: "Sifón", corto: "Sifón", retornable: true },
  { key: "jugo", label: "Jugo", corto: "Jugo", retornable: false },
];
const PRODUCTOS_RETORNABLES = PRODUCTOS.filter((p) => p.retornable);
const DEFAULT_CONFIG = {
  adminPin: "",
  repartidores: [],
  precios: { b20: 0, b12: 0, sifon: 0, jugo: 0 },
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
function aplicarDeltaEnvases(envasesPrestados, delta, signo = 1) {
  const ep = { ...(envasesPrestados || envasesVacio()) };
  Object.keys(delta).forEach((tipo) => {
    ep[tipo] = Math.max(0, (ep[tipo] || 0) + signo * delta[tipo]);
  });
  return ep;
}
function textoDevoluciones(v) {
  if (!v.retornos) return "";
  return PRODUCTOS_RETORNABLES.filter((p) => (v.retornos[p.key] || 0) > 0).map((p) => `${v.retornos[p.key]}×${p.corto}`).join(", ");
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
  const headers = ["Nombre", "Dirección", "Teléfono", "Días de visita", "Repartidor", "Deuda acumulada", "Envases prestados", "Máquina frío/calor", "Notas"];
  const rows = db.clientes.map((c) => {
    const rep = db.config.repartidores.find((r) => r.id === c.repartidorId);
    return [
      c.nombre, c.direccion, c.telefono || "", (c.diasVisita || []).join(" - "),
      rep?.nombre || "", c.deudaAcumulada || 0, textoEnvasesPrestados(c.envasesPrestados) || "Ninguno",
      c.maquinaFrioCalor ? "Sí" : "No", c.notas || "",
    ];
  });
  descargarCSV(`clientes_${hoyISO()}.csv`, headers, rows);
}
function exportarVisitasCSV(db) {
  const headers = ["Fecha", "Cliente", "Repartidor", "Vendió", "Productos", "Total", "Método de pago", "Deuda generada", "Deuda cobrada", "Devolvió", "Notas"];
  const metodos = { efectivo: "Efectivo", mercadopago: "Mercado Pago", deuda: "Fiado" };
  const rows = db.visitas.slice().sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0)).map((v) => {
    const cliente = db.clientes.find((c) => c.id === v.clienteId);
    const rep = db.config.repartidores.find((r) => r.id === v.repartidorId);
    const productos = (v.items || []).filter((it) => it.cantidad > 0).map((it) => `${it.cantidad}x${PRODUCTOS.find((p) => p.key === it.tipo)?.corto}`).join(" + ");
    return [
      fechaLegible(v.fecha), cliente?.nombre || "Cliente eliminado", rep?.nombre || "",
      v.vendio ? "Sí" : "No", productos, v.total || 0, v.vendio ? (metodos[v.metodoPago] || "") : "",
      v.deudaGenerada || 0, v.deudaCobrada || 0, textoDevoluciones(v) || "", v.notas || "",
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
function AdminDashboard({ db }) {
  const [rango, setRango] = useState("hoy");
  const hoy = hoyISO();

  const visitasFiltradas = useMemo(() => {
    return db.visitas.filter((v) => {
      if (rango === "hoy") return v.fecha === hoy;
      if (rango === "semana") {
        const d = new Date(v.fecha);
        const now = new Date(hoy);
        const diff = (now - d) / 86400000;
        return diff >= 0 && diff < 7;
      }
      if (rango === "mes") return v.fecha.slice(0, 7) === hoy.slice(0, 7);
      return true;
    });
  }, [db.visitas, rango, hoy]);

  const efectivo = visitasFiltradas.reduce((s, v) => s + (v.pagos?.efectivo || 0), 0);
  const mp = visitasFiltradas.reduce((s, v) => s + (v.pagos?.mercadopago || 0), 0);
  const deudaGenerada = visitasFiltradas.reduce((s, v) => s + (v.deudaGenerada || 0), 0);
  const facturado = visitasFiltradas.reduce((s, v) => s + (v.total || 0), 0);

  const gastosFiltrados = db.gastos.filter((g) => {
    if (rango === "hoy") return g.fecha === hoy;
    if (rango === "semana") { const d = new Date(g.fecha); const now = new Date(hoy); const diff = (now - d) / 86400000; return diff >= 0 && diff < 7; }
    if (rango === "mes") return g.fecha.slice(0, 7) === hoy.slice(0, 7);
    return true;
  });
  const totalGastos = gastosFiltrados.reduce((s, g) => s + g.monto, 0);

  const deudaTotalClientes = db.clientes.reduce((s, c) => s + (c.deudaAcumulada || 0), 0);
  const envasesEnCalle = db.clientes.reduce((s, c) => s + totalEnvasesPrestados(c.envasesPrestados), 0);

  const preciosSinConfigurar = Object.values(db.config.precios).some((p) => !p);

  return (
    <div>
      {preciosSinConfigurar && (
        <Card style={{ background: C.warningBg, border: "none" }} className="mb-3">
          <div className="flex items-center gap-2 text-xs font-semibold" style={{ color: C.warning }}>
            <AlertCircle size={16} /> Todavía tenés precios en $0. Configurálos en Ajustes.
          </div>
        </Card>
      )}

      <div className="flex gap-2 mb-4">
        {[["hoy", "Hoy"], ["semana", "Semana"], ["mes", "Mes"], ["todo", "Todo"]].map(([k, l]) => (
          <button
            key={k}
            onClick={() => setRango(k)}
            className="px-3 py-1.5 rounded-lg text-xs font-bold"
            style={{ background: rango === k ? C.primary : C.surface, color: rango === k ? "#fff" : C.muted, border: `1px solid ${rango === k ? C.primary : C.border}` }}
          >
            {l}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap gap-2 mb-4">
        <Meter label="Facturado" value={formatMoney(facturado)} />
        <Meter label="Efectivo" value={formatMoney(efectivo)} />
        <Meter label="Mercado Pago" value={formatMoney(mp)} />
        <Meter label="Fiado (nuevo)" value={formatMoney(deudaGenerada)} />
      </div>

      <div className="text-xs font-bold uppercase tracking-wide mb-2" style={{ color: C.muted }}>Por repartidor ({rango})</div>
      {db.config.repartidores.length === 0 ? (
        <div className="text-xs mb-4" style={{ color: C.mutedLight }}>Agregá repartidores en Ajustes para ver el desglose.</div>
      ) : (
        <div className="flex flex-col gap-2 mb-4">
          {db.config.repartidores.map((r) => {
            const vr = visitasFiltradas.filter((v) => v.repartidorId === r.id);
            const fact = vr.reduce((s, v) => s + (v.total || 0), 0);
            const ef = vr.reduce((s, v) => s + (v.pagos?.efectivo || 0), 0);
            const mpr = vr.reduce((s, v) => s + (v.pagos?.mercadopago || 0), 0);
            const fiado = vr.reduce((s, v) => s + (v.deudaGenerada || 0), 0);
            return (
              <Card key={r.id}>
                <div className="flex items-center justify-between mb-1.5">
                  <div className="font-bold text-sm flex items-center gap-1.5"><Truck size={14} color={C.primary} />{r.nombre}</div>
                  <div className="font-mono font-extrabold text-sm">{formatMoney(fact)}</div>
                </div>
                <div className="flex gap-1.5 flex-wrap">
                  <Badge tone="success">Efectivo {formatMoney(ef)}</Badge>
                  <Badge tone="accent">MP {formatMoney(mpr)}</Badge>
                  <Badge tone={fiado > 0 ? "danger" : "muted"}>Fió {formatMoney(fiado)}</Badge>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 mb-4">
        <Card>
          <div className="text-xs font-bold uppercase tracking-wide mb-1" style={{ color: C.muted }}>Deuda total clientes</div>
          <div className="font-mono font-extrabold text-xl" style={{ color: deudaTotalClientes > 0 ? C.danger : C.ink }}>{formatMoney(deudaTotalClientes)}</div>
        </Card>
        <Card>
          <div className="text-xs font-bold uppercase tracking-wide mb-1" style={{ color: C.muted }}>Envases en la calle</div>
          <div className="font-mono font-extrabold text-xl">{envasesEnCalle}</div>
        </Card>
        <Card>
          <div className="text-xs font-bold uppercase tracking-wide mb-1" style={{ color: C.muted }}>Gastos ({rango})</div>
          <div className="font-mono font-extrabold text-xl">{formatMoney(totalGastos)}</div>
        </Card>
        <Card>
          <div className="text-xs font-bold uppercase tracking-wide mb-1" style={{ color: C.muted }}>Balance ({rango})</div>
          <div className="font-mono font-extrabold text-xl" style={{ color: (efectivo + mp - totalGastos) >= 0 ? C.success : C.danger }}>
            {formatMoney(efectivo + mp - totalGastos)}
          </div>
        </Card>
      </div>

      <div className="text-xs font-bold mb-2" style={{ color: C.muted }}>Visitas ({rango})</div>
      {visitasFiltradas.length === 0 ? (
        <div className="text-xs" style={{ color: C.mutedLight }}>Sin visitas registradas en este período.</div>
      ) : (
        <div className="flex flex-col gap-2">
          {visitasFiltradas.slice().sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0)).slice(0, 8).map((v) => {
            const cliente = db.clientes.find((c) => c.id === v.clienteId);
            const rep = db.config.repartidores.find((r) => r.id === v.repartidorId);
            return (
              <Card key={v.id}>
                <div className="flex items-center justify-between">
                  <div className="font-bold text-sm">{cliente?.nombre || "Cliente eliminado"}</div>
                  {v.vendio ? <Badge tone="success">{formatMoney(v.total)}</Badge> : <Badge tone="muted">No vendió</Badge>}
                </div>
                <div className="text-xs mt-0.5" style={{ color: C.muted }}>
                  {fechaLegible(v.fecha)} · {rep?.nombre || "—"}
                  {v.vendio && v.metodoPago && " · " + ({ efectivo: "Efectivo", mercadopago: "Mercado Pago", deuda: "Fiado" }[v.metodoPago] || "")}
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ---------- Clientes (admin) ---------- */
function ClienteForm({ initial, repartidores, onSave, onCancel, isAdmin }) {
  const [f, setF] = useState(() => {
    if (initial) {
      return {
        ...initial,
        envasesPrestados: initial.envasesPrestados || envasesVacio(),
        maquinaFrioCalor: initial.maquinaFrioCalor ?? false,
      };
    }
    return {
      nombre: "", direccion: "", telefono: "", notas: "",
      diasVisita: [], repartidorId: repartidores[0]?.id || "",
      envasesPrestados: envasesVacio(), maquinaFrioCalor: false,
      orden: "", activo: true,
    };
  });
  const [error, setError] = useState("");

  function submit() {
    if (!f.nombre.trim()) return setError("Ingresá el nombre del cliente.");
    if (!f.direccion.trim()) return setError("Ingresá la dirección.");
    if (f.diasVisita.length === 0) return setError("Elegí al menos un día de visita.");
    if (isAdmin && !f.repartidorId) return setError("Asigná un repartidor.");
    onSave(f);
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
        <Field label="Envases prestados" hint="Cantidad de cada envase que la empresa tiene prestada a este cliente.">
          <div className="flex flex-col gap-2">
            {PRODUCTOS_RETORNABLES.map((p) => (
              <div key={p.key} className="flex items-center justify-between">
                <span className="text-xs font-semibold">{p.label}</span>
                <Stepper value={f.envasesPrestados[p.key] || 0} onChange={(v) => setF({ ...f, envasesPrestados: { ...f.envasesPrestados, [p.key]: v } })} />
              </div>
            ))}
          </div>
        </Field>
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

  const lista = db.clientes
    .filter((c) => c.nombre.toLowerCase().includes(busca.toLowerCase()) || c.direccion.toLowerCase().includes(busca.toLowerCase()))
    .sort((a, b) => a.nombre.localeCompare(b.nombre));

  const clienteDetalle = detalleId ? db.clientes.find((c) => c.id === detalleId) : null;

  function guardarCliente(f) {
    const next = clone(db);
    if (f.id) {
      const i = next.clientes.findIndex((c) => c.id === f.id);
      next.clientes[i] = { ...next.clientes[i], ...f };
    } else {
      next.clientes.push({ ...f, id: uid(), deudaAcumulada: 0, creadoEl: hoyISO() });
    }
    mutate(next);
    setSheet(null);
  }

  function eliminarCliente(c) {
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
          <Sheet title="Editar cliente" onClose={() => setSheet(null)} closeOnBackdrop={false}>
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
          <Search size={16} color={C.mutedLight} style={{ position: "absolute", left: 10, top: 11 }} />
          <input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar cliente…"
            className="w-full rounded-xl pl-8 pr-3 py-2.5 text-sm outline-none"
            style={{ background: C.surface, border: `1px solid ${C.border}` }}
          />
        </div>
        <Btn icon={Plus} onClick={() => setSheet("nuevo")}>Nuevo</Btn>
      </div>

      {lista.length === 0 ? (
        <EmptyState icon={Users} title="Sin clientes todavía" text="Agregá el primer cliente para empezar a armar los recorridos." action={<Btn icon={Plus} onClick={() => setSheet("nuevo")}>Nuevo cliente</Btn>} />
      ) : (
        <div className="flex flex-col gap-2">
          {lista.map((c) => {
            const rep = db.config.repartidores.find((r) => r.id === c.repartidorId);
            return (
              <Card key={c.id}>
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1" onClick={() => setDetalleId(c.id)}>
                    <div className="font-bold text-sm truncate">{c.nombre}</div>
                    <div className="text-xs truncate" style={{ color: C.muted }}>{c.direccion}</div>
                    <div className="flex flex-wrap gap-1 mt-1.5">
                      {c.diasVisita.map((d) => <Badge key={d} tone="accent">{d.slice(0, 3)}</Badge>)}
                      {rep && <Badge tone="muted">{rep.nombre}</Badge>}
                      {c.deudaAcumulada > 0 && <Badge tone="danger">Debe {formatMoney(c.deudaAcumulada)}</Badge>}
                      {totalEnvasesPrestados(c.envasesPrestados) > 0 && <Badge tone="danger">Prestado: {textoEnvasesPrestados(c.envasesPrestados)}</Badge>}
                      {c.maquinaFrioCalor && <Badge tone="accent">Máquina F/C</Badge>}
                    </div>
                  </div>
                  <div className="flex flex-col gap-1">
                    <button onClick={() => setSheet(c)} className="p-1.5 rounded-lg active:bg-black/5"><Edit2 size={15} color={C.muted} /></button>
                    <button onClick={() => setConfirmDel(c)} className="p-1.5 rounded-lg active:bg-black/5"><Trash2 size={15} color={C.danger} /></button>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {sheet && (
        <Sheet title={sheet === "nuevo" ? "Nuevo cliente" : "Editar cliente"} onClose={() => setSheet(null)} closeOnBackdrop={false}>
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
          <div className="text-sm mb-4">
            ¿Seguro que querés eliminar a <b>{confirmDel.nombre}</b>? Podés deshacerlo después con el botón deshacer.
          </div>
          <div className="flex gap-2">
            <Btn variant="ghost" full onClick={() => setConfirmDel(null)}>Cancelar</Btn>
            <Btn variant="danger" full onClick={() => eliminarCliente(confirmDel)}>Eliminar</Btn>
          </div>
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
        <div className="text-xs" style={{ color: C.muted }}>{cliente.direccion}</div>
        <div className="flex flex-wrap gap-1.5 mt-2">
          {cliente.diasVisita.map((d) => <Badge key={d} tone="accent">{d.slice(0, 3)}</Badge>)}
          {cliente.deudaAcumulada > 0 && <Badge tone="danger">Debe {formatMoney(cliente.deudaAcumulada)}</Badge>}
          {totalEnvasesPrestados(cliente.envasesPrestados) > 0 && <Badge tone="danger">Prestado: {textoEnvasesPrestados(cliente.envasesPrestados)}</Badge>}
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
                    {textoDevoluciones(v) && <div className="text-xs mt-0.5" style={{ color: C.success }}>Devolvió: {textoDevoluciones(v)}</div>}
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

/* ---------- Historial (admin) ---------- */
function AdminHistorial({ db, mutate }) {
  const [filtroRep, setFiltroRep] = useState("todos");
  const [confirmDel, setConfirmDel] = useState(null);

  const hoy = diaSemanaHoy();
  const fechaHoy = hoyISO();

  // Clientes que forman parte del recorrido de HOY
  const clientesHoy = db.clientes
    .filter((c) => c.diasVisita?.includes(hoy))
    .filter(
      (c) =>
        filtroRep === "todos" ||
        c.repartidorId === filtroRep
    )
    .sort(
      (a, b) =>
        (Number(a.orden) || 999) -
          (Number(b.orden) || 999) ||
        a.nombre.localeCompare(b.nombre)
    );

  // Clientes ya visitados hoy
  const idsVisitadosHoy = new Set(
    db.visitas
      .filter((v) => v.fecha === fechaHoy)
      .map((v) => v.clienteId)
  );

  // Historial:
  // solamente mostramos visitas cuyo cliente todavía existe
  const visitas = db.visitas
    .filter((v) =>
      db.clientes.some((c) => c.id === v.clienteId)
    )
    .filter(
      (v) =>
        filtroRep === "todos" ||
        v.repartidorId === filtroRep
    )
    .slice()
    .sort(
      (a, b) =>
        (b.timestamp || 0) -
        (a.timestamp || 0)
    );

  function borrarVisita(v) {
    const next = clone(db);
    next.visitas = next.visitas.filter((x) => x.id !== v.id);
    const ci = next.clientes.findIndex((c) => c.id === v.clienteId);
    if (ci >= 0) {
      if (v.deudaGenerada) next.clientes[ci].deudaAcumulada = Math.max(0, (next.clientes[ci].deudaAcumulada || 0) - v.deudaGenerada);
      if (v.deudaCobrada) next.clientes[ci].deudaAcumulada = (next.clientes[ci].deudaAcumulada || 0) + v.deudaCobrada;
      next.clientes[ci].envasesPrestados = aplicarDeltaEnvases(next.clientes[ci].envasesPrestados, calcularDeltaEnvases(v), -1);
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

      <div
  className="text-xs font-bold uppercase tracking-wide mb-2 mt-3"
  style={{ color: C.muted }}
>
  Recorrido de hoy
</div>

{clientesHoy.length === 0 ? (
  <Card>
    <div
      className="text-xs text-center"
      style={{ color: C.mutedLight }}
    >
      No hay clientes programados para hoy.
    </div>
  </Card>
) : (
  <div className="flex flex-col gap-2 mb-5">
    {clientesHoy.map((c) => {
      const rep = db.config.repartidores.find(
        (r) => r.id === c.repartidorId
      );

      const visitado = idsVisitadosHoy.has(c.id);

      return (
        <Card key={c.id}>
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0 flex-1">
              <div className="font-bold text-sm">
                {c.nombre}
              </div>

              <div
                className="text-xs"
                style={{ color: C.muted }}
              >
                {c.direccion}
              </div>

              <div className="flex gap-1 mt-1.5 flex-wrap">
                {rep && (
                  <Badge tone="muted">
                    {rep.nombre}
                  </Badge>
                )}

                {c.orden && (
                  <Badge tone="accent">
                    Orden {c.orden}
                  </Badge>
                )}
              </div>
            </div>

            <Badge tone={visitado ? "success" : "warning"}>
              {visitado ? "Visitado" : "Pendiente"}
            </Badge>
          </div>
        </Card>
      );
    })}
  </div>
)}

<div
  className="text-xs font-bold uppercase tracking-wide mb-2"
  style={{ color: C.muted }}
>
  Historial
</div>

      {visitas.length === 0 ? (
        <EmptyState icon={ClipboardList} title="Sin recorridos registrados" text="Cuando los repartidores empiecen a visitar clientes, va a aparecer acá." />
      ) : (
        <div className="flex flex-col gap-2">
          {visitas.map((v) => {
            const cliente = db.clientes.find((c) => c.id === v.clienteId);
            const rep = db.config.repartidores.find((r) => r.id === v.repartidorId);
            return (
              <Card key={v.id}>
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="font-bold text-sm">{cliente?.nombre || "Cliente eliminado"}</div>
                    <div className="text-xs" style={{ color: C.muted }}>{fechaLegible(v.fecha)} · {rep?.nombre || "—"}</div>
                    {v.vendio ? (
                      <div className="text-xs mt-1">
                        {v.items.filter((it) => it.cantidad > 0).map((it) => `${it.cantidad}× ${PRODUCTOS.find((p) => p.key === it.tipo)?.corto}`).join(", ")}
                        {" — "}<span className="font-mono font-bold">{formatMoney(v.total)}</span>
                      </div>
                    ) : (
                      <div className="text-xs mt-1" style={{ color: C.mutedLight }}>No vendió{v.notas ? " · " + v.notas : ""}</div>
                    )}
                    {v.deudaCobrada > 0 && <div className="text-xs mt-0.5" style={{ color: C.success }}>Cobró deuda: {formatMoney(v.deudaCobrada)}</div>}
                    {textoDevoluciones(v) && <div className="text-xs mt-0.5" style={{ color: C.success }}>Devolvió: {textoDevoluciones(v)}</div>}
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
          <div className="text-sm mb-4">Se va a revertir el efecto en la deuda y los envases del cliente. Podés deshacerlo con el botón deshacer.</div>
          <div className="flex gap-2">
            <Btn variant="ghost" full onClick={() => setConfirmDel(null)}>Cancelar</Btn>
            <Btn variant="danger" full onClick={() => borrarVisita(confirmDel)}>Eliminar</Btn>
          </div>
        </Sheet>
      )}
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
    next.gastos.push({ id: uid(), concepto, monto: Number(monto), fecha: hoyISO(), timestamp: Date.now() });
    mutate(next);
    setConcepto(""); setMonto(""); setSheet(false);
  }

  function borrar(g) {
    const next = clone(db);
    next.gastos = next.gastos.filter((x) => x.id !== g.id);
    mutate(next);
    setConfirmDel(null);
  }

  const total = db.gastos.reduce((s, g) => s + g.monto, 0);

  const gruposMes = {};
  db.gastos.forEach((g) => {
    const mes = g.fecha.slice(0, 7);
    if (!gruposMes[mes]) gruposMes[mes] = [];
    gruposMes[mes].push(g);
  });
  const meses = Object.keys(gruposMes).sort().reverse();
  function nombreMesGasto(mesKey) {
    const [y, m] = mesKey.split("-");
    return `${NOMBRES_MES[Number(m) - 1]} ${y}`;
  }

  return (
    <div>
      <Card style={{ background: C.primaryDark, border: "none" }} className="mb-3 flex items-center justify-between">
        <div>
          <div className="text-xs font-bold uppercase" style={{ color: C.accentSoft, opacity: 0.8 }}>Total gastado</div>
          <div className="font-mono font-extrabold text-xl" style={{ color: "#fff" }}>{formatMoney(total)}</div>
        </div>
        <Btn variant="accent" icon={Plus} onClick={() => setSheet(true)}>Gasto</Btn>
      </Card>

      {meses.length === 0 ? (
        <EmptyState icon={Receipt} title="Sin gastos cargados" text="Registrá combustible, mantenimiento u otros gastos del negocio." />
      ) : (
        meses.map((mes) => {
          const items = gruposMes[mes].slice().sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
          const subtotal = items.reduce((s, g) => s + g.monto, 0);
          return (
            <div key={mes} className="mb-4">
              <div className="flex items-center justify-between mb-2">
                <div className="text-xs font-extrabold uppercase tracking-wide" style={{ color: C.muted }}>{nombreMesGasto(mes)}</div>
                <div className="font-mono text-xs font-bold">{formatMoney(subtotal)}</div>
              </div>
              <div className="flex flex-col gap-2">
                {items.map((g) => (
                  <Card key={g.id} className="flex items-center justify-between">
                    <div>
                      <div className="font-bold text-sm">{g.concepto}</div>
                      <div className="text-xs" style={{ color: C.muted }}>{fechaLegible(g.fecha)}</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="font-mono font-bold text-sm">{formatMoney(g.monto)}</div>
                      <button onClick={() => setConfirmDel(g)} className="p-1 rounded-lg active:bg-black/5"><Trash2 size={14} color={C.danger} /></button>
                    </div>
                  </Card>
                ))}
              </div>
            </div>
          );
        })
      )}

      {sheet && (
        <Sheet title="Nuevo gasto" onClose={() => setSheet(false)} closeOnBackdrop={false}>
          <Field label="Concepto"><Input value={concepto} onChange={(e) => setConcepto(e.target.value)} placeholder="Ej: Nafta" /></Field>
          <Field label="Monto"><Input type="number" inputMode="decimal" value={monto} onChange={(e) => setMonto(e.target.value)} placeholder="0" /></Field>
          <div className="flex gap-2 mt-2">
            <Btn variant="ghost" full onClick={() => setSheet(false)}>Cancelar</Btn>
            <Btn full onClick={guardar}>Guardar</Btn>
          </div>
        </Sheet>
      )}

      {confirmDel && (
        <Sheet title="Eliminar gasto" onClose={() => setConfirmDel(null)}>
          <div className="text-sm mb-4">¿Eliminar "{confirmDel.concepto}" por {formatMoney(confirmDel.monto)}?</div>
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
    next.config.precios = { b20: Number(precios.b20) || 0, b12: Number(precios.b12) || 0, sifon: Number(precios.sifon) || 0, jugo: Number(precios.jugo) || 0 };
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

  const misClientes = db.clientes.filter((c) => c.repartidorId === repartidor.id);
  const hoy = diaSemanaHoy();
  const deHoy = misClientes.filter((c) => c.diasVisita.includes(hoy)).sort((a, b) => (Number(a.orden) || 999) - (Number(b.orden) || 999) || a.nombre.localeCompare(b.nombre));
  const visitasHoy = db.visitas.filter((v) => v.repartidorId === repartidor.id && v.fecha === hoyISO());
  const idsVisitados = new Set(visitasHoy.map((v) => v.clienteId));
  const pendientes = deHoy.filter((c) => !idsVisitados.has(c.id));
  const enProgreso = idsVisitados.size > 0 && idsVisitados.size < deHoy.length;

  return (
    <Screen>
      <TopBar
        title={repartidor.nombre}
        subtitle={fechaLegible(hoyISO()) + " · " + hoy}
        tone="dark"
        right={
          <div className="flex items-center gap-1">
            <span className="flex items-center gap-1 px-1.5 mr-1">
              <span className="w-1.5 h-1.5 rounded-full" style={{ background: offline ? C.warning : C.accent }} />
              <span className="text-[10px] font-bold" style={{ color: C.accentSoft }}>{offline ? "sin conexión" : "en vivo"}</span>
            </span>
            <button onClick={onLogout} className="p-2 rounded-full active:bg-white/10"><LogOut size={16} color="#fff" /></button>
          </div>
        }
      />
      <div className="flex-1 overflow-y-auto px-4 py-4">
        {vista === "inicio" && (
          <RepartidorInicio
            deHoy={deHoy}
            pendientes={pendientes}
            visitadosCount={idsVisitados.size}
            enProgreso={enProgreso}
            onEmpezar={() => setVista("recorrido")}
          />
        )}
        {vista === "clientes" && <RepartidorClientes db={db} mutate={mutate} repartidor={repartidor} />}
        {vista === "recorrido" && (
          <RepartidorRecorrido
            db={db} mutate={mutate} repartidor={repartidor}
            clientes={deHoy} visitadosIds={idsVisitados}
            onSalir={() => setVista("inicio")}
          />
        )}
      </div>
      {vista !== "recorrido" && (
        <div className="flex-shrink-0 flex" style={{ background: C.surface, borderTop: `1px solid ${C.border}` }}>
          {[["inicio", "Inicio", HomeIcon], ["clientes", "Mis clientes", Users]].map(([key, label, Icon]) => {
            const active = vista === key;
            return (
              <button key={key} onClick={() => setVista(key)} className="flex-1 flex flex-col items-center gap-0.5 py-2.5">
                <Icon size={18} color={active ? C.primary : C.mutedLight} strokeWidth={active ? 2.4 : 2} />
                <span className="text-xs font-semibold" style={{ color: active ? C.primary : C.mutedLight }}>{label}</span>
              </button>
            );
          })}
        </div>
      )}
    </Screen>
  );
}

function RepartidorInicio({ deHoy, pendientes, visitadosCount, enProgreso, onEmpezar }) {
  return (
    <div className="flex flex-col items-center justify-center text-center pt-10">
      <div className="w-20 h-20 rounded-3xl flex items-center justify-center mb-4" style={{ background: C.primaryDark }}>
        <Truck size={34} color="#fff" />
      </div>
      {deHoy.length === 0 ? (
        <>
          <div className="font-bold text-base mb-1">No tenés clientes para hoy</div>
          <div className="text-xs mb-6" style={{ color: C.muted }}>Revisá "Mis clientes" para ver tus días de visita.</div>
        </>
      ) : (
        <>
          <div className="font-extrabold text-xl mb-1">{deHoy.length} cliente{deHoy.length !== 1 ? "s" : ""} hoy</div>
          <div className="text-xs mb-6" style={{ color: C.muted }}>
            {visitadosCount > 0 ? `${visitadosCount} de ${deHoy.length} ya visitados` : "Todavía no arrancaste el recorrido"}
          </div>
          <Btn size="lg" onClick={onEmpezar} icon={pendientes.length === 0 ? CheckCircle2 : Truck}>
            {pendientes.length === 0 ? "Ver recorrido completo" : enProgreso ? "Continuar recorrido" : "Empezar recorrido"}
          </Btn>
        </>
      )}
    </div>
  );
}

function RepartidorClientes({ db, mutate, repartidor }) {
  const [sheet, setSheet] = useState(null);
  const [busca, setBusca] = useState("");
  const misClientes = db.clientes
    .filter((c) => c.repartidorId === repartidor.id)
    .filter((c) => c.nombre.toLowerCase().includes(busca.toLowerCase()) || c.direccion.toLowerCase().includes(busca.toLowerCase()))
    .sort((a, b) => a.nombre.localeCompare(b.nombre));

  function guardar(f) {
    const next = clone(db);
    if (f.id) {
      const i = next.clientes.findIndex((c) => c.id === f.id);
      next.clientes[i] = { ...next.clientes[i], ...f, repartidorId: repartidor.id };
    } else {
      next.clientes.push({ ...f, id: uid(), repartidorId: repartidor.id, deudaAcumulada: 0, envasesPrestados: envasesVacio(), creadoEl: hoyISO() });
    }
    mutate(next);
    setSheet(null);
  }

  return (
    <div>
      <div className="flex gap-2 mb-3">
        <div className="flex-1 relative">
          <Search size={16} color={C.mutedLight} style={{ position: "absolute", left: 10, top: 11 }} />
          <input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar cliente…"
            className="w-full rounded-xl pl-8 pr-3 py-2.5 text-sm outline-none"
            style={{ background: C.surface, border: `1px solid ${C.border}` }}
          />
        </div>
        <Btn icon={Plus} onClick={() => setSheet("nuevo")}>Nuevo</Btn>
      </div>
      {misClientes.length === 0 ? (
        <EmptyState icon={Users} title={busca ? "Sin resultados" : "Todavía no tenés clientes"} text={busca ? "Probá con otro nombre o dirección." : "Agregá tu primer cliente para que aparezca en tu recorrido."} action={!busca && <Btn icon={Plus} onClick={() => setSheet("nuevo")}>Nuevo cliente</Btn>} />
      ) : (
        <div className="flex flex-col gap-2">
          {misClientes.map((c) => (
            <Card key={c.id} onClick={() => setSheet(c)}>
              <div className="font-bold text-sm">{c.nombre}</div>
              <div className="text-xs" style={{ color: C.muted }}>{c.direccion}</div>
              <div className="flex flex-wrap gap-1 mt-1.5">
                {c.diasVisita.map((d) => <Badge key={d} tone="accent">{d.slice(0, 3)}</Badge>)}
                {totalEnvasesPrestados(c.envasesPrestados) > 0 && <Badge tone="danger">Prestado: {textoEnvasesPrestados(c.envasesPrestados)}</Badge>}
                {c.maquinaFrioCalor && <Badge tone="accent">Máquina F/C</Badge>}
              </div>
            </Card>
          ))}
        </div>
      )}
      {sheet && (
        <Sheet title={sheet === "nuevo" ? "Nuevo cliente" : "Editar cliente"} onClose={() => setSheet(null)} closeOnBackdrop={false}>
          <ClienteForm initial={sheet === "nuevo" ? null : sheet} repartidores={db.config.repartidores} isAdmin={false} onSave={guardar} onCancel={() => setSheet(null)} />
        </Sheet>
      )}
    </div>
  );
}

/* ---------- Recorrido activo (repartidor) ---------- */
function RepartidorRecorrido({ db, mutate, repartidor, clientes, visitadosIds, onSalir }) {
  const [activo, setActivo] = useState(null);
  const pendientes = clientes.filter((c) => !visitadosIds.has(c.id));
  const hechos = clientes.filter((c) => visitadosIds.has(c.id));

  function registrarVisita(cliente, visita) {
    const next = clone(db);
    next.visitas.push(visita);
    const ci = next.clientes.findIndex((c) => c.id === cliente.id);
    if (ci >= 0) {
      let deuda = next.clientes[ci].deudaAcumulada || 0;
      deuda -= visita.deudaCobrada || 0;
      deuda += visita.deudaGenerada || 0;
      next.clientes[ci].deudaAcumulada = Math.max(0, deuda);
      next.clientes[ci].envasesPrestados = aplicarDeltaEnvases(next.clientes[ci].envasesPrestados, calcularDeltaEnvases(visita), 1);
    }
    mutate(next, { history: false });
    setActivo(null);
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <button onClick={onSalir} className="text-xs font-bold flex items-center gap-1" style={{ color: C.primary }}><ArrowLeft size={14} /> Volver a inicio</button>
        <Badge tone="accent">{hechos.length}/{clientes.length}</Badge>
      </div>

      {pendientes.length > 0 && (
        <>
          <div className="text-xs font-bold uppercase tracking-wide mb-2" style={{ color: C.muted }}>Pendientes</div>
          <div className="flex flex-col gap-2 mb-4">
            {pendientes.map((c) => <ClienteVisitaCard key={c.id} cliente={c} onClick={() => setActivo(c)} />)}
          </div>
        </>
      )}

      {hechos.length > 0 && (
        <>
          <div className="text-xs font-bold uppercase tracking-wide mb-2" style={{ color: C.muted }}>Visitados</div>
          <div className="flex flex-col gap-2">
            {hechos.map((c) => <ClienteVisitaCard key={c.id} cliente={c} hecho />)}
          </div>
        </>
      )}

      {pendientes.length === 0 && (
        <Card style={{ background: C.successBg, border: "none" }} className="mt-3 flex items-center gap-2">
          <CheckCircle2 size={20} color={C.success} />
          <div className="text-sm font-bold" style={{ color: C.success }}>¡Recorrido completo!</div>
        </Card>
      )}

      {activo && (
        <VisitaSheet
          cliente={activo}
          precios={db.config.precios}
          onClose={() => setActivo(null)}
          onGuardar={(visita) => registrarVisita(activo, visita)}
        />
      )}
    </div>
  );
}

function ClienteVisitaCard({ cliente, hecho, onClick }) {
  return (
    <Card onClick={onClick} style={{ opacity: hecho ? 0.65 : 1 }}>
      <div className="flex items-start gap-2">
        <div className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5" style={{ background: hecho ? C.successBg : C.accentSoft }}>
          {hecho ? <CheckCircle2 size={15} color={C.success} /> : <Circle size={15} color={C.primary} />}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <div className="font-bold text-sm">{cliente.nombre}</div>
            {PRODUCTOS_RETORNABLES.filter((p) => (cliente.envasesPrestados?.[p.key] || 0) > 0).map((p) => (
              <span key={p.key} className="px-1.5 py-0.5 rounded-md text-[10px] font-mono font-extrabold flex-shrink-0" style={{ background: C.dangerBg, color: C.danger }}>
                {cliente.envasesPrestados[p.key]}×{p.corto}
              </span>
            ))}
          </div>
          <div className="text-xs" style={{ color: C.muted }}>{cliente.direccion}</div>
          <div className="flex flex-wrap gap-1 mt-1">
            {cliente.deudaAcumulada > 0 && <Badge tone="danger">Debe {formatMoney(cliente.deudaAcumulada)}</Badge>}
            {cliente.maquinaFrioCalor && <Badge tone="accent">Máquina F/C</Badge>}
            {cliente.notas && <Badge tone="muted">Nota</Badge>}
          </div>
        </div>
        <div className="flex gap-1 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
          {cliente.telefono && (
            <a href={`tel:${cliente.telefono}`} className="p-1.5 rounded-lg" style={{ background: C.bg }}><Phone size={13} color={C.primary} /></a>
          )}
          <a href={`https://maps.google.com/?q=${encodeURIComponent(cliente.direccion)}`} target="_blank" rel="noreferrer" className="p-1.5 rounded-lg" style={{ background: C.bg }}><MapPin size={13} color={C.primary} /></a>
        </div>
      </div>
    </Card>
  );
}

const NOTAS_RAPIDAS = ["No estaba", "No quiso hoy", "Volver más tarde"];

function VisitaSheet({ cliente, precios, onClose, onGuardar }) {
  const saldoActual = cliente.envasesPrestados || envasesVacio();
  const [vendio, setVendio] = useState(true);
  const [items, setItems] = useState(
    PRODUCTOS.map((p) => ({ tipo: p.key, cantidad: 0, precioUnitario: precios[p.key] || 0 }))
  );
  const [retornos, setRetornos] = useState(() => {
    const r = {};
    PRODUCTOS_RETORNABLES.forEach((p) => { r[p.key] = 0; });
    return r;
  });
  const [retornosTocados, setRetornosTocados] = useState(() => new Set());
  const [metodoPago, setMetodoPago] = useState("efectivo");
  const [montoPagado, setMontoPagado] = useState(null); // null = total completo
  const [cobrarDeuda, setCobrarDeuda] = useState(false);
  const [montoDeuda, setMontoDeuda] = useState(cliente.deudaAcumulada || 0);
  const [metodoDeuda, setMetodoDeuda] = useState("efectivo");
  const [notas, setNotas] = useState("");

  const total = totalPedido(items);
  const pagadoFinal = montoPagado === null ? total : Number(montoPagado) || 0;
  const restante = Math.max(0, total - pagadoFinal);

  function actualizarCantidad(idx, valor) {
    const p = PRODUCTOS[idx];
    setItems(items.map((it, i) => (i === idx ? { ...it, cantidad: valor } : it)));
    // Por defecto asumimos cambio 1x1 (devuelve lo mismo que se le entrega),
    // salvo que el repartidor ya haya ajustado la devolución a mano.
    if (p.retornable && !retornosTocados.has(p.key)) {
      setRetornos((r) => ({ ...r, [p.key]: valor }));
    }
  }
  function actualizarRetorno(tipo, valor) {
    setRetornosTocados((prev) => new Set(prev).add(tipo));
    setRetornos((r) => ({ ...r, [tipo]: Math.max(0, valor) }));
  }

  function guardar() {
    const retornosFinal = {};
    PRODUCTOS_RETORNABLES.forEach((p) => {
      const idx = PRODUCTOS.findIndex((x) => x.key === p.key);
      const cant = items[idx]?.cantidad || 0;
      const saldo = saldoActual[p.key] || 0;
      const relevante = vendio ? (cant > 0 || saldo > 0) : (saldo > 0);
      retornosFinal[p.key] = relevante ? (retornos[p.key] || 0) : 0;
    });
    const visita = {
    id: uid(),
    clienteId: cliente.id,
    clienteNombre: cliente.nombre,
    repartidorId: cliente.repartidorId,
    fecha: hoyISO(),
    diaSemana: diaSemanaHoy(),
      vendio,
      items: vendio ? items : [],
      retornos: retornosFinal,
      total: vendio ? total : 0,
      metodoPago: vendio ? metodoPago : null,
      pagos: vendio && metodoPago !== "deuda" ? { [metodoPago]: pagadoFinal } : {},
      deudaGenerada: vendio && metodoPago === "deuda" ? total : (vendio ? restante : 0),
      deudaCobrada: cobrarDeuda ? Number(montoDeuda) || 0 : 0,
      metodoDeuda: cobrarDeuda ? metodoDeuda : null,
      notas,
      timestamp: Date.now(),
    };
    if (visita.deudaCobrada) {
      visita.pagos = { ...visita.pagos, [metodoDeuda]: (visita.pagos[metodoDeuda] || 0) + visita.deudaCobrada };
    }
    onGuardar(visita);
  }

  return (
    <Sheet
      title={cliente.nombre}
      onClose={onClose}
      closeOnBackdrop={false}
      footer={<Btn full size="lg" onClick={guardar} icon={Check}>Guardar visita</Btn>}
    >
      <div className="text-xs mb-3" style={{ color: C.muted }}>{cliente.direccion}</div>

      {cliente.deudaAcumulada > 0 && (
        <Card style={{ background: C.dangerBg, border: "none" }} className="mb-3">
          <div className="flex items-center justify-between mb-2">
            <div className="text-xs font-bold" style={{ color: C.danger }}>Debe {formatMoney(cliente.deudaAcumulada)} de antes</div>
            <button
              onClick={() => setCobrarDeuda(!cobrarDeuda)}
              className="px-2.5 py-1 rounded-lg text-xs font-bold"
              style={{ background: cobrarDeuda ? C.danger : "#fff", color: cobrarDeuda ? "#fff" : C.danger, border: `1px solid ${C.danger}` }}
            >
              {cobrarDeuda ? "Cobrando" : "Cobrar deuda"}
            </button>
          </div>
          {cobrarDeuda && (
            <div className="flex gap-2 items-center">
              <Input type="number" inputMode="decimal" value={montoDeuda} onChange={(e) => setMontoDeuda(e.target.value)} style={{ flex: 1 }} />
              <select value={metodoDeuda} onChange={(e) => setMetodoDeuda(e.target.value)} className="rounded-xl px-2 py-2.5 text-xs" style={{ background: "#fff", border: `1px solid ${C.border}` }}>
                <option value="efectivo">Efectivo</option>
                <option value="mercadopago">Mercado Pago</option>
              </select>
            </div>
          )}
        </Card>
      )}

      <div className="flex gap-2 mb-4">
        <button onClick={() => setVendio(true)} className="flex-1 py-3 rounded-xl font-bold text-sm" style={{ background: vendio ? C.success : C.bg, color: vendio ? "#fff" : C.muted }}>Sí vendió</button>
        <button onClick={() => setVendio(false)} className="flex-1 py-3 rounded-xl font-bold text-sm" style={{ background: !vendio ? C.danger : C.bg, color: !vendio ? "#fff" : C.muted }}>No vendió</button>
      </div>

      {vendio ? (
        <>
          <div className="flex flex-col gap-2 mb-3">
            {PRODUCTOS.map((p, idx) => {
              const cant = items[idx].cantidad;
              const saldo = saldoActual[p.key] || 0;
              const mostrarRetorno = p.retornable && (cant > 0 || saldo > 0);
              return (
                <div key={p.key}>
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-sm font-semibold">{p.label}</div>
                      <div className="text-xs font-mono" style={{ color: C.mutedLight }}>{formatMoney(precios[p.key] || 0)} c/u</div>
                    </div>
                    <Stepper value={cant} onChange={(v) => actualizarCantidad(idx, v)} />
                  </div>
                  {mostrarRetorno && (
                    <div className="flex items-center justify-between mt-1 ml-1 pl-2 py-1" style={{ borderLeft: `2px solid ${C.border}` }}>
                      <span className="text-xs" style={{ color: C.muted }}>
                        Vacíos que devolvió{saldo > 0 && <span style={{ color: C.danger, fontWeight: 700 }}> · debe {saldo}</span>}
                      </span>
                      <Stepper value={retornos[p.key] || 0} onChange={(v) => actualizarRetorno(p.key, v)} />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          <div className="flex items-center justify-between mb-3 pt-2" style={{ borderTop: `1px dashed ${C.border}` }}>
            <span className="text-sm font-bold">Total</span>
            <span className="font-mono font-extrabold text-lg">{formatMoney(total)}</span>
          </div>
          <Field label="Forma de pago">
            <div className="flex gap-2">
              {[["efectivo", "Efectivo", Banknote], ["mercadopago", "Mercado Pago", CreditCard], ["deuda", "Fía (deuda)", HandCoins]].map(([k, l, Icon]) => (
                <button key={k} onClick={() => setMetodoPago(k)} className="flex-1 flex flex-col items-center gap-1 py-2 rounded-xl" style={{ background: metodoPago === k ? C.primary : C.bg, color: metodoPago === k ? "#fff" : C.muted }}>
                  <Icon size={16} />
                  <span className="text-xs font-bold text-center">{l}</span>
                </button>
              ))}
            </div>
          </Field>
          {metodoPago !== "deuda" && (
            <Field label="Monto pagado ahora" hint={restante > 0 ? `Queda pendiente ${formatMoney(restante)}, se suma a la deuda.` : null}>
              <Input type="number" inputMode="decimal" value={montoPagado === null ? total : montoPagado} onChange={(e) => setMontoPagado(e.target.value)} />
            </Field>
          )}
          <Field label="Notas de la visita">
            <Textarea rows={2} value={notas} onChange={(e) => setNotas(e.target.value)} />
          </Field>
        </>
      ) : (
        <>
          <Field label="Motivo (opcional)">
            <div className="flex flex-wrap gap-1.5 mb-2">
              {NOTAS_RAPIDAS.map((n) => (
                <button key={n} onClick={() => setNotas(n)} className="px-2.5 py-1 rounded-lg text-xs font-semibold" style={{ background: notas === n ? C.primary : C.bg, color: notas === n ? "#fff" : C.muted }}>{n}</button>
              ))}
            </div>
          </Field>
          {PRODUCTOS_RETORNABLES.some((p) => (saldoActual[p.key] || 0) > 0) && (
            <Field label="¿Te devolvió envases vacíos igual?" hint="Aunque no haya comprado, puede haberte dado envases pendientes de antes.">
              <div className="flex flex-col gap-2">
                {PRODUCTOS_RETORNABLES.filter((p) => (saldoActual[p.key] || 0) > 0).map((p) => (
                  <div key={p.key} className="flex items-center justify-between">
                    <span className="text-xs font-semibold">{p.label} <span style={{ color: C.danger }}>(debe {saldoActual[p.key]})</span></span>
                    <Stepper value={retornos[p.key] || 0} onChange={(v) => actualizarRetorno(p.key, v)} />
                  </div>
                ))}
              </div>
            </Field>
          )}
        </>
      )}
    </Sheet>
  );
}

/* ============================================================
   RAÍZ DE LA APLICACIÓN
   ============================================================ */
export default function App() {
  const [loading, setLoading] = useState(true);
  const [db, setDb] = useState({ clientes: [], visitas: [], gastos: [], config: clone(DEFAULT_CONFIG) });
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
      if (loaded.size === 4) {
        setProfile(getLocalProfile() || "picker");
        setLoading(false);
      }
    }
    migrarFormatoViejoSiHaceFalta();
    const unsubs = [
      subscribeCollection("clientes", (v) => { setDb((p) => ({ ...p, clientes: v })); markLoaded("clientes"); setConnError(null); }, setConnError),
      subscribeCollection("visitas", (v) => { setDb((p) => ({ ...p, visitas: v })); markLoaded("visitas"); setConnError(null); }, setConnError),
      subscribeCollection("gastos", (v) => { setDb((p) => ({ ...p, gastos: v })); markLoaded("gastos"); setConnError(null); }, setConnError),
      subscribeConfigDoc(clone(DEFAULT_CONFIG), (v) => { setDb((p) => ({ ...p, config: v })); markLoaded("config"); setConnError(null); }, setConnError),
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
