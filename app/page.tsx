import Link from "next/link";
import { connection } from "next/server";
import { GateChip, StageMatrix, StatusBadge } from "@/components/flow";
import { SourceBanner } from "@/components/source-banner";
import { getOrders } from "@/lib/data/orders";
import type { OrderStatus } from "@/lib/flow/types";
import { date, money } from "@/lib/format";

const ALERT_ORDER: OrderStatus[] = ["inconsistente", "bloqueada", "accion"];

export default async function Dashboard() {
  await connection();
  const result = await getOrders();
  const { orders } = result;

  const count = (s: OrderStatus) => orders.filter((o) => o.status === s).length;
  const porCobrar = orders.reduce((acc, o) => acc + Math.max(0, o.raw.amountTotal - o.paid), 0);
  const currency = orders[0]?.raw.currency ?? "CLP";

  const alerts = orders
    .filter((o) => ALERT_ORDER.includes(o.status))
    .sort(
      (a, b) =>
        ALERT_ORDER.indexOf(a.status) - ALERT_ORDER.indexOf(b.status) ||
        (a.raw.commitmentDate ?? "").localeCompare(b.raw.commitmentDate ?? ""),
    );

  const kpis = [
    { label: "OV activas", value: orders.length - count("cerrada"), href: "/ordenes" },
    { label: "Inconsistentes", value: count("inconsistente"), href: "/ordenes?status=inconsistente", tone: "text-fuchsia-700" },
    { label: "Bloqueadas", value: count("bloqueada"), href: "/ordenes?status=bloqueada", tone: "text-red-700" },
    { label: "Acción pendiente", value: count("accion"), href: "/ordenes?status=accion", tone: "text-amber-700" },
    { label: "Por cobrar", value: money(porCobrar, currency), href: "/ordenes?track=financiero&stage=saldo" },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h1 className="text-2xl font-bold">Estados visibles en la Orden de Venta</h1>
          <p className="text-slate-600">Un solo estado no alcanza para representar todo lo que ocurre.</p>
        </div>
        <span className="rounded-full bg-slate-200 px-3 py-1 text-xs text-slate-700">
          Fuente: {result.source === "demo" ? "datos demo" : "Odoo"}
        </span>
      </div>

      <SourceBanner result={result} />

      <section className="grid grid-cols-2 gap-3 md:grid-cols-5">
        {kpis.map((k) => (
          <Link key={k.label} href={k.href} className="rounded-xl border border-slate-200 bg-white p-4 hover:shadow-md">
            <div className="text-xs text-slate-500">{k.label}</div>
            <div className={`mt-1 text-xl font-semibold tabular-nums break-all lg:text-2xl ${k.tone ?? ""}`}>{k.value}</div>
          </Link>
        ))}
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-5">
        <h2 className="mb-4 font-semibold">OV por flujo y etapa</h2>
        <StageMatrix orders={orders} />
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-5">
        <h2 className="mb-3 font-semibold">Qué hay que resolver</h2>
        {alerts.length === 0 ? (
          <p className="text-sm text-slate-500">Sin bloqueos, inconsistencias ni acciones pendientes.</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {alerts.map((o) => (
              <li key={o.raw.id} className="flex flex-wrap items-start gap-x-4 gap-y-1 py-3">
                <Link href={`/ordenes/${o.raw.id}`} className="w-20 font-semibold text-blue-700 hover:underline">
                  {o.raw.name}
                </Link>
                <div className="min-w-48 flex-1">
                  <div className="text-sm">{o.raw.partnerName}</div>
                  <div className="text-xs text-slate-500">Compromiso: {date(o.raw.commitmentDate)}</div>
                </div>
                <ul className="flex-[2] space-y-1">
                  {o.gates
                    .filter((g) => g.status === "inconsistente" || g.status === "bloqueado" || g.status === "accion")
                    .map((g) => (
                      <li key={g.id} className="flex items-center gap-2 text-sm">
                        <GateChip status={g.status} />
                        <span className="text-slate-500">{g.label}:</span> {g.message}
                      </li>
                    ))}
                </ul>
                <StatusBadge status={o.status} />
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
