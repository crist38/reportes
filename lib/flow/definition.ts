// Definición de los 5 flujos de estado de una Orden de Venta.
// Es la "guía" de la aplicación: el motor, los reportes y las pantallas se construyen a partir de aquí.
// Las clases de Tailwind deben ir escritas literalmente para que el compilador las detecte.

export const TRACK_IDS = ["tecnico", "financiero", "produccion", "despacho", "instalacion"] as const;
export type TrackId = (typeof TRACK_IDS)[number];

export interface StageDef {
  id: string;
  label: string;
  description: string;
}

export interface TrackStyles {
  text: string;
  solid: string;
  soft: string;
  border: string;
  dot: string;
}

export interface TrackDef {
  id: TrackId;
  label: string;
  /** De dónde sale el estado en Odoo (se muestra en la guía). */
  source: string;
  stages: StageDef[];
  styles: TrackStyles;
}

export const TRACKS: TrackDef[] = [
  {
    id: "tecnico",
    label: "Técnico",
    source:
      "Etapa de la oportunidad del CRM vinculada a la OV (Ganado = Liberado). Si no hay oportunidad, campo de selección x_estado_tecnico en sale.order.",
    styles: {
      text: "text-orange-600",
      solid: "bg-orange-500 text-white border-orange-500",
      soft: "bg-orange-50 text-orange-800 border-orange-200",
      border: "border-orange-300",
      dot: "bg-orange-500",
    },
    stages: [
      { id: "sin_medir", label: "Sin medir", description: "La OV existe pero aún no se rectifican medidas en obra." },
      { id: "medido", label: "Medido", description: "Medidas de obra registradas." },
      { id: "en_revision", label: "En revisión", description: "Oficina técnica revisa diseño y despiece." },
      { id: "aprobado", label: "Aprobado", description: "Diseño aprobado por el cliente." },
      { id: "liberado", label: "Liberado", description: "Planos y despiece liberados a fábrica." },
    ],
  },
  {
    id: "financiero",
    label: "Financiero",
    source: "Calculado desde las facturas de la OV (account.move: total, saldo residual).",
    styles: {
      text: "text-green-700",
      solid: "bg-green-600 text-white border-green-600",
      soft: "bg-green-50 text-green-800 border-green-200",
      border: "border-green-300",
      dot: "bg-green-600",
    },
    stages: [
      { id: "anticipo_pendiente", label: "Anticipo pendiente", description: "No se ha cobrado el anticipo mínimo." },
      { id: "habilitado", label: "Habilitado", description: "Anticipo cobrado: la OV puede pasar a fábrica." },
      { id: "pago_parcial", label: "Pago parcial", description: "Pagos por sobre el anticipo, sin facturar el total." },
      { id: "saldo", label: "Saldo", description: "Total facturado; queda saldo por cobrar." },
      { id: "pagado", label: "Pagado", description: "OV cobrada al 100 %." },
    ],
  },
  {
    id: "produccion",
    label: "Producción",
    source: "Calculado desde las órdenes de fabricación (mrp.production) vinculadas a la OV.",
    styles: {
      text: "text-teal-700",
      solid: "bg-teal-700 text-white border-teal-700",
      soft: "bg-teal-50 text-teal-800 border-teal-200",
      border: "border-teal-300",
      dot: "bg-teal-600",
    },
    stages: [
      { id: "sin_liberar", label: "Sin liberar", description: "Sin órdenes de fabricación confirmadas." },
      { id: "programado", label: "Programado", description: "MO confirmadas, aún sin iniciar." },
      { id: "fabricacion", label: "Fabricación", description: "Al menos una MO en proceso." },
      { id: "calidad", label: "Calidad", description: "Fabricación terminada, pendiente de control y cierre." },
      { id: "terminado", label: "Terminado", description: "Todas las MO cerradas." },
    ],
  },
  {
    id: "despacho",
    label: "Despacho",
    source: "Calculado desde las entregas (stock.picking de salida) de la OV.",
    styles: {
      text: "text-blue-700",
      solid: "bg-blue-700 text-white border-blue-700",
      soft: "bg-blue-50 text-blue-800 border-blue-200",
      border: "border-blue-300",
      dot: "bg-blue-600",
    },
    stages: [
      { id: "pendiente", label: "Pendiente", description: "Nada listo para despachar." },
      { id: "programado", label: "Programado", description: "Entrega reservada y lista para salir." },
      { id: "parcial", label: "Parcial", description: "Parte de la OV ya fue despachada." },
      { id: "completo", label: "Completo", description: "Toda la OV fue despachada." },
    ],
  },
  {
    id: "instalacion",
    label: "Instalación",
    source: "Campo de selección x_estado_instalacion en sale.order (Studio o módulo propio).",
    styles: {
      text: "text-red-600",
      solid: "bg-red-600 text-white border-red-600",
      soft: "bg-red-50 text-red-800 border-red-200",
      border: "border-red-300",
      dot: "bg-red-600",
    },
    stages: [
      { id: "no_aplica", label: "No aplica", description: "La OV no incluye instalación." },
      { id: "pendiente", label: "Pendiente", description: "Instalación contratada, sin fecha." },
      { id: "programada", label: "Programada", description: "Instalación con fecha y cuadrilla asignada." },
      { id: "en_ejecucion", label: "En ejecución", description: "Cuadrilla trabajando en obra." },
      { id: "recibida", label: "Recibida", description: "Obra recibida conforme por el cliente." },
    ],
  },
];

export const TRACK_BY_ID: Record<TrackId, TrackDef> = Object.fromEntries(
  TRACKS.map((t) => [t.id, t]),
) as Record<TrackId, TrackDef>;

export function stageIndex(track: TrackId, stageId: string): number {
  return TRACK_BY_ID[track].stages.findIndex((s) => s.id === stageId);
}

/** Una etapa es final si es la última del flujo; "No aplica" también cierra la instalación. */
export function isFinalStage(track: TrackId, index: number): boolean {
  const last = TRACK_BY_ID[track].stages.length - 1;
  return index === last || (track === "instalacion" && index === 0);
}
