import type { NextRequest } from "next/server";
import { getOrders } from "@/lib/data/orders";
import { TRACK_BY_ID, TRACK_IDS } from "@/lib/flow/definition";
import { STATUS_META, applyFilters, parseFilters } from "@/lib/flow/filters";

function csvCell(value: string | number): string {
  const s = String(value);
  return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export async function GET(request: NextRequest) {
  const filters = parseFilters(Object.fromEntries(request.nextUrl.searchParams));
  const result = await getOrders();
  if (result.error) return new Response(result.error, { status: 502 });

  const header = [
    "OV",
    "Cliente",
    "Compromiso",
    "Total",
    "Cobrado",
    ...TRACK_IDS.map((id) => TRACK_BY_ID[id].label),
    "Estado",
    "Alertas",
  ];
  const rows = applyFilters(result.orders, filters).map((o) => [
    o.raw.name,
    o.raw.partnerName,
    o.raw.commitmentDate?.slice(0, 10) ?? "",
    Math.round(o.raw.amountTotal),
    Math.round(o.paid),
    ...TRACK_IDS.map((id) => {
      const i = o.tracks[id].index;
      return i === null ? "Sin datos" : TRACK_BY_ID[id].stages[i].label;
    }),
    STATUS_META[o.status].label,
    o.gates
      .filter((g) => g.status === "inconsistente" || g.status === "bloqueado" || g.status === "accion")
      .map((g) => `${g.label}: ${g.message}`)
      .join(" | "),
  ]);

  // Punto y coma + BOM: Excel en español lo abre bien sin asistente de importación.
  const csv = "﻿" + [header, ...rows].map((r) => r.map(csvCell).join(";")).join("\r\n");
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="reporte-ov-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  });
}
