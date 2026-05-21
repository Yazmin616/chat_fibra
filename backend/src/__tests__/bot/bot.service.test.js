/**
 * @file bot.service.test.js
 * @description Tests unitarios para bot.service.js.
 *
 * Los repositorios se mockean completamente para aislar la lógica de negocio
 * de cualquier dependencia de base de datos.
 *
 * Cobertura de las transiciones de estado críticas:
 *   abierta → SELECCION_EMPRESA  (sin empresa preconfigurada)
 *   abierta → SELECCION_AREA     (con empresa preconfigurada)
 *   SELECCION_EMPRESA → SELECCION_AREA (empresa válida)
 *   SELECCION_EMPRESA → SELECCION_EMPRESA (empresa inválida)
 *   SELECCION_AREA → ESPERANDO_AGENTE (depto válido)
 *   SELECCION_AREA → SELECCION_AREA (depto inválido)
 *   ESPERANDO_AGENTE → ESPERANDO_AGENTE (mensaje durante espera)
 *   ENCUESTA_AGENTE / ENCUESTA_BOT → cerrada
 *   es_humano=true → null (el bot no interfiere)
 */

jest.mock('../../repositories/usuario.repository');
jest.mock('../../repositories/conversacion.repository');
jest.mock('../../repositories/mensaje.repository');
jest.mock('../../repositories/calificacion.repository');

const botService       = require('../../services/bot.service');
const usuarioRepo      = require('../../repositories/usuario.repository');
const conversacionRepo = require('../../repositories/conversacion.repository');
const mensajeRepo      = require('../../repositories/mensaje.repository');
const calificacionRepo = require('../../repositories/calificacion.repository');

// ---------------------------------------------------------------------------
// Helpers de setup
// ---------------------------------------------------------------------------

const USUARIO_MOCK = { id: 1, nombre: 'Test', username: 'test' };

function mockConversacion(overrides = {}) {
  return {
    id:          10,
    estado:      'abierta',
    empresa_id:  'fibratec',
    es_humano:   false,
    usuario_id:  1,
    departamento: null,
    ...overrides,
  };
}

const INPUT_BASE = {
  canal:                  'telegram',
  user_id:                '999',
  nombre:                 'Test',
  username:               'test',
  empresa_id:             'fibratec',
  mensaje:                'hola',
  tipo:                   'text',
  url_media:              null,
  empresa_preconfigurada: false,
};

// ---------------------------------------------------------------------------
// beforeEach: valores por defecto para todos los mocks
// ---------------------------------------------------------------------------

