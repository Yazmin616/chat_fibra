const repo = require('../repositories/categoriaCierre.repository');

// GET /categorias-cierre?empresa_id=fibratec|todas[&q=texto][&area=...]
async function listar(req, res, next) {
  try {
    const { empresa_id, q, area } = req.query;
    if (!empresa_id) return res.status(400).json({ error: 'empresa_id requerido' });

    const agente     = req.agente;
    const isAdmin    = agente?.rol === 'admin';
    const busqueda   = q?.trim();
    const areaFiltro = area === '__general__' ? '__general__' : area;

    let rows;
    if (isAdmin && empresa_id === 'todas') {
      ({ rows } = await repo.listAll(areaFiltro));
    } else if (isAdmin) {
      ({ rows } = busqueda
        ? await repo.search(empresa_id, busqueda, areaFiltro)
        : await repo.list(empresa_id, areaFiltro));
    } else {
      const areaAgente = agente?.area || null;
      ({ rows } = busqueda
        ? await repo.searchForAgent(empresa_id, busqueda, areaAgente)
        : await repo.listForAgent(empresa_id, areaAgente));
    }
    res.json(rows);
  } catch (e) { next(e); }
}

// POST /categorias-cierre  { empresa_id, nombre, descripcion, area, color, empresas[] }
async function crear(req, res, next) {
  try {
    const { empresa_id, nombre, descripcion, area, color, empresas } = req.body;
    if (!empresa_id || !nombre?.trim()) {
      return res.status(400).json({ error: 'empresa_id y nombre son requeridos' });
    }
    const empresaList = Array.isArray(empresas) && empresas.length ? empresas : [empresa_id];
    const { rows } = await repo.create(
      empresa_id, nombre.trim(), descripcion?.trim(), area || null, color || '#6366f1', empresaList
    );
    res.status(201).json(rows[0]);
  } catch (e) {
    if (e.code === '23505') return res.status(409).json({ error: 'Ya existe una categoría con ese nombre en esta empresa' });
    next(e);
  }
}

// PUT /categorias-cierre/:id
async function actualizar(req, res, next) {
  try {
    const id = Number(req.params.id);
    const { empresa_id, nombre, descripcion, area, color, activa, empresas } = req.body;
    if (!empresa_id || !nombre?.trim()) {
      return res.status(400).json({ error: 'empresa_id y nombre son requeridos' });
    }
    const empresaList = Array.isArray(empresas) && empresas.length ? empresas : [empresa_id];
    const { rows } = await repo.update(
      id, empresa_id, nombre.trim(), descripcion?.trim(), area || null, color || '#6366f1', activa, empresaList
    );
    if (!rows.length) return res.status(404).json({ error: 'Categoría no encontrada' });
    res.json(rows[0]);
  } catch (e) {
    if (e.code === '23505') return res.status(409).json({ error: 'Ya existe una categoría con ese nombre en esta empresa' });
    next(e);
  }
}

// DELETE /categorias-cierre/:id?empresa_id=fibratec
async function eliminar(req, res, next) {
  try {
    const id = Number(req.params.id);
    const { empresa_id } = req.query;
    if (!empresa_id) return res.status(400).json({ error: 'empresa_id requerido' });
    const { rowCount } = await repo.remove(id, empresa_id);
    if (!rowCount) return res.status(404).json({ error: 'Categoría no encontrada' });
    res.json({ ok: true });
  } catch (e) { next(e); }
}

module.exports = { listar, crear, actualizar, eliminar };
