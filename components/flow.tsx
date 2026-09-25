import Link from "next/link";
import { TRACKS, TRACK_BY_ID, type TrackId } from "@/lib/flow/definition";
import { STATUS_META } from "@/lib/flow/filters";
import type { GateStatus, OrderStatus, OrderView, TrackState } from "@/lib/flow/types";

/** Fila de etapas con chevrons, como en la guía. `index` null = sin datos; "guide" = muestra el flujo vacío. */
export function TrackPipeline({ track, state }: { track: TrackId; state: TrackState | "guide" }) {
  const def = TRACK_BY_ID[track];
  const current = state === "guide" ? def.stages.length - 1 : state.index;

  return (
    <div className="grid gap-2 sm:grid-cols-[9rem_1fr] sm:items-center">
      <div className={`text-sm font-bold uppercase tracking-wide ${def.styles.text}`}>{def.label}</div>
      <ol className="flex flex-wrap items-center gap-1">
        {def.stages.map((stage, i) => {
          let cls = `bg-white text-slate-600 ${def.styles.border}`;
          if (current !== null && i === current) cls = `${def.styles.solid} font-semibold shadow-sm`;
          // "No aplica" es una alternativa, no un paso previo: no se marca como recorrido.
          else if (state !== "guide" && current !== null && i < current && !(track === "instalacion" && i === 0)) cls = def.styles.soft;
          return (
            <li key={stage.id} className="flex items-center gap-1">
              <span title={stage.description} className={`rounded-lg border px-3 py-2 text-sm whitespace-nowrap ${cls}`}>
                {stage.label}
              </span>
              {i < def.stages.length - 1 && <span className={`text-xs ${def.styles.text}`}>›</span>}
            </li>
          );
        })}
        {state !== "guide" && current === null && (
          <li className="rounded-lg border border-dashed border-slate-300 px-3 py-2 text-sm text-slate-500">Sin datos</li>
        )}
      </ol>
    </div>
  );
}

/** Versión compacta para tablas: una barra segmentada por flujo. */
export function MiniTrack({ track, state }: { track: TrackId; state: TrackState }) {
  const def = TRACK_BY_ID[track];
  const label = state.index === null ? "Sin datos" : def.stages[state.index].label;
  return (
    <div className="min-w-24" title={`${def.label}: ${label} — ${state.detail}`}>
      <div className="flex gap-0.5">
        {def.stages.map((s, i) => (
          <span
            key={s.id}
            className={`h-1.5 flex-1 rounded-full ${state.index !== null && i <= state.index ? def.styles.dot : "bg-slate-200"}`}
          />
        ))}
      </div>
      <div className={`mt-1 text-xs ${state.index === null ? "text-slate-400" : "text-slate-700"}`}>{label}</div>
    </div>
  );
}

export function StatusBadge({ status }: { status: OrderStatus }) {
  const meta = STATUS_META[status];
  return (
    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset whitespace-nowrap ${meta.className}`}>
      {meta.label}
    </span>
  );
}

export const GATE_META: Record<GateStatus, { label: string; className: string }> = {
  ok: { label: "OK", className: "bg-emerald-100 text-emerald-800" },
  accion: { label: "Acción", className: "bg-amber-100 text-amber-900" },
  espera: { label: "En espera", className: "bg-slate-100 text-slate-600" },
  bloqueado: { label: "Bloqueado", className: "bg-red-100 text-red-800" },
  inconsistente: { label: "Inconsistente", className: "bg-fuchsia-100 text-fuchsia-800" },
  sin_datos: { label: "Sin datos", className: "bg-slate-100 text-slate-500" },
};

export function GateChip({ status }: { status: GateStatus }) {
  const meta = GATE_META[status];
  return <span className={`rounded px-1.5 py-0.5 text-xs font-medium whitespace-nowrap ${meta.className}`}>{meta.label}</span>;
}

/** Matriz flujo × etapa con el número de OV en cada celda; cada celda filtra la lista de órdenes. */
export function StageMatrix({ orders }: { orders: OrderView[] }) {
  return (
    <div className="space-y-4">
      {TRACKS.map((def) => {
        const counts = def.stages.map((_, i) => orders.filter((o) => o.tracks[def.id].index === i).length);
        const missing = orders.filter((o) => o.tracks[def.id].index === null).length;
        return (
          <div key={def.id} className="grid gap-2 sm:grid-cols-[9rem_1fr] sm:items-center">
            <div className={`text-sm font-bold uppercase tracking-wide ${def.styles.text}`}>{def.label}</div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
              {def.stages.map((stage, i) => {
                const n = counts[i];
                const last = i === def.stages.length - 1;
                return (
                  <Link
                    key={stage.id}
                    href={`/ordenes?track=${def.id}&stage=${stage.id}`}
                    title={stage.description}
                    className={`rounded-lg border px-3 py-2 transition hover:shadow-md ${
                      last ? def.styles.solid : n > 0 ? `bg-white ${def.styles.border}` : "border-slate-200 bg-slate-50 text-slate-400"
                    }`}
                  >
                    <div className="text-xs">{stage.label}</div>
                    <div className="text-2xl font-semibold tabular-nums">{n}</div>
                  </Link>
                );
              })}
            </div>
            {missing > 0 && (
              <p className="text-xs text-slate-500 sm:col-start-2">{missing} OV sin datos para este flujo.</p>
            )}
          </div>
        );
      })}
    </div>
  );
}
