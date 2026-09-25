import { ReportView } from "@/components/report-view";
import { getOrders } from "@/lib/data/orders";
import { buildReport, parseReportFilters } from "@/lib/reports";

export default async function ReportesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const filters = parseReportFilters(await searchParams);
  const result = await getOrders();
  return <ReportView r={buildReport(result.orders, filters)} filters={filters} result={result} />;
}
