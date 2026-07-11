/**
 * @file flujoDefault.js
 * @description Representación COMPLETA del flujo actual del bot como JSON React Flow.
 *
 * Mapea exactamente cada estado del bot a un nodo visual:
 *   abierta.state       → nodo "Bienvenida"
 *   menuTipoCliente     → nodo "¿Eres cliente?"
 *   identificacionDatos → nodo "Identificar cliente"
 *   confirmarCuenta     → nodo "Confirmar cuenta"
 *   seleccionServicio   → nodo "Seleccionar servicio"
 *   menuAutoservicio    → nodo "Menú autoservicio"
 *   otraConsulta        → nodo "¿Otra consulta?"
 *   seleccionArea       → nodo "Seleccionar área"
 *   escalar_*           → nodos asignar_equipo por departamento
 *   fin_agente          → nodo "En espera de agente"
 *   encuesta            → nodo "Encuesta de satisfacción"
 *
 * Layout: izquierda → derecha (horizontal), grupos por columna.
 */

/* ─────────────────────────────────────────────────────────────────────────
   COLUMNAS (x):
     0   → Inicio / Bienvenida
     380 → Tipo de cliente
     760 → Identificación / Prospecto
     1140 → Confirmación / Menú autoservicio
     1520 → Resultados (deuda, pago, falla) / Selección área
     1900 → Escalada a agentes
     2280 → Nodos finales (en espera, encuesta, fin)
   ───────────────────────────────────────────────────────────────────────── */

