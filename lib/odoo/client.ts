import "server-only";

// Cliente mínimo para la API JSON-2 de Odoo 19: POST /json/2/<modelo>/<método>
// Solo se ejecuta en el servidor: la API key nunca llega al navegador.

export class OdooError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly odooName?: string,
  ) {
    super(message);
    this.name = "OdooError";
  }
}

export interface OdooConfig {
  url: string;
  db: string;
  apiKey: string;
}

export function readOdooConfig(): OdooConfig | null {
  const url = process.env.ODOO_URL?.replace(/\/+$/, "");
  const db = process.env.ODOO_DB;
  const apiKey = process.env.ODOO_API_KEY;
  if (!url || !db || !apiKey) return null;
  return { url, db, apiKey };
}

export type Domain = unknown[];
/** Many2one en lecturas: [id, "nombre"] o false. */
export type Many2one = [number, string] | false;

export function m2oName(value: unknown): string | null {
  return Array.isArray(value) ? String(value[1]) : null;
}

export class OdooClient {
  constructor(private readonly config: OdooConfig) {}

  async call<T>(model: string, method: string, args: Record<string, unknown> = {}): Promise<T> {
    const res = await fetch(`${this.config.url}/json/2/${model}/${method}`, {
      method: "POST",
      headers: {
        Authorization: `bearer ${this.config.apiKey}`,
        "X-Odoo-Database": this.config.db,
        "Content-Type": "application/json; charset=utf-8",
      },
      body: JSON.stringify(args),
      cache: "no-store",
    });
    if (!res.ok) {
      let message = `${res.status} ${res.statusText}`;
      let odooName: string | undefined;
      try {
        const body = (await res.json()) as { message?: string; name?: string };
        message = body.message ?? message;
        odooName = body.name;
      } catch {
        // cuerpo no JSON: se mantiene el status HTTP
      }
      throw new OdooError(`Odoo ${model}.${method}: ${message}`, res.status, odooName);
    }
    return (await res.json()) as T;
  }

  searchRead<T>(model: string, domain: Domain, fields: string[], opts: { limit?: number; order?: string } = {}) {
    return this.call<T[]>(model, "search_read", { domain, fields, ...opts });
  }

  read<T>(model: string, ids: number[], fields: string[]) {
    if (ids.length === 0) return Promise.resolve([] as T[]);
    return this.call<T[]>(model, "read", { ids, fields });
  }

  async fieldNames(model: string): Promise<Set<string>> {
    const fields = await this.call<Record<string, unknown>>(model, "fields_get", { attributes: ["type"] });
    return new Set(Object.keys(fields));
  }
}
