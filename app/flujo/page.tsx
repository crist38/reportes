import { connection } from "next/server";
import { TrackPipeline } from "@/components/flow";
import { readPolicy } from "@/lib/data/orders";
import { TRACKS, TRACK_BY_ID, stageIndex } from "@/lib/flow/definition";

export default async function FlowGuidePage() {
  await connection(); // la política se lee del entorno en tiempo de ejecución
  const policy = readPolicy();
  const despachoReq = TRACK_BY_ID.financiero.stages[stageIndex("financiero", policy.despachoRequiere)].label;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Guía del flujo</h1>
        <p className="text-slate-600">Cada OV avanza en cinco flujos independientes. Estas son las etapas y las reglas que los conectan.</p>
      </div>

      <section className="space-y-4 rounded-xl border border-slate-200 bg-white p-5">
        {TRACKS.map((t) => (
          <TrackPipeline key={t.id} track={t.id} state="guide" />
        ))}
        <p className="border-t border-slate-100 pt-4 text-center text-sm text-slate-600">
          Ejemplo: una OV puede estar técnicamente liberada, fabricada parcialmente y todavía bloqueada por saldo pendiente.
        </p>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-5">
        <h2 className="mb-3 font-semibold">Reglas entre flujos</h2>
        <ol className="list-decimal space-y-2 pl-5 text-sm">
          <li>
            <strong>Liberación a fábrica:</strong> requiere Técnico = <em>Liberado</em> y Financiero ≥ <em>Habilitado</em> (anticipo de{" "}
            {Math.round(policy.anticipoPct * 100)} % cobrado). Si hay MO iniciadas sin cumplirlo, la OV queda <em>inconsistente</em>.
          </li>
          <li>
            <strong>Despacho:</strong> requiere MO terminadas (todas, o algunas para un despacho parcial) y Financiero ≥ <em>{despachoReq}</em>.
            Si la fabricación está lista pero falta el pago, la OV queda <em>bloqueada</em>.
          </li>
          <li>
            <strong>Instalación:</strong> <em>En ejecución</em> requiere despacho al menos parcial; <em>Recibida</em> requiere despacho completo.
            Con el despacho completo e instalación pendiente, la acción es programarla.
          </li>
          <li>
            <strong>Cierre:</strong> la OV se considera cerrada cuando los cinco flujos llegan a su última etapa (o la instalación no aplica).
          </li>
        </ol>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-5">
        <h2 className="mb-3 font-semibold">De dónde sale cada estado en Odoo</h2>
        <dl className="grid gap-x-6 gap-y-3 text-sm sm:grid-cols-[9rem_1fr]">
          {TRACKS.map((t) => (
            <div key={t.id} className="contents">
              <dt className={`font-bold uppercase ${t.styles.text}`}>{t.label}</dt>
              <dd className="text-slate-700">{t.source}</dd>
            </div>
          ))}
        </dl>
      </section>
    </div>
  );
}
