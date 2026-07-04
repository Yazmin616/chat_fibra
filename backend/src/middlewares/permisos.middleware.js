const permisosRepo = require('../repositories/permisos.repository');

/**
 * Verifica que el agente autenticado tenga acceso a un módulo.
 * Admin siempre pasa. Demás roles deben tener el módulo asignado.
 * Uso: router.get('/ruta', verifyToken, requireModulo('chat'), handler)
 */
function requireModulo(modulo) {
  return async (req, res, next) => {
    try {
      const { id, rol } = req.agente;
      if (rol === 'admin') return next();
      const ok = await permisosRepo.tieneModulo(id, modulo);
      if (!ok) return res.status(403).json({ error: `Sin acceso al módulo "${modulo}"` });
      next();
    } catch (e) { next(e); }
  };
}

/**
 * Verifica que el agente tenga acceso a la empresa que viene en la petición.
 * @param {Function} getEmpresaId - Función (req) => string que extrae el empresa_id
 * Uso: requireEmpresa(req => req.query.empresa_id)
 *      requireEmpresa(req => req.body.empresa_id)
 *      requireEmpresa(req => req.params.empresa_id)
 */
function requireEmpresa(getEmpresaId) {
  return async (req, res, next) => {
    try {
      const { id, rol } = req.agente;
      if (rol === 'admin') return next();
      const empresa_id = getEmpresaId(req);
      if (!empresa_id || empresa_id === 'todas') return next(); // sin filtro específico
      const ok = await permisosRepo.tieneEmpresa(id, empresa_id);
      if (!ok) return res.status(403).json({ error: 'Sin acceso a esta empresa' });
      next();
    } catch (e) { next(e); }
  };
}

module.exports = { requireModulo, requireEmpresa };
