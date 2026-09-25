import "server-only";

import type { MoState, PickingState, RawInvoice, RawOrder, RawPicking, RawProduction } from "@/lib/flow/types";
import { OdooClient, m2oName, type Domain } from "./client";

// Traduce los modelos de Odoo 19 (sale.order, account.move, mrp.production, stock.picking)
// al formato RawOrder que usa el motor de flujos.

export interface OdooFetchOptions {
  limit: number;
  tecnicoField: string;
  instalacionField: string;
  orderIds?: number[];
}

interface SaleOrderRow {
  id: number;
  name: string;
  partner_id: unknown;
  user_id: unknown;
  date_order: string;
  commitment_date: string | false;
  amount_total: number;
  currency_id: unknown;
  invoice_ids: number[];
  picking_ids: number[];
  mrp_production_ids?: number[];
  [custom: string]: unknown;
}

interface MoveRow {
  id: number;
  name: string;
  move_type: string;
  state: RawInvoice["state"];
  amount_total: number;
  amount_residual: number;
  invoice_date: string | false;
}

interface ProductionRow {
  id: number;
  name: string;
  state: MoState;
  product_id: unknown;
  product_qty: number;
  origin: string | false;
}

interface PickingRow {
  id: number;
  name: string;
  state: PickingState;
  picking_type_code: string;
  scheduled_date: string | false;
  date_done: string | false;
}

export async function fetchOdooOrders(
  client: OdooClient,
  opts: OdooFetchOptions,
): Promise<{ orders: RawOrder[]; warnings: string[] }> {
  const warnings: string[] = [];
  const soFields = await client.fieldNames("sale.order");

  const optional = [opts.tecnicoField, opts.instalacionField, "mrp_production_ids"];
  for (const f of [opts.tecnicoField, opts.instalacionField]) {
    if (!soFields.has(f)) warnings.push(`El campo ${f} no existe en sale.order: ese flujo se mostrará "sin datos".`);
  }

  const domain: Domain = [["state", "=", "sale"]];
  if (opts.orderIds) domain.push(["id", "in", opts.orderIds]);

  const orders = await client.searchRead<SaleOrderRow>(
    "sale.order",
    domain,
    [
      "name",
      "partner_id",
      "user_id",
      "date_order",
      "commitment_date",
      "amount_total",
      "currency_id",
      "invoice_ids",
      "picking_ids",
      ...optional.filter((f) => soFields.has(f)),
    ],
    { limit: opts.limit, order: "date_order desc" },
  );

  const invoiceIds = orders.flatMap((o) => o.invoice_ids);
  const pickingIds = orders.flatMap((o) => o.picking_ids);

  const [moves, pickings, productions] = await Promise.all([
    client.read<MoveRow>("account.move", invoiceIds, [
      "name",
      "move_type",
      "state",
      "amount_total",
      "amount_residual",
      "invoice_date",
    ]),
    client.read<PickingRow>("stock.picking", pickingIds, [
      "name",
      "state",
      "picking_type_code",
      "scheduled_date",
      "date_done",
    ]),
    fetchProductions(client, orders, soFields.has("mrp_production_ids")),
  ]);

  if (productions.originOnly > 0) {
    warnings.push(
      `${productions.originOnly} órdenes de fabricación se vincularon solo por su documento origen (no por la ruta MTO de Odoo).`,
    );
  }

  const moveById = new Map(moves.map((m) => [m.id, m]));
  const pickingById = new Map(pickings.map((p) => [p.id, p]));

  const result = orders.map((so): RawOrder => {
    const productionRows = [
      ...(so.mrp_production_ids ?? []).map((id) => productions.byId.get(id)).filter((p) => p !== undefined),
      ...(productions.byOrigin.get(originKey(so.name)) ?? []),
    ];

    return {
      id: so.id,
      name: so.name,
      partnerId: Array.isArray(so.partner_id) ? Number(so.partner_id[0]) : null,
      partnerName: m2oName(so.partner_id) ?? "—",
      salesperson: m2oName(so.user_id),
      dateOrder: so.date_order,
      commitmentDate: so.commitment_date || null,
      amountTotal: so.amount_total,
      currency: m2oName(so.currency_id) ?? "",
      tecnico: selectionValue(so, opts.tecnicoField, soFields),
      instalacion: selectionValue(so, opts.instalacionField, soFields),
      invoices: so.invoice_ids
        .map((id) => moveById.get(id))
        .filter((m): m is MoveRow => m !== undefined && (m.move_type === "out_invoice" || m.move_type === "out_refund"))
        .map(toInvoice),
      productions: productionRows.map(toProduction),
      pickings: so.picking_ids
        .map((id) => pickingById.get(id))
        .filter((p): p is PickingRow => p !== undefined && p.picking_type_code === "outgoing")
        .map(toPicking),
    };
  });

  return { orders: result, warnings };
}

