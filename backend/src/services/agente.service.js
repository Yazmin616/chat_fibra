/**
 * @file agente.service.js
 * @description Lógica de negocio para la gestión de agentes del CRM.
 * Incluye autenticación (login/logout) y operaciones CRUD.
 *
 * Seguridad:
 *   - Las contraseñas se almacenan como hash bcrypt (coste 10).
 *   - Los tokens JWT expiran en 24 horas.
 *   - JWT_SECRET se lee desde variables de entorno; nunca hardcodeado.
 */

const bcrypt     = require('bcryptjs');
const jwt        = require('jsonwebtoken');
const db         = require('../config/db');
const agenteRepo      = require('../repositories/agente.repository');
const conversacionRepo = require('../repositories/conversacion.repository');

const JWT_SECRET  = process.env.JWT_SECRET;
const JWT_EXPIRY  = process.env.JWT_EXPIRY || '10h';
if (!JWT_SECRET) throw new Error('JWT_SECRET no está configurado en .env');

/**
 * Autentica al agente con email y contraseña, lo marca como online
 * y devuelve un token JWT con sus datos básicos.
 *
 * @param {string} email    - Email del agente.
 * @param {string} password - Contraseña en texto plano.
 * @returns {Promise<{token: string, agente: {id, nombre, rol, area}}>}
 * @throws {Error} 401 si el email no existe o la contraseña es incorrecta.
 */
async function login(email, password) {
  const { rows } = await agenteRepo.findByEmail(email);
  if (rows.length === 0) {
    const err = new Error('Usuario no encontrado');
    err.status = 401;
    throw err;
  }
  const agente = rows[0];

  // Soporta tanto contraseñas hasheadas (producción) como texto plano (setup inicial)
  const valid = agente.password.startsWith('$2')
    ? await bcrypt.compare(password, agente.password)
    : password === agente.password;

  if (!valid) {
    const err = new Error('Contraseña incorrecta');
    err.status = 401;
    throw err;
  }

  await agenteRepo.setOnline(agente.id, true);

  // Consultar si es coordinador
  const { rows: isCoord } = await db.query(
    "SELECT 1 FROM public.areas_soluciones WHERE coordinador_id = $1 LIMIT 1",
    [agente.id]
  );
  const esCoordinador = isCoord.length > 0;

  const token = jwt.sign(
    { id: agente.id, nombre: agente.nombre, rol: agente.rol, area: agente.area, es_coordinador: esCoordinador, foto_perfil: agente.foto_perfil },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRY }
  );

  return {
    token,
    agente: { id: agente.id, nombre: agente.nombre, rol: agente.rol, area: agente.area, es_coordinador: esCoordinador, foto_perfil: agente.foto_perfil }
  };
}

/**
 * Marca al agente como offline al cerrar sesión.
 * @param {number} agente_id - PK del agente.
 * @returns {Promise<import('pg').QueryResult>}
 */
const logout = (agente_id) => agenteRepo.setOnline(agente_id, false);

/**
 * Devuelve la lista completa de agentes (sin contraseñas).
 * @returns {Promise<import('pg').QueryResult>}
 */
const listar = () => agenteRepo.findAll();

/**
 * Crea un nuevo agente con la contraseña hasheada.
 * @param {object} datos
 * @param {string} datos.nombre   - Nombre completo.
 * @param {string} datos.email    - Email (debe ser único en la tabla).
 * @param {string} datos.password - Contraseña en texto plano (se hashea aquí).
 * @param {string} datos.rol      - "admin" o "asesor".
 * @param {string} datos.area     - Área de trabajo.
 * @returns {Promise<{id, nombre, email}>} Datos del agente creado.
 */
async function crear({ nombre, email, password, rol, area }) {
  const hashedPassword = await bcrypt.hash(password, 10);
  const { rows } = await agenteRepo.create(nombre, email, hashedPassword, rol, area);
  return rows[0];
}

/**
 * Elimina un agente: primero desvincula sus conversaciones (pone agente_id=NULL)
 * para no violar la restricción de FK, luego borra el registro.
 * @param {number} id - PK del agente.
 * @returns {Promise<void>}
 */
async function eliminar(id) {
  await conversacionRepo.unassignAgente(id);
  await agenteRepo.remove(id);
}

/**
 * Actualiza los datos de un agente. Si se proporciona password, se re-hashea;
 * de lo contrario solo se actualizan los demás campos.
 *
 * @param {number} id      - PK del agente.
 * @param {object} datos   - { nombre, email, rol, area, password? }
 * @returns {Promise<object>} Agente actualizado.
 */
async function actualizar(id, { nombre, email, rol, area, password }) {
  if (password) {
    const hashedPassword = await bcrypt.hash(password, 10);
    const { rows } = await agenteRepo.updateWithPassword(id, nombre, email, hashedPassword, rol, area);
    return rows[0];
  }
  const { rows } = await agenteRepo.update(id, nombre, email, rol, area);
  return rows[0];
}

module.exports = { login, logout, listar, crear, eliminar, actualizar };
