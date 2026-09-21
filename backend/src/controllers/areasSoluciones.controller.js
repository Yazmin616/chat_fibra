const db = require('../config/db');

const listarAreas = async (req, res, next) => {
  try {
    const { empresa_id, catalogo } = req.query;
    const esCatalogo = catalogo === 'true' || catalogo === true;
    
    let query, params;
    if (!empresa_id || empresa_id === 'todas') {
      // Devolver todas las áreas ordenadas por nombre
      query = `
        SELECT a.*, ag.nombre AS coordinador_nombre, ag.email AS coordinador_email
        FROM public.areas_soluciones a
        LEFT JOIN public.agentes ag ON a.coordinador_id = ag.id
        ORDER BY a.nombre_area ASC
      `;
      params = [];
    } else {
      query = `
        SELECT a.*, ag.nombre AS coordinador_nombre, ag.email AS coordinador_email
        FROM public.areas_soluciones a
        LEFT JOIN public.agentes ag ON a.coordinador_id = ag.id
        WHERE a.empresa_id ? $1 OR a.empresa_id ? 'todas'
        ORDER BY a.nombre_area ASC
      `;
      params = [empresa_id];
    }
    
    const { rows } = await db.query(query, params);
    
    // Si es para catálogo/selectores o si es admin, entregar todo
    if (req.agente.rol === 'admin' || esCatalogo) {
      return res.json(rows);
    }
    
    // Si es vista de gestión para coordinador, filtrar a las que coordina
    res.json(rows.filter(r => r.coordinador_id === req.agente.id));
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

    const nombreLimpio = (nombre_area || '').trim();
    if (!nombreLimpio) {
      return res.status(400).json({ message: 'El nombre del área o departamento es obligatorio.' });
    }

    // Verificar si ya existe un área con el mismo nombre (insensible a mayúsculas)
    const { rows: yaExiste } = await db.query(
      'SELECT id FROM public.areas_soluciones WHERE LOWER(TRIM(nombre_area)) = LOWER(TRIM($1)) LIMIT 1',
      [nombreLimpio]
    );
    if (yaExiste.length > 0) {
      return res.status(400).json({ message: `Ya existe un área o departamento llamado "${nombreLimpio}".` });
    }

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
      [JSON.stringify(eid), nombreLimpio, descripcion || '', sols, coordId]
    );

    const io = req.app.get('io');
    if (io) io.emit('areas_actualizadas');

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

    // Obtener el área actual
    const { rows: currentArea } = await db.query(
      "SELECT coordinador_id, nombre_area FROM public.areas_soluciones WHERE id = $1",
      [id]
    );
    if (currentArea.length === 0) return res.status(404).json({ message: 'Área no encontrada' });

    const oldCoordId = currentArea[0]?.coordinador_id;
    const oldNombre = currentArea[0]?.nombre_area;
    
    if (req.agente.rol !== 'admin') {
      if (oldCoordId !== req.agente.id) {
        return res.status(403).json({ message: 'No tienes permiso para modificar un área que no coordinas.' });
      }
      if (req.body.hasOwnProperty('coordinador_id') && parseInt(req.body.coordinador_id, 10) !== req.agente.id) {
        return res.status(403).json({ message: 'No tienes permiso para cambiar el coordinador de esta área.' });
      }
    }

    const nombreLimpio = nombre_area ? nombre_area.trim() : null;
    if (nombreLimpio) {
      const { rows: yaExiste } = await db.query(
        'SELECT id FROM public.areas_soluciones WHERE LOWER(TRIM(nombre_area)) = LOWER(TRIM($1)) AND id != $2 LIMIT 1',
        [nombreLimpio, id]
      );
      if (yaExiste.length > 0) {
        return res.status(400).json({ message: `Ya existe otra área llamada "${nombreLimpio}".` });
      }
    }

    let query = `
      UPDATE public.areas_soluciones 
      SET nombre_area = COALESCE($1, nombre_area), 
          descripcion = COALESCE($2, descripcion), 
          soluciones = COALESCE($3, soluciones), 
          activo = COALESCE($4, activo),
          empresa_id = COALESCE($5, empresa_id),
          updated_at = NOW()
    `;
    const params = [nombreLimpio, descripcion, sols, activo, eidStr];
    
    if (req.body.hasOwnProperty('coordinador_id')) {
      const coordId = req.body.coordinador_id ? parseInt(req.body.coordinador_id, 10) : null;
      params.push(coordId);
      query += `, coordinador_id = $${params.length}`;
    }
    
    params.push(id);
    query += ` WHERE id = $${params.length} RETURNING *`;

    const { rows } = await db.query(query, params);

    // Si cambió el nombre del área, actualizar referencias en agentes para no romper consistencia
    if (nombreLimpio && oldNombre && nombreLimpio !== oldNombre) {
      await db.query('UPDATE public.agentes SET area = $1 WHERE area = $2', [nombreLimpio, oldNombre]);
    }

    // Notificar en tiempo real vía Socket.io
    const io = req.app.get('io');
    if (io) {
      io.emit('areas_actualizadas');
      if (req.body.hasOwnProperty('coordinador_id')) {
        const newCoordId = rows[0].coordinador_id;
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

    const { rows: areaRow } = await db.query('SELECT nombre_area FROM public.areas_soluciones WHERE id = $1', [id]);
    if (areaRow.length === 0) return res.status(404).json({ message: 'Área no encontrada' });
    const nombre = areaRow[0].nombre_area;

    // Verificar si hay agentes asociados a esta área
    const { rows: agentesConArea } = await db.query(
      'SELECT COUNT(*)::int AS total FROM public.agentes WHERE area = $1',
      [nombre]
    );
    if (agentesConArea[0].total > 0) {
      return res.status(400).json({
        message: `No se puede eliminar "${nombre}" porque tiene ${agentesConArea[0].total} agente(s) asignado(s). Reasigna los agentes a otra área primero.`
      });
    }

    await db.query('DELETE FROM public.areas_soluciones WHERE id = $1', [id]);

    const io = req.app.get('io');
    if (io) io.emit('areas_actualizadas');

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
