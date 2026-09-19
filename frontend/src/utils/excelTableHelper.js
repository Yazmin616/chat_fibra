/**
 * @file excelTableHelper.js
 * @description Utilidades para detectar, procesar y convertir tablas copiadas desde Excel,
 * Google Sheets o páginas web a imágenes HD (capturas tipo screenshot) o texto formateado.
 */

import html2canvas from 'html2canvas';

/**
 * Detecta si los datos del portapapeles corresponden a una tabla de hoja de cálculo.
 * @param {DataTransfer} clipboardData
 * @returns {boolean}
 */
export function isTableClipboardData(clipboardData) {
  if (!clipboardData) return false;

  // 1. Detección por HTML (Excel, Sheets, LibreOffice, HTML tables)
  const html = clipboardData.getData('text/html') || '';
  if (
    html.includes('<table') ||
    html.includes('<TABLE') ||
    (html.includes('<tr') && html.includes('<td'))
  ) {
    // Verificar que realmente contenga celdas
    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(html, 'text/html');
      const table = doc.querySelector('table');
      if (table && table.querySelectorAll('tr').length >= 1) {
        const cells = table.querySelectorAll('td, th');
        // Al menos 2 celdas para considerarlo tabla
        if (cells.length >= 2) return true;
      }
    } catch (_) {}
  }

  // 2. Detección por texto plano delimitado por tabulaciones (TSV)
  const plain = (clipboardData.getData('text/plain') || '').trim();
  if (plain) {
    const lines = plain.split(/\r?\n/).filter(l => l.trim().length > 0);
    if (lines.length >= 1) {
      const tabCounts = lines.map(line => (line.match(/\t/g) || []).length);
      const totalTabs = tabCounts.reduce((a, b) => a + b, 0);
      // Si hay al menos un tabulador por fila y más de 1 celda
      if (totalTabs >= 1 && (lines.length > 1 || tabCounts[0] >= 1)) {
        return true;
      }
    }
  }

  return false;
}

/**
 * Extrae la matriz bidimensional de celdas a partir de un elemento table.
 * @param {HTMLTableElement} tableElement
 * @returns {string[][]}
 */
export function extractTableMatrix(tableElement) {
  if (!tableElement) return [];
  const rows = Array.from(tableElement.querySelectorAll('tr'));
  return rows.map(tr => {
    const cells = Array.from(tr.querySelectorAll('td, th'));
    return cells.map(cell => {
      // Limpiar saltos de línea internos y tabulaciones dentro de la misma celda
      return (cell.textContent || '').replace(/[\r\n\t]+/g, ' ').trim();
    });
  }).filter(row => row.some(cell => cell.length > 0));
}

/**
 * Formato 1: TSV (Tab-Separated Values).
 * Formato estándar de portapapeles de Excel. Cada fila en una línea, columnas separadas por \t.
 * Al copiarlo desde WhatsApp y pegarlo en Excel (Ctrl+V), Excel lo reparte exactamente en las celdas y columnas.
 */
export function formatAsTSV(matrix) {
  if (!matrix || matrix.length === 0) return '';
  return matrix.map(row => row.join('\t')).join('\n');
}

/**
 * Formato 2: Cuadrícula visual alineada para WhatsApp (bloque de código monoespaciado ```).
 * Calcula anchos de columnas para que visualmente quede como una tabla de Excel en el chat.
 */
export function formatAsGrid(matrix) {
  if (!matrix || matrix.length === 0) return '';
  const numCols = Math.max(...matrix.map(r => r.length));
  if (numCols === 0) return '';

  const colWidths = Array(numCols).fill(0);
  matrix.forEach(row => {
    row.forEach((cell, cIdx) => {
      const len = (cell || '').length;
      if (len > colWidths[cIdx]) colWidths[cIdx] = len;
    });
  });

  const lines = [];
  matrix.forEach((row, rIdx) => {
    const formattedCells = colWidths.map((w, cIdx) => {
      const text = row[cIdx] || '';
      return text.padEnd(w, ' ');
    });
    lines.push(formattedCells.join(' │ '));

    // Separador horizontal debajo de la cabecera
    if (rIdx === 0 && matrix.length > 1) {
      const sep = colWidths.map(w => '─'.repeat(Math.max(w, 1))).join('─┼─');
      lines.push(sep);
    }
  });

  return '```\n' + lines.join('\n') + '\n```';
}

