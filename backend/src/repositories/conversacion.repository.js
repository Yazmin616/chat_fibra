/**
 * @file conversacion.repository.js
 * @description Capa de acceso a datos para la tabla `conversaciones`.
 *
 * Una conversación representa una sesión de atención entre un usuario (cliente)
 * y el sistema (bot o agente humano). Sus estados posibles son:
 *   abierta → SELECCION_EMPRESA → SELECCION_AREA → ESPERANDO_AGENTE
 *   → atendiendo → ENCUESTA_AGENTE | ENCUESTA_BOT → cerrada
 *
 * Este módulo solo contiene queries SQL parametrizadas, sin lógica de negocio.
 */

const db = require('../config/db');

/**
 * Busca una conversación por su PK.
 * @param {number} id - ID de la conversación.
 * @returns {Promise<import('pg').QueryResult>}
 */
const findById = (id) =>
  db.query('SELECT * FROM conversaciones WHERE id=$1', [id]);

/**
 * Devuelve la conversación activa (no cerrada) más reciente de un usuario.
 * Prioriza conversaciones con `es_humano=true` (atención real) sobre las de menú.
 * @param {number} usuario_id - PK del usuario.
 * @returns {Promise<import('pg').QueryResult>}
 */
const findActiveByUsuario = (usuario_id, empresa_id) =>
  db.query(
    'SELECT * FROM conversaciones WHERE usuario_id=$1 AND empresa_id=$2 AND estado!=$3 ORDER BY es_humano DESC, id DESC LIMIT 1',
    [usuario_id, empresa_id, 'cerrada']
  );

/**
 * Lista los IDs de todas las conversaciones de un usuario (para borrado en cascada).
 * @param {number} usuario_id - PK del usuario.
 * @returns {Promise<import('pg').QueryResult>} Filas con solo el campo `id`.
 */
const findIdsByUsuario = (usuario_id) =>
  db.query('SELECT id FROM conversaciones WHERE usuario_id=$1', [usuario_id]);

/**
 * Crea una conversación de menú (estado inicial, aún sin área ni agente).
 * @param {number}  usuario_id  - PK del usuario.
 * @param {string}  empresa_id  - Empresa seleccionada, ej. "fibratec".
 * @param {string}  [estado]    - Estado inicial (default: "abierta").
 * @param {boolean} [es_humano] - Si habrá atención humana (default: false).
 * @returns {Promise<import('pg').QueryResult>}
 */
const create = (usuario_id, empresa_id, estado = 'abierta', es_humano = false) =>
  db.query(
    'INSERT INTO conversaciones (usuario_id, empresa_id, estado, es_humano) VALUES ($1,$2,$3,$4) RETURNING *',
    [usuario_id, empresa_id, estado, es_humano]
  );

/**
 * Crea una conversación limpia en estado ESPERANDO_AGENTE para un área específica.
 * Se llama cuando el cliente selecciona el área en el menú del bot.
 * @param {number} usuario_id   - PK del usuario.
 * @param {string} empresa_id   - Empresa.
 * @param {string} departamento - Área elegida: "Ventas", "Cobranza" o "Soporte Técnico".
 * @returns {Promise<import('pg').QueryResult>} Solo devuelve el `id` de la nueva conversación.
 */
const createEsperando = (usuario_id, empresa_id, departamento) =>
  db.query(
    `INSERT INTO conversaciones (usuario_id, empresa_id, departamento, estado, es_humano, updated_at)
     VALUES ($1,$2,$3,'ESPERANDO_AGENTE',true,NOW()) RETURNING id`,
    [usuario_id, empresa_id, departamento]
  );

/**
 * Actualiza el estado y el timestamp `updated_at` de una conversación.
 * @param {number} id     - PK de la conversación.
 * @param {string} estado - Nuevo estado.
 * @returns {Promise<import('pg').QueryResult>}
 */
const updateEstado = (id, estado) =>
  db.query('UPDATE conversaciones SET estado=$1, updated_at=NOW() WHERE id=$2', [estado, id]);

/**
 * Actualiza la empresa asociada a una conversación (se usa durante el flujo del menú).
 * @param {number} id         - PK de la conversación.
 * @param {string} empresa_id - Nueva empresa.
 * @returns {Promise<import('pg').QueryResult>}
 */
const updateEmpresa = (id, empresa_id) =>
  db.query('UPDATE conversaciones SET empresa_id=$1 WHERE id=$2', [empresa_id, id]);

