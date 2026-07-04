/**
 * Representación del flujo actual del bot como JSON React Flow.
 * Se usa como seed visual en el editor cuando la empresa aún no tiene flujo en BD.
 * El flow engine también puede usarlo como fallback.
 */
const nodos = [
  {
    id: 'entrada',
    tipo: 'mensaje',
    posicion: { x: 100, y: 80 },
    datos: {
      label: 'Bienvenida',
      texto: '¡Hola! Soy el asistente virtual de FIBRATEC. ¿En qué puedo ayudarte hoy?',
    },
  },
  {
    id: 'tipo_cliente',
    tipo: 'pregunta',
    posicion: { x: 100, y: 220 },
    datos: {
      label: 'Tipo de cliente',
      texto: '¿Eres cliente nuestro?',
      opciones: [
        { texto: 'Sí, soy cliente', valor: 'cliente' },
        { texto: 'No soy cliente', valor: 'prospecto' },
      ],
    },
  },
  {
    id: 'nlu_texto',
    tipo: 'intencion',
    posicion: { x: 100, y: 380 },
    datos: {
      label: 'Detectar intención',
      descripcion: 'Analiza el texto libre del cliente para detectar soporte / cobranza / ventas',
    },
  },
  {
    id: 'menu_cliente',
    tipo: 'pregunta',
    posicion: { x: 100, y: 540 },
    datos: {
      label: 'Menú cliente',
      texto: 'Aquí tienes tus opciones:',
      opciones: [
        { texto: 'Ver deuda', valor: 'deuda' },
        { texto: 'Formas de pago', valor: 'pago' },
        { texto: 'Reportar falla', valor: 'falla' },
        { texto: 'Hablar con asesor', valor: 'asesor' },
      ],
    },
  },
  {
    id: 'escalar_soporte',
    tipo: 'accion',
    posicion: { x: -160, y: 700 },
    datos: {
      label: 'Escalar a Soporte',
      accion: 'escalar_agente',
      departamento: 'Soporte Técnico',
      mensaje: '🔧 Te conectamos con Soporte Técnico. Un asesor te atenderá pronto.',
    },
  },
  {
    id: 'escalar_cobranza',
    tipo: 'accion',
    posicion: { x: 100, y: 700 },
    datos: {
      label: 'Escalar a Cobranza',
      accion: 'escalar_agente',
      departamento: 'Cobranza',
      mensaje: '💰 Te conectamos con Cobranza. Un asesor te atenderá en breve.',
    },
  },
  {
    id: 'escalar_ventas',
    tipo: 'accion',
    posicion: { x: 360, y: 700 },
    datos: {
      label: 'Escalar a Ventas',
      accion: 'escalar_agente',
      departamento: 'Ventas',
      mensaje: '🆕 Te conectamos con Ventas. ¡Pronto te contactaremos!',
    },
  },
  {
    id: 'seleccion_area',
    tipo: 'pregunta',
    posicion: { x: 600, y: 540 },
    datos: {
      label: 'Selección de área',
      texto: '¿Con qué área deseas hablar?',
      opciones: [
        { texto: 'Soporte Técnico', valor: 'soporte' },
        { texto: 'Cobranza', valor: 'cobranza' },
        { texto: 'Ventas', valor: 'ventas' },
      ],
    },
  },
  {
    id: 'fin_agente',
    tipo: 'fin',
    posicion: { x: 100, y: 860 },
    datos: {
      label: 'En espera de agente',
      descripcion: 'Conversación en cola para atención humana',
    },
  },
  {
    id: 'prospecto_info',
    tipo: 'mensaje',
    posicion: { x: 600, y: 380 },
    datos: {
      label: 'Info prospecto',
      texto: '¡Gracias por tu interés! Te conectamos con nuestro equipo de Ventas para darte información sobre nuestros planes.',
    },
  },
];

const conexiones = [
  { id: 'e1', source: 'entrada',        target: 'tipo_cliente',    label: '' },
  { id: 'e2', source: 'tipo_cliente',   target: 'nlu_texto',       sourceHandle: 'cliente',   label: 'Es cliente' },
  { id: 'e3', source: 'tipo_cliente',   target: 'prospecto_info',  sourceHandle: 'prospecto', label: 'No es cliente' },
  { id: 'e4', source: 'nlu_texto',      target: 'menu_cliente',    label: 'Sin intención clara' },
  { id: 'e5', source: 'nlu_texto',      target: 'escalar_soporte', label: 'Soporte' },
  { id: 'e6', source: 'nlu_texto',      target: 'escalar_cobranza',label: 'Cobranza' },
  { id: 'e7', source: 'nlu_texto',      target: 'escalar_ventas',  label: 'Ventas' },
  { id: 'e8', source: 'menu_cliente',   target: 'escalar_soporte', sourceHandle: 'falla',     label: 'Falla' },
  { id: 'e9', source: 'menu_cliente',   target: 'seleccion_area',  sourceHandle: 'asesor',    label: 'Asesor' },
  { id: 'e10',source: 'seleccion_area', target: 'escalar_soporte', sourceHandle: 'soporte',   label: 'Soporte' },
  { id: 'e11',source: 'seleccion_area', target: 'escalar_cobranza',sourceHandle: 'cobranza',  label: 'Cobranza' },
  { id: 'e12',source: 'seleccion_area', target: 'escalar_ventas',  sourceHandle: 'ventas',    label: 'Ventas' },
  { id: 'e13',source: 'escalar_soporte', target: 'fin_agente',     label: '' },
  { id: 'e14',source: 'escalar_cobranza',target: 'fin_agente',     label: '' },
  { id: 'e15',source: 'escalar_ventas',  target: 'fin_agente',     label: '' },
  { id: 'e16',source: 'prospecto_info',  target: 'escalar_ventas', label: '' },
];

module.exports = { rootNodeId: 'entrada', nodos, conexiones };
