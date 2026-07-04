const Joi              = require('joi');
const db               = require('../config/db');
const rolTemplateRepo  = require('../repositories/rolTemplate.repository');

const templateSchema = Joi.object({
  empresas: Joi.array().items(Joi.string()).min(1).required(),
  areas:    Joi.array().items(Joi.object({
    empresa_id: Joi.string().required(),
    areas:      Joi.array().items(Joi.string()).min(1).required(),
  })).min(1).required(),
  modulos: Joi.array().items(Joi.string()).required(),
});

// GET /rol-template — lista todas las plantillas
const list = async (req, res, next) => {
  try {
    const { rows } = await rolTemplateRepo.getAll();
    res.json(rows);
  } catch (e) { next(e); }
};

// GET /rol-template/:rol — obtiene una plantilla por rol
const get = async (req, res, next) => {
  try {
    const { rows } = await rolTemplateRepo.getByRol(req.params.rol);
    if (!rows.length) return res.status(404).json({ error: `Sin plantilla para el rol "${req.params.rol}"` });
    res.json(rows[0]);
  } catch (e) { next(e); }
};

// PUT /rol-template/:rol — crea o actualiza la plantilla (solo admin)
const upsert = async (req, res, next) => {
  try {
    const { error, value } = templateSchema.validate(req.body, { abortEarly: false });
    if (error) return res.status(400).json({ error: error.details.map(d => d.message).join(', ') });

    const row = await rolTemplateRepo.upsert(req.params.rol, value, req.agente.id);
    const io = req.app.get('io');
    if (io) io.emit('rol_template_actualizado', { rol: req.params.rol });
    res.json(row);
  } catch (e) { next(e); }
};

// POST /rol-template/:rol/apply — aplica la plantilla a TODOS los usuarios del rol (solo admin)
const applyToRol = async (req, res, next) => {
  try {
    const usuariosAfectados = await rolTemplateRepo.applyToRole(req.params.rol, req.agente.id);
    const io = req.app.get('io');
    if (io) {
      for (const id of usuariosAfectados) {
        io.emit('permisos_actualizados', { usuario_id: id });
      }
    }
    res.json({ ok: true, usuarios_afectados: usuariosAfectados.length });
  } catch (e) { next(e); }
};

module.exports = { list, get, upsert, applyToRol };
