export function money(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat("es-CL", { style: "currency", currency: currency || "CLP", maximumFractionDigits: 0 }).format(amount);
  } catch {
    return `${Math.round(amount).toLocaleString("es-CL")} ${currency}`;
  }
}

/** Odoo entrega fechas UTC como "YYYY-MM-DD HH:MM:SS". */
export function date(value: string | null): string {
  if (!value) return "—";
  const d = new Date(value.includes("T") ? value : `${value.replace(" ", "T")}Z`);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString("es-CL", { day: "2-digit", month: "short", year: "numeric", timeZone: process.env.TZ || "America/Santiago" });
}
