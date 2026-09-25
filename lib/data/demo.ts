import type { MoState, PickingState, RawInvoice, RawOrder } from "@/lib/flow/types";

// Datos de demostración: cubren todas las etapas y los casos de bloqueo e inconsistencia.
// Se usan cuando no hay ODOO_URL / ODOO_DB / ODOO_API_KEY configurados.

let seq = 1000;
const nextId = () => ++seq;

function invoices(total: number, parts: { pct: number; paidPct: number; refund?: boolean }[]): RawInvoice[] {
  return parts.map((p) => {
    const id = nextId();
    const amount = Math.round(total * p.pct);
    return {
      id,
      name: `${p.refund ? "RINV" : "INV"}/2026/${String(id).padStart(5, "0")}`,
      moveType: p.refund ? "out_refund" : "out_invoice",
      state: "posted",
      amountTotal: amount,
      amountResidual: Math.round(amount * (1 - p.paidPct)),
      invoiceDate: "2026-09-01",
    };
  });
}

const PRODUCTS = ["Ventana PVC corredera 2H", "Ventana PVC proyectante", "Puerta PVC 1H", "Termopanel DVH 4/12/4"];

function productions(states: MoState[]) {
  return states.map((state, i) => {
    const id = nextId();
    return { id, name: `WH/MO/${String(id).padStart(5, "0")}`, state, productName: PRODUCTS[i % PRODUCTS.length], qty: 1 + (i % 3) };
  });
}

function pickings(states: PickingState[]) {
  return states.map((state) => {
    const id = nextId();
    return {
      id,
      name: `WH/OUT/${String(id).padStart(5, "0")}`,
      state,
      scheduledDate: "2026-10-05 09:00:00",
      dateDone: state === "done" ? "2026-09-20 16:30:00" : null,
    };
  });
}

interface Spec {
  name: string;
  partner: string;
  total: number;
  tecnico: string;
  instalacion: string;
  pays: { pct: number; paidPct: number; refund?: boolean }[];
  mos: MoState[];
  picks: PickingState[];
  commitment: string;
}

