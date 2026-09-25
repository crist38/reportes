import { TRACK_BY_ID, TRACK_IDS, isFinalStage, stageIndex, type TrackId } from "./definition";
import type {
  GateResult,
  MoState,
  OrderStatus,
  OrderView,
  RawOrder,
  TrackState,
} from "./types";

export interface FlowPolicy {
  /** Fracción del total que debe estar cobrada para quedar "Habilitado" (0.5 = 50 %). */
  anticipoPct: number;
  /** Etapa financiera mínima para permitir el despacho. */
  despachoRequiere: "habilitado" | "saldo" | "pagado";
}

export const DEFAULT_POLICY: FlowPolicy = { anticipoPct: 0.5, despachoRequiere: "pagado" };

const EPS = 0.005;

// ---------- Derivación de cada flujo ----------

function fromSelection(track: TrackId, value: string | null): TrackState {
  if (value === null) return { index: null, detail: "Campo no configurado en Odoo" };
  if (value === "") return { index: 0, detail: "Sin estado asignado en Odoo" };
  const index = stageIndex(track, value);
  if (index < 0) return { index: null, detail: `Valor desconocido: "${value}"` };
  return { index, detail: TRACK_BY_ID[track].stages[index].description };
}

export function sumPayments(order: RawOrder): { paid: number; invoiced: number } {
  let paid = 0;
  let invoiced = 0;
  for (const inv of order.invoices) {
    if (inv.state !== "posted") continue;
    const sign = inv.moveType === "out_refund" ? -1 : 1;
    invoiced += sign * inv.amountTotal;
    paid += sign * (inv.amountTotal - inv.amountResidual);
  }
  return { paid, invoiced };
}

function deriveFinanciero(order: RawOrder, policy: FlowPolicy): TrackState {
  const { paid, invoiced } = sumPayments(order);
  const total = order.amountTotal;
  if (total <= 0) return { index: stageIndex("financiero", "pagado"), detail: "OV sin monto" };

  const pct = paid / total;
  const pctText = `${Math.round(pct * 100)} % cobrado`;
  let id: string;
  if (pct >= 1 - EPS) id = "pagado";
  else if (invoiced >= total * (1 - EPS)) id = "saldo";
  else if (pct > policy.anticipoPct + EPS) id = "pago_parcial";
  else if (pct >= policy.anticipoPct - EPS) id = "habilitado";
  else id = "anticipo_pendiente";

  return { index: stageIndex("financiero", id), detail: pctText };
}

const MO_STAGE: Record<Exclude<MoState, "cancel">, string> = {
  draft: "sin_liberar",
  confirmed: "programado",
  progress: "fabricacion",
  to_close: "calidad",
  done: "terminado",
};

function deriveProduccion(order: RawOrder): TrackState {
  const mos = order.productions.filter((p) => p.state !== "cancel");
  if (mos.length === 0) return { index: 0, detail: "Sin órdenes de fabricación" };

  const indexes = mos.map((mo) => stageIndex("produccion", MO_STAGE[mo.state as Exclude<MoState, "cancel">]));
  const done = mos.filter((mo) => mo.state === "done").length;
  const anyStarted = indexes.some((i) => i >= stageIndex("produccion", "fabricacion"));
  // La OV avanza al ritmo de su MO más atrasada, salvo que alguna ya esté en fabricación.
  let index = Math.min(...indexes);
  if (anyStarted && index < stageIndex("produccion", "fabricacion")) index = stageIndex("produccion", "fabricacion");

  const detail = done > 0 && done < mos.length ? `Parcial: ${done}/${mos.length} MO terminadas` : `${done}/${mos.length} MO terminadas`;
  return { index, detail, progress: { done, total: mos.length } };
}

function deriveDespacho(order: RawOrder): TrackState {
  const picks = order.pickings.filter((p) => p.state !== "cancel");
  const done = picks.filter((p) => p.state === "done").length;
  const progress = { done, total: picks.length };
  let id: string;
  if (picks.length > 0 && done === picks.length) id = "completo";
  else if (done > 0) id = "parcial";
  else if (picks.some((p) => p.state === "assigned")) id = "programado";
  else id = "pendiente";
  const detail = picks.length === 0 ? "Sin entregas generadas" : `${done}/${picks.length} entregas realizadas`;
  return { index: stageIndex("despacho", id), detail, progress };
}

export function deriveTracks(order: RawOrder, policy: FlowPolicy): Record<TrackId, TrackState> {
  return {
    tecnico: fromSelection("tecnico", order.tecnico),
    financiero: deriveFinanciero(order, policy),
    produccion: deriveProduccion(order),
    despacho: deriveDespacho(order),
    instalacion: fromSelection("instalacion", order.instalacion),
  };
}

// ---------- Reglas entre flujos (compuertas) ----------

type Tracks = Record<TrackId, TrackState>;

/** true/false si el flujo alcanzó la etapa; null si no hay datos. */
function reached(tracks: Tracks, track: TrackId, stageId: string): boolean | null {
  const i = tracks[track].index;
  return i === null ? null : i >= stageIndex(track, stageId);
}

