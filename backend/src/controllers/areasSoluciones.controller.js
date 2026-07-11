const db = require('../config/db');

const listarAreas = async (req, res, next) => {
  try {
    const { empresa_id } = req.query;
    
    let query, params;
    if (!empresa_id || empresa_id === 'todas') {
      // Si piden todas, devolvemos TODAS las áreas de la base de datos (Globales + Específicas)
      query = `
        SELECT a.*, ag.nombre AS coordinador_nombre, ag.email AS coordinador_email
        FROM public.areas_soluciones a
        LEFT JOIN public.agentes ag ON a.coordinador_id = ag.id
        ORDER BY a.id ASC
      `;
      params = [];
    } else {
      // Si piden las de una empresa específica (ej. Fibratec), devolvemos las de esa empresa MÁS las que tengan 'todas' en su array
      query = `
        SELECT a.*, ag.nombre AS coordinador_nombre, ag.email AS coordinador_email
        FROM public.areas_soluciones a
        LEFT JOIN public.agentes ag ON a.coordinador_id = ag.id
        WHERE a.empresa_id ? $1 OR a.empresa_id ? 'todas'
        ORDER BY a.id ASC
      `;
      params = [empresa_id];
    }
    
    const { rows } = await db.query(query, params);
    
    if (req.agente.rol !== 'admin') {
      return res.json(rows.filter(r => r.coordinador_id === req.agente.id));
    }
    
    res.json(rows);
  } catch (error) {
    next(error);
  }
};

const crearArea = async (req, res, next) => {
  try {
    if (req.agente.rol !== 'admin') {
      return res.status(403).json({ message: 'Solo los administradores pueden crear áreas.' });
    }
    const { empresa_id, nombre_area, descripcion, soluciones, coordinador_id } = req.body;
    // Permitir guardar un arreglo JSON en la BD
    let eid = empresa_id;
    if (!Array.isArray(eid)) {
      eid = eid ? [eid] : ['todas'];
    }
    const sols = Array.isArray(soluciones) ? JSON.stringify(soluciones) : '[]';
    const coordId = coordinador_id ? parseInt(coordinador_id, 10) : null;

    const { rows } = await db.query(
      `INSERT INTO public.areas_soluciones (empresa_id, nombre_area, descripcion, soluciones, activo, coordinador_id) 
       VALUES ($1, $2, $3, $4, true, $5) RETURNING *`,
      [JSON.stringify(eid), nombre_area, descripcion || '', sols, coordId]
    );
    res.status(201).json(rows[0]);
  } catch (error) {
    next(error);
  }
};

const actualizarArea = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { nombre_area, descripcion, soluciones, activo, empresa_id } = req.body;
    const sols = Array.isArray(soluciones) ? JSON.stringify(soluciones) : null;
    
    let eid = empresa_id;
    if (eid && !Array.isArray(eid)) {
      eid = [eid];
    }
    const eidStr = eid ? JSON.stringify(eid) : null;

    // Obtener el coordinador actual antes de actualizar
    const { rows: currentArea } = await db.query(
      "SELECT coordinador_id FROM public.areas_soluciones WHERE id = $1",
      [id]
    );
    const oldCoordId = currentArea[0]?.coordinador_id;
    
    if (req.agente.rol !== 'admin') {
      if (oldCoordId !== req.agente.id) {
        return res.status(403).json({ message: 'No tienes permiso para modificar un área que no coordinas.' });
      }
      if (req.body.hasOwnProperty('coordinador_id') && parseInt(req.body.coordinador_id, 10) !== req.agente.id) {
        return res.status(403).json({ message: 'No tienes permiso para cambiar el coordinador de esta área.' });
      }
    }

    let query = `
      UPDATE public.areas_soluciones 
      SET nombre_area = COALESCE($1, nombre_area), 
          descripcion = COALESCE($2, descripcion), 
          soluciones = COALESCE($3, soluciones), 
          activo = COALESCE($4, activo),
          empresa_id = COALESCE($5, empresa_id)
    `;
    const params = [nombre_area, descripcion, sols, activo, eidStr];
    
    if (req.body.hasOwnProperty('coordinador_id')) {
      const coordId = req.body.coordinador_id ? parseInt(req.body.coordinador_id, 10) : null;
      params.push(coordId);
      query += `, coordinador_id = $${params.length}`;
    }
    
    params.push(id);
    query += ` WHERE id = $${params.length} RETURNING *`;

    const { rows } = await db.query(query, params);

    if (rows.length === 0) return res.status(404).json({ message: 'Área no encontrada' });

    // Si cambió el coordinador, notificar en tiempo real vía Socket.io para refrescar los permisos
    if (req.body.hasOwnProperty('coordinador_id')) {
      const newCoordId = rows[0].coordinador_id;
      const io = req.app.get('io');
      if (io) {
        if (oldCoordId) io.emit('permisos_actualizados', { usuario_id: oldCoordId });
        if (newCoordId && newCoordId !== oldCoordId) io.emit('permisos_actualizados', { usuario_id: newCoordId });
      }
    }

    res.json(rows[0]);
  } catch (error) {
    next(error);
  }
};

const eliminarArea = async (req, res, next) => {
  try {
    if (req.agente.rol !== 'admin') {
      return res.status(403).json({ message: 'Solo los administradores pueden eliminar áreas.' });
    }
    const { id } = req.params;
    const { rows } = await db.query(
      'DELETE FROM public.areas_soluciones WHERE id = $1 RETURNING *',
      [id]
    );

    if (rows.length === 0) return res.status(404).json({ message: 'Área no encontrada' });
    res.json({ message: 'Área eliminada correctamente' });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  listarAreas,
  crearArea,
  actualizarArea,
  eliminarArea
};
