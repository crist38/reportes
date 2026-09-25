import type { RawSaleLine } from "./flow/types";

// Insumos de termopaneles y cristales calculados desde las líneas de venta,
// con la misma lógica del cotizador de termopaneles (github.com/crist38/Termopanel).

export const PLANCHA = { ancho: 1800, alto: 2500 }; // mm
export const PLANCHA_M2 = (PLANCHA.ancho * PLANCHA.alto) / 1_000_000;
export const TIRA_SEPARADOR_MM = 5000;

export interface ParsedLine {
  cantidad: number;
  ancho: number; // mm
  alto: number; // mm
  areaM2: number;
  tipo: "termopanel" | "monolitico" | null;
  cristales: string[]; // "Cristal Incoloro 5mm"
  separador: string | null; // "Separador 10mm Negro"
  palillaje: { color: string; tiras: number } | null;
}

export interface Insumos {
  lineas: number;
  cristalTotalM2: number;
  hotmelt: number; // ml
  butilo: number; // ml
  escuadras: number; // uds
  cristalesTipo: { nombre: string; neto: number; real: number; planchas: number }[];
  separadores: { nombre: string; neto: number; real: number; tiras: number }[];
  palillaje: { color: string; tiras: number; paneles: number }[];
}

const cap = (s: string) => s.trim().replace(/\s+/g, " ");

/**
 * Lee una línea en cualquiera de los dos formatos que genera el cotizador:
 *  "[V1] | Cantidad: 6 unidades | Termopanel 748 x 976 mm | Cristal 1: Incoloro 5mm | Cristal 2: Incoloro 4mm | Separador: 10mm color Mate"
 *  "[V1] Cantidad: 2\nDimensiones: 904 x 1943 mm\nCristal 1: Reflex Bronce 5mm\nCristal 2: Incoloro 5mm\nSeparador: 10mm - Negro"
 */
export function parseLine(line: RawSaleLine): ParsedLine {
  const text = line.description;
  const parts = text
    .split(/\s\|\s|\n/)
    .map((p) => p.replace(/^\[[^\]]*\]\s*/, "").trim())
    .filter(Boolean);
  const find = (re: RegExp) => parts.map((p) => p.match(re)).find((m) => m !== null) ?? null;

  const cantidad = Number(find(/cantidad:\s*(\d+)/i)?.[1] ?? 1) || 1;

  let ancho = 0;
  let alto = 0;
  const dim = find(/(?:termopanel|dimensiones?:|monol[ií]tico)\D*?(\d+)\s*x\s*(\d+)/i);
  if (dim) {
    ancho = Number(dim[1]);
    alto = Number(dim[2]);
  } else if (line.anchoM && line.altoM) {
    // x_studio_alto_m guarda el alto acumulado de todas las unidades
    ancho = Math.round(line.anchoM * 1000);
    alto = Math.round((line.altoM * 1000) / cantidad);
  }

  const cristal = (re: RegExp) => {
    const m = find(re);
    return m ? `Cristal ${cap(m[1])} ${m[2]}mm` : null;
  };
  const c1 = cristal(/^(?:cristal 1|c1):\s*(.+?)\s*(\d+)\s*mm/i);
  const c2 = cristal(/^(?:cristal 2|c2):\s*(.+?)\s*(\d+)\s*mm/i);
  const mono = cristal(/^cristal:\s*(.+?)\s*(\d+)\s*mm/i);

  const sep = find(/^(?:separador|sep):\s*(\d+)\s*mm\s*(?:color\s+|-\s*)?(.*)$/i);
  const separador = sep ? cap(`Separador ${sep[1]}mm ${sep[2] ?? ""}`) : null;

  const pal = text.match(/palillaje\s*\(\s*([^,)]+?)\s*,\s*(\d+)\s*horizontales?\s*,\s*(\d+)\s*verticales?/i);
  const palillaje = pal ? { color: cap(pal[1]), tiras: (Number(pal[2]) + Number(pal[3])) * cantidad } : null;

  const esTermo = /dvh|termopanel/i.test(line.productName) || /termopanel/i.test(text) || c2 !== null || separador !== null;
  const esMono = !esTermo && (/monol/i.test(line.productName) || /monol/i.test(text) || mono !== null);

  return {
    cantidad,
    ancho,
    alto,
    areaM2: line.qty,
    tipo: esTermo ? "termopanel" : esMono ? "monolitico" : null,
    cristales: esTermo ? [c1, c2].filter((c): c is string => c !== null) : esMono && mono ? [mono] : [],
    separador: esTermo ? separador : null,
    palillaje: esTermo ? palillaje : null,
  };
}

