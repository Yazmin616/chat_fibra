const pool = require('../config/db');

class MenusRepository {
  async getPersonalizados(empresaId) {
    const res = await pool.query(
      `SELECT menu_id, button_id, texto, activo 
       FROM menus_bot 
       WHERE empresa_id = $1`,
      [empresaId]
    );
    return res.rows;
  }

  async upsertPersonalizado(empresaId, menuId, buttonId, texto, activo = true) {
    await pool.query(
      `INSERT INTO menus_bot (empresa_id, menu_id, button_id, texto, activo)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (empresa_id, menu_id, button_id) 
       DO UPDATE SET texto = EXCLUDED.texto, activo = EXCLUDED.activo, updated_at = CURRENT_TIMESTAMP`,
      [empresaId, menuId, buttonId, texto, activo]
    );
  }
}

module.exports = new MenusRepository();
