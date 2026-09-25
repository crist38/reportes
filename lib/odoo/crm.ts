// Estado técnico de una OV a partir de la etapa de su oportunidad en el CRM de Odoo.
// Regla principal: etapa ganada ("Won" / "Ganado") = Liberado.

export interface CrmStage {
  name: string;
  isWon: boolean;
}

/** Etapas no ganadas → etapa técnica. Se puede ampliar con ODOO_CRM_ETAPAS="Nombre:etapa,...". */
const DEFAULT_MAP: Record<string, string> = {
  new: "sin_medir",
  nuevo: "sin_medir",
  qualified: "medido",
  calificado: "medido",
  proposition: "en_revision",
  propuesta: "en_revision",
  negotiation: "aprobado",
  negociación: "aprobado",
};

export function parseStageMap(env: string | undefined): Record<string, string> {
  const map = { ...DEFAULT_MAP };
  for (const pair of (env ?? "").split(",")) {
    const [name, stage] = pair.split(":").map((s) => s?.trim());
    if (name && stage) map[name.toLowerCase()] = stage;
  }
  return map;
}

/**
 * Etapa técnica para una oportunidad. null = no aporta estado (oportunidad perdida).
 * Las etapas abiertas sin mapeo cuentan como "en revisión": la venta sigue en manos de la oficina técnica.
 */
export function tecnicoDesdeCrm(stage: CrmStage, active: boolean, map: Record<string, string>): string | null {
  if (stage.isWon) return "liberado";
  if (!active || /perd|lost/i.test(stage.name)) return null;
  return map[stage.name.trim().toLowerCase()] ?? "en_revision";
}
