/**
 * @file parsers.test.js
 * @description Tests unitarios para las funciones de parseo del menú del bot.
 * Cada parser convierte el texto libre del cliente en un valor del dominio.
 */

const { parseEmpresa, parseDepto, parsePuntuacion } = require('../../bot/parsers');

describe('parseEmpresa', () => {
  test('devuelve fibratec cuando el mensaje contiene "1"', () => {
    expect(parseEmpresa('1')).toEqual({ empresa: 'fibratec', nombre: 'Fibratec' });
  });

  test('devuelve compusemmm cuando el mensaje contiene "2"', () => {
    expect(parseEmpresa('2')).toEqual({ empresa: 'compusemmm', nombre: 'Compusemmm de México' });
  });

  test('detecta el número aunque haya texto alrededor', () => {
    expect(parseEmpresa('quiero 1 por favor')).toEqual({ empresa: 'fibratec', nombre: 'Fibratec' });
  });

  test('acepta el nombre "fibratec" como texto', () => {
    expect(parseEmpresa('Fibratec')).toEqual({ empresa: 'fibratec', nombre: 'Fibratec' });
  });

  test('devuelve objeto vacío para entrada desconocida', () => {
    expect(parseEmpresa('hola')).toEqual({});
    expect(parseEmpresa('')).toEqual({});
    expect(parseEmpresa('3')).toEqual({});
  });
});

describe('parseDepto', () => {
  test('devuelve Ventas para "1"', () => {
    expect(parseDepto('1')).toBe('Ventas');
  });

  test('devuelve Cobranza para "2"', () => {
    expect(parseDepto('2')).toBe('Cobranza');
  });

  test('devuelve Soporte Técnico para "3"', () => {
    expect(parseDepto('3')).toBe('Soporte Técnico');
  });

  test('acepta "ventas" como texto', () => {
    expect(parseDepto('ventas')).toBe('Ventas');
  });

  test('acepta "cobranza" como texto', () => {
    expect(parseDepto('cobranza')).toBe('Cobranza');
  });

  test('acepta "soporte" como texto', () => {
    expect(parseDepto('soporte')).toBe('Soporte Técnico');
  });

  test('acepta "soporte técnico" con tilde y sin tilde', () => {
    expect(parseDepto('soporte técnico')).toBe('Soporte Técnico');
    expect(parseDepto('soporte tecnico')).toBe('Soporte Técnico');
  });

  test('devuelve null para entrada inválida', () => {
    expect(parseDepto('hola')).toBeNull();
    expect(parseDepto('')).toBeNull();
    expect(parseDepto('4')).toBeNull();
  });
});

describe('parsePuntuacion', () => {
  test('devuelve Mal para "1"', () => {
    expect(parsePuntuacion('1')).toBe('Mal');
  });

  test('devuelve Regular para "2"', () => {
    expect(parsePuntuacion('2')).toBe('Regular');
  });

  test('devuelve Bien para "3"', () => {
    expect(parsePuntuacion('3')).toBe('Bien');
  });

  test('acepta "mal", "regular", "bien" como texto exacto', () => {
    expect(parsePuntuacion('mal')).toBe('Mal');
    expect(parsePuntuacion('regular')).toBe('Regular');
    expect(parsePuntuacion('bien')).toBe('Bien');
  });

  test('devuelve Desconocida para entrada no reconocida', () => {
    expect(parsePuntuacion('excelente')).toBe('Desconocida');
    expect(parsePuntuacion('')).toBe('Desconocida');
  });
});
