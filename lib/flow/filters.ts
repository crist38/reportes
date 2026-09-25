import { TRACK_BY_ID, TRACK_IDS, type TrackId } from "./definition";
import type { OrderStatus, OrderView } from "./types";

// Filtros compartidos por la tabla de órdenes y la exportación CSV.

export interface OrderFilters {
  track?: TrackId;
  stage?: string;
  status?: OrderStatus;
  q?: string;
}

const STATUSES: OrderStatus[] = ["cerrada", "inconsistente", "bloqueada", "accion", "en_curso"];

export function parseFilters(params: Record<string, string | string[] | undefined>): OrderFilters {
  const one = (k: string) => {
    const v = params[k];
    return Array.isArray(v) ? v[0] : v;
  };
  const track = one("track");
  const status = one("status");
  return {
    track: TRACK_IDS.includes(track as TrackId) ? (track as TrackId) : undefined,
    stage: one("stage") || undefined,
    status: STATUSES.includes(status as OrderStatus) ? (status as OrderStatus) : undefined,
    q: one("q")?.trim() || undefined,
  };
}

export function applyFilters(orders: OrderView[], f: OrderFilters): OrderView[] {
  return orders.filter((o) => {
    if (f.status && o.status !== f.status) return false;
    if (f.track && f.stage) {
      const i = o.tracks[f.track].index;
      if (i === null || TRACK_BY_ID[f.track].stages[i]?.id !== f.stage) return false;
    }
    if (f.q) {
      const q = f.q.toLowerCase();
      if (!o.raw.name.toLowerCase().includes(q) && !o.raw.partnerName.toLowerCase().includes(q)) return false;
    }
    return true;
  });
}

export function filtersToQuery(f: OrderFilters): string {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(f)) if (v) p.set(k, v);
  const s = p.toString();
  return s ? `?${s}` : "";
}

export const STATUS_META: Record<OrderStatus, { label: string; className: string }> = {
  inconsistente: { label: "Inconsistente", className: "bg-fuchsia-100 text-fuchsia-800 ring-fuchsia-300" },
  bloqueada: { label: "Bloqueada", className: "bg-red-100 text-red-800 ring-red-300" },
  accion: { label: "Acción pendiente", className: "bg-amber-100 text-amber-900 ring-amber-300" },
  en_curso: { label: "En curso", className: "bg-slate-100 text-slate-700 ring-slate-300" },
  cerrada: { label: "Cerrada", className: "bg-emerald-100 text-emerald-800 ring-emerald-300" },
};
