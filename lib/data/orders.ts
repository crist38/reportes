import "server-only";

import { DEFAULT_POLICY, buildOrderView, type FlowPolicy } from "@/lib/flow/engine";
import type { OrderView } from "@/lib/flow/types";
import { OdooClient, OdooError, readOdooConfig } from "@/lib/odoo/client";
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
    const { orders, warnings } = await fetchOdooOrders(new OdooClient(config), {
      limit: Number(process.env.ODOO_LIMIT) || 300,
      tecnicoField: process.env.ODOO_FIELD_TECNICO || "x_estado_tecnico",
      instalacionField: process.env.ODOO_FIELD_INSTALACION || "x_estado_instalacion",
      orderIds,
    });
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