/**
 * Formato 3: Lista estructurada con viñetas y negritas para WhatsApp.
 */
export function formatAsStructuredList(matrix) {
  if (!matrix || matrix.length === 0) return '';
  const headers = matrix[0] || [];
  const hasHeaders = headers.length > 1 && matrix.length > 1;

  if (hasHeaders && headers.length <= 4) {
    const dataRows = matrix.slice(1);
    return dataRows.map((row, idx) => {
      const parts = row.map((val, cIdx) => {
        const h = headers[cIdx] || `Columna ${cIdx + 1}`;
        return `*${h}:* ${val || '-'}`;
      }).filter(Boolean);
      return `📌 *Fila ${idx + 1}:*\n` + parts.map(p => `  • ${p}`).join('\n');
    }).join('\n\n');
  }

  return matrix.map(row => '• ' + row.filter(Boolean).join(' — ')).join('\n');
}

/**
 * Limpia y normaliza el HTML de una tabla copiada desde Excel / Office.
 * Elimina artefactos de Microsoft Office, clases mso y normaliza formato.
 * @param {string} rawHtml
 * @param {string} plainText
 * @param {boolean} isDarkMode
 * @returns {{ cleanHtml: string, plainText: string, tsvText: string, gridText: string, listText: string, rowCount: number, colCount: number }}
 */
export function parseClipboardTable(rawHtml, plainText, isDarkMode = false) {
  let tableElement = null;
  let rowCount = 0;
  let colCount = 0;

  if (rawHtml) {
    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(rawHtml, 'text/html');
      tableElement = doc.querySelector('table');
    } catch (_) {}
  }

  // Si no hay tabla HTML válida, construir una desde el texto plano (TSV)
  if (!tableElement && plainText) {
    const lines = plainText.trim().split(/\r?\n/).filter(l => l.length > 0);
    if (lines.length > 0) {
      tableElement = document.createElement('table');
      lines.forEach((line, rowIdx) => {
        const tr = document.createElement('tr');
        const cols = line.split('\t');
        if (cols.length > colCount) colCount = cols.length;
        cols.forEach(cellText => {
          const cell = document.createElement(rowIdx === 0 ? 'th' : 'td');
          cell.textContent = cellText;
          tr.appendChild(cell);
        });
        tableElement.appendChild(tr);
      });
      rowCount = lines.length;
    }
  }

  if (!tableElement) {
    const safePlain = (plainText || '').replace(/\r\n/g, '\n');
    return {
      cleanHtml: '',
      plainText: safePlain,
      tsvText: safePlain,
      gridText: safePlain,
      listText: safePlain,
      rowCount: 0,
      colCount: 0
    };
  }

  // Normalizar estilos y celdas
  const rows = Array.from(tableElement.querySelectorAll('tr'));
  rowCount = rows.length;

  rows.forEach((tr, rIdx) => {
    const cells = Array.from(tr.querySelectorAll('td, th'));
    if (cells.length > colCount) colCount = cells.length;

    cells.forEach(cell => {
      // Limpiar atributos y estilos propietarios de Office
      cell.removeAttribute('class');
      cell.removeAttribute('width');
      cell.removeAttribute('height');

      const text = cell.textContent || '';
      const isNumber = /^[\s$€£¥\d,.-]+$/.test(text.trim()) && /\d/.test(text);

      // Si es la primera fila y no es <th>, tratar como cabecera
      if (rIdx === 0 && cell.tagName.toLowerCase() === 'td') {
        cell.setAttribute('data-is-header', 'true');
      }

      if (isNumber) {
        cell.setAttribute('data-align', 'right');
      }
    });
  });

  const matrix = extractTableMatrix(tableElement);
  const tsvText = formatAsTSV(matrix);
  const gridText = formatAsGrid(matrix);
  const listText = formatAsStructuredList(matrix);

  // Si el portapapeles original traía texto con tabuladores y saltos de línea exactos, usarlo o fallback a tsvText
  const finalTSV = (plainText && plainText.includes('\t') && plainText.includes('\n'))
    ? plainText.replace(/\r\n/g, '\n').trim()
    : tsvText;

  return {
    cleanHtml: tableElement.outerHTML,
    plainText: finalTSV,
    tsvText: finalTSV,
    gridText,
    listText,
    rowCount,
    colCount
  };
}

/**
 * Renderiza la tabla como un contenedor estilizado y genera un Blob PNG HD.
 * @param {string} tableHtml
 * @param {boolean} isDarkMode
 * @returns {Promise<Blob>}
 */
