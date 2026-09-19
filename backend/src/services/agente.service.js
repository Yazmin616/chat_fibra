/**
 * @file agente.service.js
 * @description Lógica de negocio para la gestión de agentes del CRM.
 * Incluye autenticación (login/logout), cambio obligatorio de contraseña,
 * generación de contraseñas temporales por coordinadores y operaciones CRUD.
 *
 * Seguridad:
 *   - Las contraseñas se almacenan como hash bcrypt (coste 10).
 *   - Los tokens JWT expiran en 10 horas.
 *   - JWT_SECRET se lee desde variables de entorno.
 */

const bcrypt          = require('bcryptjs');
const jwt             = require('jsonwebtoken');
const crypto          = require('crypto');
const db              = require('../config/db');
const agenteRepo      = require('../repositories/agente.repository');
const conversacionRepo = require('../repositories/conversacion.repository');

const JWT_SECRET = process.env.JWT_SECRET;
const JWT_EXPIRY = process.env.JWT_EXPIRY || '10h';
if (!JWT_SECRET) throw new Error('JWT_SECRET no está configurado en .env');

/**
 * Autentica al agente con usuario (o email) y contraseña, lo marca como online
 * y devuelve un token JWT con sus datos básicos y estado de primer login.
 *
 * @param {string} identifier - Usuario o correo del agente.
 * @param {string} password   - Contraseña en texto plano.
 * @returns {Promise<{token: string, agente: object}>}
 */
