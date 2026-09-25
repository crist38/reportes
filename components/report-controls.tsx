"use client";

import { Calendar, Printer, RefreshCw, Users } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { refrescarDatos } from "@/app/actions";
import { PERIODOS, type ReportFilters } from "@/lib/reports";

const SELECT =
  "w-full appearance-none rounded-xl border border-slate-200 bg-white px-4 py-2.5 pr-10 text-sm font-semibold text-slate-700 shadow-sm outline-none transition-all focus:border-teal-500 focus:ring-2 focus:ring-teal-500";

export function ReportControls({
  filters,
  clientes,
  basePath,
}: {
  filters: ReportFilters;
  clientes: { id: number; name: string }[];
  basePath: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const go = (next: Partial<ReportFilters>) => {
    const f = { ...filters, ...next };
    const p = new URLSearchParams({ periodo: f.periodo });
    if (f.periodo === "fecha" && f.fecha) p.set("fecha", f.fecha);
    if (f.cliente) p.set("cliente", String(f.cliente));
    startTransition(() => router.push(`${basePath}?${p}`));
  };

  return (
    <div className="flex w-full flex-col items-center gap-3 self-stretch sm:flex-row xl:w-auto xl:self-auto print:hidden">
      <div className="relative w-full sm:w-64">
        <select
          aria-label="Cliente"
          value={filters.cliente ?? ""}
          onChange={(e) => go({ cliente: e.target.value ? Number(e.target.value) : undefined })}
          className={`${SELECT} truncate`}
        >
          <option value="">Todos los Clientes</option>
          {clientes.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <Users size={16} className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-slate-400" />
      </div>

      <div className="relative w-full sm:w-44">
        <select
          aria-label="Período"
          value={filters.periodo}
          onChange={(e) => go({ periodo: e.target.value as ReportFilters["periodo"] })}
          className={SELECT}
        >
          {PERIODOS.map((p) => (
            <option key={p.id} value={p.id}>
              {p.label}
            </option>
          ))}
        </select>
      </div>

      {filters.periodo === "fecha" && (
        <div className="relative w-full sm:w-44">
          <input
            type="date"
            aria-label="Fecha"
            value={filters.fecha ?? ""}
            onChange={(e) => go({ fecha: e.target.value || undefined })}
            className={SELECT}
          />
          <Calendar size={16} className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-slate-400" />
        </div>
      )}

      <button
        onClick={() => window.print()}
        className="flex w-full items-center justify-center gap-2 rounded-xl bg-slate-100 px-5 py-2.5 text-sm font-bold whitespace-nowrap text-slate-700 shadow-sm transition-all hover:bg-slate-200 active:scale-95 sm:w-auto"
      >
        <Printer size={16} />
        Imprimir
      </button>
      <button
        onClick={() =>
          startTransition(async () => {
            await refrescarDatos();
            router.refresh();
          })
        }
        className="flex w-full items-center justify-center gap-2 rounded-xl bg-teal-500 px-5 py-2.5 text-sm font-bold whitespace-nowrap text-white shadow-sm transition-all hover:bg-teal-600 active:scale-95 sm:w-auto"
      >
        <RefreshCw size={16} className={pending ? "animate-spin" : ""} />
        Nuevo Reporte
      </button>
    </div>
  );
}