export async function convertTableToImageBlob(tableHtml, isDarkMode = false) {
  // Contenedor principal temporal fuera de pantalla
  const host = document.createElement('div');
  host.style.position = 'fixed';
  host.style.left = '-9999px';
  host.style.top = '0';
  host.style.zIndex = '-9999';
  host.style.opacity = '0';
  host.style.pointerEvents = 'none';

  // Tarjeta de captura con diseño premium estilo Excel / WhatsApp
  const card = document.createElement('div');
  card.className = 'excel-capture-card';
  card.style.fontFamily = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif';
  card.style.background = isDarkMode ? '#111b21' : '#ffffff';
  card.style.color = isDarkMode ? '#e9edef' : '#111b21';
  card.style.padding = '18px 22px 16px';
  card.style.borderRadius = '12px';
  card.style.boxShadow = isDarkMode
    ? '0 6px 20px rgba(0, 0, 0, 0.45)'
    : '0 6px 20px rgba(0, 0, 0, 0.08)';
  card.style.border = isDarkMode ? '1px solid #222e35' : '1px solid #e2e8f0';
  card.style.display = 'inline-block';
  card.style.maxWidth = '1100px';
  card.style.boxSizing = 'border-box';

  // Cabecera estilizada de la tarjeta
  const headerBar = document.createElement('div');
  headerBar.style.display = 'flex';
  headerBar.style.alignItems = 'center';
  headerBar.style.justifyContent = 'space-between';
  headerBar.style.marginBottom = '12px';
  headerBar.style.paddingBottom = '8px';
  headerBar.style.borderBottom = isDarkMode ? '1px solid #222e35' : '1px solid #edf2f7';

  const headerLeft = document.createElement('div');
  headerLeft.style.display = 'flex';
  headerLeft.style.alignItems = 'center';
  headerLeft.style.gap = '8px';

  // Ícono representativo de hoja de cálculo
  const iconBadge = document.createElement('span');
  iconBadge.style.display = 'inline-flex';
  iconBadge.style.alignItems = 'center';
  iconBadge.style.justifyContent = 'center';
  iconBadge.style.width = '24px';
  iconBadge.style.height = '24px';
  iconBadge.style.borderRadius = '6px';
  iconBadge.style.background = '#107c41'; // Verde característico de Excel
  iconBadge.style.color = '#ffffff';
  iconBadge.style.fontWeight = 'bold';
  iconBadge.style.fontSize = '13px';
  iconBadge.textContent = 'X';

  const titleText = document.createElement('span');
  titleText.style.fontWeight = '600';
  titleText.style.fontSize = '13px';
  titleText.style.color = isDarkMode ? '#e9edef' : '#1e293b';
  titleText.textContent = 'Tabla de Datos';

  headerLeft.appendChild(iconBadge);
  headerLeft.appendChild(titleText);

  const headerRight = document.createElement('span');
  headerRight.style.fontSize = '11px';
  headerRight.style.color = isDarkMode ? '#8696a0' : '#94a3b8';
  headerRight.style.letterSpacing = '0.3px';
  headerRight.textContent = new Date().toLocaleDateString('es-MX', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  });

  headerBar.appendChild(headerLeft);
  headerBar.appendChild(headerRight);
  card.appendChild(headerBar);

  // Wrapper para la tabla con estilos CSS inyectados
  const tableWrap = document.createElement('div');
  tableWrap.innerHTML = tableHtml;

  const table = tableWrap.querySelector('table');
  if (table) {
    table.style.borderCollapse = 'collapse';
    table.style.width = 'max-content';
    table.style.minWidth = '320px';
    table.style.fontSize = '13px';
    table.style.lineHeight = '1.45';

    // Estilizar filas y celdas
    const trs = table.querySelectorAll('tr');
    trs.forEach((tr, rIdx) => {
      const isHeaderRow = rIdx === 0;
      const tds = tr.querySelectorAll('td, th');

      tds.forEach(cell => {
        cell.style.padding = '8px 14px';
        cell.style.border = isDarkMode ? '1px solid #2a3942' : '1px solid #cbd5e1';
        cell.style.whiteSpace = 'pre-wrap';
        cell.style.wordBreak = 'break-word';

        if (cell.getAttribute('data-align') === 'right') {
          cell.style.textAlign = 'right';
        } else {
          cell.style.textAlign = 'left';
        }

        if (isHeaderRow || cell.tagName.toLowerCase() === 'th' || cell.getAttribute('data-is-header') === 'true') {
          cell.style.background = isDarkMode ? '#005c4b' : '#008069';
          cell.style.color = '#ffffff';
          cell.style.fontWeight = '600';
          cell.style.fontSize = '12.5px';
          cell.style.letterSpacing = '0.2px';
        } else {
          if (rIdx % 2 === 0) {
            cell.style.background = isDarkMode ? '#111b21' : '#ffffff';
          } else {
            cell.style.background = isDarkMode ? '#182229' : '#f8fafc';
          }
          cell.style.color = isDarkMode ? '#d1d7db' : '#1e293b';
        }
      });
    });
  }

  card.appendChild(tableWrap);

  // Pie de tarjeta discreto
  const footerBar = document.createElement('div');
  footerBar.style.marginTop = '10px';
  footerBar.style.display = 'flex';
  footerBar.style.justifyContent = 'flex-end';
  footerBar.style.fontSize = '10px';
  footerBar.style.color = isDarkMode ? '#667781' : '#94a3b8';
  footerBar.textContent = 'ISP CRM';
  card.appendChild(footerBar);

  host.appendChild(card);
  document.body.appendChild(host);

  try {
    const canvas = await html2canvas(card, {
      scale: 2, // Calidad HD tipo pantalla Retina
      backgroundColor: null,
      useCORS: true,
      logging: false,
      allowTaint: true
    });

    return new Promise((resolve, reject) => {
      canvas.toBlob(blob => {
        if (blob) {
          resolve(blob);
        } else {
          reject(new Error('toBlob retornó null'));
        }
      }, 'image/png');
    });
  } finally {
    if (document.body.contains(host)) {
      document.body.removeChild(host);
    }
  }
}