beforeEach(() => {
  jest.clearAllMocks();

  usuarioRepo.findByCanal.mockResolvedValue({ rows: [USUARIO_MOCK] });
  usuarioRepo.update.mockResolvedValue({ rows: [] });

  conversacionRepo.findActiveByUsuario.mockResolvedValue({ rows: [mockConversacion()] });
  conversacionRepo.updateEstado.mockResolvedValue({ rows: [] });
  conversacionRepo.updateEmpresa.mockResolvedValue({ rows: [] });
  conversacionRepo.createEsperando.mockResolvedValue({ rows: [{ id: 20 }] });

  mensajeRepo.create.mockResolvedValue({ rows: [] });
  calificacionRepo.create.mockResolvedValue({ rows: [] });
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('botService.procesar — es_humano', () => {
  test('devuelve null cuando es_humano=true (agente ya atiende)', async () => {
    conversacionRepo.findActiveByUsuario.mockResolvedValue({
      rows: [mockConversacion({ estado: 'atendiendo', es_humano: true })],
    });
    const result = await botService.procesar(INPUT_BASE, null);
    expect(result).toBeNull();
  });
});

describe('botService.procesar — estado abierta', () => {
  test('sin empresa preconfigurada → pide selección de empresa', async () => {
    const result = await botService.procesar({ ...INPUT_BASE, empresa_preconfigurada: false }, null);
    expect(result.texto).toContain('Fibratec');
    expect(conversacionRepo.updateEstado).toHaveBeenCalledWith(10, 'SELECCION_EMPRESA');
  });

  test('con empresa preconfigurada → pide selección de área', async () => {
    const result = await botService.procesar({ ...INPUT_BASE, empresa_preconfigurada: true }, null);
    expect(result.texto).toContain('área');
    expect(conversacionRepo.updateEstado).toHaveBeenCalledWith(10, 'SELECCION_AREA');
  });
});

describe('botService.procesar — estado SELECCION_EMPRESA', () => {
  beforeEach(() => {
    conversacionRepo.findActiveByUsuario.mockResolvedValue({
      rows: [mockConversacion({ estado: 'SELECCION_EMPRESA' })],
    });
  });

  test('opción "1" → selecciona fibratec y pasa a SELECCION_AREA', async () => {
    const result = await botService.procesar({ ...INPUT_BASE, mensaje: '1' }, null);
    expect(conversacionRepo.updateEmpresa).toHaveBeenCalledWith(10, 'fibratec');
    expect(result.texto).toContain('área');
    expect(conversacionRepo.updateEstado).toHaveBeenCalledWith(10, 'SELECCION_AREA');
  });

  test('opción "2" → selecciona compusemmm y pasa a SELECCION_AREA', async () => {
    const result = await botService.procesar({ ...INPUT_BASE, mensaje: '2' }, null);
    expect(conversacionRepo.updateEmpresa).toHaveBeenCalledWith(10, 'compusemmm');
    expect(conversacionRepo.updateEstado).toHaveBeenCalledWith(10, 'SELECCION_AREA');
  });

  test('opción inválida → permanece en SELECCION_EMPRESA', async () => {
    const result = await botService.procesar({ ...INPUT_BASE, mensaje: 'no sé' }, null);
    expect(result.texto).toContain('no reconocida');
    expect(conversacionRepo.updateEstado).toHaveBeenCalledWith(10, 'SELECCION_EMPRESA');
  });
});

describe('botService.procesar — estado SELECCION_AREA', () => {
  beforeEach(() => {
    conversacionRepo.findActiveByUsuario.mockResolvedValue({
      rows: [mockConversacion({ estado: 'SELECCION_AREA' })],
    });
  });

  test('opción "1" → crea nueva conversación en ESPERANDO_AGENTE y envía confirmación', async () => {
    const result = await botService.procesar({ ...INPUT_BASE, mensaje: '1' }, null);
    expect(conversacionRepo.updateEstado).toHaveBeenCalledWith(10, 'cerrada');
    expect(conversacionRepo.createEsperando).toHaveBeenCalledWith(1, 'fibratec', 'Ventas');
    expect(result.conversacion_id).toBe(20);
    expect(result.texto).toContain('Ventas');
  });

  test('opción "3" → crea nueva conversación para Soporte Técnico', async () => {
    const result = await botService.procesar({ ...INPUT_BASE, mensaje: '3' }, null);
    expect(conversacionRepo.createEsperando).toHaveBeenCalledWith(1, 'fibratec', 'Soporte Técnico');
    expect(result.conversacion_id).toBe(20);
  });

  test('opción inválida → permanece en SELECCION_AREA', async () => {
    const result = await botService.procesar({ ...INPUT_BASE, mensaje: 'no sé' }, null);
    expect(result.texto).toContain('no reconocida');
    expect(conversacionRepo.createEsperando).not.toHaveBeenCalled();
  });
});

describe('botService.procesar — estado ESPERANDO_AGENTE', () => {
  test('el cliente escribe → recibe recordatorio de fila y estado no cambia', async () => {
    conversacionRepo.findActiveByUsuario.mockResolvedValue({
      rows: [mockConversacion({ estado: 'ESPERANDO_AGENTE', departamento: 'Soporte Técnico' })],
    });
    const result = await botService.procesar({ ...INPUT_BASE, mensaje: 'siguen ahí?' }, null);
    expect(result.texto).toContain('fila de');
    expect(conversacionRepo.updateEstado).toHaveBeenCalledWith(10, 'ESPERANDO_AGENTE');
  });
});

describe('botService.procesar — encuesta CSAT', () => {
  test('ENCUESTA_AGENTE con puntuación "3" → guarda calificación y cierra', async () => {
    // io.to('admin').emit(...) — mockReturnThis hace que to() devuelva el propio io
    const io = { emit: jest.fn(), to: jest.fn().mockReturnThis() };
    conversacionRepo.findActiveByUsuario.mockResolvedValue({
      rows: [mockConversacion({ estado: 'ENCUESTA_AGENTE' })],
    });
    const result = await botService.procesar({ ...INPUT_BASE, mensaje: '3' }, io);
    expect(calificacionRepo.create).toHaveBeenCalledWith(10, 'Bien', '3', 'agente');
    expect(io.to).toHaveBeenCalledWith('admin');
    expect(io.emit).toHaveBeenCalledWith('nueva_calificacion', expect.objectContaining({ puntuacion: 'Bien' }));
    expect(result.texto).toContain('calificación');
    expect(conversacionRepo.updateEstado).toHaveBeenCalledWith(10, 'cerrada');
  });

  test('ENCUESTA_BOT con puntuación "1" → guarda calificación tipo bot', async () => {
    conversacionRepo.findActiveByUsuario.mockResolvedValue({
      rows: [mockConversacion({ estado: 'ENCUESTA_BOT' })],
    });
    const result = await botService.procesar({ ...INPUT_BASE, mensaje: '1' }, null);
    expect(calificacionRepo.create).toHaveBeenCalledWith(10, 'Mal', '1', 'bot');
    expect(conversacionRepo.updateEstado).toHaveBeenCalledWith(10, 'cerrada');
  });
});

describe('botService.procesar — crea usuario nuevo', () => {
  test('usuario no existe → se crea', async () => {
    usuarioRepo.findByCanal.mockResolvedValue({ rows: [] });
    usuarioRepo.create = jest.fn().mockResolvedValue({ rows: [USUARIO_MOCK] });
    const result = await botService.procesar(INPUT_BASE, null);
    expect(usuarioRepo.create).toHaveBeenCalledWith('telegram', '999', 'Test', 'test', null);
    expect(result).toBeTruthy();
  });
});
