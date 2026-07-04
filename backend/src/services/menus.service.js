const repo = require('../repositories/menus.repository');

const DEFAULT_MENUS = {
  AREAS: [
    { button_id: '1', texto: '1️⃣  Ventas' },
    { button_id: '2', texto: '2️⃣  Cobranza' },
    { button_id: '3', texto: '3️⃣  Soporte Técnico' },
  ],
  ENCUESTA: [
    { button_id: '3', texto: '👍 Buena' },
    { button_id: '2', texto: '😐 Regular' },
    { button_id: '1', texto: '👎 Mala' },
  ],
  TIPO_CLIENTE: [
    { button_id: 'soy_cliente', texto: '👤 Soy cliente' },
    { button_id: 'contratar', texto: '🆕 Quiero contratar' },
    { button_id: 'asesor', texto: '🧑‍💼 Hablar con un asesor' },
  ],
  AUTOSERVICIO: [
    { button_id: 'deuda', texto: '💰 ¿Cuánto debo?' },
    { button_id: 'pago', texto: '📍 ¿Dónde pago?' },
    { button_id: 'falla', texto: '🔧 Reportar falla' },
    { button_id: 'comprobante', texto: '✅ Validar comprobante' },
    { button_id: 'asesor', texto: '🧑‍💼 Hablar con asesor' },
    { button_id: 'consulta_ajena', texto: '👥 Consultar para otra persona' },
  ],
  AUTOSERVICIO_BASICO: [
    { button_id: 'deuda', texto: '💰 ¿Cuánto debo?' },
    { button_id: 'pago', texto: '📍 ¿Dónde pago?' },
    { button_id: 'falla', texto: '🔧 Reportar falla' },
    { button_id: 'asesor', texto: '🧑‍💼 Hablar con asesor' },
    { button_id: 'consulta_ajena', texto: '👥 Consultar para otra persona' },
  ],
  OTRA_CONSULTA: [
    { button_id: 'si', texto: '✅ Sí' },
    { button_id: 'no', texto: '❌ No' },
  ],
  OTRA_CONSULTA_MULTI: [
    { button_id: 'si', texto: '✅ Sí' },
    { button_id: 'no', texto: '❌ No' },
    { button_id: 'cambiar_servicio', texto: '🔄 Consultar otro servicio' },
  ],
  CONFIRMAR_CUENTA: [
    { button_id: 'si_mia', texto: '✅ Sí, es mi cuenta' },
    { button_id: 'no_mia', texto: '👥 No, consulto por otra persona' },
  ],
  TIPO_IDENTIFICACION: [
    { button_id: 'id_cliente', texto: '🔢 ID de cliente' },
    { button_id: 'tel', texto: '📱 Teléfono' },
    { button_id: 'contrato', texto: '🪪 ID de contrato' },
    { button_id: 'email', texto: '📧 Correo electrónico' },
    { button_id: 'usuario', texto: '👤 Nombre de usuario' },
    { button_id: 'wifi', texto: '📶 Nombre de red WiFi' },
    { button_id: 'cedula', texto: '🪪 Cédula' },
    { button_id: 'asesor', texto: '🧑‍💼 Hablar con asesor' },
  ],
  CONFIRMAR_INTENCION: [
    { button_id: 'confirmar_si', texto: '✅ Sí, correcto' },
    { button_id: 'confirmar_no', texto: '↩️ No, otra opción' },
  ]
};

const MENU_DESCRIPTIONS = {
  AREAS: 'Selección de área para transferencia',
  ENCUESTA: 'Encuesta de satisfacción al finalizar el chat',
  TIPO_CLIENTE: 'Menú inicial (Cliente Nuevo vs Actual)',
  AUTOSERVICIO: 'Menú principal de autoservicio (con validación de comprobante)',
  AUTOSERVICIO_BASICO: 'Menú principal de autoservicio (sin validación de comprobante)',
  OTRA_CONSULTA: 'Pregunta al finalizar un flujo: ¿Otra consulta?',
  OTRA_CONSULTA_MULTI: 'Pregunta al finalizar un flujo (con opción de cambiar servicio)',
  CONFIRMAR_CUENTA: 'Confirmación tras encontrar la cuenta del cliente',
  TIPO_IDENTIFICACION: 'Métodos por los que el cliente puede buscar su cuenta',
  CONFIRMAR_INTENCION: 'Confirmación cuando el NLU detecta una intención'
};