/**
 * Asigna un agente a una conversación (si no tiene uno) y cambia el estado
 * de ESPERANDO_AGENTE → atendiendo cuando el agente envía el primer mensaje.
 * Usa COALESCE para no sobreescribir una asignación previa.
 * @param {number} id        - PK de la conversación.
 * @param {number} agente_id - PK del agente que toma el chat.
 * @returns {Promise<import('pg').QueryResult>}
 */
const assignAgente = (id, agente_id) =>
  db.query(
    `UPDATE conversaciones
     SET agente_id=COALESCE(agente_id,$1),
         estado=CASE WHEN estado='ESPERANDO_AGENTE' THEN 'atendiendo' ELSE estado END,
         ultimo_mensaje_cliente=CASE WHEN estado='ESPERANDO_AGENTE' THEN NOW() ELSE ultimo_mensaje_cliente END,
         sla_pendiente_desde=CASE WHEN estado='ESPERANDO_AGENTE' THEN NOW() ELSE sla_pendiente_desde END,
         updated_at=NOW()
     WHERE id=$2`,
    [agente_id, id]
  );

/**
 * Libera un chat del agente: marca es_humano=false, cambia estado a ENCUESTA_AGENTE
 * y registra el motivo de cierre. Esto dispara el flujo de encuesta CSAT.
 * @param {number} id            - PK de la conversación.
 * @param {string} motivo        - Motivo del cierre (texto libre).
 * @param {string} agente_nombre - Nombre del agente que cierra.
 * @returns {Promise<import('pg').QueryResult>}
 */
const liberar = (id, motivo, agente_nombre, categoria_cierre_id, comentario_cierre, tipo_cierre, cerrado_por_id) =>
  db.query(
    `UPDATE conversaciones
     SET es_humano=false, estado=$1, motivo_cierre=$2, cerrado_por=$3,
         categoria_cierre_id=$4, comentario_cierre=$5,
         tipo_cierre=$6, cerrado_por_id=$7, cerrado_en=NOW(), updated_at=NOW()
     WHERE id=$8`,
    ['ENCUESTA_AGENTE', motivo, agente_nombre,
     categoria_cierre_id || null, comentario_cierre || null,
     tipo_cierre || 'manual', cerrado_por_id || null, id]
  );

/**
 * Elimina conversaciones por una lista de IDs (usado en borrado total GDPR).
 * @param {number[]} ids - Array de PKs a eliminar.
 * @returns {Promise<import('pg').QueryResult>}
 */
const deleteByIds = (ids) =>
  db.query('DELETE FROM conversaciones WHERE id=ANY($1)', [ids]);

/**
 * Actualiza el timestamp `updated_at` de una conversación (señal de actividad reciente).
 * Se llama cada vez que un agente envía un mensaje, para reiniciar el timer de inactividad.
 * @param {number} id - PK de la conversación.
 * @returns {Promise<import('pg').QueryResult>}
 */
const touch = (id) =>
  db.query('UPDATE conversaciones SET updated_at=NOW() WHERE id=$1', [id]);

/**
 * Desvincula todas las conversaciones de un agente (agente_id → NULL).
 * Se usa antes de eliminar un agente para no violar la FK.
 * @param {number} agente_id - PK del agente a desvincular.
 * @returns {Promise<import('pg').QueryResult>}
 */
const unassignAgente = (agente_id) =>
  db.query('UPDATE conversaciones SET agente_id=NULL WHERE agente_id=$1', [agente_id]);

// ---------------------------------------------------------------------------
// Queries de listado con sub-queries de métricas (para el panel CRM)
// ---------------------------------------------------------------------------

/**
 * Sub-queries SQL reutilizables que calculan el último mensaje y el contador
 * de no leídos para cada conversación. Se insertan en SELECT de listados.
 * @private
 */
const MENSAJES_SUBQUERIES = `
  (SELECT texto FROM mensajes WHERE conversacion_id=c.id ORDER BY id DESC LIMIT 1) AS ultimo_mensaje,
  (SELECT remitente FROM mensajes WHERE conversacion_id=c.id ORDER BY id DESC LIMIT 1) AS ultimo_remitente,
  (SELECT created_at FROM mensajes WHERE conversacion_id=c.id ORDER BY id DESC LIMIT 1) AS fecha_ultimo_mensaje,
  (SELECT COUNT(*) FROM mensajes WHERE conversacion_id=c.id AND remitente IN ('user', 'sistema_info') AND leido=false) AS no_leidos
`;

