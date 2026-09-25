import type { OrdersResult } from "@/lib/data/orders";

export function SourceBanner({ result }: { result: OrdersResult }) {
  return (
    <div className="space-y-2">
      {result.error && (
        <div className="rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-800">
          <strong>No se pudo leer Odoo.</strong> {result.error}
        </div>
      )}
      {result.warnings.map((w) => (
        <div key={w} className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-2 text-sm text-amber-900">
          {w}
        </div>
      ))}
    </div>
  );
}
