/**
 * @file comunicados.controller.js
 * @description Controlador para el mural de comunicados corporativos,
 * cumpleaños y aniversarios obtenidos de la API de Gestión Personal.
 */

const axios = require('axios');
const logger = require('../config/logger');

const GESTION_PERSONAL_API = process.env.GESTION_PERSONAL_API_URL || 'http://127.0.0.1:8000';
const GESTION_PERSONAL_API_KEY = process.env.GESTION_PERSONAL_API_KEY || 'fibratec_crm_integracion_secure_key_2026';

const apiClient = axios.create({
  baseURL: GESTION_PERSONAL_API,
  timeout: 4500,
  headers: {
    'x-api-key': GESTION_PERSONAL_API_KEY,
    'Content-Type': 'application/json'
  }
});

async function getResumen(req, res, next) {
  try {
    const response = await apiClient.get('/api/comunicados/resumen');
    return res.json(response.data);
  } catch (err) {
    logger.warn(`[Comunicados] No se pudo conectar con Gestión Personal en ${GESTION_PERSONAL_API}: ${err.message}`);
    // Retornar estructura base amigable si el servicio de RH está desconectado temporalmente
    const ahora = new Date();
    return res.json({
      hoy: ahora.toISOString().split('T')[0],
      mes_actual: ahora.getMonth() + 1,
      cumpleanos_hoy: [],
      cumpleanos_mes: [],
      aniversarios_mes: [],
      comunicados: [
        {
          id_comunicado: 1,
          titulo: "¡Bienvenidos al Portal Corporativo!",
          contenido: "Aquí podrás consultar avisos importantes, comunicados de la empresa y cumpleaños de tus compañeros de equipo.",
          categoria: "GENERAL",
          autor: "Recursos Humanos",
          fijado: true,
          activo: true,
          fecha_publicacion: ahora.toISOString().slice(0, 16).replace('T', ' ')
        }
      ],
      servicio_rh_conectado: false
    });
  }
}

async function getComunicados(req, res, next) {
  try {
    const response = await apiClient.get('/api/comunicados/');
    return res.json(response.data);
  } catch (err) {
    logger.warn(`[Comunicados] Error al listar comunicados: ${err.message}`);
    return res.json([]);
  }
}

async function crearComunicado(req, res, next) {
  try {
    const response = await apiClient.post('/api/comunicados/', req.body);
    return res.json(response.data);
  } catch (err) {
    next(err);
  }
}

async function eliminarComunicado(req, res, next) {
  try {
    const { id } = req.params;
    const response = await apiClient.delete(`/api/comunicados/${id}`);
    return res.json(response.data);
  } catch (err) {
    next(err);
  }
}

module.exports = { getResumen, getComunicados, crearComunicado, eliminarComunicado };
