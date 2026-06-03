/**
 * @file wisp.mock.js
 * @description Servicio mock del sistema WISP externo.
 * Simula la consulta de clientes para el flujo de autoservicio del bot
 * mientras se integra la API real.
 *
 * Para conectar la API real: reemplazar `buscar` y `buscarPorExternalId`
 * con llamadas HTTP al endpoint del WISP y eliminar CLIENTES_MOCK.
 */

/** @type {Array<{empresa_id: string, busqueda: object, nombre: string, servicios: Array}>} */
const CLIENTES_MOCK = [
  {
    empresa_id: 'fibratec',
    // Cliente con un solo servicio y deuda pendiente
    linked_external_ids: [], // IDs de Telegram/WhatsApp para reconocimiento automático
    busqueda: {
      id_cliente: ['1001'],
      telefono:  ['5551234567', '555-123-4567'],
      contrato:  ['C001', 'FIB-001'],
      email:     ['juan.perez@gmail.com'],
      usuario:   ['jperez'],
      wifi:      ['JPEREZ_5G', 'JPEREZ_HOGAR'],
      cedula:    ['12345678'],
    },
    nombre: 'Juan Pérez García',
    servicios: [
      {
        id:               'S001',
        etiqueta:         'Internet 100Mb – Col. Centro',
        estado:           'activo',
        deuda:            350.00,
        fecha_vencimiento: '31/05/2026',
        portal_pago:      'https://fibratec.mx/portal/cliente/S001',
        direccion:        'Calle Hidalgo 45, Col. Centro',
      },
    ],
  },
  {
    empresa_id: 'fibratec',
    // Cliente con múltiples servicios, uno con deuda y uno al corriente
    linked_external_ids: [],
    busqueda: {
      id_cliente: ['1002'],
      telefono: ['5559876543'],
      contrato: ['C002', 'FIB-002'],
      email:    ['maria.lopez@gmail.com'],
      usuario:  ['mlopez'],
      wifi:     ['MLOPEZ_CASA', 'MLOPEZ_OFICINA'],
      cedula:   ['87654321'],
    },
    nombre: 'María López Ramírez',
    servicios: [
      {
        id:               'S002',
        etiqueta:         'Internet 50Mb – Av. Reforma 123',
        estado:           'activo',
        deuda:            0,
        fecha_vencimiento: '15/06/2026',
        portal_pago:      'https://fibratec.mx/portal/cliente/S002',
        direccion:        'Av. Reforma 123, Piso 2',
      },
      {
        id:               'S003',
        etiqueta:         'Internet 200Mb – Calle Juárez 45',
        estado:           'activo',
        deuda:            750.00,
        fecha_vencimiento: '20/05/2026',
        portal_pago:      'https://fibratec.mx/portal/cliente/S003',
        direccion:        'Calle Juárez 45, Local B',
      },
    ],
  },
  {
    empresa_id: 'compusemmm',
    // Cliente con servicio suspendido por deuda alta
    linked_external_ids: [],
    busqueda: {
      id_cliente: ['2001'],
      telefono: ['5553334444'],
      contrato: ['C003'],
      email:    ['carlos.gomez@example.com'],
      usuario:  ['cgomez'],
      wifi:     ['CGOMEZ_NET'],
      cedula:   ['11223344'],
    },
    nombre: 'Carlos Gómez Vargas',
    servicios: [
      {
        id:               'S004',
        etiqueta:         'Internet 30Mb – Col. Las Flores',
        estado:           'suspendido',
        deuda:            1200.00,
        fecha_vencimiento: '01/05/2026',
        portal_pago:      'https://fibratec.mx/portal/cliente/S004',
        direccion:        'Blvd. Las Flores 78',
      },
    ],
  },
];

/** Normaliza texto para comparación. */
const norm = (s) => String(s || '').trim().toLowerCase().replace(/[-\s]/g, '');

/**
 * Busca un cliente por cualquier valor de identificación (teléfono, contrato, email, etc.).
 * Solo devuelve clientes que pertenezcan a la empresa indicada.
 * @param {string} valor      - Dato proporcionado por el cliente.
 * @param {string} empresaId  - ID de la empresa (ej. 'fibratec', 'compusemmm').
 * @returns {object|null} Datos del cliente o null si no se encontró.
 */
function buscar(valor, empresaId) {
  if (!valor || !empresaId) return null;
  const v = norm(valor);

  for (const cliente of CLIENTES_MOCK) {
    if (cliente.empresa_id !== empresaId) continue;
    const todosLosCampos = Object.values(cliente.busqueda).flat();
    if (todosLosCampos.some((c) => norm(c) === v)) {
      return { empresa_id: cliente.empresa_id, nombre: cliente.nombre, servicios: cliente.servicios };
    }
  }
  return null;
}

/**
 * Reconoce a un cliente automáticamente por su ID externo del canal.
 * Solo devuelve clientes que pertenezcan a la empresa indicada.
 * @param {string} externalId - ID externo del usuario (ej. Telegram user_id).
 * @param {string} empresaId  - ID de la empresa.
 * @returns {object|null}
 */
function buscarPorExternalId(externalId, empresaId) {
  if (!externalId || !empresaId) return null;
  const v = norm(externalId);

  for (const cliente of CLIENTES_MOCK) {
    if (cliente.empresa_id !== empresaId) continue;
    if (cliente.linked_external_ids.some((id) => norm(id) === v)) {
      return { empresa_id: cliente.empresa_id, nombre: cliente.nombre, servicios: cliente.servicios };
    }
  }
  return null;
}

module.exports = { buscar, buscarPorExternalId };
