import { describe, expect, it } from "vitest";
import type { RawSaleLine } from "./flow/types";
import { calcularInsumos, consumoSeparador, consumoVidrio, parseLine } from "./insumos";

const DVH = "[TP4+10+4] DVH 4+10+4 (Generico)";
const line = (description: string, extra: Partial<RawSaleLine> = {}): RawSaleLine => ({
  description,
  productName: DVH,
  qty: 1,
  anchoM: null,
  altoM: null,
  ...extra,
});

describe("parseLine", () => {
  it("formato con barras", () => {
    const p = parseLine(
      line("[V1] | Cantidad: 6 unidades | Termopanel 748 x 976 mm | Cristal 1: Incoloro 5mm | Cristal 2: Incoloro 4mm | Separador: 10mm color Mate"),
    );
    expect(p).toMatchObject({ cantidad: 6, ancho: 748, alto: 976, tipo: "termopanel", separador: "Separador 10mm Mate" });
    expect(p.cristales).toEqual(["Cristal Incoloro 5mm", "Cristal Incoloro 4mm"]);
  });

  it("formato con saltos de línea y separador con guion", () => {
    const p = parseLine(
      line("[V1] Cantidad: 2\nDimensiones: 904 x 1943 mm\nCristal 1: Reflex Bronce 5mm\nCristal 2: Incoloro 5mm\nSeparador: 10mm - Negro"),
    );
    expect(p).toMatchObject({ cantidad: 2, ancho: 904, alto: 1943, separador: "Separador 10mm Negro" });
    expect(p.cristales).toEqual(["Cristal Reflex Bronce 5mm", "Cristal Incoloro 5mm"]);
  });

  it("usa los campos Studio si el texto no trae medidas (alto acumulado)", () => {
    const p = parseLine(line("[V1] | Cantidad: 2 | Cristal 1: Incoloro 4mm | Cristal 2: Incoloro 4mm", { anchoM: 0.9, altoM: 3.8 }));
    expect(p).toMatchObject({ ancho: 900, alto: 1900 });
  });

  it("palillaje y monolítico", () => {
    const t = parseLine(line("[V1] | Cantidad: 3 | Termopanel 500 x 500 mm | Cristal 1: Incoloro 4mm | Palillaje (Blanco, 2 horizontales, 1 verticales)"));
    expect(t.palillaje).toEqual({ color: "Blanco", tiras: 9 });
    const m = parseLine(line("[C1] | Cantidad: 1 | Cristal Monolítico 600 x 400 mm | Cristal: Incoloro 6mm", { productName: "Cristal monolítico" }));
    expect(m).toMatchObject({ tipo: "monolitico", ancho: 600, alto: 400, cristales: ["Cristal Incoloro 6mm"], separador: null });
  });

  it("ignora ventanas PVC", () => {
    expect(parseLine(line("[V1] Corrediza | 4/9/4 | Blanco", { productName: "Ventana 2 hojas correderas PVC" })).tipo).toBeNull();
  });
});

describe("cálculos", () => {
  it("separador: 1 panel de 1000x1000 cabe en 1 tira de 5 m", () => {
    expect(consumoSeparador(1000, 1000, 1)).toEqual({ neto: 4, real: 5 });
    // 2 paneles = 8 piezas de 1 m = 8 m → 2 tiras
    expect(consumoSeparador(1000, 1000, 2)).toEqual({ neto: 8, real: 10 });
  });

  it("vidrio: 4 piezas de 900x1250 caben en 1 plancha de 1800x2500", () => {
    const r = consumoVidrio([{ ancho: 900, alto: 1250, cantidad: 4 }]);
    expect(r.planchas).toBe(1);
    expect(r.neto).toBeCloseTo(4.5);
    expect(r.real).toBeCloseTo(4.5);
  });

  it("vidrio: 5 piezas necesitan 2 planchas", () => {
    expect(consumoVidrio([{ ancho: 900, alto: 1250, cantidad: 5 }]).planchas).toBe(2);
  });

  it("agrega insumos de varias líneas", () => {
    const i = calcularInsumos([
      line("[V1] | Cantidad: 2 | Termopanel 1000 x 1000 mm | Cristal 1: Incoloro 4mm | Cristal 2: Incoloro 4mm | Separador: 10mm color Mate"),
      line("[V2] Corrediza | 4/9/4 | Blanco", { productName: "Ventana PVC" }),
    ]);
    expect(i.lineas).toBe(1);
    expect(i.escuadras).toBe(8);
    expect(i.hotmelt).toBeCloseTo(8);
    expect(i.butilo).toBeCloseTo(8);
    expect(i.separadores).toEqual([{ nombre: "Separador 10mm Mate", neto: 8, real: 10, tiras: 2 }]);
    // Cristal 1 y 2 del mismo tipo: 4 piezas de 1000x1000
    expect(i.cristalesTipo[0]).toMatchObject({ nombre: "Cristal Incoloro 4mm", neto: 4 });
  });
});
