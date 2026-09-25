"use server";

import { invalidateOrdersCache } from "@/lib/data/orders";

/** Descarta los datos de Odoo en caché para que el próximo render lea datos frescos. */
export async function refrescarDatos() {
  invalidateOrdersCache();
}
