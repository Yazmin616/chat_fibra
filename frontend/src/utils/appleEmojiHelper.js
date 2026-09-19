import React from 'react';
import appleData from '@emoji-mart/data/sets/15/apple.json';

// Construcción del mapa de emojis a partir del dataset oficial de Apple
const emojiMap = new Map();
if (appleData && appleData.emojis) {
  for (const [, emoji] of Object.entries(appleData.emojis)) {
    if (emoji.skins) {
      for (const skin of emoji.skins) {
        if (skin.native) {
          emojiMap.set(skin.native, skin.unified.toLowerCase());
        }
      }
    }
  }
}

// Ordenar por longitud descendente para que secuencias compuestas (tonos de piel, ZWJ, banderas) tengan prioridad
const sortedKeys = Array.from(emojiMap.keys()).sort((a, b) => b.length - a.length);
const escapeRegex = (s) => s.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&');
export const EMOJI_REGEX = new RegExp(`(${sortedKeys.map(escapeRegex).join('|')})`, 'g');

/**
 * Obtiene la URL de la imagen oficial de Apple en CDN para un emoji nativo
 */
export function getAppleEmojiUrl(nativeChar) {
  if (!nativeChar) return null;
  const unified = emojiMap.get(nativeChar);
  if (!unified) return null;
  return `https://cdn.jsdelivr.net/npm/emoji-datasource-apple@15.0.1/img/apple/64/${unified}.png`;
}

/**
 * Verifica si un texto contiene ÚNICAMENTE 1, 2 o 3 emojis (para agrandarlos como en WhatsApp)
 */
export function countOnlyEmojis(text) {
  if (!text) return 0;
  const trimmed = text.trim();
  if (!trimmed) return 0;
  const matches = trimmed.match(EMOJI_REGEX);
  if (!matches) return 0;
  const remaining = trimmed.replace(EMOJI_REGEX, '').replace(/\s+/g, '');
  if (remaining.length === 0 && matches.length <= 3) {
    return matches.length;
  }
  return 0;
}

/**
 * Renderiza un solo emoji de Apple como componente React (ideal para reacciones y botones)
 */
export function renderAppleEmoji(nativeChar, customSize) {
  const url = getAppleEmojiUrl(nativeChar);
  if (!url) return <span>{nativeChar}</span>;
  return (
    <img
      src={url}
      alt={nativeChar}
      draggable={false}
      className="wa-apple-emoji inline"
      style={customSize ? { width: customSize, height: customSize } : undefined}
    />
  );
}

/**
 * Renderiza un bloque de texto reemplazando los emojis por las imágenes de Apple
 */
export function renderContentWithAppleEmojis(text, customSize) {
  if (!text) return null;
  const parts = text.split(EMOJI_REGEX);
  return parts.map((part, index) => {
    if (!part) return null;
    const url = getAppleEmojiUrl(part);
    if (url) {
      return (
        <img
          key={`emoji-${index}`}
          src={url}
          alt={part}
          draggable={false}
          className="wa-apple-emoji inline"
          style={customSize ? { width: customSize, height: customSize } : undefined}
        />
      );
    }
    return part;
  });
}

/**
 * Extrae texto plano de un elemento contentEditable respetando los emojis en imágenes
 */
export function extractTextFromContentEditable(element) {
  if (!element) return '';
  let text = '';
  const walk = (node) => {
    if (node.nodeType === 3) { // Node.TEXT_NODE
      text += node.textContent;
    } else if (node.nodeType === 1) { // Node.ELEMENT_NODE
      if (node.tagName === 'IMG' && (node.dataset?.emoji || node.alt)) {
        text += node.dataset?.emoji || node.alt;
      } else if (node.tagName === 'BR') {
        text += '\n';
      } else if (node.tagName === 'DIV' || node.tagName === 'P') {
        if (text.length > 0 && !text.endsWith('\n')) text += '\n';
        node.childNodes.forEach(walk);
      } else {
        node.childNodes.forEach(walk);
      }
    }
  };
  element.childNodes.forEach(walk);
  return text;
}

/**
 * Convierte un texto con emojis en un string HTML con tags <img> de Apple emojis
 */
export function textToAppleEmojiHtml(text) {
  if (!text) return '';
  const escaped = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  return escaped.replace(EMOJI_REGEX, (emoji) => {
    const url = getAppleEmojiUrl(emoji);
    if (url) {
      return `<img src="${url}" alt="${emoji}" data-emoji="${emoji}" class="wa-apple-emoji inline" draggable="false" />`;
    }
    return emoji;
  }).replace(/\n/g, '<br>');
}

/**
 * Inserta un emoji oficial de Apple en la posición del cursor de un elemento contentEditable
 */
export function insertEmojiAtCursor(element, emojiChar) {
  if (!element || !emojiChar) return;
  element.focus();
  const url = getAppleEmojiUrl(emojiChar);
  if (url) {
    const img = document.createElement('img');
    img.src = url;
    img.alt = emojiChar;
    img.dataset.emoji = emojiChar;
    img.className = 'wa-apple-emoji inline';
    img.draggable = false;

    const sel = window.getSelection();
    if (sel && sel.rangeCount > 0 && element.contains(sel.getRangeAt(0).commonAncestorContainer)) {
      const range = sel.getRangeAt(0);
      range.deleteContents();
      range.insertNode(img);
      range.setStartAfter(img);
      range.setEndAfter(img);
      sel.removeAllRanges();
      sel.addRange(range);
    } else {
      element.appendChild(img);
      const range = document.createRange();
      range.selectNodeContents(element);
      range.collapse(false);
      const sel2 = window.getSelection();
      sel2.removeAllRanges();
      sel2.addRange(range);
    }
  } else {
    document.execCommand('insertText', false, emojiChar);
  }
}