/**
 * Procesa la información del clipboard cuando se detecta una tabla.
 * @param {DataTransfer} clipboardData
 * @param {boolean} isDarkMode
 * @returns {Promise<{ blob: Blob, url: string, plainText: string, rowCount: number, colCount: number }>}
 */
export async function processClipboardTable(clipboardData, isDarkMode = false) {
  const rawHtml = clipboardData.getData('text/html') || '';
  const plainText = clipboardData.getData('text/plain') || '';

  const { cleanHtml, plainText: textResult, tsvText, gridText, listText, rowCount, colCount } = parseClipboardTable(
    rawHtml,
    plainText,
    isDarkMode
  );

  const blob = await convertTableToImageBlob(cleanHtml, isDarkMode);
  const url = URL.createObjectURL(blob);

  return {
    blob,
    url,
    plainText: textResult,
    tsvText: tsvText || textResult,
    gridText: gridText || textResult,
    listText: listText || textResult,
    rowCount,
    colCount
  };
}

/**
 * Detecta si un texto plano corresponde a datos tabulares (TSV o cuadrícula monoespaciada).
 * @param {string} text
 * @returns {boolean}
 */
export function isTableText(text) {
  if (!text || typeof text !== 'string') return false;
  // Si contiene backticks con cuadrícula o separador de tabla
  if (text.includes('```') && (text.includes('│') || text.includes('─┼─') || text.includes('|'))) return true;
  // Si contiene tabuladores \t
  if (text.includes('\t')) {
    const lines = text.trim().split(/\r?\n/).filter(l => l.trim().length > 0);
    const tabLines = lines.filter(l => l.includes('\t'));
    if (tabLines.length >= 1 && tabLines.some(l => l.split('\t').length >= 2)) {
      return true;
    }
  }
  return false;
}

/**
 * Convierte un texto que puede ser cuadrícula (```...```) o TSV a TSV puro para pegar en Excel.
 * @param {string} text
 * @returns {string}
 */
export function extractTSVForExcel(text) {
  if (!text || typeof text !== 'string') return '';
  const clean = text.trim();
  // Si es un bloque de cuadrícula con ``` y │
  if (clean.includes('│')) {
    const lines = clean.replace(/```/g, '').split(/\r?\n/)
      .map(l => l.trim())
      .filter(l => l.length > 0 && !l.includes('─┼─') && !l.startsWith('──'));
    return lines.map(line => {
      return line.split('│').map(c => c.trim()).join('\t');
    }).join('\n');
  }
  // Si ya es TSV, normalizar saltos de línea
  return clean.replace(/\r\n/g, '\n');
}