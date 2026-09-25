import type { TrackId } from "./definition";

// Datos "crudos" de una OV, independientes de si vienen de Odoo o de la demo.

export interface RawInvoice {
  id: number;
  name: string;
  moveType: "out_invoice" | "out_refund";
  state: "draft" | "posted" | "cancel";
  amountTotal: number;
  amountResidual: number;
  invoiceDate: string | null;
}

export type MoState = "draft" | "confirmed" | "progress" | "to_close" | "done" | "cancel";

export interface RawProduction {
  id: number;
  name: string;
  state: MoState;
  productName: string;
  qty: number;
}

export type PickingState = "draft" | "waiting" | "confirmed" | "assigned" | "done" | "cancel";

export interface RawPicking {
  id: number;
  name: string;
  state: PickingState;
  scheduledDate: string | null;
  dateDone: string | null;
}

export interface RawOrder {
  id: number;
  name: string;
  partnerId: number | null;
  partnerName: string;
  salesperson: string | null;
  dateOrder: string;
  commitmentDate: string | null;
  amountTotal: number;
  currency: string;
  /** Valor del campo de selección técnico; null si el campo no existe en Odoo. */
  tecnico: string | null;
  /** Valor del campo de selección de instalación; null si el campo no existe en Odoo. */
  instalacion: string | null;
  invoices: RawInvoice[];
  productions: RawProduction[];
  pickings: RawPicking[];
}

export interface TrackState {
  /** Índice de la etapa actual; null = sin datos. */
  index: number | null;
  /** Explicación corta de por qué está en esa etapa. */
  detail: string;
  progress?: { done: number; total: number };
}

export type GateStatus = "ok" | "accion" | "espera" | "bloqueado" | "inconsistente" | "sin_datos";

export interface GateResult {
  id: "liberacion" | "despacho" | "instalacion";
  label: string;
  status: GateStatus;
  message: string;
}

export type OrderStatus = "cerrada" | "inconsistente" | "bloqueada" | "accion" | "en_curso";

export interface OrderView {
  raw: RawOrder;
  tracks: Record<TrackId, TrackState>;
  gates: GateResult[];
  status: OrderStatus;
  paid: number;
  invoiced: number;
}
