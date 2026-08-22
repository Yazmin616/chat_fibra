/**
 * @file comunicados.routes.js
 * @description Rutas para el mural de avisos, comunicados y cumpleaños corporativos.
 */

const express = require('express');
const router = express.Router();
const { verifyToken } = require('../middleware/auth.middleware');
const comunicadosCtrl = require('../controllers/comunicados.controller');

router.use(verifyToken);

router.get('/resumen', comunicadosCtrl.getResumen);
router.get('/', comunicadosCtrl.getComunicados);
router.post('/', comunicadosCtrl.crearComunicado);
router.delete('/:id', comunicadosCtrl.eliminarComunicado);

module.exports = router;
