import Link from "next/link";
import { MiniTrack, StatusBadge } from "@/components/flow";
import { SourceBanner } from "@/components/source-banner";
import { getOrders } from "@/lib/data/orders";
import { TRACK_BY_ID, TRACK_IDS } from "@/lib/flow/definition";
import { STATUS_META, applyFilters, filtersToQuery, parseFilters } from "@/lib/flow/filters";
import type { OrderStatus } from "@/lib/flow/types";
import { date, money } from "@/lib/format";

export default async function OrdersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const filters = parseFilters(await searchParams);
  const result = await getOrders();
  const orders = applyFilters(result.orders, filters);
  const stageLabel =
    filters.track && filters.stage
      ? TRACK_BY_ID[filters.track].stages.find((s) => s.id === filters.stage)?.label
      : undefined;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Órdenes de venta</h1>
          <p className="text-sm text-slate-600">
            {orders.length} de {result.orders.length} OV
            {stageLabel && filters.track && (
              <>
                {" "}· {TRACK_BY_ID[filters.track].label}: <strong>{stageLabel}</strong>
              </>
            )}
          </p>
        </div>
        <a
          href={`/api/reporte${filtersToQuery(filters)}`}
          className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700"
        >
          Exportar CSV
        </a>
      </div>

      <SourceBanner result={result} />

      <form className="flex flex-wrap items-end gap-2 rounded-xl border border-slate-200 bg-white p-3" action="/ordenes">
        {filters.track && <input type="hidden" name="track" value={filters.track} />}
        {filters.stage && <input type="hidden" name="stage" value={filters.stage} />}
        <label className="flex flex-col text-xs text-slate-500">
          Buscar
          <input
            name="q"
            defaultValue={filters.q}
            placeholder="OV o cliente"
            className="mt-1 rounded-md border border-slate-300 px-2 py-1.5 text-sm text-slate-900"
          />
        </label>
        <label className="flex flex-col text-xs text-slate-500">
          Estado
          <select
            name="status"
            defaultValue={filters.status ?? ""}
            className="mt-1 rounded-md border border-slate-300 px-2 py-1.5 text-sm text-slate-900"
          >
            <option value="">Todos</option>
            {(Object.keys(STATUS_META) as OrderStatus[]).map((s) => (
              <option key={s} value={s}>
                {STATUS_META[s].label}
              </option>
            ))}
          </select>
        </label>
        <button className="rounded-md bg-blue-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-600">Filtrar</button>
        {(filters.q || filters.status || filters.track) && (
          <Link href="/ordenes" className="px-2 py-1.5 text-sm text-slate-600 hover:underline">
            Limpiar
          </Link>
        )}
      </form>

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs text-slate-500">
            <tr>
              <th className="px-3 py-2 font-medium">OV</th>
              <th className="px-3 py-2 font-medium">Cliente</th>
              <th className="px-3 py-2 font-medium">Compromiso</th>
              <th className="px-3 py-2 text-right font-medium">Total</th>
              {TRACK_IDS.map((id) => (
                <th key={id} className={`px-3 py-2 font-medium ${TRACK_BY_ID[id].styles.text}`}>
                  {TRACK_BY_ID[id].label}
                </th>
              ))}
              <th className="px-3 py-2 font-medium">Estado</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {orders.map((o) => (
              <tr key={o.raw.id} className="hover:bg-slate-50">
                <td className="px-3 py-2">
                  <Link href={`/ordenes/${o.raw.id}`} className="font-semibold text-blue-700 hover:underline">
                    {o.raw.name}
                  </Link>
                </td>
                <td className="px-3 py-2">{o.raw.partnerName}</td>
                <td className="px-3 py-2 whitespace-nowrap">{date(o.raw.commitmentDate)}</td>
                <td className="px-3 py-2 text-right tabular-nums whitespace-nowrap">{money(o.raw.amountTotal, o.raw.currency)}</td>
                {TRACK_IDS.map((id) => (
                  <td key={id} className="px-3 py-2">
                    <MiniTrack track={id} state={o.tracks[id]} />
                  </td>
                ))}
                <td className="px-3 py-2">
                  <StatusBadge status={o.status} />
                </td>
              </tr>
            ))}
            {orders.length === 0 && (
              <tr>
                <td colSpan={10} className="px-3 py-8 text-center text-slate-500">
                  No hay OV con estos filtros.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