function gateLiberacion(t: Tracks): GateResult {
  const base = { id: "liberacion", label: "Liberación a fábrica" } as const;
  const tecnicoOk = reached(t, "tecnico", "liberado");
  const pagoOk = reached(t, "financiero", "habilitado");
  const started = reached(t, "produccion", "programado") === true;

  if (tecnicoOk === null) {
    return { ...base, status: started ? "ok" : "sin_datos", message: "Sin estado técnico en Odoo." };
  }
  const faltan = [!tecnicoOk && "técnico liberado", !pagoOk && "anticipo cobrado"].filter(Boolean).join(" y ");
  if (started) {
    return tecnicoOk && pagoOk
      ? { ...base, status: "ok", message: "Liberada con técnico y anticipo al día." }
      : { ...base, status: "inconsistente", message: `Producción iniciada sin ${faltan}.` };
  }
  if (tecnicoOk && pagoOk) return { ...base, status: "accion", message: "Lista para liberar: confirmar MO en Odoo." };
  if (tecnicoOk) return { ...base, status: "bloqueado", message: "Técnico liberado, pero bloqueada por anticipo pendiente." };
  return { ...base, status: "espera", message: `Falta ${faltan}.` };
}

function gateDespacho(t: Tracks, policy: FlowPolicy): GateResult {
  const base = { id: "despacho", label: "Despacho" } as const;
  const prodDone = reached(t, "produccion", "terminado") === true;
  const pagoOk = reached(t, "financiero", policy.despachoRequiere) === true;
  const started = reached(t, "despacho", "parcial") === true;
  const complete = reached(t, "despacho", "completo") === true;
  const requisito = TRACK_BY_ID.financiero.stages[stageIndex("financiero", policy.despachoRequiere)].label.toLowerCase();

  if (started && !pagoOk) return { ...base, status: "inconsistente", message: `Despachada sin estar en "${requisito}".` };
  if (complete && !prodDone) return { ...base, status: "inconsistente", message: "Despacho completo con MO abiertas." };
  if (complete) return { ...base, status: "ok", message: "Despacho completo." };

  const mosDone = t.produccion.progress?.done ?? 0;
  if (prodDone) {
    return pagoOk
      ? { ...base, status: "accion", message: started ? "Completar el despacho pendiente." : "Lista para despachar." }
      : { ...base, status: "bloqueado", message: `Fabricada, pero bloqueada: requiere "${requisito}".` };
  }
  if (started) return { ...base, status: "espera", message: "Despacho parcial hecho; esperando el resto de la fabricación." };
  if (mosDone > 0) {
    return pagoOk
      ? { ...base, status: "accion", message: `Despacho parcial posible: ${mosDone} MO terminadas.` }
      : { ...base, status: "bloqueado", message: `${mosDone} MO terminadas, despacho bloqueado: requiere "${requisito}".` };
  }
  return { ...base, status: "espera", message: "Esperando fin de fabricación." };
}

function gateInstalacion(t: Tracks): GateResult {
  const base = { id: "instalacion", label: "Instalación" } as const;
  const i = t.instalacion.index;
  if (i === null) return { ...base, status: "sin_datos", message: "Sin estado de instalación en Odoo." };
  if (i === stageIndex("instalacion", "no_aplica")) return { ...base, status: "ok", message: "No incluye instalación." };

  const despachoParcial = reached(t, "despacho", "parcial") === true;
  const despachoCompleto = reached(t, "despacho", "completo") === true;
  if (i >= stageIndex("instalacion", "recibida")) {
    return despachoCompleto
      ? { ...base, status: "ok", message: "Obra recibida." }
      : { ...base, status: "inconsistente", message: "Obra recibida sin despacho completo." };
  }
  if (i >= stageIndex("instalacion", "en_ejecucion") && !despachoParcial) {
    return { ...base, status: "inconsistente", message: "Instalando sin material despachado." };
  }
  if (i === stageIndex("instalacion", "pendiente") && despachoCompleto) {
    return { ...base, status: "accion", message: "Material despachado: programar instalación." };
  }
  return { ...base, status: "espera", message: TRACK_BY_ID.instalacion.stages[i].description };
}

export function evaluateGates(tracks: Tracks, policy: FlowPolicy): GateResult[] {
  return [gateLiberacion(tracks), gateDespacho(tracks, policy), gateInstalacion(tracks)];
}

function overallStatus(tracks: Tracks, gates: GateResult[]): OrderStatus {
  if (gates.some((g) => g.status === "inconsistente")) return "inconsistente";
  if (gates.some((g) => g.status === "bloqueado")) return "bloqueada";
  const allFinal = TRACK_IDS.every((id) => {
    const i = tracks[id].index;
    return i !== null && isFinalStage(id, i);
  });
  if (allFinal) return "cerrada";
  if (gates.some((g) => g.status === "accion")) return "accion";
  return "en_curso";
}

export function buildOrderView(raw: RawOrder, policy: FlowPolicy = DEFAULT_POLICY): OrderView {
  const tracks = deriveTracks(raw, policy);
  const gates = evaluateGates(tracks, policy);
  const { paid, invoiced } = sumPayments(raw);
  return { raw, tracks, gates, status: overallStatus(tracks, gates), paid, invoiced };
}
