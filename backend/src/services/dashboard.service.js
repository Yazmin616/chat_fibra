/**
 * @file dashboard.service.js
 * @description Lógica de negocio para el panel de KPIs y estadísticas.
 * Consulta y agrega datos de conversaciones y calificaciones para generar:
 *   - KPIs de actividad (chats hoy/semana/mes, activos, cerrados).
 *   - Distribución de calificaciones CSAT (Bien/Regular/Mal).
 *   - Actividad diaria de los últimos 7 días.
 *   - Top asesores por rendimiento (solo Admin).
 *   - Últimas 10 calificaciones individuales.
 *
 * Todas las queries usan parámetros posicionales para prevenir SQL injection.
 * Los filtros de empresa y agente se construyen dinámicamente pero de forma segura.
 */

const db         = require('../config/db');
const agenteRepo = require('../repositories/agente.repository');

/**
 * Obtiene todos los datos del dashboard filtrados por empresa y/o agente.
 *
 * @param {number|string} [agente_id]  - PK del agente solicitante (determina rol y filtro).
 * @param {string}        [empresa_id] - "todas" para sin filtro, o un ID concreto (ej. "fibratec").
 * @returns {Promise<{
 *   kpis: object,
 *   calificaciones: object,
 *   actividadDiaria: object[],
 *   topAgentes: object[],
 *   ultimasCalificaciones: object[]
 * }>}
 */
async function getKpis(agente_id, empresa_id, filtro_agente_id, filtro_area) {
  let esAdmin = false;
  if (agente_id) {
    const { rows } = await agenteRepo.findById(agente_id);
    esAdmin = rows[0]?.rol === 'admin';
  }

  // Construir filtros seguros (parámetros posicionales, no concatenación)
  const f = _buildFilters(empresa_id, esAdmin, agente_id, filtro_agente_id, filtro_area);

  // Ejecutar todas las queries de lectura en paralelo para mejor rendimiento
  const [kpis, calificaciones, actividadDiaria, ultimasCalificaciones] = await Promise.all([

    // KPIs de actividad — todos con la misma ventana temporal para comparación consistente
    db.query(`
      SELECT
        COUNT(*) FILTER (
          WHERE (c.updated_at AT TIME ZONE 'America/Mexico_City')::date = (NOW() AT TIME ZONE 'America/Mexico_City')::date
        ) AS hoy,
        COUNT(*) FILTER (
          WHERE (c.updated_at AT TIME ZONE 'America/Mexico_City')::date >= (NOW() AT TIME ZONE 'America/Mexico_City')::date - 6
        ) AS semana,
        COUNT(*) FILTER (
          WHERE (c.estado='cerrada' OR c.estado LIKE 'ENCUESTA_%')
            AND (c.updated_at AT TIME ZONE 'America/Mexico_City')::date >= (NOW() AT TIME ZONE 'America/Mexico_City')::date - 6
        ) AS cerrados_semana,
        COUNT(*) FILTER (WHERE c.estado='atendiendo' OR c.estado='ESPERANDO_AGENTE') AS activos
      FROM conversaciones c
      WHERE c.agente_id IS NOT NULL ${f.where}
    `, f.params),

    // Distribución CSAT — agente (para el donut) + bot (conversaciones sin atender)
    db.query(`
      SELECT
        COUNT(*) FILTER (WHERE cal.tipo='agente' AND cal.puntuacion='Bien')    AS bien,
        COUNT(*) FILTER (WHERE cal.tipo='agente' AND cal.puntuacion='Regular') AS regular,
        COUNT(*) FILTER (WHERE cal.tipo='agente' AND cal.puntuacion='Mal')     AS mal,
        COUNT(*) FILTER (WHERE cal.tipo='agente') AS total,
        COUNT(*) FILTER (WHERE cal.tipo='bot')    AS sin_atencion
      FROM calificaciones cal
      JOIN conversaciones c ON cal.conversacion_id=c.id
      WHERE 1=1 ${f.where}
    `, f.params),

    // Actividad de los últimos 7 días
    db.query(`
      SELECT
        TO_CHAR(c.updated_at AT TIME ZONE 'America/Mexico_City','DD/MM') AS dia,
        COUNT(*) AS chats
      FROM conversaciones c
      WHERE c.agente_id IS NOT NULL
        AND (c.updated_at AT TIME ZONE 'America/Mexico_City')::date >= (NOW() AT TIME ZONE 'America/Mexico_City')::date - 6
        ${f.where}
      GROUP BY TO_CHAR(c.updated_at AT TIME ZONE 'America/Mexico_City','DD/MM'),
               (c.updated_at AT TIME ZONE 'America/Mexico_City')::date
      ORDER BY (c.updated_at AT TIME ZONE 'America/Mexico_City')::date ASC
    `, f.params),

    // Últimas 4 calificaciones individuales — incluye tipo para distinguir bot/agente
    db.query(`
      SELECT cal.puntuacion, cal.tipo, cal.created_at, u.nombre AS cliente, a.nombre AS agente, c.departamento
      FROM calificaciones cal
      JOIN conversaciones c ON cal.conversacion_id=c.id
      JOIN usuarios u ON c.usuario_id=u.id
      LEFT JOIN agentes a ON c.agente_id=a.id
      WHERE 1=1 ${f.where}
      ORDER BY cal.created_at DESC LIMIT 4
    `, f.params)

  ]);

  // Top asesores (solo disponible para Admin)
  let topAgentes = [];
  if (esAdmin) {
    const ef = _buildEmpresaFilter(empresa_id);
    const { rows } = await db.query(`
      SELECT
        a.id, a.nombre, a.area,
        COUNT(c.id) AS total_chats,
        COUNT(c.id) FILTER (WHERE (c.updated_at AT TIME ZONE 'America/Mexico_City')::date >= (NOW() AT TIME ZONE 'America/Mexico_City')::date - 6) AS esta_semana,
        COUNT(cal.id) AS total_calificaciones,
        ROUND(COUNT(cal.id) FILTER (WHERE cal.puntuacion='Bien') * 100.0 / NULLIF(COUNT(cal.id),0), 0) AS satisfaccion_pct
      FROM agentes a
      LEFT JOIN conversaciones c ON c.agente_id=a.id ${ef.joinWhere}
      LEFT JOIN calificaciones cal ON cal.conversacion_id=c.id AND cal.tipo='agente'
      WHERE a.rol='asesor'
      GROUP BY a.id, a.nombre, a.area
      ORDER BY satisfaccion_pct DESC NULLS LAST, total_chats DESC
    `, ef.params);
    topAgentes = rows;
  }

  return {
    kpis:                  kpis.rows[0],
    calificaciones:        calificaciones.rows[0],
    actividadDiaria:       actividadDiaria.rows,
    topAgentes,
    ultimasCalificaciones: ultimasCalificaciones.rows
  };
}

