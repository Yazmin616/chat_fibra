/**
 * @file contactos.routes.js
 * @description Rutas para la vista de Contactos (directorio de usuarios/clientes).
 * Permite listar todos los clientes que han interactuado con el sistema
 * y editar sus datos de contacto manualmente desde el CRM.
 *
 * Rutas expuestas (requieren token válido de cualquier rol):
 *   GET /contactos/     → Lista todos los usuarios con métricas de interacción
 *   PUT /contactos/:id  → Actualiza nombre y/o teléfono de un usuario
 */

const express      = require('express');
const router       = express.Router();
const usuarioRepo  = require('../repositories/usuario.repository');
const { verifyToken } = require('../middleware/auth.middleware');

/**
 * Lista todos los usuarios con su última interacción y total de chats.
 * Ordenados por fecha de última interacción descendente.
 * Respuesta 200: array de usuarios.
 */
router.get('/', verifyToken, async (req, res, next) => {
  try {
    const { rows } = await usuarioRepo.findAll();
    res.json(rows);
  } catch (err) { next(err); }
});

/**
 * Actualiza los datos editables de un usuario (nombre y teléfono).
 * Params:  id = PK del usuario.
 * Body:    { nombre: string, telefono: string }
 * Respuesta 200: { message: "Contacto actualizado" }
 */
router.put('/:id', verifyToken, async (req, res, next) => {
  try {
    const { nombre, telefono } = req.body;
    await usuarioRepo.updateContacto(req.params.id, nombre, telefono);
    res.json({ message: 'Contacto actualizado' });
  } catch (err) { next(err); }
});

module.exports = router;