const nodos = [

  /* ══════════════════════════════════════════════════════
     COLUMNA 0 — INICIO
     ══════════════════════════════════════════════════════ */
  {
    id: 'enrutador',
    tipo: 'enrutador_inicial',
    posicion: { x: 60, y: 320 },
    datos: {
      label: 'Enrutador (Invisible)',
      descripcion: 'Evalúa el estado del cliente y lo envía al saludo correcto.',
    },
  },
  {
    id: 'saludo_nuevo',
    tipo: 'mensaje',
    posicion: { x: 380, y: 160 },
    datos: {
      label: 'Saludo a cliente nuevo',
      texto: '👋 ¡Hola, {{nombre}}! Bienvenido/a a {{empresa}}.\n\n¿Cómo puedo ayudarte? Toca una opción o escribe tu consulta.\n\n_Para hablar directamente con un asesor, escribe "asesor"._',
    },
  },
  {
    id: 'saludo_recurrente',
    tipo: 'mensaje',
    posicion: { x: 380, y: 320 },
    datos: {
      label: 'Saludo a cliente recurrente (no identificado)',
      texto: '👋 ¡Hola de nuevo, {{nombre}}! Bienvenido/a a {{empresa}}.\n\nPara consultar tu servicio, necesito verificar tus datos. ¿Con qué te identificas?',
    },
  },
  {
    id: 'saludo_autoservicio',
    tipo: 'mensaje',
    posicion: { x: 380, y: 480 },
    datos: {
      label: 'Saludo a cliente reconocido (1 servicio)',
      texto: '👋 ¡Hola de nuevo, {{nombre}}! Bienvenido/a a {{empresa}}.\n\n¿En qué puedo ayudarte hoy?',
    },
  },
  {
    id: 'saludo_multiservicio',
    tipo: 'mensaje',
    posicion: { x: 380, y: 640 },
    datos: {
      label: 'Saludo a cliente reconocido (Multi-servicio)',
      texto: '👋 ¡Hola de nuevo, {{nombre}}! Bienvenido/a a {{empresa}}.',
    },
  },

  /* ══════════════════════════════════════════════════════
     COLUMNA 1 — TIPO DE CLIENTE
     ══════════════════════════════════════════════════════ */
  {
    id: 'tipo_cliente',
    tipo: 'lista_opciones',
    posicion: { x: 700, y: 380 },
    datos: {
      label: '¿Eres cliente?',
      texto: '¿Cómo puedo ayudarte hoy?',
      opciones: [
        { texto: '📋 Soy cliente (tengo servicio)', valor: 'cliente' },
        { texto: '🆕 Quiero ser cliente',            valor: 'prospecto' },
        { texto: '🧑‍💼 Hablar con un asesor',           valor: 'asesor' },
      ],
    },
  },
  {
    id: 'detectar_intencion',
    tipo: 'intencion',
    posicion: { x: 440, y: 440 },
    datos: {
      label: 'Detectar intención',
      texto: 'El cliente escribió texto libre — se analiza por palabras clave',
      descripcion: 'Analiza el texto libre del cliente para detectar soporte / cobranza / ventas',
      opciones: [
        { texto: 'Soporte Técnico', valor: 'soporte' },
        { texto: 'Cobranza / Pago', valor: 'cobranza' },
        { texto: 'Ventas / Planes', valor: 'ventas' },
        { texto: 'Sin intención clara', valor: 'menu' },
      ],
    },
  },

  /* ══════════════════════════════════════════════════════
     COLUMNA 2 — IDENTIFICACIÓN / PROSPECTO
     ══════════════════════════════════════════════════════ */
  {
    id: 'identificacion',
    tipo: 'lista_opciones',
    posicion: { x: 840, y: 80 },
    datos: {
      label: 'Identificar cliente',
      texto: 'Para consultar tu servicio, necesito verificar tus datos.\n¿Con qué te identificas?',
      opciones: [
        { texto: '📞 Número de teléfono', valor: 'telefono' },
        { texto: '📄 Número de contrato', valor: 'contrato' },
        { texto: '🪪 Nombre completo',    valor: 'nombre' },
      ],
    },
  },
  {
    id: 'ingresar_dato',
    tipo: 'esperar_mensaje',
    posicion: { x: 840, y: 260 },
    datos: {
      label: 'Ingresar dato de identificación',
      texto: 'Por favor escribe tu {{tipo_identificacion}}:',
      timeout: 120,
    },
  },
  {
    id: 'prospecto_info',
    tipo: 'mensaje',
    posicion: { x: 840, y: 420 },
    datos: {
      label: 'Info prospecto',
      texto: '¡Gracias por tu interés! 🎉\n\nTe conectamos con nuestro equipo de *Ventas* para darte información sobre nuestros planes y tarifas.',
    },
  },

  /* ══════════════════════════════════════════════════════
     COLUMNA 3 — CONFIRMACIÓN DE CUENTA / MULTI-SERVICIO
     ══════════════════════════════════════════════════════ */
  {
    id: 'confirmar_cuenta',
    tipo: 'lista_opciones',
    posicion: { x: 1220, y: 80 },
    datos: {
      label: 'Confirmar cuenta',
      texto: '¿Es este tu servicio?\n\n📋 *{{servicio_etiqueta}}*\n📍 {{servicio_direccion}}\n📶 Estado: {{servicio_estado}}',
      opciones: [
        { texto: '✅ Sí, es mi servicio', valor: 'si' },
        { texto: '❌ No, buscar otro',    valor: 'no' },
      ],
    },
  },
  {
    id: 'seleccion_servicio',
    tipo: 'lista_opciones',
    posicion: { x: 1220, y: 280 },
    datos: {
      label: 'Seleccionar servicio',
      texto: 'Tienes varios servicios registrados. ¿Cuál deseas consultar?',
      opciones: [
        { texto: '📡 Contrato 1 (Dinámico)', valor: 'servicio_0' },
        { texto: '📡 Contrato 2 (Dinámico)', valor: 'servicio_1' },
        { texto: '👥 Consultar para otra persona', valor: 'consulta_ajena' },
      ],
    },
  },

  /* ══════════════════════════════════════════════════════
     COLUMNA 4 — MENÚ AUTOSERVICIO (cliente identificado)
     ══════════════════════════════════════════════════════ */
  {
    id: 'menu_autoservicio',
    tipo: 'lista_opciones',
    posicion: { x: 1600, y: 160 },
    datos: {
      label: 'Menú autoservicio',
      texto: '¿En qué puedo ayudarte hoy?',
      opciones: [
        { texto: '💰 Ver mi saldo / deuda', valor: 'deuda' },
        { texto: '📍 Formas de pago',       valor: 'pago' },
        { texto: '🔧 Reportar falla',        valor: 'falla' },
        { texto: '✅ Enviar comprobante',    valor: 'comprobante' },
        { texto: '🧑‍💼 Hablar con asesor',    valor: 'asesor' },
        { texto: '👥 Consultar otro cliente',valor: 'consulta_ajena' },
      ],
    },
  },

  /* ══════════════════════════════════════════════════════
     COLUMNA 5 — RESULTADOS / RESPUESTAS DE AUTOSERVICIO
     ══════════════════════════════════════════════════════ */
  {
    id: 'info_deuda',
    tipo: 'mensaje',
    posicion: { x: 1980, y: 60 },
    datos: {
      label: 'Mostrar saldo',
      texto: '💰 *Estado de cuenta*\n\n📋 {{servicio_etiqueta}}\n💵 Saldo pendiente: *${{servicio_deuda}} MXN*\n📅 Fecha límite: {{servicio_vencimiento}}\n📶 Servicio: {{servicio_estado}}',
    },
  },
  {
    id: 'info_pago',
    tipo: 'mensaje',
    posicion: { x: 1980, y: 220 },
    datos: {
      label: 'Mostrar formas de pago',
      texto: '📍 *¿Dónde pagar?*\n\nPara tu servicio *{{servicio_etiqueta}}* puedes pagar en:\n\n🔗 Portal en línea:\n{{servicio_portal_pago}}\n\n🏪 También puedes pagar en nuestras sucursales o corresponsales autorizados.',
    },
  },
  {
    id: 'otra_consulta',
    tipo: 'lista_opciones',
    posicion: { x: 1980, y: 380 },
    datos: {
      label: '¿Otra consulta?',
      texto: '¿Deseas realizar otra consulta?',
      opciones: [
        { texto: '🔄 Sí, otra consulta',       valor: 'si' },
        { texto: '🔀 Cambiar servicio',          valor: 'cambiar_servicio' },
        { texto: '❌ No, terminar',              valor: 'no' },
      ],
    },
  },
  {
    id: 'seleccion_area',
    tipo: 'lista_opciones',
    posicion: { x: 1980, y: 580 },
    datos: {
      label: 'Seleccionar área',
      texto: '🧑‍💼 ¿Con qué área deseas hablar?',
      opciones: [
        { texto: '🔧 Soporte Técnico', valor: 'soporte' },
        { texto: '💰 Cobranza',        valor: 'cobranza' },
        { texto: '🆕 Ventas',          valor: 'ventas' },
      ],
    },
  },

  /* ══════════════════════════════════════════════════════
     COLUMNA 6 — ESCALADA A AGENTES
     ══════════════════════════════════════════════════════ */
  {
    id: 'escalar_soporte',
    tipo: 'asignar_equipo',
    posicion: { x: 2360, y: 80 },
    datos: {
      label: 'Escalar a Soporte',
      equipo: 'Soporte Técnico',
      mensaje: '🔧 Te conectamos con *Soporte Técnico*.\n\nDescribe tu problema y un asesor te atenderá pronto. 🙏',
    },
  },
  {
    id: 'escalar_cobranza',
    tipo: 'asignar_equipo',
    posicion: { x: 2360, y: 280 },
    datos: {
      label: 'Escalar a Cobranza',
      equipo: 'Cobranza',
      mensaje: '💰 Te conectamos con *Cobranza*.\n\nUn asesor te atenderá en breve. 🙏',
    },
  },
  {
    id: 'escalar_ventas',
    tipo: 'asignar_equipo',
    posicion: { x: 2360, y: 480 },
    datos: {
      label: 'Escalar a Ventas',
      equipo: 'Ventas',
      mensaje: '🆕 Te conectamos con *Ventas*.\n\n¡Pronto un asesor te contactará! 🙏',
    },
  },
  {
    id: 'escalar_comprobante',
    tipo: 'asignar_equipo',
    posicion: { x: 2360, y: 680 },
    datos: {
      label: 'Escalar comprobante',
      equipo: 'Cobranza',
      mensaje: '✅ Te conectamos con *Cobranza* para validar tu comprobante.\n\nPor favor envía la imagen de tu comprobante. 🙏',
    },
  },

  /* ══════════════════════════════════════════════════════
     COLUMNA 7 — FIN / ENCUESTA
     ══════════════════════════════════════════════════════ */
  {
    id: 'encuesta',
    tipo: 'lista_opciones',
    posicion: { x: 2740, y: 160 },
    datos: {
      label: 'Encuesta de satisfacción',
      texto: '⭐ ¿Cómo calificarías la atención recibida hoy?\n\nTu opinión nos ayuda a mejorar.',
      opciones: [
        { texto: '😊 Bien', valor: '3' },
        { texto: '😐 Regular', valor: '2' },
        { texto: '🙁 Mal', valor: '1' },
      ],
    },
  },
  {
    id: 'fin_encuesta',
    tipo: 'fin',
    posicion: { x: 2740, y: 440 },
    datos: {
      label: 'Conversación finalizada',
      descripcion: '✅ ¡Gracias por contactarnos! Si necesitas algo más, escríbenos cuando quieras.',
    },
  },
  {
    id: 'fin_agente',
    tipo: 'fin',
    posicion: { x: 2740, y: 600 },
    datos: {
      label: 'En espera de agente',
      descripcion: 'Conversación en cola para atención humana',
    },
  },
];