/**
 * Devuelve todas las calificaciones sin límite para la vista completa del modal.
 *
 * @param {number|string} [agente_id]       - PK del agente solicitante (determina rol).
 * @param {string}        [empresa_id]      - ID de empresa o "todas".
 * @param {number|string} [filtro_agente_id]- ID de agente a filtrar (solo admin).
 * @param {string}        [filtro_area]     - Área a filtrar (solo admin).
 * @returns {Promise<object[]>}
 */
async function getCalificaciones(agente_id, empresa_id, filtro_agente_id, filtro_area) {
  let esAdmin = false;
  if (agente_id) {
    const { rows } = await agenteRepo.findById(agente_id);
    esAdmin = rows[0]?.rol === 'admin';
  }
  const f = _buildFilters(empresa_id, esAdmin, agente_id, filtro_agente_id, filtro_area);
  const { rows } = await db.query(`
    SELECT cal.puntuacion, cal.tipo, cal.created_at, u.nombre AS cliente, a.nombre AS agente, c.departamento
    FROM calificaciones cal
    JOIN conversaciones c ON cal.conversacion_id=c.id
    JOIN usuarios u ON c.usuario_id=u.id
    LEFT JOIN agentes a ON c.agente_id=a.id
    WHERE 1=1 ${f.where}
    ORDER BY cal.created_at DESC
  `, f.params);
  return rows;
}

// ---------------------------------------------------------------------------
// Helpers privados para construcción segura de filtros dinámicos
// ---------------------------------------------------------------------------

/**
 * Construye el fragmento WHERE y el array de parámetros para filtrar
 * por empresa y/o agente. Nunca usa concatenación de strings con datos del usuario.
 * @private
 * @param {string}        empresa_id
 * @param {boolean}       esAdmin
 * @param {number|string} agente_id
 * @returns {{ params: any[], where: string }}
 */
function _buildFilters(empresa_id, esAdmin, agente_id, filtro_agente_id, filtro_area) {
  const todas   = empresa_id === 'todas';
  const params  = [];
  const clauses = [];

  if (!todas) {
    params.push(empresa_id || 'fibratec');
    clauses.push(`c.empresa_id=$${params.length}`);
  }

  if (!esAdmin && agente_id) {
    // Asesor: solo ve sus propias conversaciones
    params.push(agente_id);
    clauses.push(`c.agente_id=$${params.length}`);
  } else if (esAdmin && filtro_agente_id) {
    // Admin filtrando por agente específico
    params.push(filtro_agente_id);
    clauses.push(`c.agente_id=$${params.length}`);
  } else if (esAdmin && filtro_area) {
    // Admin filtrando por área
    params.push(filtro_area);
    clauses.push(`c.departamento=$${params.length}`);
  }

  return { params, where: clauses.length > 0 ? 'AND ' + clauses.join(' AND ') : '' };
}

