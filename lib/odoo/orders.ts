import "server-only";

import type { MoState, PickingState, RawInvoice, RawOrder, RawPicking, RawProduction, RawSaleLine } from "@/lib/flow/types";
import { OdooClient, m2oName, type Domain } from "./client";
import { parseStageMap, tecnicoDesdeCrm } from "./crm";

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
  tag_ids?: number[];
  opportunity_id?: unknown;
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

  const optional = [opts.tecnicoField, opts.instalacionField, "mrp_production_ids", "tag_ids", "opportunity_id"];
  if (!soFields.has(opts.instalacionField)) {
    warnings.push(`El campo ${opts.instalacionField} no existe en sale.order: el flujo de instalación se mostrará "sin datos".`);
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

  const tagIds = [...new Set(orders.flatMap((o) => o.tag_ids ?? []))];

  const [moves, pickings, productions, tags, lines] = await Promise.all([
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
    client.read<{ id: number; name: string }>("crm.tag", tagIds, ["name"]),
    fetchLines(client, orders.map((o) => o.id)),
  ]);
  const tagName = new Map(tags.map((t) => [t.id, t.name]));

  const crm = await fetchCrmTecnico(client, orders, soFields.has("opportunity_id"));
  const sinCrm = orders.length - crm.byOrder.size;
  if (crm.error) warnings.push(`No se pudo leer el CRM (${crm.error}); el estado técnico sale solo de ${opts.tecnicoField}.`);
  else if (sinCrm > 0) {
    warnings.push(
      `${sinCrm} de ${orders.length} OV no tienen oportunidad en el CRM` +
        (soFields.has(opts.tecnicoField) ? ` y usan el campo ${opts.tecnicoField}.` : `: su estado técnico queda "sin datos". Crea las cotizaciones desde la oportunidad para vincularlas.`),
    );
  }

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
      tags: (so.tag_ids ?? []).map((id) => tagName.get(id)).filter((n): n is string => n !== undefined),
      salesperson: m2oName(so.user_id),
      dateOrder: so.date_order,
      commitmentDate: so.commitment_date || null,
      amountTotal: so.amount_total,
      currency: m2oName(so.currency_id) ?? "",
      tecnico: crm.byOrder.get(so.id)?.tecnico ?? selectionValue(so, opts.tecnicoField, soFields),
      tecnicoOrigen: crm.byOrder.get(so.id)?.origen ?? null,
      instalacion: selectionValue(so, opts.instalacionField, soFields),
      invoices: so.invoice_ids
        .map((id) => moveById.get(id))
        .filter((m): m is MoveRow => m !== undefined && (m.move_type === "out_invoice" || m.move_type === "out_refund"))
        .map(toInvoice),
      productions: productionRows.map(toProduction),
      lines: lines.get(so.id) ?? [],
      pickings: so.picking_ids
        .map((id) => pickingById.get(id))
        .filter((p): p is PickingRow => p !== undefined && p.picking_type_code === "outgoing")
        .map(toPicking),
    };
  });

  return { orders: result, warnings };
}

interface SaleLineRow {
  order_id: unknown;
  name: string;
  product_id: unknown;
  product_uom_qty: number;
  display_type: string | false;
  x_studio_ancho_m?: number | false;
  x_studio_alto_m?: number | false;
}

/** Líneas de producto de las OV (sin secciones ni notas), agrupadas por OV. */
async function fetchLines(client: OdooClient, orderIds: number[]): Promise<Map<number, RawSaleLine[]>> {
  const byOrder = new Map<number, RawSaleLine[]>();
  if (orderIds.length === 0) return byOrder;
  const lineFields = await client.fieldNames("sale.order.line");
  const rows = await client.searchRead<SaleLineRow>(
    "sale.order.line",
    [["order_id", "in", orderIds], ["display_type", "=", false]],
    ["order_id", "name", "product_id", "product_uom_qty", "display_type", ...["x_studio_ancho_m", "x_studio_alto_m"].filter((f) => lineFields.has(f))],
  );
  for (const r of rows) {
    const orderId = Array.isArray(r.order_id) ? Number(r.order_id[0]) : null;
    if (orderId === null) continue;
    byOrder.set(orderId, [
      ...(byOrder.get(orderId) ?? []),
      {
        description: r.name ?? "",
        productName: m2oName(r.product_id) ?? "",
        qty: r.product_uom_qty,
        anchoM: r.x_studio_ancho_m || null,
        altoM: r.x_studio_alto_m || null,
      },
    ]);
  }
  return byOrder;
}