/* ═══════════════════════════════════════════════════════════════════════════
   CONEXIONES (aristas / flechas del flujo)
   ═══════════════════════════════════════════════════════════════════════════ */
const conexiones = [

  /* ── Enrutador → Saludos ─────────────────────────────────────────── */
  { id: 'e_enrutador_nuevo',    source: 'enrutador', target: 'saludo_nuevo',          sourceHandle: 'nuevo',          label: 'Nuevo' },
  { id: 'e_enrutador_recur',    source: 'enrutador', target: 'saludo_recurrente',     sourceHandle: 'recurrente',     label: 'Recurrente' },
  { id: 'e_enrutador_auto',     source: 'enrutador', target: 'saludo_autoservicio',   sourceHandle: 'autoservicio',   label: '1 Servicio' },
  { id: 'e_enrutador_multi',    source: 'enrutador', target: 'saludo_multiservicio',  sourceHandle: 'multiservicio',  label: 'Multi-servicio' },

  /* ── Saludos → Destinos ──────────────────────────────────────────── */
  { id: 'e_saludo_nuevo_dst',   source: 'saludo_nuevo',         target: 'tipo_cliente',       label: '' },
  { id: 'e_saludo_recur_dst',   source: 'saludo_recurrente',    target: 'identificacion',     label: '' },
  { id: 'e_saludo_auto_dst',    source: 'saludo_autoservicio',  target: 'menu_autoservicio',  label: '' },
  { id: 'e_saludo_multi_dst',   source: 'saludo_multiservicio', target: 'seleccion_servicio', label: '' },

  /* ── Tipo de cliente ────────────────────────────────────────────────── */
  { id: 'e_tipo_cliente',    source: 'tipo_cliente',     target: 'identificacion',     sourceHandle: 'cliente',   label: 'Soy cliente' },
  { id: 'e_tipo_prospecto',  source: 'tipo_cliente',     target: 'prospecto_info',     sourceHandle: 'prospecto', label: 'Quiero ser cliente' },
  { id: 'e_tipo_asesor',     source: 'tipo_cliente',     target: 'seleccion_area',     sourceHandle: 'asesor',    label: 'Hablar con asesor' },

  /* ── Detección de intención (texto libre) ───────────────────────────── */
  { id: 'e_nlu_soporte',     source: 'detectar_intencion', target: 'escalar_soporte',  sourceHandle: 'soporte',   label: 'Soporte' },
  { id: 'e_nlu_cobranza',    source: 'detectar_intencion', target: 'escalar_cobranza', sourceHandle: 'cobranza',  label: 'Cobranza' },
  { id: 'e_nlu_ventas',      source: 'detectar_intencion', target: 'escalar_ventas',   sourceHandle: 'ventas',    label: 'Ventas' },
  { id: 'e_nlu_menu',        source: 'detectar_intencion', target: 'tipo_cliente',     sourceHandle: 'menu',      label: 'Sin intención' },

  /* ── Identificación ─────────────────────────────────────────────────── */
  { id: 'e_id_dato',         source: 'identificacion',   target: 'ingresar_dato',      label: '' },
  { id: 'e_dato_confirmar',  source: 'ingresar_dato',    target: 'confirmar_cuenta',   label: 'Cliente encontrado' },

  /* ── Confirmar cuenta ───────────────────────────────────────────────── */
  { id: 'e_confirm_si',      source: 'confirmar_cuenta', target: 'menu_autoservicio',  sourceHandle: 'si',  label: 'Sí, es mi cuenta' },
  { id: 'e_confirm_no',      source: 'confirmar_cuenta', target: 'identificacion',     sourceHandle: 'no',  label: 'No, buscar otro' },

  /* ── Multi-servicio → autoservicio ──────────────────────────────────── */
  { id: 'e_servicio_menu',   source: 'seleccion_servicio', target: 'menu_autoservicio', label: 'Servicio elegido' },

  /* ── Prospecto → Ventas ─────────────────────────────────────────────── */
  { id: 'e_prospecto_ventas',source: 'prospecto_info',   target: 'escalar_ventas',     label: '' },

  /* ── Menú autoservicio ──────────────────────────────────────────────── */
  { id: 'e_auto_deuda',      source: 'menu_autoservicio', target: 'info_deuda',          sourceHandle: 'deuda',         label: 'Ver deuda' },
  { id: 'e_auto_pago',       source: 'menu_autoservicio', target: 'info_pago',           sourceHandle: 'pago',          label: 'Formas de pago' },
  { id: 'e_auto_falla',      source: 'menu_autoservicio', target: 'escalar_soporte',     sourceHandle: 'falla',         label: 'Reportar falla' },
  { id: 'e_auto_comprobante',source: 'menu_autoservicio', target: 'escalar_comprobante', sourceHandle: 'comprobante',   label: 'Enviar comprobante' },
  { id: 'e_auto_asesor',     source: 'menu_autoservicio', target: 'seleccion_area',      sourceHandle: 'asesor',        label: 'Hablar con asesor' },
  { id: 'e_auto_ajena',      source: 'menu_autoservicio', target: 'identificacion',      sourceHandle: 'consulta_ajena',label: 'Consultar otro cliente' },

  /* ── Resultados → otra consulta ─────────────────────────────────────── */
  { id: 'e_deuda_otra',      source: 'info_deuda',        target: 'otra_consulta',      label: '' },
  { id: 'e_pago_otra',       source: 'info_pago',         target: 'otra_consulta',      label: '' },

  /* ── Otra consulta ──────────────────────────────────────────────────── */
  { id: 'e_otra_si',         source: 'otra_consulta',     target: 'menu_autoservicio',  sourceHandle: 'si',              label: 'Sí, otra consulta' },
  { id: 'e_otra_cambiar',    source: 'otra_consulta',     target: 'seleccion_servicio', sourceHandle: 'cambiar_servicio', label: 'Cambiar servicio' },
  { id: 'e_otra_no',         source: 'otra_consulta',     target: 'encuesta',           sourceHandle: 'no',              label: 'No, terminar' },

  /* ── Selección de área ──────────────────────────────────────────────── */
  { id: 'e_area_soporte',    source: 'seleccion_area',    target: 'escalar_soporte',    sourceHandle: 'soporte',   label: 'Soporte Técnico' },
  { id: 'e_area_cobranza',   source: 'seleccion_area',    target: 'escalar_cobranza',   sourceHandle: 'cobranza',  label: 'Cobranza' },
  { id: 'e_area_ventas',     source: 'seleccion_area',    target: 'escalar_ventas',     sourceHandle: 'ventas',    label: 'Ventas' },

  /* ── Escaladas → fin_agente ─────────────────────────────────────────── */
  { id: 'e_soporte_fin',     source: 'escalar_soporte',    target: 'fin_agente',         label: '' },
  { id: 'e_cobranza_fin',    source: 'escalar_cobranza',   target: 'fin_agente',         label: '' },
  { id: 'e_ventas_fin',      source: 'escalar_ventas',     target: 'fin_agente',         label: '' },
  { id: 'e_comp_fin',        source: 'escalar_comprobante',target: 'fin_agente',         label: '' },

  /* ── Encuesta → fin ─────────────────────────────────────────────────── */
  { id: 'e_encuesta_fin',    source: 'encuesta',           target: 'fin_encuesta',       label: 'Calificación recibida' },
];

module.exports = { rootNodeId: 'enrutador', nodos, conexiones };
