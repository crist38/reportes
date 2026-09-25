# Flujo OV · Reportes Odoo

Reportes de las Órdenes de Venta de Odoo 19 organizados según los 5 flujos de estado de la fábrica:
**Técnico, Financiero, Producción, Despacho e Instalación**. La definición de esos flujos
([lib/flow/definition.ts](lib/flow/definition.ts)) y sus reglas ([lib/flow/engine.ts](lib/flow/engine.ts))
son la guía de toda la aplicación.

Stack: Next.js 16 (App Router) + TypeScript + Tailwind CSS 4. Odoo se consulta desde el servidor con la
API JSON-2 de Odoo 19 (`/json/2/<modelo>/<método>`); la API key nunca llega al navegador.

## Uso

```bash
npm install
npm run dev        # http://localhost:3000
npm test           # pruebas del motor de flujos
```

Sin `.env.local` la app arranca en **modo demo** con 18 OV de ejemplo. Para leer tu Odoo, copia
`.env.example` a `.env.local` y completa `ODOO_URL`, `ODOO_DB` y `ODOO_API_KEY`.

## Pantallas

| Ruta | Contenido |
|---|---|
| `/` | KPIs, matriz flujo × etapa (cada celda filtra la lista) y lista de bloqueos, inconsistencias y acciones pendientes |
| `/ordenes` | Tabla de OV con los 5 flujos, búsqueda y filtro por estado; exportación CSV |
| `/ordenes/[id]` | Los 5 flujos de una OV, reglas evaluadas y documentos (facturas, MO, entregas) |
| `/flujo` | La guía: etapas, reglas entre flujos y origen de cada estado en Odoo |
| `/api/reporte` | CSV (separador `;`, UTF-8 con BOM para Excel); acepta los mismos filtros que `/ordenes` |

## De dónde sale cada estado

| Flujo | Origen en Odoo |
|---|---|
| Técnico | Campo de selección `x_estado_tecnico` en `sale.order` |
| Financiero | Facturas publicadas de la OV (`account.move`): % cobrado vs. anticipo y total facturado |
| Producción | `mrp.production` de la OV (vía `mrp_production_ids`, o por `origin` si no existe) |
| Despacho | `stock.picking` de salida de la OV |
| Instalación | Campo de selección `x_estado_instalacion` en `sale.order` |

### Crear los campos Técnico e Instalación en Odoo

Con Studio (o un módulo propio), agrega a `sale.order` dos campos **Selección** con estas claves exactas:

- `x_estado_tecnico`: `sin_medir`, `medido`, `en_revision`, `aprobado`, `liberado`
- `x_estado_instalacion`: `no_aplica`, `pendiente`, `programada`, `en_ejecucion`, `recibida`

Si un campo no existe, ese flujo aparece como "Sin datos" y la app lo avisa. Un campo vacío cuenta
como la primera etapa.

## Reglas entre flujos

1. **Liberación a fábrica:** Técnico = Liberado y Financiero ≥ Habilitado. MO iniciadas sin cumplirlo = *inconsistente*.
2. **Despacho:** MO terminadas y Financiero ≥ `DESPACHO_REQUIERE`. Fabricada sin pago = *bloqueada*.
3. **Instalación:** En ejecución requiere despacho parcial; Recibida requiere despacho completo.

Estado global de la OV: Inconsistente > Bloqueada > Cerrada > Acción pendiente > En curso.

## Usuario de Odoo

Usa un usuario técnico con permisos de **solo lectura** sobre Ventas, Contabilidad (facturas), Fabricación
e Inventario, y genera su API key en *Preferencias → Seguridad de la cuenta*.
