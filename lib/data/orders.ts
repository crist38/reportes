import "server-only";

import { DEFAULT_POLICY, buildOrderView, type FlowPolicy } from "@/lib/flow/engine";
import type { OrderView, RawOrder } from "@/lib/flow/types";
import { OdooClient, OdooError, readOdooConfig, type OdooConfig } from "@/lib/odoo/client";
import { fetchOdooOrders } from "@/lib/odoo/orders";
import { demoOrders } from "./demo";

export interface OrdersResult {
  orders: OrderView[];
  source: "odoo" | "demo";
  warnings: string[];
  error?: string;
  policy: FlowPolicy;
}

export function readPolicy(): FlowPolicy {
  const pct = Number(process.env.ANTICIPO_PCT);
  const req = process.env.DESPACHO_REQUIERE;
  return {
    anticipoPct: Number.isFinite(pct) && pct > 0 && pct <= 1 ? pct : DEFAULT_POLICY.anticipoPct,
    despachoRequiere: req === "habilitado" || req === "saldo" || req === "pagado" ? req : DEFAULT_POLICY.despachoRequiere,
  };
}

// Caché en memoria de lo leído de Odoo: evita el límite de llamadas por minuto de Odoo Online
// al cambiar de página, pestaña o filtro. "Nuevo Reporte" la invalida.
const CACHE_MS = Math.max(0, Number(process.env.ODOO_CACHE_SECONDS ?? 60)) * 1000;
const cache = new Map<string, { at: number; data: Promise<{ orders: RawOrder[]; warnings: string[] }> }>();

export function invalidateOrdersCache() {
  cache.clear();
}

function fetchCached(config: OdooConfig, orderIds?: number[]) {
  const key = orderIds ? `ids:${orderIds.join(",")}` : "all";
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.data;

  const data = fetchOdooOrders(new OdooClient(config), {
    limit: Number(process.env.ODOO_LIMIT) || 300,
    tecnicoField: process.env.ODOO_FIELD_TECNICO || "x_estado_tecnico",
    instalacionField: process.env.ODOO_FIELD_INSTALACION || "x_estado_instalacion",
    orderIds,
  });
  data.catch(() => cache.delete(key)); // los errores no se guardan
  cache.set(key, { at: Date.now(), data });
  return data;
}

export async function getOrders(orderIds?: number[]): Promise<OrdersResult> {
  const policy = readPolicy();
  const config = readOdooConfig();

  if (!config) {
    const raw = demoOrders().filter((o) => !orderIds || orderIds.includes(o.id));
    return {
      orders: raw.map((o) => buildOrderView(o, policy)),
      source: "demo",
      warnings: ["Modo demo: configura ODOO_URL, ODOO_DB y ODOO_API_KEY en .env.local para leer tu Odoo."],
      policy,
    };
  }

  try {
    // Para el detalle de una OV se reutiliza la lista completa si está en caché.
    let { orders, warnings } = await fetchCached(config);
    if (orderIds) {
      const found = orders.filter((o) => orderIds.includes(o.id));
      ({ orders, warnings } = found.length === orderIds.length ? { orders: found, warnings } : await fetchCached(config, orderIds));
    }
    return { orders: orders.map((o) => buildOrderView(o, policy)), source: "odoo", warnings, policy };
  } catch (err) {
    const message = err instanceof OdooError || err instanceof Error ? err.message : String(err);
    return { orders: [], source: "odoo", warnings: [], error: message, policy };
  }
}

export async function getOrder(id: number) {
  const result = await getOrders([id]);
  return { ...result, order: result.orders[0] ?? null };
}
