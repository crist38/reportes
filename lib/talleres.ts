import type { OrderView } from "./flow/types";

// Talleres de la fábrica. Una OV pertenece a un taller por su etiqueta de venta en Odoo
// (p. ej. "Termopanel", "Taller PVC"); si no tiene etiquetas, por el producto de sus MO.

export type TallerId = "pvc" | "aluminio" | "termopanel";

export interface TallerDef {
  id: TallerId;
  nombre: string;
  /** Etiqueta de sale.order que identifica al taller. */
  tag: RegExp;
  /** Nombre de producto fabricado por el taller. */
  producto: RegExp;
  /** Unidad de medida de sus órdenes de fabricación. */
  unidad: string;
  descripcion: string;
  styles: { bar: string; soft: string; text: string; tab: string };
}

export const TALLERES: TallerDef[] = [
  {
    id: "pvc",
    nombre: "Taller PVC",
    tag: /pvc/i,
    producto: /ventana|puerta|pvc/i,
    unidad: "uds",
    descripcion: "Ventanas y puertas de PVC.",
    styles: { bar: "bg-teal-500", soft: "bg-teal-200", text: "text-teal-600", tab: "bg-teal-600 text-white" },
  },
  {
    id: "aluminio",
    nombre: "Taller Aluminio",
    tag: /alumin/i,
    producto: /alumin/i,
    unidad: "uds",
    descripcion: "Ventanas y puertas de aluminio.",
    styles: { bar: "bg-sky-500", soft: "bg-sky-200", text: "text-sky-600", tab: "bg-sky-600 text-white" },
  },
  {
    id: "termopanel",
    nombre: "Taller Termopanel",
    tag: /termopanel|dvh/i,
    producto: /dvh|termopanel/i,
    unidad: "m²",
    descripcion: "Termopaneles (DVH) y cristales.",
    styles: { bar: "bg-indigo-500", soft: "bg-indigo-200", text: "text-indigo-600", tab: "bg-indigo-600 text-white" },
  },
];

export const TALLER_BY_ID = Object.fromEntries(TALLERES.map((t) => [t.id, t])) as Record<TallerId, TallerDef>;

export function isTallerId(value: string): value is TallerId {
  return Object.hasOwn(TALLER_BY_ID, value);
}

/** Taller de un producto fabricado, o null si no corresponde a ninguno. */
export function tallerDeProducto(productName: string): TallerDef | null {
  return TALLERES.find((t) => t.producto.test(productName)) ?? null;
}

export function perteneceATaller(order: OrderView, taller: TallerDef): boolean {
  const { tags, productions } = order.raw;
  if (tags.length > 0) return tags.some((tag) => taller.tag.test(tag));
  return productions.some((mo) => taller.producto.test(mo.productName));
}