function selectionValue(so: SaleOrderRow, field: string, fields: Set<string>): string | null {
  if (!fields.has(field)) return null;
  const value = so[field];
  // Un campo vacío equivale a la primera etapa del flujo.
  return typeof value === "string" && value ? value : "";
}

/** "S00250" y "S250" → "S250": las MO creadas fuera de la ruta MTO a veces escriben el origen sin ceros. */
export function originKey(ref: string): string {
  const m = ref.trim().match(/^([A-Za-z/]*?)0*(\d+)$/);
  return m ? `${m[1].toUpperCase()}${m[2]}` : ref.trim().toUpperCase();
}

/**
 * MO de cada OV = vínculo estándar de Odoo (mrp_production_ids, rutas MTO)
 * ∪ MO cuyo documento origen nombra la OV (MO creadas a mano o desde otra app).
 */
async function fetchProductions(client: OdooClient, orders: SaleOrderRow[], viaSaleField: boolean) {
  const fields = ["name", "state", "product_id", "product_qty", "origin"];
  const variants = [...new Set(orders.flatMap((o) => [o.name, originKey(o.name)]))];

  const [linked, byOriginRows] = await Promise.all([
    viaSaleField
      ? client.read<ProductionRow>("mrp.production", orders.flatMap((o) => o.mrp_production_ids ?? []), fields)
      : Promise.resolve([] as ProductionRow[]),
    variants.length
      ? client.searchRead<ProductionRow>("mrp.production", [["origin", "in", variants]], fields)
      : Promise.resolve([] as ProductionRow[]),
  ]);

  const linkedIds = new Set(linked.map((r) => r.id));
  const byId = new Map([...linked, ...byOriginRows].map((r) => [r.id, r]));
  const byOrigin = new Map<string, ProductionRow[]>();
  for (const r of byOriginRows) {
    if (!r.origin || linkedIds.has(r.id)) continue;
    const key = originKey(r.origin);
    byOrigin.set(key, [...(byOrigin.get(key) ?? []), r]);
  }
  return { byId, byOrigin, originOnly: byOriginRows.filter((r) => !linkedIds.has(r.id)).length };
}

function toInvoice(m: MoveRow): RawInvoice {
  return {
    id: m.id,
    name: m.name,
    moveType: m.move_type as RawInvoice["moveType"],
    state: m.state,
    amountTotal: m.amount_total,
    amountResidual: m.amount_residual,
    invoiceDate: m.invoice_date || null,
  };
}

function toProduction(p: ProductionRow): RawProduction {
  return {
    id: p.id,
    name: p.name,
    state: p.state,
    productName: m2oName(p.product_id) ?? "—",
    qty: p.product_qty,
  };
}

function toPicking(p: PickingRow): RawPicking {
  return {
    id: p.id,
    name: p.name,
    state: p.state,
    scheduledDate: p.scheduled_date || null,
    dateDone: p.date_done || null,
  };
}