/**
 * Construye el filtro de empresa para el JOIN de la query de top asesores.
 * @private
 * @param {string} empresa_id
 * @returns {{ params: any[], joinWhere: string }}
 */
function _buildEmpresaFilter(empresa_id) {
  if (!empresa_id || empresa_id === 'todas') return { params: [], joinWhere: '' };
  return { params: [empresa_id], joinWhere: 'AND c.empresa_id=$1' };
}

/**
 * Retorna estadísticas detalladas de un asesor específico: resumen global,
 * desglose por empresa, desglose por área, y actividad de los últimos 30 días.
 *
 * @param {number|string} id - PK del agente.
 * @returns {Promise<{ resumen: object, porEmpresa: object[], porArea: object[], actividad: object[] }>}
 */
async function getAgenteStats(id) {
  const [resumen, porEmpresa, porArea, actividad] = await Promise.all([

    db.query(`
      SELECT
        a.nombre, a.area,
        COUNT(DISTINCT c.id)         AS total_conversaciones,
        COUNT(DISTINCT c.usuario_id) AS clientes_unicos,
        COUNT(c.id) FILTER (WHERE (c.updated_at AT TIME ZONE 'America/Mexico_City')::date >= (NOW() AT TIME ZONE 'America/Mexico_City')::date - 6)  AS esta_semana,
        COUNT(c.id) FILTER (WHERE (c.updated_at AT TIME ZONE 'America/Mexico_City')::date >= (NOW() AT TIME ZONE 'America/Mexico_City')::date - 29) AS este_mes,
        COUNT(cal.id) FILTER (WHERE cal.puntuacion='Bien')    AS bien,
        COUNT(cal.id) FILTER (WHERE cal.puntuacion='Regular') AS regular,
        COUNT(cal.id) FILTER (WHERE cal.puntuacion='Mal')     AS mal,
        COUNT(cal.id) AS total_calificaciones,
        ROUND(COUNT(cal.id) FILTER (WHERE cal.puntuacion='Bien') * 100.0 / NULLIF(COUNT(cal.id),0), 0) AS satisfaccion_pct
      FROM agentes a
      LEFT JOIN conversaciones c   ON c.agente_id=a.id
      LEFT JOIN calificaciones cal ON cal.conversacion_id=c.id AND cal.tipo='agente'
      WHERE a.id=$1
      GROUP BY a.id, a.nombre, a.area
    `, [id]),

    db.query(`
      SELECT
        c.empresa_id,
        COUNT(c.id)                  AS chats,
        COUNT(DISTINCT c.usuario_id) AS clientes,
        ROUND(COUNT(cal.id) FILTER (WHERE cal.puntuacion='Bien') * 100.0 / NULLIF(COUNT(cal.id),0), 0) AS satisfaccion_pct
      FROM conversaciones c
      LEFT JOIN calificaciones cal ON cal.conversacion_id=c.id AND cal.tipo='agente'
      WHERE c.agente_id=$1
      GROUP BY c.empresa_id
      ORDER BY chats DESC
    `, [id]),

    db.query(`
      SELECT
        COALESCE(c.departamento, 'Sin área') AS area,
        COUNT(c.id) AS chats,
        ROUND(COUNT(cal.id) FILTER (WHERE cal.puntuacion='Bien') * 100.0 / NULLIF(COUNT(cal.id),0), 0) AS satisfaccion_pct
      FROM conversaciones c
      LEFT JOIN calificaciones cal ON cal.conversacion_id=c.id AND cal.tipo='agente'
      WHERE c.agente_id=$1
      GROUP BY c.departamento
      ORDER BY chats DESC
    `, [id]),

    db.query(`
      SELECT
        TO_CHAR(c.updated_at AT TIME ZONE 'America/Mexico_City', 'DD/MM') AS dia,
        (c.updated_at AT TIME ZONE 'America/Mexico_City')::date            AS fecha,
        COUNT(*) AS chats
      FROM conversaciones c
      WHERE c.agente_id=$1
        AND (c.updated_at AT TIME ZONE 'America/Mexico_City')::date >= (NOW() AT TIME ZONE 'America/Mexico_City')::date - 29
      GROUP BY dia, fecha
      ORDER BY fecha ASC
    `, [id]),

  ]);

  return {
    resumen:    resumen.rows[0]  || null,
    porEmpresa: porEmpresa.rows,
    porArea:    porArea.rows,
    actividad:  actividad.rows,
  };
}

module.exports = { getKpis, getCalificaciones, getAgenteStats };
