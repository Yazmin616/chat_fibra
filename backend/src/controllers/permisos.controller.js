const permisosRepo = require('../repositories/permisos.repository');

// GET /permisos/mi  →  permisos del agente autenticado
async function getMios(req, res, next) {
  try {
    const { id, rol } = req.agente;
    if (rol === 'admin') {
      // Admin no tiene restricciones — devuelve sentinelas de acceso total
      return res.json({
        empresas: ['__todas__'],
        areas:    [{ empresa_id: '__todas__', areas: ['__todas__'] }],
        modulos:  ['chat','contactos','infracciones','dashboard','usuarios','configuracion','etiquetas','notas_cierre'],
      });
    }
    const data = await permisosRepo.getPermisos(id);
    res.json(data);
  } catch (e) { next(e); }
}

// GET /permisos/:id  →  permisos de un usuario (solo admin)
async function getDeUsuario(req, res, next) {
  try {
    const id = Number(req.params.id);
    if (!id) return res.status(400).json({ error: 'ID inválido' });
    const data = await permisosRepo.getPermisos(id);
    const log  = await permisosRepo.getLog(id);
    res.json({ ...data, log: log.rows });
  } catch (e) { next(e); }
}

// PUT /permisos/:id  →  reemplaza permisos (solo admin)
// Body: { empresas: string[], areas: {empresa_id, areas[]}[], modulos: string[] }
async function setDeUsuario(req, res, next) {
  try {
    const usuario_id = Number(req.params.id);
    if (!usuario_id) return res.status(400).json({ error: 'ID inválido' });

    const { empresas, areas, modulos } = req.body;
    if (!Array.isArray(empresas) || !Array.isArray(modulos)) {
      return res.status(400).json({ error: 'empresas y modulos deben ser arrays' });
    }

    await permisosRepo.setPermisos(usuario_id, { empresas, areas: areas || [], modulos }, req.agente.id);

    // Notificar en tiempo real al usuario si está conectado
    const io = req.app.get('io');
    if (io) io.emit('permisos_actualizados', { usuario_id });

    const data = await permisosRepo.getPermisos(usuario_id);
    res.json(data);
  } catch (e) { next(e); }
}

module.exports = { getMios, getDeUsuario, setDeUsuario };
