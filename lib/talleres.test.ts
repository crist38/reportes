import { describe, expect, it } from "vitest";
import { demoOrders } from "./data/demo";
import { buildOrderView } from "./flow/engine";
import type { RawOrder } from "./flow/types";
import { TALLER_BY_ID, isTallerId, perteneceATaller } from "./talleres";

const view = (patch: Partial<RawOrder>) => buildOrderView({ ...demoOrders()[0], ...patch });
const mo = (productName: string) => ({ id: 1, name: "MO", state: "confirmed" as const, productName, qty: 1 });

describe("talleres", () => {
  it("asigna por etiqueta de venta", () => {
    expect(perteneceATaller(view({ tags: ["Taller PVC"] }), TALLER_BY_ID.pvc)).toBe(true);
    expect(perteneceATaller(view({ tags: ["Termopanel"] }), TALLER_BY_ID.termopanel)).toBe(true);
    expect(perteneceATaller(view({ tags: ["Taller Aluminio"] }), TALLER_BY_ID.aluminio)).toBe(true);
    expect(perteneceATaller(view({ tags: ["Termopanel"] }), TALLER_BY_ID.pvc)).toBe(false);
  });

  it("sin etiquetas, asigna por el producto fabricado", () => {
    const o = view({ tags: [], productions: [mo("[TP4+10+4] DVH 4+10+4 (Generico)")] });
    expect(perteneceATaller(o, TALLER_BY_ID.termopanel)).toBe(true);
    expect(perteneceATaller(o, TALLER_BY_ID.pvc)).toBe(false);
  });

  it("la etiqueta manda sobre el producto", () => {
    const o = view({ tags: ["Taller PVC"], productions: [mo("DVH 4+10+4")] });
    expect(perteneceATaller(o, TALLER_BY_ID.termopanel)).toBe(false);
  });

  it("valida el id de la URL", () => {
    expect(isTallerId("aluminio")).toBe(true);
    expect(isTallerId("madera")).toBe(false);
    expect(isTallerId("toString")).toBe(false);
  });
});