/** Tiras de 5 m necesarias para los 4 lados de cada unidad (First Fit Decreasing). */
export function consumoSeparador(ancho: number, alto: number, cantidad: number) {
  if (ancho <= 0 || alto <= 0 || cantidad <= 0) return { neto: 0, real: 0 };
  const neto = ((2 * (ancho + alto)) / 1000) * cantidad;
  if (ancho > TIRA_SEPARADOR_MM || alto > TIRA_SEPARADOR_MM) return { neto, real: neto };

  const piezas = Array.from({ length: cantidad }, () => [ancho, ancho, alto, alto]).flat().sort((a, b) => b - a);
  const libres: number[] = [];
  for (const p of piezas) {
    const i = libres.findIndex((l) => l >= p);
    if (i >= 0) libres[i] -= p;
    else libres.push(TIRA_SEPARADOR_MM - p);
  }
  return { neto, real: libres.length * (TIRA_SEPARADOR_MM / 1000) };
}

/** m² de planchas de 1800 x 2500 mm necesarias (empaquetado por estantes, permite rotar). */
export function consumoVidrio(piezas: { ancho: number; alto: number; cantidad: number }[]) {
  let neto = 0;
  let fueraDePlancha = 0;
  const flat: { w: number; h: number }[] = [];
  for (const p of piezas) {
    if (p.ancho <= 0 || p.alto <= 0 || p.cantidad <= 0) continue;
    neto += ((p.ancho * p.alto) / 1_000_000) * p.cantidad;
    for (let i = 0; i < p.cantidad; i++) flat.push({ w: Math.min(p.ancho, p.alto), h: Math.max(p.ancho, p.alto) });
  }
  flat.sort((a, b) => b.h - a.h);

  const W = PLANCHA.ancho;
  const H = PLANCHA.alto;
  const planchas: { estantes: { alto: number; usado: number }[]; altoUsado: number }[] = [];

  const colocar = (pl: (typeof planchas)[number], w: number, h: number) => {
    for (const e of pl.estantes) {
      if (e.usado + w <= W && h <= e.alto) return (e.usado += w), true;
      if (e.usado + h <= W && w <= e.alto) return (e.usado += h), true;
    }
    if (pl.altoUsado + h <= H && w <= W) return pl.estantes.push({ alto: h, usado: w }), (pl.altoUsado += h), true;
    if (pl.altoUsado + w <= H && h <= W) return pl.estantes.push({ alto: w, usado: h }), (pl.altoUsado += w), true;
    return false;
  };

  for (const { w, h } of flat) {
    if (planchas.some((pl) => colocar(pl, w, h))) continue;
    const nueva = { estantes: [], altoUsado: 0 };
    if (colocar(nueva, w, h)) planchas.push(nueva);
    else fueraDePlancha += (w * h) / 1_000_000; // pieza más grande que la plancha
  }

  const real = planchas.length * PLANCHA_M2 + fueraDePlancha;
  return { neto, real: Math.max(real, neto), planchas: planchas.length };
}

export function calcularInsumos(lines: RawSaleLine[]): Insumos {
  let hotmelt = 0;
  let butilo = 0;
  let escuadras = 0;
  let lineas = 0;
  const vidrio = new Map<string, { ancho: number; alto: number; cantidad: number }[]>();
  const separadores = new Map<string, { neto: number; real: number }>();
  const palillaje = new Map<string, { tiras: number; paneles: number }>();

  for (const line of lines) {
    const p = parseLine(line);
    if (!p.tipo) continue;
    lineas += 1;
    for (const c of p.cristales) vidrio.set(c, [...(vidrio.get(c) ?? []), { ancho: p.ancho, alto: p.alto, cantidad: p.cantidad }]);
    if (p.tipo !== "termopanel") continue;

    const perimetroMl = ((2 * (p.ancho + p.alto)) / 1000) * p.cantidad;
    escuadras += 4 * p.cantidad;
    hotmelt += perimetroMl;
    butilo += perimetroMl;
    if (p.separador) {
      const c = consumoSeparador(p.ancho, p.alto, p.cantidad);
      const acc = separadores.get(p.separador) ?? { neto: 0, real: 0 };
      separadores.set(p.separador, { neto: acc.neto + c.neto, real: acc.real + c.real });
    }
    if (p.palillaje) {
      const acc = palillaje.get(p.palillaje.color) ?? { tiras: 0, paneles: 0 };
      palillaje.set(p.palillaje.color, { tiras: acc.tiras + p.palillaje.tiras, paneles: acc.paneles + p.cantidad });
    }
  }

  const cristalesTipo = [...vidrio].map(([nombre, piezas]) => ({ nombre, ...consumoVidrio(piezas) }));
  return {
    lineas,
    cristalTotalM2: cristalesTipo.reduce((s, c) => s + c.real, 0),
    hotmelt,
    butilo,
    escuadras,
    cristalesTipo: cristalesTipo.sort((a, b) => b.real - a.real),
    separadores: [...separadores]
      .map(([nombre, v]) => ({ nombre, ...v, tiras: Math.round(v.real / (TIRA_SEPARADOR_MM / 1000)) }))
      .sort((a, b) => b.real - a.real),
    palillaje: [...palillaje].map(([color, v]) => ({ color, ...v })),
  };
}