interface LeadRow {
  id: number;
  name: string;
  partner_id: unknown;
  stage_id: unknown;
  active: boolean;
}

/**
 * Estado técnico desde el CRM: oportunidad vinculada a la OV (opportunity_id) o, si no la tiene,
 * la única oportunidad del mismo cliente. Ganado = Liberado.
 */
async function fetchCrmTecnico(client: OdooClient, orders: SaleOrderRow[], hasOpportunityField: boolean) {
  const byOrder = new Map<number, { tecnico: string | null; origen: string }>();
  try {
    const leadFields = ["name", "partner_id", "stage_id", "active"];
    const ctx = { active_test: false }; // incluir oportunidades perdidas/archivadas
    const directIds = hasOpportunityField
      ? orders.map((o) => (Array.isArray(o.opportunity_id) ? Number(o.opportunity_id[0]) : null)).filter((id): id is number => id !== null)
      : [];
    const sinVinculo = orders.filter((o) => !Array.isArray(o.opportunity_id) && Array.isArray(o.partner_id));
    const partnerIds = [...new Set(sinVinculo.map((o) => Number((o.partner_id as [number, string])[0])))];

    const [direct, byPartner] = await Promise.all([
      directIds.length ? client.call<LeadRow[]>("crm.lead", "read", { ids: [...new Set(directIds)], fields: leadFields, context: ctx }) : [],
      partnerIds.length
        ? client.searchRead<LeadRow>("crm.lead", [["type", "=", "opportunity"], ["partner_id", "in", partnerIds]], leadFields, { context: ctx })
        : [],
    ]);

    const stageIds = [...new Set([...direct, ...byPartner].map((l) => (Array.isArray(l.stage_id) ? Number(l.stage_id[0]) : null)))].filter(
      (id): id is number => id !== null,
    );
    const stages = new Map(
      (await client.read<{ id: number; name: string; is_won: boolean }>("crm.stage", stageIds, ["name", "is_won"])).map((s) => [
        s.id,
        { name: s.name, isWon: s.is_won },
      ]),
    );
    const map = parseStageMap(process.env.ODOO_CRM_ETAPAS);

    const resolve = (lead: LeadRow, via: string) => {
      const stage = Array.isArray(lead.stage_id) ? stages.get(Number(lead.stage_id[0])) : undefined;
      if (!stage) return null;
      return { tecnico: tecnicoDesdeCrm(stage, lead.active, map), origen: `CRM${via}: ${stage.name} · ${lead.name}` };
    };

    const directById = new Map(direct.map((l) => [l.id, l]));
    const leadsByPartner = new Map<number, LeadRow[]>();
    for (const l of byPartner) {
      if (!Array.isArray(l.partner_id)) continue;
      const pid = Number(l.partner_id[0]);
      leadsByPartner.set(pid, [...(leadsByPartner.get(pid) ?? []), l]);
    }

    for (const so of orders) {
      let r = null;
      if (Array.isArray(so.opportunity_id)) {
        const lead = directById.get(Number(so.opportunity_id[0]));
        r = lead ? resolve(lead, "") : null;
      } else if (Array.isArray(so.partner_id)) {
        const leads = leadsByPartner.get(Number(so.partner_id[0])) ?? [];
        // Solo si no hay ambigüedad: una única oportunidad para ese cliente.
        r = leads.length === 1 ? resolve(leads[0], " (por cliente)") : null;
      }
      if (r) byOrder.set(so.id, r);
    }
    return { byOrder, error: null };
  } catch (err) {
    return { byOrder, error: err instanceof Error ? err.message : String(err) };
  }
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
