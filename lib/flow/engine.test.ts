import { describe, expect, it } from "vitest";
import { demoOrders } from "@/lib/data/demo";
import { TRACK_BY_ID, type TrackId } from "./definition";
import { buildOrderView, DEFAULT_POLICY } from "./engine";
import type { OrderView, RawOrder } from "./types";

const base: RawOrder = {
  id: 1,
  name: "S1",
  partnerId: 1,
  partnerName: "Cliente",
  tags: [],
  salesperson: null,
  dateOrder: "2026-09-01 10:00:00",
  commitmentDate: null,
  amountTotal: 1000,
  currency: "CLP",
  tecnico: "liberado",
  instalacion: "no_aplica",
  invoices: [],
  productions: [],
  pickings: [],
};

const inv = (amount: number, residual: number, refund = false) => ({
  id: Math.random(),
  name: "INV",
  moveType: refund ? ("out_refund" as const) : ("out_invoice" as const),
  state: "posted" as const,
  amountTotal: amount,
  amountResidual: residual,
  invoiceDate: null,
});

const stage = (o: OrderView, t: TrackId) => {
  const i = o.tracks[t].index;
  return i === null ? null : TRACK_BY_ID[t].stages[i].id;
};
const gate = (o: OrderView, id: string) => o.gates.find((g) => g.id === id)!.status;

describe("financiero", () => {
  it.each([
    [[], "anticipo_pendiente"],
    [[inv(500, 0)], "habilitado"],
    [[inv(700, 0)], "pago_parcial"],
    [[inv(500, 0), inv(500, 500)], "saldo"],
    [[inv(1000, 0)], "pagado"],
    [[inv(1000, 0), inv(200, 0, true)], "pago_parcial"],
  ])("facturas %j → %s", (invoices, expected) => {
    expect(stage(buildOrderView({ ...base, invoices }), "financiero")).toBe(expected);
  });

  it("ignora facturas en borrador", () => {
    const o = buildOrderView({ ...base, invoices: [{ ...inv(1000, 0), state: "draft" }] });
    expect(stage(o, "financiero")).toBe("anticipo_pendiente");
  });
});

describe("producción", () => {
  const mo = (state: RawOrder["productions"][number]["state"]) => ({ id: 1, name: "MO", state, productName: "V", qty: 1 });

  it("sin MO → sin liberar; canceladas no cuentan", () => {
    expect(stage(buildOrderView({ ...base, productions: [mo("cancel")] }), "produccion")).toBe("sin_liberar");
  });
  it("avanza con la MO más atrasada, pero cualquier MO iniciada = fabricación", () => {
    expect(stage(buildOrderView({ ...base, productions: [mo("done"), mo("confirmed")] }), "produccion")).toBe("fabricacion");
    expect(stage(buildOrderView({ ...base, productions: [mo("done"), mo("to_close")] }), "produccion")).toBe("calidad");
    expect(stage(buildOrderView({ ...base, productions: [mo("confirmed"), mo("draft")] }), "produccion")).toBe("sin_liberar");
    expect(stage(buildOrderView({ ...base, productions: [mo("done"), mo("done")] }), "produccion")).toBe("terminado");
  });
});

describe("reglas", () => {
  it("técnico liberado sin anticipo → liberación bloqueada", () => {
    const o = buildOrderView({ ...base, instalacion: "pendiente" });
    expect(gate(o, "liberacion")).toBe("bloqueado");
    expect(o.status).toBe("bloqueada");
  });

  it("MO en proceso sin técnico liberado → inconsistente", () => {
    const o = buildOrderView({
      ...base,
      tecnico: "en_revision",
      invoices: [inv(500, 0)],
      productions: [{ id: 1, name: "MO", state: "progress", productName: "V", qty: 1 }],
    });
    expect(gate(o, "liberacion")).toBe("inconsistente");
    expect(o.status).toBe("inconsistente");
  });

  it("campos técnicos ausentes en Odoo → sin datos, no bloquea", () => {
    const o = buildOrderView({ ...base, tecnico: null, instalacion: null });
    expect(o.tracks.tecnico.index).toBeNull();
    expect(gate(o, "liberacion")).toBe("sin_datos");
  });

  it("política de despacho configurable", () => {
    const raw: RawOrder = {
      ...base,
      invoices: [inv(1000, 400)],
      productions: [{ id: 1, name: "MO", state: "done", productName: "V", qty: 1 }],
      pickings: [{ id: 1, name: "OUT", state: "assigned", scheduledDate: null, dateDone: null }],
    };
    expect(gate(buildOrderView(raw), "despacho")).toBe("bloqueado");
    expect(gate(buildOrderView(raw, { ...DEFAULT_POLICY, despachoRequiere: "saldo" }), "despacho")).toBe("accion");
  });
});

describe("datos demo", () => {
  const views = demoOrders().map((o) => buildOrderView(o));
  const byName = (n: string) => views.find((v) => v.raw.name === n)!;

  it("el ejemplo de la guía: liberada, fabricada parcialmente y bloqueada por saldo", () => {
    const o = byName("S00409");
    expect(stage(o, "tecnico")).toBe("liberado");
    expect(o.tracks.produccion.progress).toEqual({ done: 2, total: 3 });
    expect(stage(o, "financiero")).toBe("saldo");
    expect(gate(o, "despacho")).toBe("bloqueado");
    expect(o.status).toBe("bloqueada");
  });

  it("cubre todos los estados globales", () => {
    const statuses = new Set(views.map((v) => v.status));
    expect([...statuses].sort()).toEqual(["accion", "bloqueada", "cerrada", "en_curso", "inconsistente"]);
  });
});
