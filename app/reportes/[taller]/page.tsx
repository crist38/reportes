import { notFound } from "next/navigation";
import { ReportView } from "@/components/report-view";
import { getOrders } from "@/lib/data/orders";
import { buildReport, parseReportFilters } from "@/lib/reports";
import { TALLER_BY_ID, isTallerId, perteneceATaller } from "@/lib/talleres";

export default async function TallerReportPage({
  params,
  searchParams,
}: {
  params: Promise<{ taller: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { taller: id } = await params;
  if (!isTallerId(id)) notFound();
  const taller = TALLER_BY_ID[id];

  const filters = parseReportFilters(await searchParams);
  const result = await getOrders();
  const orders = result.orders.filter((o) => perteneceATaller(o, taller));

  // Ventas, clientes y cobranza: las OV etiquetadas del taller.
  // Producción: lo que fabrica el taller en cualquier OV del período (p. ej. los DVH de una venta PVC
  // se fabrican en el Taller Termopanel).
  const r = buildReport(orders, filters);
  const { produccion } = buildReport(result.orders, filters, undefined, (name) => taller.producto.test(name));

  return (
    <ReportView
      r={{ ...r, produccion }}
      filters={filters}
      result={result}
      taller={taller}
      sinVentasDelTaller={!result.error && orders.length === 0}
    />
  );
}
