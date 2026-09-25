import { describe, expect, it } from "vitest";
import { demoOrders } from "./data/demo";
import { buildOrderView } from "./flow/engine";
import { buildReport, localDay, parseReportFilters } from "./reports";

const views = demoOrders().map((o) => buildOrderView(o));
const NOW = new Date("2026-09-25T15:00:00Z");

describe("reporte", () => {
  it("convierte fechas UTC de Odoo al día de Chile", () => {
    expect(localDay("2026-09-26 02:00:00")).toBe("2026-09-25");
    expect(localDay("2026-09-25 14:00:00")).toBe("2026-09-25");
  });

  it("filtra el mes actual y compara con el anterior", () => {
    const r = buildReport(views, { periodo: "mes" }, NOW);
    const sept = views.filter((v) => v.raw.dateOrder.startsWith("2026-09"));
    const ago = views.filter((v) => v.raw.dateOrder.startsWith("2026-08"));
    expect(r.kpis.ventas).toBe(sept.length);
    const monto = (xs: typeof views) => xs.reduce((s, v) => s + v.raw.amountTotal, 0);
    expect(r.kpis.monto).toBe(monto(sept));
    expect(r.kpis.deltaMonto).toBeCloseTo(((monto(sept) - monto(ago)) / monto(ago)) * 100);
  });

  it("histórico sin comparación; filtro por cliente", () => {
    const r = buildReport(views, { periodo: "historico", cliente: views[0].raw.partnerId! }, NOW);
    expect(r.kpis.ventas).toBe(1);
    expect(r.kpis.deltaMonto).toBeNull();
    expect(r.ranking[0].name).toBe(views[0].raw.partnerName);
  });

  it("clasifica las MO por taller", () => {
    const r = buildReport(views, { periodo: "historico" }, NOW);
    const total = views.flatMap((v) => v.raw.productions).filter((p) => p.state !== "cancel").length;
    expect(r.talleres.reduce((s, t) => s + t.mos, 0)).toBe(total);
    expect(r.talleres.find((t) => t.nombre === "Taller Termopaneles")!.mos).toBeGreaterThan(0);
  });

  it("valida los parámetros de la URL", () => {
    expect(parseReportFilters({ periodo: "x", fecha: "ayer", cliente: "-3" })).toEqual({ periodo: "mes", fecha: undefined, cliente: undefined });
    expect(parseReportFilters({ periodo: "fecha", fecha: "2026-09-01", cliente: "7" })).toEqual({ periodo: "fecha", fecha: "2026-09-01", cliente: 7 });
  });
});
