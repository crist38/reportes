import {
  Box,
  ClipboardList,
  DollarSign,
  Factory,
  GitBranch,
  TrendingUp,
  Users,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { StatusBadge } from "@/components/flow";
import { InsumosSection } from "@/components/insumos-section";
import { ReportControls } from "@/components/report-controls";
import { SourceBanner } from "@/components/source-banner";
import type { OrdersResult } from "@/lib/data/orders";
import { TRACK_BY_ID } from "@/lib/flow/definition";
import { date, money } from "@/lib/format";
import type { ReportData, ReportFilters } from "@/lib/reports";
import { TALLERES, type TallerDef, type TallerId } from "@/lib/talleres";

const TALLER_DEFAULT = { bar: "bg-slate-500", soft: "bg-slate-200", text: "text-slate-600" };
const MEDALS = ["🥇", "🥈", "🥉"];
const qty = (n: number) => n.toLocaleString("es-CL", { maximumFractionDigits: 2 });

/** Reporte de gestión, general o de un taller, con el estilo del cotizador de termopaneles. */
export function ReportView({
  r,
  filters,
  result,
  taller,
  sinVentasDelTaller = false,
}: {
  r: ReportData;
  filters: ReportFilters;
  result: OrdersResult;
  taller?: TallerDef;
  /** El taller no tiene ninguna venta en Odoo (en ningún período). */
  sinVentasDelTaller?: boolean;
}) {
  const $ = (n: number) => money(n, r.currency);
  const maxMos = Math.max(1, ...r.talleres.map((t) => t.mos));
  const maxEstado = Math.max(1, ...r.produccion.map((p) => p.mos));
  const basePath = taller ? `/reportes/${taller.id}` : "/reportes";

  return (
    <div className="space-y-8 pb-12">
      <ReportTabs active={taller?.id} />

      <header className="flex flex-col items-start justify-between gap-4 xl:flex-row xl:items-center">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-slate-800">
            {taller ? taller.nombre : "Reporte"} · {r.titulo}
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            {taller ? taller.descripcion : "Resumen de ventas, fabricación y cobranza desde Odoo."}
          </p>
        </div>
        <ReportControls filters={filters} clientes={r.clientes} basePath={basePath} />
      </header>

      <SourceBanner result={result} />

      {taller && sinVentasDelTaller && (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-6 text-sm text-slate-600">
          <p className="font-bold text-slate-800">Aún no hay ventas del {taller.nombre} en Odoo.</p>
          <p className="mt-1">
            Las ventas se asignan a cada taller por su <strong>etiqueta</strong> en Odoo. Cuando confirmes cotizaciones con la etiqueta
            «{taller.nombre}», aparecerán aquí automáticamente.
          </p>
        </div>
      )}

      <section className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard icon={DollarSign} color="bg-emerald-500" label="Ventas confirmadas ($)" value={$(r.kpis.monto)} delta={r.kpis.deltaMonto} />
        <KpiCard icon={ClipboardList} color="bg-blue-500" label="N° de ventas" value={String(r.kpis.ventas)} delta={r.kpis.deltaVentas} />
        <KpiCard icon={TrendingUp} color="bg-orange-500" label="Ticket promedio" value={$(r.kpis.ticket)} />
        <KpiCard icon={Box} color="bg-purple-500" label="Este mes (ventas)" value={String(r.kpis.esteMes)} />
      </section>

      <section className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="flex flex-col justify-between rounded-2xl border border-slate-100 bg-white p-6 shadow-sm lg:col-span-2">
          {taller ? (
            <div>
              <SectionTitle icon={Factory} title={`Producción del ${taller.nombre}`} />
              <p className="text-xs text-slate-400">Órdenes de fabricación de productos del taller en todas las ventas del período, por estado.</p>
              <div className="mt-8 space-y-5">
                {r.produccion.map((p) => (
                  <div key={p.state}>
                    <div className="mb-2 flex items-center justify-between gap-2">
                      <span className="text-sm font-semibold text-slate-700">{p.label}</span>
                      <span className={`font-mono text-sm font-bold ${taller.styles.text}`}>
                        {p.mos} MO · {qty(p.cantidad)} {taller.unidad}
                      </span>
                    </div>
                    <div className="h-3 w-full overflow-hidden rounded-full bg-slate-100">
                      <div className={`h-full rounded-full ${taller.styles.bar}`} style={{ width: `${(p.mos / maxEstado) * 100}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
          <div>
            <SectionTitle icon={Factory} title="Volumen de Producción por Taller" />
            <p className="text-xs text-slate-400">Órdenes de fabricación de las ventas del período. Tramo oscuro = terminadas.</p>
          <div className="mt-8 space-y-6">
            {r.talleres.map((t) => {
              const def = TALLERES.find((d) => d.nombre === t.nombre);
              const c = def?.styles ?? TALLER_DEFAULT;
              return (
                <div key={t.nombre}>
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <span className="text-sm font-semibold text-slate-700">{t.nombre}</span>
                    <span className={`font-mono text-sm font-bold ${c.text}`}>
                      {t.terminadas}/{t.mos} MO · {qty(t.unidades)} {def?.unidad ?? "cant."}
                    </span>
                  </div>
                  <div className="h-3 w-full overflow-hidden rounded-full bg-slate-100">
                    <div className={`flex h-full rounded-full ${c.soft}`} style={{ width: `${(t.mos / maxMos) * 100}%` }}>
                      <div className={`h-full rounded-full ${c.bar}`} style={{ width: `${t.mos ? (t.terminadas / t.mos) * 100 : 0}%` }} />
                    </div>
                  </div>
                  <p className="mt-1 text-[11px] text-slate-400">{t.enProceso} en proceso o por cerrar</p>
                </div>
              );
            })}
          </div>
          </div>
          )}
          <div className="mt-6 flex justify-between border-t border-slate-100 pt-4 text-xs text-slate-500">
            <span>* Calculado desde mrp.production vinculadas a cada venta</span>
            <span>ProWindows Ltda.</span>
          </div>
        </div>

        <div className="relative flex flex-col justify-between overflow-hidden rounded-2xl bg-gradient-to-br from-teal-500 to-emerald-600 p-6 text-white shadow-sm">
          <Wallet size={180} className="absolute right-0 bottom-0 translate-x-4 translate-y-4 opacity-10" />
          <div>
            <p className="text-xs font-semibold tracking-wider text-teal-100 uppercase">Cobranza</p>
            <h2 className="mt-1 text-2xl font-bold">Saldo por Cobrar</h2>
            <p className="mt-2 text-xs leading-relaxed text-teal-50">
              Total de las ventas del período menos lo pagado en sus facturas publicadas en Odoo.
            </p>
          </div>
          <div className="mt-8">
            <span className="block text-xs text-teal-100">Pendiente</span>
            <span className="mt-1 block font-mono text-4xl font-black break-all">{$(r.porCobrar)}</span>
            <span className="mt-2 block text-xs text-teal-100">Cobrado: {$(r.cobrado)}</span>
          </div>
        </div>
      </section>

      <InsumosSection insumos={r.insumos} vacio={insumosVacio(taller)} />

      <section className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm">
        <SectionTitle icon={GitBranch} title="Avance de los Flujos" />
        <p className="mb-6 text-xs text-slate-400">Ventas del período que ya llegaron a la última etapa de cada flujo.</p>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-5">
          {r.flujo.map((f) => {
            const def = TRACK_BY_ID[f.track];
            const pct = f.total ? (f.completas / f.total) * 100 : 0;
            return (
              <div key={f.track} className="flex flex-col justify-between rounded-xl border border-slate-100 bg-slate-50 p-4">
                <div>
                  <span className={`block text-[10px] font-bold tracking-wider uppercase ${def.styles.text}`}>{def.label}</span>
                  <span className="mt-1 block text-sm font-bold text-slate-700">
                    {def.stages[def.stages.length - 1].label}
                  </span>
                </div>
                {f.total === 0 ? (
                  <p className="mt-4 text-xs text-slate-400 italic">Sin datos en Odoo</p>
                ) : (
                  <div className="mt-4">
                    <div className="text-right font-mono text-2xl font-black text-slate-700">
                      {f.completas}
                      <span className="text-sm font-semibold text-slate-400">/{f.total}</span>
                    </div>
                    <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-slate-200">
                      <div className={`h-full rounded-full ${def.styles.dot}`} style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>

      <section className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm">
        <SectionTitle icon={Users} title="Estadísticas de Clientes Destacados" />
        <div className="mt-6 overflow-x-auto">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead>
              <tr className="border-b border-slate-100 text-xs font-bold tracking-wider text-slate-400 uppercase">
                <th className="w-24 pr-4 pb-3 text-center">Posición</th>
                <th className="pb-3">Nombre del Cliente</th>
                <th className="w-28 pb-3 text-center">N° de Ventas</th>
                <th className="w-40 pb-3 text-right">Monto Comprado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {r.ranking.length === 0 ? (
                <EmptyRow cols={4} text="No se registraron ventas confirmadas en este período." />
              ) : (
                r.ranking.map((c, i) => (
                  <tr key={`${c.name}-${i}`} className="transition-colors hover:bg-slate-50/50">
                    <td className="py-3.5 text-center font-bold text-slate-400">{MEDALS[i] ?? i + 1}</td>
                    <td className="py-3.5">
                      <div className="flex items-center gap-2">
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-teal-50 text-xs font-semibold text-teal-600">
                          {c.name.substring(0, 2).toUpperCase()}
                        </div>
                        <span className="font-semibold text-slate-700">{c.name}</span>
                      </div>
                    </td>
                    <td className="py-3.5 text-center font-mono font-medium text-slate-600">{c.pedidos}</td>
                    <td className="py-3.5 text-right font-mono font-bold text-slate-800">{$(c.total)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm">
        <SectionTitle icon={ClipboardList} title="Detalle de Ventas Confirmadas" />
        <div className="mt-6 overflow-x-auto">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead>
              <tr className="border-b border-slate-100 text-xs font-bold tracking-wider text-slate-400 uppercase">
                <th className="pb-3">N° Venta</th>
                <th className="pb-3">Cliente</th>
                <th className="w-32 pb-3 text-center">Fecha</th>
                <th className="w-36 pb-3 text-center">Estado del flujo</th>
                <th className="w-40 pb-3 text-right">Total</th>
                <th className="w-28 pb-3 text-center print:hidden">Flujo</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {r.orders.length === 0 ? (
                <EmptyRow cols={6} text="No se encontraron registros en este período." />
              ) : (
                r.orders.map((o) => (
                  <tr key={o.raw.id} className="transition-colors hover:bg-slate-50/50">
                    <td className="py-3.5 font-bold text-slate-800">{o.raw.name}</td>
                    <td className="py-3.5 font-semibold text-slate-700">{o.raw.partnerName}</td>
                    <td className="py-3.5 text-center text-xs font-medium text-slate-500">{date(o.raw.dateOrder)}</td>
                    <td className="py-3.5 text-center">
                      <StatusBadge status={o.status} />
                    </td>
                    <td className="py-3.5 text-right font-mono font-bold text-slate-800">{$(o.raw.amountTotal)}</td>
                    <td className="py-3 text-center print:hidden">
                      <Link
                        href={`/ordenes/${o.raw.id}`}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-teal-100 bg-teal-50 px-2.5 py-1.5 text-[11px] font-bold text-teal-700 transition-all hover:bg-teal-100 active:scale-95"
                      >
                        <GitBranch size={12} />
                        Ver flujo
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function insumosVacio(taller?: TallerDef): string {
  if (taller?.id === "pvc") {
    return "Las ventas del Taller PVC no traen el detalle de insumos: sus líneas solo indican la ventana, el DVH (p. ej. 4/9/4) y el color, y las órdenes de fabricación de «Ventana PVC» no tienen componentes en su lista de materiales en Odoo. Cuando esa lista tenga perfiles, herrajes y cristales, su consumo se podrá mostrar aquí.";
  }
  if (taller?.id === "aluminio") return "Aún no hay ventas del Taller Aluminio.";
  return "No hay líneas de termopaneles ni cristales en las ventas del período.";
}

function ReportTabs({ active }: { active?: TallerId }) {
  const tabs = [
    { href: "/reportes", label: "General", id: undefined as TallerId | undefined, tab: "bg-slate-800 text-white" },
    ...TALLERES.map((t) => ({ href: `/reportes/${t.id}`, label: t.nombre, id: t.id as TallerId | undefined, tab: t.styles.tab })),
  ];
  return (
    <nav className="flex flex-wrap gap-2 print:hidden">
      {tabs.map((t) => (
        <Link
          key={t.href}
          href={t.href}
          className={`rounded-xl px-4 py-2 text-sm font-bold shadow-sm transition-all ${
            t.id === active ? t.tab : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-100"
          }`}
        >
          {t.label}
        </Link>
      ))}
    </nav>
  );
}

function KpiCard({
  icon: Icon,
  color,
  label,
  value,
  delta,
}: {
  icon: LucideIcon;
  color: string;
  label: string;
  value: string;
  delta?: number | null;
}) {
  return (
    <div className="flex flex-col justify-between rounded-2xl border border-slate-100 bg-white p-6 shadow-sm transition-shadow hover:shadow-md">
      <div className="flex items-start justify-between">
        <div className={`rounded-2xl p-3.5 text-white shadow-sm ${color}`}>
          <Icon size={24} />
        </div>
        {delta !== undefined && delta !== null && (
          <span
            title="Comparado con el mes anterior"
            className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${delta >= 0 ? "bg-emerald-50 text-emerald-600" : "bg-rose-50 text-rose-600"}`}
          >
            {delta >= 0 ? "+" : ""}
            {Math.round(delta)}%
          </span>
        )}
      </div>
      <div className="mt-4">
        <p className="text-[11px] font-bold tracking-wider text-slate-400 uppercase">{label}</p>
        <p className="mt-1 font-mono text-2xl font-black break-all text-slate-800 xl:text-3xl">{value}</p>
      </div>
    </div>
  );
}

function SectionTitle({ icon: Icon, title }: { icon: LucideIcon; title: string }) {
  return (
    <div className="mb-1 flex items-center gap-2">
      <Icon className="text-teal-600" size={18} />
      <h2 className="text-lg font-bold text-slate-800">{title}</h2>
    </div>
  );
}

function EmptyRow({ cols, text }: { cols: number; text: string }) {
  return (
    <tr>
      <td colSpan={cols} className="py-6 text-center text-xs text-slate-400 italic">
        {text}
      </td>
    </tr>
  );
}
