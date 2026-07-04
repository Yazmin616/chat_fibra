const menusService = require('../services/menus.service');

const getMenus = async (req, res, next) => {
  try {
    const { empresa_id } = req.query;
    const eid = (empresa_id && empresa_id !== 'todas') ? empresa_id : 'fibratec';
    
    const menus = await menusService.getAllMenus(eid);
    res.json(menus);
  } catch (err) {
    next(err);
  }
};

const saveMenuButton = async (req, res, next) => {
  try {
    const { menuId, buttonId } = req.params;
    const { texto, activo, empresa_id } = req.body;
    const eid = (empresa_id && empresa_id !== 'todas') ? empresa_id : 'fibratec';
    
    const esActivo = activo !== undefined ? activo : true;

    await menusService.updateMenuButton(eid, menuId, buttonId, texto, esActivo);
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  getMenus,
  saveMenuButton
};