const SPECS: Spec[] = [
  { name: "S00401", partner: "Constructora Andes SpA", total: 18_450_000, tecnico: "sin_medir", instalacion: "pendiente", pays: [], mos: [], picks: [], commitment: "2026-11-20" },
  { name: "S00402", partner: "María Fernanda Rojas", total: 2_380_000, tecnico: "medido", instalacion: "pendiente", pays: [{ pct: 0.5, paidPct: 1 }], mos: [], picks: [], commitment: "2026-10-30" },
  { name: "S00403", partner: "Inmobiliaria Los Robles", total: 42_900_000, tecnico: "en_revision", instalacion: "pendiente", pays: [{ pct: 0.5, paidPct: 0.4 }], mos: [], picks: [], commitment: "2026-12-15" },
  { name: "S00404", partner: "Colegio San Rafael", total: 9_870_000, tecnico: "aprobado", instalacion: "no_aplica", pays: [{ pct: 0.5, paidPct: 1 }], mos: [], picks: [], commitment: "2026-10-25" },
  { name: "S00405", partner: "Hotel Puerto Varas", total: 27_300_000, tecnico: "liberado", instalacion: "pendiente", pays: [{ pct: 0.5, paidPct: 1 }], mos: [], picks: [], commitment: "2026-11-05" },
  { name: "S00406", partner: "Juan Pablo Muñoz", total: 1_640_000, tecnico: "liberado", instalacion: "pendiente", pays: [{ pct: 0.5, paidPct: 0.3 }], mos: [], picks: [], commitment: "2026-10-18" },
  { name: "S00407", partner: "Clínica Alemana Sur", total: 15_200_000, tecnico: "liberado", instalacion: "pendiente", pays: [{ pct: 0.5, paidPct: 1 }], mos: ["confirmed", "confirmed", "confirmed"], picks: ["waiting"], commitment: "2026-10-28" },
  { name: "S00408", partner: "Edificio Mirador", total: 33_750_000, tecnico: "liberado", instalacion: "programada", pays: [{ pct: 0.5, paidPct: 1 }, { pct: 0.2, paidPct: 1 }], mos: ["progress", "confirmed", "confirmed", "progress"], picks: ["waiting"], commitment: "2026-10-22" },
  // Ejemplo de la guía: liberada, fabricada parcialmente y bloqueada por saldo pendiente.
  { name: "S00409", partner: "Constructora Pacífico", total: 21_600_000, tecnico: "liberado", instalacion: "pendiente", pays: [{ pct: 0.5, paidPct: 1 }, { pct: 0.5, paidPct: 0 }], mos: ["done", "done", "progress"], picks: ["confirmed"], commitment: "2026-10-10" },
  { name: "S00410", partner: "Carolina Soto", total: 3_150_000, tecnico: "liberado", instalacion: "no_aplica", pays: [{ pct: 0.5, paidPct: 1 }, { pct: 0.5, paidPct: 1 }], mos: ["to_close"], picks: ["waiting"], commitment: "2026-10-08" },
  { name: "S00411", partner: "Municipalidad de Frutillar", total: 12_480_000, tecnico: "liberado", instalacion: "pendiente", pays: [{ pct: 0.5, paidPct: 1 }, { pct: 0.5, paidPct: 1 }], mos: ["done", "done"], picks: ["assigned"], commitment: "2026-10-03" },
  { name: "S00412", partner: "Agrícola El Maitén", total: 6_720_000, tecnico: "liberado", instalacion: "pendiente", pays: [{ pct: 0.5, paidPct: 1 }, { pct: 0.5, paidPct: 0.6 }], mos: ["done", "done"], picks: ["confirmed"], commitment: "2026-09-30" },
  { name: "S00413", partner: "Condominio Las Lengas", total: 48_300_000, tecnico: "liberado", instalacion: "en_ejecucion", pays: [{ pct: 0.5, paidPct: 1 }, { pct: 0.5, paidPct: 1 }], mos: ["done", "done", "done"], picks: ["done", "assigned"], commitment: "2026-09-26" },
  { name: "S00414", partner: "Ricardo Fuentes", total: 2_050_000, tecnico: "liberado", instalacion: "pendiente", pays: [{ pct: 0.5, paidPct: 1 }, { pct: 0.5, paidPct: 1 }], mos: ["done"], picks: ["done"], commitment: "2026-09-18" },
  { name: "S00415", partner: "Oficinas Nueva Costanera", total: 19_900_000, tecnico: "liberado", instalacion: "recibida", pays: [{ pct: 0.5, paidPct: 1 }, { pct: 0.5, paidPct: 1 }], mos: ["done", "done"], picks: ["done"], commitment: "2026-09-12" },
  { name: "S00416", partner: "Ferretería Osorno", total: 4_420_000, tecnico: "liberado", instalacion: "no_aplica", pays: [{ pct: 1, paidPct: 1 }], mos: ["done"], picks: ["done"], commitment: "2026-09-05" },
  // Inconsistencias típicas que el reporte debe detectar.
  { name: "S00417", partner: "Casa Taller Ñuble", total: 5_600_000, tecnico: "en_revision", instalacion: "pendiente", pays: [{ pct: 0.5, paidPct: 1 }], mos: ["progress"], picks: [], commitment: "2026-10-15" },
  { name: "S00418", partner: "Sociedad Río Bueno", total: 8_300_000, tecnico: "liberado", instalacion: "no_aplica", pays: [{ pct: 1, paidPct: 0.7 }], mos: ["done"], picks: ["done"], commitment: "2026-09-15" },
];

export function demoOrders(): RawOrder[] {
  seq = 1000;
  return SPECS.map((s, i) => ({
    id: i + 1,
    name: s.name,
    partnerId: 500 + i,
    partnerName: s.partner,
    salesperson: i % 2 ? "Paula Díaz" : "Andrés Vera",
    // Mitad en agosto y mitad en septiembre 2026, para que "Este mes" y la comparación tengan datos.
    dateOrder: `2026-${i % 2 ? "08" : "09"}-${String(1 + i).padStart(2, "0")} 14:00:00`,
    commitmentDate: `${s.commitment} 12:00:00`,
    amountTotal: s.total,
    currency: "CLP",
    tecnico: s.tecnico,
    instalacion: s.instalacion,
    invoices: invoices(s.total, s.pays),
    productions: productions(s.mos),
    pickings: pickings(s.picks),
  }));
}
