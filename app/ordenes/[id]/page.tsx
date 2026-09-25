import Link from "next/link";
import { notFound } from "next/navigation";
import { GateChip, StatusBadge, TrackPipeline } from "@/components/flow";
import { SourceBanner } from "@/components/source-banner";
import { getOrder } from "@/lib/data/orders";
import { TRACK_BY_ID, TRACK_IDS } from "@/lib/flow/definition";
import { date, money } from "@/lib/format";

const MO_LABEL: Record<string, string> = {
  draft: "Borrador",
  confirmed: "Confirmada",
  progress: "En proceso",
  to_close: "Por cerrar",
  done: "Hecha",
  cancel: "Cancelada",
};
const PICK_LABEL: Record<string, string> = {
  draft: "Borrador",
  waiting: "Esperando otra operación",
  confirmed: "En espera",
  assigned: "Preparada",
  done: "Hecha",
  cancel: "Cancelada",
};

export default async function OrderPage({ params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id);
  if (!Number.isInteger(id) || id <= 0) notFound();
  const result = await getOrder(id);
  const order = result.order;
  if (!order) {
    if (result.error) return <SourceBanner result={result} />;
    notFound();
  }
  const { raw } = order;

  return (
    <div className="space-y-6">
      <div>
        <Link href="/ordenes" className="text-sm text-slate-500 hover:underline">
          ← Órdenes
        </Link>
        <div className="mt-1 flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-bold">{raw.name}</h1>
          <StatusBadge status={order.status} />
        </div>
        <p className="text-slate-600">
          {raw.partnerName} · {money(raw.amountTotal, raw.currency)} · Compromiso {date(raw.commitmentDate)}
          {raw.salesperson && ` · Vendedor: ${raw.salesperson}`}
        </p>
      </div>

      <SourceBanner result={{ ...result, warnings: result.source === "demo" ? [] : result.warnings }} />

      <section className="space-y-4 rounded-xl border border-slate-200 bg-white p-5">
        {TRACK_IDS.map((tid) => (
          <div key={tid}>
            <TrackPipeline track={tid} state={order.tracks[tid]} />
            <p className="mt-1 text-xs text-slate-500 sm:pl-36">{order.tracks[tid].detail}</p>
          </div>
        ))}
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-5">
        <h2 className="mb-3 font-semibold">Reglas del flujo</h2>
        <ul className="space-y-2">
          {order.gates.map((g) => (
            <li key={g.id} className="flex flex-wrap items-center gap-2 text-sm">
              <GateChip status={g.status} />
              <span className="font-medium">{g.label}:</span>
              <span>{g.message}</span>
            </li>
          ))}
        </ul>
      </section>

      <div className="grid gap-4 lg:grid-cols-3">
        <DocTable
          title="Facturas"
          color={TRACK_BY_ID.financiero.styles.text}
          footer={`Facturado ${money(order.invoiced, raw.currency)} · Cobrado ${money(order.paid, raw.currency)}`}
          headers={["Documento", "Total", "Saldo"]}
          rows={raw.invoices.map((i) => [
            `${i.name}${i.moveType === "out_refund" ? " (NC)" : ""}${i.state !== "posted" ? ` · ${i.state}` : ""}`,
            money(i.amountTotal, raw.currency),
            money(i.amountResidual, raw.currency),
          ])}
        />
        <DocTable
          title="Órdenes de fabricación"
          color={TRACK_BY_ID.produccion.styles.text}
          headers={["MO", "Producto", "Estado"]}
          rows={raw.productions.map((p) => [p.name, `${p.qty} × ${p.productName}`, MO_LABEL[p.state] ?? p.state])}
        />
        <DocTable
          title="Entregas"
          color={TRACK_BY_ID.despacho.styles.text}
          headers={["Entrega", "Programada", "Estado"]}
          rows={raw.pickings.map((p) => [p.name, date(p.scheduledDate), PICK_LABEL[p.state] ?? p.state])}
        />
      </div>
    </div>
  );
}

function DocTable({
  title,
  color,
  headers,
  rows,
  footer,
}: {
  title: string;
  color: string;
  headers: string[];
  rows: string[][];
  footer?: string;
}) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4">
      <h2 className={`mb-2 text-sm font-bold uppercase tracking-wide ${color}`}>{title}</h2>
      {rows.length === 0 ? (
        <p className="text-sm text-slate-500">Sin documentos.</p>
      ) : (
        <table className="w-full text-sm">
          <thead className="text-left text-xs text-slate-500">
            <tr>
              {headers.map((h) => (
                <th key={h} className="py-1 font-medium">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((r, i) => (
              <tr key={i}>
                {r.map((c, j) => (
                  <td key={j} className="py-1.5 pr-2">
                    {c}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {footer && <p className="mt-2 text-xs text-slate-500">{footer}</p>}
    </section>
  );
}