class MenusService {
  async getAllMenus(empresaId) {
    const personalizados = await repo.getPersonalizados(empresaId);
    
    // Crear mapa rápido
    const pMap = {};
    personalizados.forEach(p => {
      if (!pMap[p.menu_id]) pMap[p.menu_id] = {};
      pMap[p.menu_id][p.button_id] = { texto: p.texto, activo: p.activo };
    });

    const menus = Object.keys(DEFAULT_MENUS).map(menuId => {
      const defaultButtons = DEFAULT_MENUS[menuId];
      const buttons = defaultButtons.map(btn => {
        const pBtn = pMap[menuId]?.[btn.button_id];
        return {
          button_id: btn.button_id,
          texto: pBtn ? pBtn.texto : btn.texto,
          activo: pBtn ? pBtn.activo : true,
          es_personalizado: !!pBtn
        };
      });

      return {
        menu_id: menuId,
        descripcion: MENU_DESCRIPTIONS[menuId],
        buttons
      };
    });

    return menus;
  }

  async updateMenuButton(empresaId, menuId, buttonId, texto, activo) {
    if (!DEFAULT_MENUS[menuId]) throw new Error('Menú no válido');
    if (!DEFAULT_MENUS[menuId].find(b => b.button_id === buttonId)) throw new Error('Botón no válido');
    
    await repo.upsertPersonalizado(empresaId, menuId, buttonId, texto, activo);
    return { ok: true };
  }

  /**
   * Genera el teclado inline de Telegram (formato de array de arrays)
   * inyectando los textos personalizados de la base de datos y filtrando los inactivos.
   */
  async getKeyboard(menuId, empresaId, columns = 1) {
    if (!DEFAULT_MENUS[menuId]) return { inline_keyboard: [] };

    const personalizados = await repo.getPersonalizados(empresaId);
    const pMap = {};
    personalizados.filter(p => p.menu_id === menuId).forEach(p => {
      pMap[p.button_id] = { texto: p.texto, activo: p.activo };
    });

    let buttons = DEFAULT_MENUS[menuId].map(btn => {
      const pBtn = pMap[btn.button_id];
      return {
        text: pBtn ? pBtn.texto : btn.texto,
        callback_data: btn.button_id,
        activo: pBtn ? pBtn.activo : true
      };
    });

    // Filtrar botones ocultos
    buttons = buttons.filter(b => b.activo);

    // Si columns > 1, agrupamos los botones. Por defecto cada botón en su propia fila.
    const inline_keyboard = [];
    if (columns === 1 || menuId === 'CONFIRMAR_INTENCION' || menuId === 'ENCUESTA' || menuId === 'OTRA_CONSULTA' || menuId === 'OTRA_CONSULTA_MULTI') {
       // Algunos teclados tienen su propia estructura original. 
       // Para ENCUESTA, CONFIRMAR_INTENCION, OTRA_CONSULTA, originalmente estaban en una fila.
       if (menuId === 'ENCUESTA' || menuId === 'CONFIRMAR_INTENCION' || menuId === 'OTRA_CONSULTA') {
         inline_keyboard.push(buttons); // todos en 1 fila
       } else if (menuId === 'OTRA_CONSULTA_MULTI') {
         inline_keyboard.push([buttons[0], buttons[1]]); // Si y No en una fila
         inline_keyboard.push([buttons[2]]); // Cambiar servicio en la segunda
       } else {
         buttons.forEach(b => inline_keyboard.push([b])); // 1 por fila
       }
    } else {
       buttons.forEach(b => inline_keyboard.push([b]));
    }

    return { inline_keyboard };
  }
}

module.exports = new MenusService();
