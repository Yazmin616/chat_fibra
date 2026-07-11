const db             = require('../config/db');
const etiquetaRepo    = require('../repositories/etiqueta.repository');
const conversacionRepo = require('../repositories/conversacion.repository');
const { emitToConv }  = require('../utils/rooms');

// GET /etiquetas?empresa_id=fibratec|todas[&q=texto][&area=...]
// Admin con empresa_id='todas' → listAll (sin filtro de empresa).
// Admin con empresa_id concreto → labels visibles para esa empresa.
// Agente → solo generales + su área (empresa_id del JWT).
async function listar(req, res, next) {
  try {
    const { empresa_id, q, area } = req.query;
    if (!empresa_id) return res.status(400).json({ error: 'empresa_id requerido' });

    const agente    = req.agente;
    const isAdmin   = agente?.rol === 'admin';
    const busqueda  = q?.trim();
    const areaFiltro = area === '__general__' ? '__general__' : area;

    let rows;
    if (isAdmin && empresa_id === 'todas') {
      ({ rows } = await etiquetaRepo.listAll(areaFiltro));
    } else if (isAdmin) {
      ({ rows } = busqueda
        ? await etiquetaRepo.search(empresa_id, busqueda, areaFiltro)
        : await etiquetaRepo.list(empresa_id, areaFiltro));
    } else {
      let targetEmpresas = [empresa_id];
      if (empresa_id === 'todas') {
        const { rows: empRows } = await db.query("SELECT id AS empresa_id FROM public.empresas");
        targetEmpresas = empRows.map(r => r.empresa_id);
      }
      
      if (targetEmpresas.length === 0) {
        rows = [];
      } else {
        const fetchRows = busqueda
          ? await etiquetaRepo.searchForAgentMulti(targetEmpresas, busqueda, agente?.area || null)
          : await etiquetaRepo.listForAgentMulti(targetEmpresas, agente?.area || null);
        rows = fetchRows.rows;
      }
      
      // Filtro para Coordinadores: si el usuario es coordinador, solo ve lo de sus áreas y lo general
      if (req.agente.coordinadorAreas && req.agente.coordinadorAreas.length > 0) {
        rows = rows.filter(r => !r.area || req.agente.coordinadorAreas.includes(r.area));
      }
    }

    res.json(rows);
  } catch (e) { next(e); }
}

// POST /etiquetas  { empresa_id, nombre, descripcion, color, area, empresas[] }
// Admin puede elegir área y empresas. Agente: área y empresa forzadas por JWT.
async function crear(req, res, next) {
  try {
    const { empresa_id, nombre, descripcion, color, area, empresas } = req.body;
    if (!empresa_id || !nombre?.trim() || !color) {
      return res.status(400).json({ error: 'empresa_id, nombre y color son requeridos' });
    }
    const isAdmin    = req.agente?.rol === 'admin';
    const areaFinal  = isAdmin ? (area || null) : (req.agente?.area || null);
    const empresaList = isAdmin
      ? (Array.isArray(empresas) && empresas.length ? empresas : [empresa_id])
      : [req.agente?.area ? empresa_id : empresa_id]; // agente → su empresa
    const { rows } = await etiquetaRepo.create(
      empresa_id, nombre.trim(), descripcion?.trim(), color, areaFinal, empresaList
    );
    res.status(201).json(rows[0]);
  } catch (e) {
    if (e.code === '23505') return res.status(409).json({ error: 'Ya existe una etiqueta con ese nombre en esta empresa' });
    next(e);
  }
}

// PUT /etiquetas/:id  { empresa_id, nombre, descripcion, color, area, empresas[] }
async function actualizar(req, res, next) {
  try {
    const id = Number(req.params.id);
    const { empresa_id, nombre, descripcion, color, area, empresas } = req.body;
    if (!empresa_id || !nombre?.trim() || !color) {
      return res.status(400).json({ error: 'empresa_id, nombre y color son requeridos' });
    }
    const empresaList = Array.isArray(empresas) && empresas.length ? empresas : [empresa_id];
    const { rows } = await etiquetaRepo.update(
      id, empresa_id, nombre.trim(), descripcion?.trim(), color, area || null, empresaList
    );
    if (!rows.length) return res.status(404).json({ error: 'Etiqueta no encontrada' });
    res.json(rows[0]);
  } catch (e) {
    if (e.code === '23505') return res.status(409).json({ error: 'Ya existe una etiqueta con ese nombre en esta empresa' });
    next(e);
  }
}

// DELETE /etiquetas/:id?empresa_id=fibratec
async function eliminar(req, res, next) {
  try {
    const id = Number(req.params.id);
    const { empresa_id } = req.query;
    if (!empresa_id) return res.status(400).json({ error: 'empresa_id requerido' });
    const { rowCount } = await etiquetaRepo.remove(id, empresa_id);
    if (!rowCount) return res.status(404).json({ error: 'Etiqueta no encontrada' });
    res.json({ ok: true });
  } catch (e) { next(e); }
}

// GET /etiquetas/conversacion/:id
async function getDeConversacion(req, res, next) {
  try {
    const { rows } = await etiquetaRepo.getByConversacion(Number(req.params.id));
    res.json(rows);
  } catch (e) { next(e); }
}

// POST /etiquetas/conversacion/:id  { etiqueta_id }
async function asignar(req, res, next) {
  try {
    const conversacion_id = Number(req.params.id);
    const { etiqueta_id } = req.body;
    if (!etiqueta_id) return res.status(400).json({ error: 'etiqueta_id requerido' });
    await etiquetaRepo.assign(conversacion_id, Number(etiqueta_id), req.agente?.id);
    const { rows: etiquetas } = await etiquetaRepo.getByConversacion(conversacion_id);
    const io = req.app.get('io');
    if (io) {
      const { rows: [conv] } = await conversacionRepo.findById(conversacion_id);
      if (conv) emitToConv(io, conv.departamento, 'conversacion_etiquetas', { conversacion_id, etiquetas });
    }
    res.json(etiquetas);
  } catch (e) { next(e); }
}

// DELETE /etiquetas/conversacion/:id/:etiqueta_id
async function quitar(req, res, next) {
  try {
    const conversacion_id = Number(req.params.id);
    const etiqueta_id     = Number(req.params.etiqueta_id);
    await etiquetaRepo.unassign(conversacion_id, etiqueta_id);
    const { rows: etiquetas } = await etiquetaRepo.getByConversacion(conversacion_id);
    const io = req.app.get('io');
    if (io) {
      const { rows: [conv] } = await conversacionRepo.findById(conversacion_id);
      if (conv) emitToConv(io, conv.departamento, 'conversacion_etiquetas', { conversacion_id, etiquetas });
    }
    res.json(etiquetas);
  } catch (e) { next(e); }
}

module.exports = { listar, crear, actualizar, eliminar, getDeConversacion, asignar, quitar };
