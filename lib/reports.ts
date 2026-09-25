import { TRACKS, isFinalStage, type TrackId } from "./flow/definition";
import type { OrderView } from "./flow/types";

// Reporte de gestión (estilo del cotizador de termopaneles), calculado sobre las OV ya evaluadas por el motor.

export type Periodo = "hoy" | "mes" | "historico" | "fecha";
export const PERIODOS: { id: Periodo; label: string }[] = [
  { id: "hoy", label: "Diario (Hoy)" },
  { id: "mes", label: "Este Mes" },
  { id: "historico", label: "Histórico" },
  { id: "fecha", label: "Fecha Específica" },
];

export interface ReportFilters {
  periodo: Periodo;
  fecha?: string; // YYYY-MM-DD, solo con periodo "fecha"
  cliente?: number;
}

/** Talleres, reconocidos por el nombre del producto fabricado. */
const TALLERES: { nombre: string; match: RegExp }[] = [
  { nombre: "Taller Termopaneles", match: /dvh|termopanel/i },
  { nombre: "Taller PVC (Ventanas y Puertas)", match: /ventana|puerta|pvc/i },
];
const OTROS = "Otros productos";

export interface TallerStats {
  nombre: string;
  mos: number;
  terminadas: number;
  enProceso: number;
  unidades: number;
}

export interface ReportData {
  titulo: string;
  orders: OrderView[];
  kpis: {
    monto: number;
    ventas: number;
    ticket: number;
    esteMes: number;
    /** Variación % contra el mes anterior; solo con periodo "mes". */
    deltaMonto: number | null;
    deltaVentas: number | null;
  };
  flujo: { track: TrackId; label: string; completas: number; total: number }[];
  talleres: TallerStats[];
  cobrado: number;
  porCobrar: number;
  ranking: { name: string; pedidos: number; total: number }[];
  clientes: { id: number; name: string }[];
  currency: string;
}

const TZ = "America/Santiago";
const ymd = new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" });

/** Fecha local (Chile) YYYY-MM-DD de una fecha UTC de Odoo "YYYY-MM-DD HH:MM:SS". */
export function localDay(odooUtc: string): string {
  const d = new Date(odooUtc.includes("T") ? odooUtc : `${odooUtc.replace(" ", "T")}Z`);
  return Number.isNaN(d.getTime()) ? odooUtc.slice(0, 10) : ymd.format(d);
}

function monthOf(day: string, offset = 0): string {
  const [y, m] = day.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + offset, 1));
  return d.toISOString().slice(0, 7);
}

function delta(actual: number, anterior: number): number | null {
  return anterior > 0 ? ((actual - anterior) / anterior) * 100 : null;
}

export function parseReportFilters(params: Record<string, string | string[] | undefined>): ReportFilters {
  const one = (k: string) => (Array.isArray(params[k]) ? params[k][0] : params[k]);
  const periodo = PERIODOS.some((p) => p.id === one("periodo")) ? (one("periodo") as Periodo) : "mes";
  const fecha = /^\d{4}-\d{2}-\d{2}$/.test(one("fecha") ?? "") ? one("fecha") : undefined;
  const cliente = Number(one("cliente"));
  return { periodo, fecha, cliente: Number.isInteger(cliente) && cliente > 0 ? cliente : undefined };
}

export function buildReport(all: OrderView[], f: ReportFilters, now: Date = new Date()): ReportData {
  const today = ymd.format(now);
  const thisMonth = today.slice(0, 7);

  const clientes = [
    ...new Map(all.filter((o) => o.raw.partnerId !== null).map((o) => [o.raw.partnerId!, o.raw.partnerName])),
  ]
    .map(([id, name]) => ({ id, name }))
    .sort((a, b) => a.name.localeCompare(b.name, "es"));

  const byClient = f.cliente ? all.filter((o) => o.raw.partnerId === f.cliente) : all;
  const inDay = (o: OrderView, day: string) => localDay(o.raw.dateOrder) === day;
  const inMonth = (o: OrderView, month: string) => localDay(o.raw.dateOrder).startsWith(month);

  let orders = byClient;
  let titulo = "Histórico";
  if (f.periodo === "hoy") {
    orders = byClient.filter((o) => inDay(o, today));
    titulo = "Hoy";
  } else if (f.periodo === "mes") {
    orders = byClient.filter((o) => inMonth(o, thisMonth));
    titulo = "Este mes";
  } else if (f.periodo === "fecha") {
    orders = f.fecha ? byClient.filter((o) => inDay(o, f.fecha!)) : [];
    titulo = f.fecha ? `Reporte del ${f.fecha.split("-").reverse().join("-")}` : "Elige una fecha";
  }

  const monto = orders.reduce((s, o) => s + o.raw.amountTotal, 0);
  const prev = f.periodo === "mes" ? byClient.filter((o) => inMonth(o, monthOf(today, -1))) : null;
  const montoPrev = prev?.reduce((s, o) => s + o.raw.amountTotal, 0) ?? 0;

  const flujo = TRACKS.map((t) => ({
    track: t.id,
    label: t.label,
    completas: orders.filter((o) => {
      const i = o.tracks[t.id].index;
      return i !== null && isFinalStage(t.id, i);
    }).length,
    total: orders.filter((o) => o.tracks[t.id].index !== null).length,
  }));

  const talleres = new Map<string, TallerStats>();
  for (const t of [...TALLERES.map((t) => t.nombre), OTROS]) {
    talleres.set(t, { nombre: t, mos: 0, terminadas: 0, enProceso: 0, unidades: 0 });
  }
  for (const mo of orders.flatMap((o) => o.raw.productions)) {
    if (mo.state === "cancel") continue;
    const nombre = TALLERES.find((t) => t.match.test(mo.productName))?.nombre ?? OTROS;
    const s = talleres.get(nombre)!;
    s.mos += 1;
    s.unidades += mo.qty;
    if (mo.state === "done") s.terminadas += 1;
    if (mo.state === "progress" || mo.state === "to_close") s.enProceso += 1;
  }

  const rankingMap = new Map<string, { name: string; pedidos: number; total: number }>();
  for (const o of orders) {
    const key = String(o.raw.partnerId ?? o.raw.partnerName);
    const r = rankingMap.get(key) ?? { name: o.raw.partnerName, pedidos: 0, total: 0 };
    r.pedidos += 1;
    r.total += o.raw.amountTotal;
    rankingMap.set(key, r);
  }

  const cobrado = orders.reduce((s, o) => s + Math.max(0, o.paid), 0);

  return {
    titulo,
    orders: [...orders].sort((a, b) => b.raw.dateOrder.localeCompare(a.raw.dateOrder)),
    kpis: {
      monto,
      ventas: orders.length,
      ticket: orders.length ? Math.round(monto / orders.length) : 0,
      esteMes: byClient.filter((o) => inMonth(o, thisMonth)).length,
      deltaMonto: prev ? delta(monto, montoPrev) : null,
      deltaVentas: prev ? delta(orders.length, prev.length) : null,
    },
    flujo,
    talleres: [...talleres.values()].filter((t) => t.mos > 0 || t.nombre !== OTROS),
    cobrado,
    porCobrar: orders.reduce((s, o) => s + Math.max(0, o.raw.amountTotal - o.paid), 0),
    ranking: [...rankingMap.values()].sort((a, b) => b.total - a.total).slice(0, 10),
    clientes,
    currency: all[0]?.raw.currency || "CLP",
  };
}
