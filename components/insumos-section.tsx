import { Grid3x3 } from "lucide-react";
import type { Insumos } from "@/lib/insumos";

const n2 = (n: number) => n.toLocaleString("es-CL", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const n1 = (n: number) => n.toLocaleString("es-CL", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const desperdicio = (neto: number, real: number) => (real > 0 ? ((real - neto) / real) * 100 : 0);

/** Colores de insignia de palillaje, igual que en el cotizador. */
function colorBadge(color: string): string {
  const c = color.toLowerCase();
  if (c.includes("blanco")) return "border border-slate-300 bg-slate-100 text-slate-600";
  if (c.includes("negro")) return "bg-slate-800 text-slate-50";
  if (c.includes("bronce")) return "bg-amber-800 text-amber-50";
  if (c.includes("gris")) return "bg-slate-500 text-slate-50";
  if (c.includes("cafe") || c.includes("madera")) return "bg-amber-900 text-amber-50";
  if (c.includes("dorado")) return "bg-amber-700 text-yellow-50";
  return "bg-indigo-100 text-indigo-700";
}

export function InsumosSection({ insumos, vacio }: { insumos: Insumos; vacio: string }) {
  const cards = [
    { kicker: "Vidrio en corte", title: "Cristales Totales", value: `${n2(insumos.cristalTotalM2)} m²` },
    { kicker: "Sellante de borde", title: "Hotmelt", value: `${n2(insumos.hotmelt)} ml` },
    { kicker: "Sello primario", title: "Butilo", value: `${n2(insumos.butilo)} ml` },
    { kicker: "Conectores de esquina", title: "Escuadras", value: `${insumos.escuadras.toLocaleString("es-CL")} uds` },
  ];

  return (
    <section className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm">
      <div className="mb-6 flex items-center gap-2">
        <Grid3x3 className="text-teal-600" size={18} />
        <h2 className="text-lg font-bold text-slate-800">Insumos y Componentes Utilizados</h2>
      </div>

      {insumos.lineas === 0 ? (
        <p className="text-sm text-slate-500 italic">{vacio}</p>
      ) : (
        <>
          <div className="mb-8 grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
            {cards.map((c) => (
              <div key={c.title} className="flex flex-col justify-between rounded-xl border border-slate-100 bg-slate-50 p-4">
                <div>
                  <span className="block text-[10px] font-bold tracking-wider text-slate-400 uppercase">{c.kicker}</span>
                  <span className="mt-1 block text-xl font-bold text-slate-700">{c.title}</span>
                </div>
                <div className="mt-4 text-right">
                  <span className="font-mono text-2xl font-black text-teal-600">{c.value}</span>
                </div>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 gap-8 border-t border-slate-100 pt-4 lg:grid-cols-2">
            <div>
              <h3 className="mb-4 flex items-center gap-1.5 text-sm font-bold text-slate-700">
                <span className="inline-block h-2 w-2 rounded-full bg-teal-500" />
                Consumo por Tipo de Cristal (m²)
              </h3>
              <div className="space-y-3">
                {insumos.cristalesTipo.length === 0 ? (
                  <p className="text-xs text-slate-400 italic">Sin registros en el período.</p>
                ) : (
                  insumos.cristalesTipo.map((c) => (
                    <Fila
                      key={c.nombre}
                      nombre={c.nombre}
                      valor={`${n2(c.real)} m² (${c.planchas} planchas)`}
                      neto={`Neto: ${n2(c.neto)} m²`}
                      desperdicio={desperdicio(c.neto, c.real)}
                      valorClass="text-teal-600"
                    />
                  ))
                )}
              </div>
            </div>

            <div>
              <h3 className="mb-4 flex items-center gap-1.5 text-sm font-bold text-slate-700">
                <span className="inline-block h-2 w-2 rounded-full bg-indigo-500" />
                Separadores por Color y Espesor (ml)
              </h3>
              <div className="space-y-3">
                {insumos.separadores.length === 0 ? (
                  <p className="text-xs text-slate-400 italic">Sin registros en el período.</p>
                ) : (
                  insumos.separadores.map((s) => (
                    <Fila
                      key={s.nombre}
                      nombre={s.nombre}
                      valor={`${n1(s.real)} ml (${s.tiras} tiras)`}
                      neto={`Neto: ${n1(s.neto)} ml`}
                      desperdicio={desperdicio(s.neto, s.real)}
                      valorClass="text-indigo-600"
                    />
                  ))
                )}
              </div>
            </div>
          </div>

          {insumos.palillaje.length > 0 && (
            <div className="mt-6 border-t border-slate-100 pt-6">
              <h3 className="mb-4 flex items-center gap-1.5 text-sm font-bold text-slate-700">
                <span className="inline-block h-2 w-2 rounded-full bg-amber-500" />
                Palillaje por Color
              </h3>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {insumos.palillaje.map((p) => (
                  <div key={p.color} className="flex flex-col gap-3 rounded-xl border border-slate-100 bg-slate-50 p-4">
                    <div className="flex items-center justify-between gap-2">
                      <span className={`max-w-[70%] truncate rounded-full px-2.5 py-1 text-[11px] font-bold ${colorBadge(p.color)}`}>
                        {p.color}
                      </span>
                      <span className="text-xs font-medium whitespace-nowrap text-slate-400">
                        {p.paneles} panel{p.paneles !== 1 ? "es" : ""}
                      </span>
                    </div>
                    <div>
                      <p className="text-[10px] font-semibold tracking-wider text-slate-400 uppercase">Tiras consumidas</p>
                      <p className="mt-0.5 font-mono text-2xl leading-tight font-black text-amber-600">{p.tiras}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <p className="mt-6 text-[11px] text-slate-400">
            * Calculado desde {insumos.lineas} líneas de venta de termopaneles y cristales, con planchas de 1800 × 2500 mm y
            tiras de separador de 5 m (misma lógica del cotizador).
          </p>
        </>
      )}
    </section>
  );
}

function Fila({
  nombre,
  valor,
  neto,
  desperdicio,
  valorClass,
}: {
  nombre: string;
  valor: string;
  neto: string;
  desperdicio: number;
  valorClass: string;
}) {
  return (
    <div className="space-y-1.5 rounded-xl border border-slate-100 bg-slate-50 p-3 transition-colors hover:bg-slate-100/70">
      <div className="flex items-start justify-between gap-2 text-xs font-semibold text-slate-700">
        <span className="max-w-[60%] truncate" title={nombre}>
          {nombre}
        </span>
        <span className={`text-right font-mono font-bold whitespace-nowrap ${valorClass}`}>{valor}</span>
      </div>
      <div className="flex items-center justify-between text-[10px] font-medium text-slate-400">
        <span>{neto}</span>
        <span>
          Desperdicio: <strong className="font-mono text-amber-600">{n1(desperdicio)}%</strong>
        </span>
      </div>
    </div>
  );
}