async function login(identifier, password) {
  const { rows } = await agenteRepo.findByUsuarioOrEmail(identifier);
  if (rows.length === 0) {
    const err = new Error('Usuario o credenciales incorrectas');
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

  // Consultar si es coordinador de algún área
  const { rows: isCoord } = await db.query(
    "SELECT 1 FROM public.areas_soluciones WHERE coordinador_id = $1 LIMIT 1",
    [agente.id]
  );
  const esCoordinador = isCoord.length > 0;

  const agenteData = {
    id: agente.id,
    usuario: agente.usuario,
    nombre: agente.nombre,
    email: agente.email,
    rol: agente.rol,
    area: agente.area,
    es_coordinador: esCoordinador,
    foto_perfil: agente.foto_perfil,
    debe_cambiar_password: Boolean(agente.debe_cambiar_password),
    coordinador_id: agente.coordinador_id,
    puede_recuperar_auto: Boolean(agente.puede_recuperar_auto),
  };

  const token = jwt.sign(agenteData, JWT_SECRET, { expiresIn: JWT_EXPIRY });

  return {
    token,
    agente: agenteData
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
 * Crea un nuevo agente con la contraseña hasheada y debe_cambiar_password = true.
 */
async function crear({ usuario, nombre, email, password, rol, area, coordinador_id = null, puede_recuperar_auto = false }) {
  // Generar usuario si viene vacío
  const usuarioLimpio = (usuario || nombre.toLowerCase().replace(/[^a-z0-9]/g, '')).trim();

  // Generar contraseña temporal si no se especificó una
  const sufijo = Math.floor(1000 + Math.random() * 9000);
  const passwordFinal = (password && password.trim().length >= 6)
    ? password.trim()
    : `Fibri_${sufijo}`;

  const hashedPassword = await bcrypt.hash(passwordFinal, 10);
  
  const autoRecup = Boolean(puede_recuperar_auto);
  const coordId = autoRecup ? null : (coordinador_id ? Number(coordinador_id) : null);

  // Por defecto, cuentas nuevas deben cambiar contraseña en primer login
  const { rows } = await agenteRepo.create({
    usuario: usuarioLimpio,
    nombre,
    email: email ? email.trim() : null,
    hashedPassword,
    rol: rol || 'asesor',
    area: area || 'General',
    coordinador_id: coordId,
    debe_cambiar_password: true,
    puede_recuperar_auto: autoRecup
  });

  return {
    ...rows[0],
    temporal_password: passwordFinal,
  };
}

/**
 * Elimina un agente: primero desvincula sus conversaciones para no violar FK.
 * @param {number} id - PK del agente.
 */
async function eliminar(id) {
  await conversacionRepo.unassignAgente(id);
  await agenteRepo.remove(id);
}

/**
 * Actualiza los datos de un agente. Si se proporciona password, se re-hashea.
 */
async function actualizar(id, { usuario, nombre, email, rol, area, password, coordinador_id, puede_recuperar_auto, debe_cambiar_password }) {
  const usuarioLimpio = usuario ? usuario.trim() : undefined;
  const autoRecup = Boolean(puede_recuperar_auto);
  const coordId = autoRecup ? null : (coordinador_id !== undefined ? (coordinador_id ? Number(coordinador_id) : null) : null);

  if (password && password.trim().length > 0) {
    const hashedPassword = await bcrypt.hash(password, 10);
    const { rows } = await agenteRepo.updateWithPassword({
      id,
      usuario: usuarioLimpio,
      nombre,
      email: email ? email.trim() : null,
      hashedPassword,
      rol,
      area,
      coordinador_id: coordId,
      puede_recuperar_auto: autoRecup,
      debe_cambiar_password: debe_cambiar_password !== undefined ? Boolean(debe_cambiar_password) : false
    });
    return rows[0];
  }

  const { rows } = await agenteRepo.update({
    id,
    usuario: usuarioLimpio,
    nombre,
    email: email ? email.trim() : null,
    rol,
    area,
    coordinador_id: coordId,
    puede_recuperar_auto: autoRecup
  });
  return rows[0];
}

/**
 * Cambio obligatorio de contraseña por parte del propio usuario (primer inicio o tras reseteo).
 */
async function cambiarPasswordObligatorio(agenteId, nuevaPassword) {
  if (!nuevaPassword || nuevaPassword.length < 6) {
    const err = new Error('La contraseña debe contener al menos 6 caracteres');
    err.status = 400;
    throw err;
  }

  const hashedPassword = await bcrypt.hash(nuevaPassword, 10);
  const { rows } = await agenteRepo.updatePasswordAndDebeCambiar(agenteId, hashedPassword, false);
  if (rows.length === 0) {
    const err = new Error('Agente no encontrado');
    err.status = 404;
    throw err;
  }

  const agente = rows[0];
  return {
    ok: true,
    mensaje: 'Contraseña actualizada exitosamente',
    agente: {
      id: agente.id,
      usuario: agente.usuario,
      nombre: agente.nombre,
      email: agente.email,
      debe_cambiar_password: false
    }
  };
}

/**
 * Genera una contraseña temporal legible para un subordinado.
 * Autorizado para Admin (global) o Coordinador (del área del agente o su coordinador directo).
 */
async function generarPasswordTemporal(solicitante, targetAgenteId) {
  const { rows } = await agenteRepo.findById(targetAgenteId);
  if (rows.length === 0) {
    const err = new Error('Agente no encontrado');
    err.status = 404;
    throw err;
  }
  const targetAgente = rows[0];

  // Verificar autorización
  const esAdmin = solicitante.rol === 'admin';
  let autorizado = esAdmin;

  if (!autorizado) {
    // Si el targetAgente tiene asignado como coordinador al solicitante
    if (targetAgente.coordinador_id && Number(targetAgente.coordinador_id) === Number(solicitante.id)) {
      autorizado = true;
    } else {
      // Verificar si el solicitante coordina el área del agente
      const { rows: areaRows } = await db.query(
        "SELECT 1 FROM public.areas_soluciones WHERE coordinador_id = $1 AND LOWER(nombre_area) = LOWER($2)",
        [solicitante.id, targetAgente.area]
      );
      if (areaRows.length > 0) {
        autorizado = true;
      }
    }
  }

  if (!autorizado) {
    const err = new Error('No tienes permisos de coordinador sobre este usuario');
    err.status = 403;
    throw err;
  }

  // Generar contraseña temporal amigable pero segura (ej: Fibri_7492)
  const sufijo = Math.floor(1000 + Math.random() * 9000);
  const temporalPassword = `Fibri_${sufijo}`;

  const hashedPassword = await bcrypt.hash(temporalPassword, 10);
  await agenteRepo.updatePasswordAndDebeCambiar(targetAgente.id, hashedPassword, true);

  return {
    ok: true,
    temporalPassword,
    targetAgente: {
      id: targetAgente.id,
      usuario: targetAgente.usuario,
      nombre: targetAgente.nombre,
      area: targetAgente.area
    }
  };
}

/**
 * Consulta la información del coordinador de un usuario para la ayuda de contraseña olvidada.
 */
async function obtenerCoordinadorDeAgente(identifier) {
  const { rows } = await agenteRepo.findByUsuarioOrEmail(identifier);
  if (rows.length === 0) {
    return {
      encontrado: false,
      mensaje: 'Si no recuerdas tus credenciales, contacta a tu Coordinador de Área o al Administrador de TI.'
    };
  }
  const agente = rows[0];

  // Si tiene habilitada la recuperación autónoma, es independiente y no depende de ningún coordinador
  if (agente.puede_recuperar_auto) {
    return {
      encontrado: true,
      usuario: agente.usuario,
      nombre: agente.nombre,
      area: agente.area,
      email: agente.email,
      es_autonomo: true,
      puede_recuperar_auto: true,
      coordinador_nombre: null,
      coordinador_email: null,
      mensaje: 'Tienes habilitada la Recuperación Autónoma por Correo. Tu cuenta es independiente y no dependes de ningún coordinador para restablecer tu contraseña.'
    };
  }

  // Si tiene coordinador explícito
  let coordinadorNombre = agente.coordinador_nombre;
  let coordinadorEmail = agente.coordinador_email;

  // Si no tiene coordinador explícito, buscar el coordinador de su área en areas_soluciones
  if (!coordinadorNombre && agente.area) {
    const { rows: areaCoord } = await db.query(
      `SELECT a.nombre, a.email 
       FROM public.areas_soluciones s
       JOIN agentes a ON a.id = s.coordinador_id
       WHERE LOWER(s.nombre_area) = LOWER($1) LIMIT 1`,
      [agente.area]
    );
    if (areaCoord.length > 0) {
      coordinadorNombre = areaCoord[0].nombre;
      coordinadorEmail = areaCoord[0].email;
    }
  }

  return {
    encontrado: true,
    usuario: agente.usuario,
    nombre: agente.nombre,
    area: agente.area,
    coordinador_nombre: coordinadorNombre || 'Administración / TI',
    coordinador_email: coordinadorEmail || null,
    puede_recuperar_auto: Boolean(agente.puede_recuperar_auto && agente.email)
  };
}

module.exports = { 
  login, logout, listar, crear, eliminar, actualizar,
  cambiarPasswordObligatorio, generarPasswordTemporal, obtenerCoordinadorDeAgente
};
