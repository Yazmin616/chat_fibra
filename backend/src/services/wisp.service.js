/**
 * @file wisp.service.js
 * @description Punto de entrada único para la integración con el sistema WISP externo.
 *
 * Todos los states importan desde aquí, no desde wisp.mock directamente.
 * Para conectar la API real: reemplazar el require de abajo con el adaptador real
 * y eliminar wisp.mock.js. El contrato (buscar / buscarPorExternalId) no cambia.
 *
 * ── Contrato del adaptador WISP ─────────────────────────────────────────────
 *
 * @typedef {Object} WispServicio
 * @property {string}                    id
 * @property {string}                    etiqueta          - Descripción legible del plan.
 * @property {'activo'|'suspendido'}     estado
 * @property {number}                    deuda             - Monto pendiente (0 si al corriente).
 * @property {string}                    fecha_vencimiento - Ej. "31/05/2026".
 * @property {string}                    portal_pago       - URL del portal de pago en línea.
 * @property {string}                    direccion         - Dirección de instalación.
 *
 * @typedef {Object} WispCliente
 * @property {string}          nombre    - Nombre completo del titular.
 * @property {WispServicio[]}  servicios - Lista de servicios contratados (≥ 1).
 *
 * ── Funciones requeridas ─────────────────────────────────────────────────────
 *
 * buscar(valor: string, empresaId: string): WispCliente | null
 *   Busca un cliente por cualquier identificador (teléfono, ID, contrato, email, etc.)
 *   Solo devuelve clientes de la empresa indicada.
 *
 * buscarPorExternalId(externalId: string, empresaId: string): WispCliente | null
 *   Reconoce a un cliente por su ID de canal (Telegram, WhatsApp, etc.)
 *   para saltar la identificación manual en visitas recurrentes.
 */

const wispImpl = require('./wisp.mock');

module.exports = wispImpl;