/**
 * Lista conversaciones para un usuario con rol Admin.
 * Devuelve UNA sola fila por usuario (la conversación más reciente),
 * sin importar el área, para una vista consolidada.
 * @param {string} empresa_id - "todas" para ver todas las empresas, o un ID concreto.
 * @returns {Promise<import('pg').QueryResult>}
 */
const listAdmin = (empresa_id) => {
  const todas = empresa_id === 'todas';
  const params = [];
  const whereEmpresa = !todas ? `AND c.empresa_id=$${params.push(empresa_id || 'fibratec')}` : '';
  return db.query(`
    SELECT DISTINCT ON (c.usuario_id, c.empresa_id)
      c.*, u.nombre, u.username, u.external_id, u.canal, u.telefono,
      a.nombre AS agente_nombre,
      ${MENSAJES_SUBQUERIES}
    FROM conversaciones c
    JOIN usuarios u ON c.usuario_id=u.id
    LEFT JOIN agentes a ON c.agente_id = a.id
    WHERE 1=1 ${whereEmpresa}
    ORDER BY c.usuario_id, c.empresa_id,
      CASE WHEN c.estado IN ('ESPERANDO_AGENTE','atendiendo') THEN 0 ELSE 1 END ASC,
      c.updated_at DESC
  `, params);
};

/**
 * Lista conversaciones para un Asesor, filtradas por su área de trabajo.
 * También devuelve una sola fila por usuario.
 * @param {string} area       - Área del asesor: "Ventas", "Cobranza" o "Soporte Técnico".
 * @param {string} empresa_id - "todas" o un ID de empresa concreto.
 * @returns {Promise<import('pg').QueryResult>}
 */
const listByAreas = (areas, empresa_id) => {
  const todas = empresa_id === 'todas';
  const params = [areas];
  const whereEmpresa = !todas ? `AND c.empresa_id=$${params.push(empresa_id || 'fibratec')}` : '';
  return db.query(`
    SELECT DISTINCT ON (c.usuario_id, c.empresa_id)
      c.*, u.nombre, u.username, u.external_id, u.canal, u.telefono,
      a.nombre AS agente_nombre,
      ${MENSAJES_SUBQUERIES}
    FROM conversaciones c
    JOIN usuarios u ON c.usuario_id=u.id
    LEFT JOIN agentes a ON c.agente_id = a.id
    WHERE c.departamento = ANY($1::text[]) ${whereEmpresa}
    ORDER BY c.usuario_id, c.empresa_id,
      CASE WHEN c.estado IN ('ESPERANDO_AGENTE','atendiendo') THEN 0 ELSE 1 END ASC,
      c.updated_at DESC
  `, params);
};

/**
 * Verifica si el usuario tiene al menos una conversación cerrada (es cliente recurrente).
 * @param {number} usuario_id
 * @param {string} empresa_id
 * @returns {Promise<import('pg').QueryResult>}
 */
const findCerradasByUsuario = (usuario_id, empresa_id) =>
  db.query(
    'SELECT id FROM conversaciones WHERE usuario_id=$1 AND empresa_id=$2 AND estado=$3 LIMIT 1',
    [usuario_id, empresa_id, 'cerrada']
  );

/**
 * Fusiona un objeto parcial con el campo metadata de la conversación.
 * Usa el operador || de JSONB para merge superficial en el nivel raíz.
 * @param {number} id              - PK de la conversación.
 * @param {object} parcialMetadata - Campos a sobrescribir/agregar.
 * @returns {Promise<import('pg').QueryResult>}
 */
const updateMetadata = (id, parcialMetadata) =>
  db.query(
    'UPDATE conversaciones SET metadata = metadata || $1::jsonb, updated_at=NOW() WHERE id=$2',
    [JSON.stringify(parcialMetadata), id]
  );

/**
 * Listado incluyendo los campos de transferencia para que el frontend
 * pueda mostrar la nota y filtrar el historial correctamente.
 * Se usa en `listAdmin` y `listByArea` a través de MENSAJES_SUBQUERIES —
 * los campos nota_transferencia, transferida_en y transferida_desde ya
 * están en `c.*` porque son columnas de la tabla conversaciones.
 */

module.exports = {
  findById,
  findActiveByUsuario,
  findIdsByUsuario,
  findCerradasByUsuario,
  create,
  createEsperando,
  updateEstado,
  updateEmpresa,
  updateMetadata,
  assignAgente,
  liberar,
  deleteByIds,
  touch,
  unassignAgente,
  listAdmin,
  listByAreas,
};
