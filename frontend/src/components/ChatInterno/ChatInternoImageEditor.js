import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  X, Undo, Pencil, Type, Square, Circle, Minus, ArrowRight,
  Smile, Sticker, Wand2, Grid, RotateCw, Crop, Download, Send, Plus
} from 'lucide-react';
import { apiService, resolveMedia } from '../../services/api';
import {
  getAppleEmojiUrl,
  extractTextFromContentEditable
} from '../../utils/appleEmojiHelper';
import data from '@emoji-mart/data/sets/15/apple.json';
import Picker from '@emoji-mart/react';

// Paleta de colores exacta de WhatsApp Web
const WA_COLORS = [
  '#1f2c34', // Gris muy oscuro
  '#54656f', // Gris medio
  '#ffffff', // Blanco
  '#00e5ff', // Cian
  '#2979ff', // Azul
  '#651fff', // Púrpura / Índigo
  '#ff9100', // Naranja
  '#ff3d00', // Rojo
  '#00a884', // Verde WhatsApp
  '#ff4081', // Rosa
  '#ffd600', // Amarillo
];

const BRUSH_SIZES = [
  { size: 3, dotSize: 5, label: 'Fino' },
  { size: 7, dotSize: 9, label: 'Medio' },
  { size: 12, dotSize: 13, label: 'Medio Grueso' },
  { size: 20, dotSize: 18, label: 'Grueso' }
];

export default function ChatInternoImageEditor({
  file,
  canal,
  onSend,
  onClose,
  userActual
}) {
  // Lista de imágenes para la bandeja inferior
  const [images, setImages] = useState([]);
  const [currentIdx, setCurrentIdx] = useState(0);

  // Estado de la imagen actual
  const [naturalSize, setNaturalSize] = useState({ width: 0, height: 0 });
  const [rotation, setRotation] = useState(0); // 0, 90, 180, 270
  const [activeTool, setActiveTool] = useState('pencil'); // 'pencil' | 'text' | 'shapes' | 'crop' | 'filter' | 'blur' | 'emoji' | 'sticker' | null
  const [selectedShape, setSelectedShape] = useState('rectangle'); // 'rectangle' | 'circle' | 'line' | 'arrow'
  const [showShapesPopover, setShowShapesPopover] = useState(false);
  const [color, setColor] = useState('#00a884');
  const [brushSize, setBrushSize] = useState(7);
  const [caption, setCaption] = useState('');
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showStickersPopover, setShowStickersPopover] = useState(false);
  const [showCaptionEmoji, setShowCaptionEmoji] = useState(false);
  const [sending, setSending] = useState(false);

  // Stickers del sistema
  const [stickerPacks, setStickerPacks] = useState([]);
  const [stickersSearch, setStickersSearch] = useState('');

  // Anotaciones y elementos
  const [strokes, setStrokes] = useState([]); // Array de trazos libres
  const [shapes, setShapes] = useState([]); // Array de formas geométricas
  const [texts, setTexts] = useState([]); // Array de textos
  const [placedStickers, setPlacedStickers] = useState([]); // Stickers colocados
  const [placedEmojis, setPlacedEmojis] = useState([]); // Emojis oficiales de Apple colocados
  const [history, setHistory] = useState([]); // Pila para deshacer

  // Modo Recorte (Crop)
  const [cropBox, setCropBox] = useState(null); // { x, y, width, height }

  // Filtros de imagen
  const [activeFilter, setActiveFilter] = useState('none'); // 'none' | 'bw' | 'sepia' | 'invert' | 'vintage'
  const [showFiltersPopover, setShowFiltersPopover] = useState(false);

  // Referencias
  const containerRef = useRef(null);
  const canvasRef = useRef(null);
  const imgRef = useRef(null);
  const isDrawingRef = useRef(false);
  const currentStrokeRef = useRef(null);
  const currentShapeRef = useRef(null);
  const multiFileInputRef = useRef(null);
  const captionEditableRef = useRef(null);
  const activeDragRef = useRef(null);

  // Cargar imagen inicial
  useEffect(() => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      const src = e.target?.result;
      const initialItem = { file, src, caption: '' };
      setImages([initialItem]);
      setCurrentIdx(0);
      loadImageSource(src);
    };
    reader.readAsDataURL(file);
  }, [file]);

  // Cargar stickers disponibles
  useEffect(() => {
    apiService.getStickers().then(packs => {
      if (Array.isArray(packs)) setStickerPacks(packs);
    }).catch(() => {});
  }, []);

  const loadImageSource = (src) => {
    const img = new Image();
    img.onload = () => {
      setNaturalSize({ width: img.naturalWidth || img.width, height: img.naturalHeight || img.height });
      imgRef.current = img;
      setCropBox(null);
      setStrokes([]);
      setShapes([]);
      setTexts([]);
      setPlacedStickers([]);
      setPlacedEmojis([]);
      setHistory([]);
      setRotation(0);
      setActiveFilter('none');
    };
    img.src = src;
  };

  // Redibujar el canvas principal
  const redrawCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    const img = imgRef.current;
    if (!canvas || !img || !naturalSize.width) return;

    const isSideways = rotation === 90 || rotation === 270;
    const targetW = isSideways ? naturalSize.height : naturalSize.width;
    const targetH = isSideways ? naturalSize.width : naturalSize.height;

    canvas.width = targetW;
    canvas.height = targetH;

    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, targetW, targetH);

    // 1. Dibujar imagen con rotación y filtros
    ctx.save();
    ctx.translate(targetW / 2, targetH / 2);
    ctx.rotate((rotation * Math.PI) / 180);

    if (activeFilter === 'bw') {
      ctx.filter = 'grayscale(100%) contrast(110%)';
    } else if (activeFilter === 'sepia') {
      ctx.filter = 'sepia(100%) contrast(105%)';
    } else if (activeFilter === 'invert') {
      ctx.filter = 'invert(100%)';
    } else if (activeFilter === 'vintage') {
      ctx.filter = 'contrast(120%) brightness(95%) saturate(140%)';
    } else {
      ctx.filter = 'none';
    }

    ctx.drawImage(img, -naturalSize.width / 2, -naturalSize.height / 2);
    ctx.restore();

    // 2. Dibujar formas geométricas
    shapes.forEach(sh => {
      ctx.save();
      ctx.strokeStyle = sh.color;
      ctx.lineWidth = sh.size;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      drawSingleShape(ctx, sh);
      ctx.restore();
    });

    if (currentShapeRef.current) {
      ctx.save();
      ctx.strokeStyle = currentShapeRef.current.color;
      ctx.lineWidth = currentShapeRef.current.size;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      drawSingleShape(ctx, currentShapeRef.current);
      ctx.restore();
    }

    // 3. Dibujar trazos de lápiz
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    strokes.forEach(st => {
      if (!st.points || st.points.length < 2) return;
      ctx.strokeStyle = st.color;
      ctx.lineWidth = st.size;
      ctx.beginPath();
      ctx.moveTo(st.points[0].x, st.points[0].y);
      for (let i = 1; i < st.points.length; i++) {
        ctx.lineTo(st.points[i].x, st.points[i].y);
      }
      ctx.stroke();
    });

    if (currentStrokeRef.current && currentStrokeRef.current.points.length > 1) {
      const cur = currentStrokeRef.current;
      ctx.strokeStyle = cur.color;
      ctx.lineWidth = cur.size;
      ctx.beginPath();
      ctx.moveTo(cur.points[0].x, cur.points[0].y);
      for (let i = 1; i < cur.points.length; i++) {
        ctx.lineTo(cur.points[i].x, cur.points[i].y);
      }
      ctx.stroke();
    }
  }, [naturalSize, rotation, strokes, shapes, activeFilter]);

  const drawSingleShape = (ctx, sh) => {
    const { type, x1, y1, x2, y2 } = sh;
    if (type === 'rectangle') {
      ctx.strokeRect(Math.min(x1, x2), Math.min(y1, y2), Math.abs(x2 - x1), Math.abs(y2 - y1));
    } else if (type === 'circle') {
      const rx = Math.abs(x2 - x1) / 2;
      const ry = Math.abs(y2 - y1) / 2;
      const cx = Math.min(x1, x2) + rx;
      const cy = Math.min(y1, y2) + ry;
      ctx.beginPath();
      ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
      ctx.stroke();
    } else if (type === 'line') {
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
    } else if (type === 'arrow') {
      const headlen = Math.max(15, sh.size * 2.5);
      const angle = Math.atan2(y2 - y1, x2 - x1);
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(x2, y2);
      ctx.lineTo(x2 - headlen * Math.cos(angle - Math.PI / 6), y2 - headlen * Math.sin(angle - Math.PI / 6));
      ctx.moveTo(x2, y2);
      ctx.lineTo(x2 - headlen * Math.cos(angle + Math.PI / 6), y2 - headlen * Math.sin(angle + Math.PI / 6));
      ctx.stroke();
    }
  };

  useEffect(() => {
    redrawCanvas();
  }, [redrawCanvas]);

  const getCanvasCoords = (e) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const clientX = e.clientX || (e.touches && e.touches[0]?.clientX) || 0;
    const clientY = e.clientY || (e.touches && e.touches[0]?.clientY) || 0;
    return {
      x: (clientX - rect.left) * scaleX,
      y: (clientY - rect.top) * scaleY,
    };
  };

  // Controladores de dibujo y formas
  const handlePointerDown = (e) => {
    if (activeTool === 'crop') return;
    const coords = getCanvasCoords(e);
    isDrawingRef.current = true;

    if (activeTool === 'pencil') {
      currentStrokeRef.current = {
        color,
        size: brushSize,
        points: [coords]
      };
    } else if (activeTool === 'shapes') {
      currentShapeRef.current = {
        type: selectedShape,
        x1: coords.x,
        y1: coords.y,
        x2: coords.x,
        y2: coords.y,
        color,
        size: brushSize
      };
    }
  };

  const handlePointerMove = (e) => {
    if (!isDrawingRef.current) return;
    const coords = getCanvasCoords(e);

    if (activeTool === 'pencil' && currentStrokeRef.current) {
      currentStrokeRef.current.points.push(coords);
      redrawCanvas();
    } else if (activeTool === 'shapes' && currentShapeRef.current) {
      currentShapeRef.current.x2 = coords.x;
      currentShapeRef.current.y2 = coords.y;
      redrawCanvas();
    }
  };

  const handlePointerUp = () => {
    if (!isDrawingRef.current) return;
    isDrawingRef.current = false;

    if (activeTool === 'pencil' && currentStrokeRef.current && currentStrokeRef.current.points.length > 1) {
      const newStroke = currentStrokeRef.current;
      setStrokes(prev => [...prev, newStroke]);
      setHistory(prev => [...prev, { type: 'stroke', data: newStroke }]);
      currentStrokeRef.current = null;
    } else if (activeTool === 'shapes' && currentShapeRef.current) {
      const newShape = currentShapeRef.current;
      if (Math.abs(newShape.x2 - newShape.x1) > 5 || Math.abs(newShape.y2 - newShape.y1) > 5) {
        setShapes(prev => [...prev, newShape]);
        setHistory(prev => [...prev, { type: 'shape', data: newShape }]);
      }
      currentShapeRef.current = null;
    }
    redrawCanvas();
  };

  // Deshacer acción
  const handleUndo = () => {
    if (history.length === 0) return;
    const last = history[history.length - 1];
    setHistory(prev => prev.slice(0, -1));

    if (last.type === 'stroke') {
      setStrokes(prev => prev.slice(0, -1));
    } else if (last.type === 'shape') {
      setShapes(prev => prev.slice(0, -1));
    } else if (last.type === 'text') {
      setTexts(prev => prev.filter(t => t.id !== last.data.id));
    } else if (last.type === 'sticker') {
      setPlacedStickers(prev => prev.filter(s => s.id !== last.data.id));
    } else if (last.type === 'emoji') {
      setPlacedEmojis(prev => prev.filter(em => em.id !== last.data.id));
    }
  };

  // Rotar 90 grados
  const handleRotate = () => {
    setRotation(r => (r + 90) % 360);
    setStrokes([]);
    setShapes([]);
    setTexts([]);
    setPlacedStickers([]);
    setPlacedEmojis([]);
    setHistory([]);
  };

  // Inicializar o aplicar recorte
  const handleToggleCrop = () => {
    if (activeTool === 'crop') {
      applyCrop();
      setActiveTool(null);
    } else {
      const canvas = canvasRef.current;
      if (!canvas) return;
      setActiveTool('crop');
      setCropBox({
        x: canvas.width * 0.1,
        y: canvas.height * 0.1,
        width: canvas.width * 0.8,
        height: canvas.height * 0.8
      });
    }
  };

  const applyCrop = () => {
    const canvas = canvasRef.current;
    if (!canvas || !cropBox) return;

    const croppedCanvas = document.createElement('canvas');
    croppedCanvas.width = Math.round(cropBox.width);
    croppedCanvas.height = Math.round(cropBox.height);
    const ctx = croppedCanvas.getContext('2d');

    ctx.drawImage(
      canvas,
      cropBox.x, cropBox.y, cropBox.width, cropBox.height,
      0, 0, croppedCanvas.width, croppedCanvas.height
    );

    const newSrc = croppedCanvas.toDataURL('image/png');
    loadImageSource(newSrc);
  };

  // Agregar texto
  const handleAddText = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const newText = {
      id: 'txt_' + Date.now(),
      text: 'Texto',
      x: canvas.width / 2,
      y: canvas.height / 2,
      color: color || '#ffffff',
      size: Math.max(26, Math.round(canvas.width * 0.05)),
      bgColor: 'rgba(0,0,0,0.5)',
      isEditing: true
    };
    setTexts(prev => [...prev, newText]);
    setHistory(prev => [...prev, { type: 'text', data: newText }]);
    setActiveTool('text');
  };

  // Agregar sticker sobre la imagen
  const handleAddStickerOnImage = (url) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const newSticker = {
      id: 'stk_' + Date.now(),
      url: resolveMedia(url),
      x: canvas.width / 2,
      y: canvas.height / 2,
      size: Math.max(90, Math.round(canvas.width * 0.22))
    };
    setPlacedStickers(prev => [...prev, newSticker]);
    setHistory(prev => [...prev, { type: 'sticker', data: newSticker }]);
    setShowStickersPopover(false);
  };

  // Agregar emoji oficial de Apple sobre la imagen
  const handleSelectEmojiOnImage = (emojiObj) => {
    const char = emojiObj?.native || emojiObj?.emoji || '😀';
    const canvas = canvasRef.current;
    if (!canvas) return;
    const appleUrl = getAppleEmojiUrl(char);

    const newEmoji = {
      id: 'emoji_' + Date.now(),
      char,
      url: appleUrl,
      x: canvas.width / 2,
      y: canvas.height / 2,
      size: Math.max(70, Math.round(canvas.width * 0.16))
    };
    setPlacedEmojis(prev => [...prev, newEmoji]);
    setHistory(prev => [...prev, { type: 'emoji', data: newEmoji }]);
    setShowEmojiPicker(false);
  };

  // Arrastrar elementos (stickers, emojis, textos) sobre el canvas
  const handleElementMouseDown = (e, id, type) => {
    e.stopPropagation();
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    activeDragRef.current = {
      id,
      type,
      startX: e.clientX * scaleX,
      startY: e.clientY * scaleY,
    };

    const handleMouseMove = (moveEvt) => {
      if (!activeDragRef.current) return;
      const { id: targetId, type: targetType } = activeDragRef.current;
      const curX = moveEvt.clientX * scaleX;
      const curY = moveEvt.clientY * scaleY;
      const deltaX = curX - activeDragRef.current.startX;
      const deltaY = curY - activeDragRef.current.startY;
      activeDragRef.current.startX = curX;
      activeDragRef.current.startY = curY;

      const updatePos = (item) => {
        if (item.id === targetId) {
          return {
            ...item,
            x: Math.max(20, Math.min(canvas.width - 20, item.x + deltaX)),
            y: Math.max(20, Math.min(canvas.height - 20, item.y + deltaY))
          };
        }
        return item;
      };

      if (targetType === 'sticker') {
        setPlacedStickers(prev => prev.map(updatePos));
      } else if (targetType === 'emoji') {
        setPlacedEmojis(prev => prev.map(updatePos));
      } else if (targetType === 'text') {
        setTexts(prev => prev.map(updatePos));
      }
    };

    const handleMouseUp = () => {
      activeDragRef.current = null;
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  };

  // Insertar emoji en el pie de foto con renderizado Apple
  const handleInsertCaptionEmoji = (emojiObj) => {
    const char = emojiObj?.native || emojiObj?.emoji || '';
    if (!char) return;
    const url = getAppleEmojiUrl(char);

    if (captionEditableRef.current) {
      captionEditableRef.current.focus();
      if (url) {
        const img = document.createElement('img');
        img.src = url;
        img.alt = char;
        img.dataset.emoji = char;
        img.className = 'wa-apple-emoji inline';
        img.draggable = false;

        const sel = window.getSelection();
        if (sel && sel.rangeCount > 0 && captionEditableRef.current.contains(sel.getRangeAt(0).commonAncestorContainer)) {
          const range = sel.getRangeAt(0);
          range.deleteContents();
          range.insertNode(img);
          range.setStartAfter(img);
          range.setEndAfter(img);
          sel.removeAllRanges();
          sel.addRange(range);
        } else {
          captionEditableRef.current.appendChild(img);
        }
      } else {
        document.execCommand('insertText', false, char);
      }
      setCaption(extractTextFromContentEditable(captionEditableRef.current));
    }
    setShowCaptionEmoji(false);
  };

  const handleCaptionInput = () => {
    if (captionEditableRef.current) {
      setCaption(extractTextFromContentEditable(captionEditableRef.current));
    }
  };

  // Agregar más imágenes a la bandeja inferior
  const handleAddMoreImages = (e) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    files.forEach(f => {
      if (!f.type.startsWith('image/')) return;
      const r = new FileReader();
      r.onload = (evt) => {
        setImages(prev => [...prev, { file: f, src: evt.target.result, caption: '' }]);
      };
      r.readAsDataURL(f);
    });
  };

  // Descargar imagen actual
  const handleDownload = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const a = document.createElement('a');
    a.href = canvas.toDataURL('image/png');
    a.download = `foto_${Date.now()}.png`;
    a.click();
  };

  // Enviar imagen final fundiendo todo (trazos, formas, stickers y emojis de Apple)
  const handleFinalSend = async () => {
    if (sending) return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    try {
      setSending(true);

      const exportCanvas = document.createElement('canvas');
      exportCanvas.width = canvas.width;
      exportCanvas.height = canvas.height;
      const ctx = exportCanvas.getContext('2d');

      // 1. Base + trazos + formas
      ctx.drawImage(canvas, 0, 0);

      // 2. Stickers corporativos
      for (const st of placedStickers) {
        try {
          const imgStk = new Image();
          imgStk.crossOrigin = 'anonymous';
          await new Promise((res, rej) => {
            imgStk.onload = res;
            imgStk.onerror = rej;
            imgStk.src = st.url;
          });
          ctx.drawImage(imgStk, st.x - st.size / 2, st.y - st.size / 2, st.size, st.size);
        } catch (_) {}
      }

      // 3. Emojis oficiales de Apple en alta resolución
      for (const em of placedEmojis) {
        try {
          if (em.url) {
            const imgEm = new Image();
            imgEm.crossOrigin = 'anonymous';
            await new Promise((res, rej) => {
              imgEm.onload = res;
              imgEm.onerror = rej;
              imgEm.src = em.url;
            });
            ctx.drawImage(imgEm, em.x - em.size / 2, em.y - em.size / 2, em.size, em.size);
          } else {
            // Fallback
            ctx.font = `${em.size}px system-ui, -apple-system, sans-serif`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(em.char, em.x, em.y);
          }
        } catch (_) {}
      }

      // 4. Textos
      texts.forEach(t => {
        if (!t.text || !t.text.trim()) return;
        ctx.save();
        ctx.font = 'bold ' + t.size + 'px system-ui, -apple-system, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        const metrics = ctx.measureText(t.text);
        const pad = t.size * 0.3;
        const bgW = metrics.width + pad * 2;
        const bgH = t.size * 1.3;

        if (t.bgColor && t.bgColor !== 'transparent') {
          ctx.fillStyle = t.bgColor;
          const rx = t.x - bgW / 2;
          const ry = t.y - bgH / 2;
          const rad = 8;
          ctx.beginPath();
          ctx.moveTo(rx + rad, ry);
          ctx.lineTo(rx + bgW - rad, ry);
          ctx.quadraticCurveTo(rx + bgW, ry, rx + bgW, ry + rad);
          ctx.lineTo(rx + bgW, ry + bgH - rad);
          ctx.quadraticCurveTo(rx + bgW, ry + bgH, rx + bgW - rad, ry + bgH);
          ctx.lineTo(rx + rad, ry + bgH);
          ctx.quadraticCurveTo(rx, ry + bgH, rx, ry + bgH - rad);
          ctx.lineTo(rx, ry + rad);
          ctx.quadraticCurveTo(rx, ry, rx + rad, ry);
          ctx.closePath();
          ctx.fill();
        }

        ctx.fillStyle = t.color || '#ffffff';
        ctx.shadowColor = 'rgba(0,0,0,0.6)';
        ctx.shadowBlur = 6;
        ctx.fillText(t.text, t.x, t.y);
        ctx.restore();
      });

      const finalCaption = captionEditableRef.current
        ? extractTextFromContentEditable(captionEditableRef.current)
        : caption;

      exportCanvas.toBlob(async (blob) => {
        if (!blob) {
          alert('Error al exportar la imagen');
          setSending(false);
          return;
        }
        if (onSend) {
          await onSend(blob, finalCaption.trim());
        }
        onClose();
      }, 'image/png', 0.95);

    } catch (err) {
      console.error('Error al exportar imagen editada:', err);
      alert('Hubo un problema al exportar la imagen.');
      setSending(false);
    }
  };

  return (
    <div className="wa-img-editor-overlay">
      {/* ── BARRA SUPERIOR EXACTA DE WHATSAPP ── */}
      <div className="wa-img-editor-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button
            type="button"
            className="wa-img-editor-btn"
            onClick={onClose}
            title="Cerrar (Esc)"
          >
            <X size={22} />
          </button>

          <button
            type="button"
            className={`wa-img-editor-btn ${history.length === 0 ? 'disabled' : ''}`}
            onClick={handleUndo}
            disabled={history.length === 0}
            title="Deshacer"
          >
            <Undo size={20} />
          </button>
        </div>

        {/* HERRAMIENTAS CENTRADAS */}
        <div className="wa-img-editor-tools">
          {/* 1. Recortar */}
          <button
            type="button"
            className={`wa-img-editor-btn ${activeTool === 'crop' ? 'active' : ''}`}
            onClick={handleToggleCrop}
            title="Recortar imagen"
          >
            <Crop size={19} />
          </button>

          {/* Girar 90° */}
          <button
            type="button"
            className="wa-img-editor-btn"
            onClick={handleRotate}
            title="Girar 90°"
          >
            <RotateCw size={19} />
          </button>

          {/* 2. Filtros / Varita mágica */}
          <div style={{ position: 'relative' }}>
            <button
              type="button"
              className={`wa-img-editor-btn ${activeFilter !== 'none' ? 'active' : ''}`}
              onClick={() => setShowFiltersPopover(prev => !prev)}
              title="Filtros"
            >
              <Wand2 size={19} />
            </button>
            {showFiltersPopover && (
              <div className="wa-img-editor-dropdown">
                <div className="wa-dropdown-title">Filtros</div>
                {[
                  { id: 'none', label: 'Normal' },
                  { id: 'bw', label: 'Blanco y negro' },
                  { id: 'sepia', label: 'Sepia' },
                  { id: 'vintage', label: 'Cálido' },
                  { id: 'invert', label: 'Invertido' },
                ].map(f => (
                  <button
                    key={f.id}
                    type="button"
                    className={`wa-dropdown-item ${activeFilter === f.id ? 'active' : ''}`}
                    onClick={() => { setActiveFilter(f.id); setShowFiltersPopover(false); }}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* 3. Lápiz / Dibujo libre */}
          <button
            type="button"
            className={`wa-img-editor-btn ${activeTool === 'pencil' ? 'active' : ''}`}
            onClick={() => setActiveTool(activeTool === 'pencil' ? null : 'pencil')}
            title="Dibujar a mano alzada"
          >
            <Pencil size={19} />
          </button>

          {/* 4. Texto (Aa) */}
          <button
            type="button"
            className={`wa-img-editor-btn ${activeTool === 'text' ? 'active' : ''}`}
            onClick={handleAddText}
            title="Añadir texto"
          >
            <Type size={20} />
          </button>

          {/* 5. Formas (Rectángulo, Círculo, Línea, Flecha) */}
          <div style={{ position: 'relative' }}>
            <button
              type="button"
              className={`wa-img-editor-btn ${activeTool === 'shapes' ? 'active' : ''}`}
              onClick={() => {
                setActiveTool('shapes');
                setShowShapesPopover(prev => !prev);
              }}
              title="Formas geométricas"
            >
              <Square size={19} />
            </button>
            {showShapesPopover && (
              <div className="wa-shapes-popover">
                <div className="wa-shapes-grid">
                  <button
                    type="button"
                    className={`wa-shape-btn ${selectedShape === 'rectangle' ? 'active' : ''}`}
                    onClick={() => { setSelectedShape('rectangle'); setShowShapesPopover(false); }}
                    title="Rectángulo"
                  >
                    <Square size={20} />
                  </button>
                  <button
                    type="button"
                    className={`wa-shape-btn ${selectedShape === 'circle' ? 'active' : ''}`}
                    onClick={() => { setSelectedShape('circle'); setShowShapesPopover(false); }}
                    title="Círculo"
                  >
                    <Circle size={20} />
                  </button>
                  <button
                    type="button"
                    className={`wa-shape-btn ${selectedShape === 'line' ? 'active' : ''}`}
                    onClick={() => { setSelectedShape('line'); setShowShapesPopover(false); }}
                    title="Línea"
                  >
                    <Minus size={20} />
                  </button>
                  <button
                    type="button"
                    className={`wa-shape-btn ${selectedShape === 'arrow' ? 'active' : ''}`}
                    onClick={() => { setSelectedShape('arrow'); setShowShapesPopover(false); }}
                    title="Flecha"
                  >
                    <ArrowRight size={20} />
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* 6. Difuminar / Mosaico */}
          <button
            type="button"
            className={`wa-img-editor-btn ${activeFilter === 'bw' ? 'active' : ''}`}
            onClick={() => setActiveFilter(activeFilter === 'bw' ? 'none' : 'bw')}
            title="Mosaico / Blanco y negro"
          >
            <Grid size={19} />
          </button>

          {/* 7. Emojis de Apple */}
          <div style={{ position: 'relative' }}>
            <button
              type="button"
              className={`wa-img-editor-btn ${showEmojiPicker ? 'active' : ''}`}
              onClick={() => setShowEmojiPicker(prev => !prev)}
              title="Emojis estilo Apple"
            >
              <Smile size={20} />
            </button>
            {showEmojiPicker && (
              <div className="wa-img-editor-emoji-popover">
                <Picker
                  data={data}
                  onEmojiSelect={handleSelectEmojiOnImage}
                  theme="dark"
                  locale="es"
                  previewPosition="none"
                  skinTonePosition="none"
                />
              </div>
            )}
          </div>

          {/* 8. Stickers WhatsApp */}
          <div style={{ position: 'relative' }}>
            <button
              type="button"
              className={`wa-img-editor-btn ${showStickersPopover ? 'active' : ''}`}
              onClick={() => setShowStickersPopover(prev => !prev)}
              title="Stickers de WhatsApp"
            >
              <Sticker size={20} />
            </button>

            {showStickersPopover && (
              <div className="wa-stickers-popup-card">
                <div className="wa-stickers-search-wrap">
                  <input
                    type="text"
                    className="wa-stickers-search-input"
                    placeholder="Buscar stickers..."
                    value={stickersSearch}
                    onChange={(e) => setStickersSearch(e.target.value)}
                  />
                </div>
                <div className="wa-stickers-popup-grid">
                  {stickerPacks.flatMap(p => (p.files || []).map(f => ({ pack: p.pack, file: f }))).slice(0, 24).map(st => (
                    <div
                      key={`${st.pack}_${st.file}`}
                      className="wa-sticker-cell"
                      onClick={() => handleAddStickerOnImage(`/uploads/stickers/${st.pack}/${st.file}`)}
                    >
                      <img src={resolveMedia(`/uploads/stickers/${st.pack}/${st.file}`)} alt="sticker" />
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* BOTONES DERECHA */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {activeTool === 'crop' ? (
            <button
              type="button"
              className="wa-img-editor-ok-btn"
              onClick={applyCrop}
            >
              OK
            </button>
          ) : (
            <button
              type="button"
              className="wa-img-editor-btn"
              onClick={handleDownload}
              title="Descargar imagen"
            >
              <Download size={20} />
            </button>
          )}
        </div>
      </div>

      {/* ── ÁREA DE TRABAJO CON IMAGEN Y CANVAS ── */}
      <div className="wa-img-editor-body" ref={containerRef}>
        <div className="wa-canvas-wrapper">
          <canvas
            ref={canvasRef}
            className={`wa-img-editor-canvas ${activeTool === 'pencil' || activeTool === 'shapes' ? 'drawing-mode' : ''}`}
            onMouseDown={handlePointerDown}
            onMouseMove={handlePointerMove}
            onMouseUp={handlePointerUp}
            onMouseLeave={handlePointerUp}
            onTouchStart={handlePointerDown}
            onTouchMove={handlePointerMove}
            onTouchEnd={handlePointerUp}
          />

          {/* Máscara y controles de recorte */}
          {activeTool === 'crop' && cropBox && (
            <div className="wa-crop-overlay-box" style={{
              left: `${(cropBox.x / (canvasRef.current?.width || 1)) * 100}%`,
              top: `${(cropBox.y / (canvasRef.current?.height || 1)) * 100}%`,
              width: `${(cropBox.width / (canvasRef.current?.width || 1)) * 100}%`,
              height: `${(cropBox.height / (canvasRef.current?.height || 1)) * 100}%`,
            }}>
              <div className="wa-crop-handle tl" />
              <div className="wa-crop-handle tm" />
              <div className="wa-crop-handle tr" />
              <div className="wa-crop-handle mr" />
              <div className="wa-crop-handle br" />
              <div className="wa-crop-handle bm" />
              <div className="wa-crop-handle bl" />
              <div className="wa-crop-handle ml" />
            </div>
          )}

          {/* Stickers colocados sobre la imagen */}
          {placedStickers.map(stk => (
            <div
              key={stk.id}
              className="wa-placed-sticker"
              style={{
                left: `${(stk.x / (canvasRef.current?.width || 1)) * 100}%`,
                top: `${(stk.y / (canvasRef.current?.height || 1)) * 100}%`,
                width: `${stk.size}px`,
                height: `${stk.size}px`,
              }}
              onMouseDown={(e) => handleElementMouseDown(e, stk.id, 'sticker')}
            >
              <img src={stk.url} alt="sticker" draggable={false} />
              <button
                type="button"
                className="wa-element-del-btn"
                onClick={() => setPlacedStickers(prev => prev.filter(s => s.id !== stk.id))}
              >
                <X size={12} />
              </button>
            </div>
          ))}

          {/* Emojis oficiales de Apple colocados sobre la imagen */}
          {placedEmojis.map(em => (
            <div
              key={em.id}
              className="wa-placed-apple-emoji"
              style={{
                left: `${(em.x / (canvasRef.current?.width || 1)) * 100}%`,
                top: `${(em.y / (canvasRef.current?.height || 1)) * 100}%`,
                width: `${em.size}px`,
                height: `${em.size}px`,
              }}
              onMouseDown={(e) => handleElementMouseDown(e, em.id, 'emoji')}
            >
              {em.url ? (
                <img src={em.url} alt={em.char} style={{ width: '100%', height: '100%', objectFit: 'contain' }} draggable={false} />
              ) : (
                <span style={{ fontSize: `${em.size * 0.8}px` }}>{em.char}</span>
              )}
              <button
                type="button"
                className="wa-element-del-btn"
                onClick={() => setPlacedEmojis(prev => prev.filter(item => item.id !== em.id))}
              >
                <X size={12} />
              </button>
            </div>
          ))}

          {/* Textos colocados */}
          {texts.map(t => {
            const canvas = canvasRef.current;
            if (!canvas) return null;
            return (
              <div
                key={t.id}
                className="wa-text-overlay-item"
                style={{
                  left: `${(t.x / canvas.width) * 100}%`,
                  top: `${(t.y / canvas.height) * 100}%`,
                  color: t.color,
                  backgroundColor: t.bgColor,
                  fontSize: `${Math.max(16, t.size * 0.7)}px`,
                }}
                onMouseDown={(e) => handleElementMouseDown(e, t.id, 'text')}
              >
                <input
                  type="text"
                  value={t.text}
                  onChange={(e) => setTexts(prev => prev.map(item => item.id === t.id ? { ...item, text: e.target.value } : item))}
                  className="wa-text-overlay-input"
                  style={{ color: t.color }}
                  autoFocus={t.isEditing}
                />
                <button
                  type="button"
                  className="wa-element-del-btn"
                  onClick={() => setTexts(prev => prev.filter(item => item.id !== t.id))}
                >
                  <X size={12} />
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── BARRA FLOTANTE DE COLORES Y GROSORES ── */}
      {(activeTool === 'pencil' || activeTool === 'shapes' || activeTool === 'text') && (
        <div className="wa-floating-palette-bar">
          <div className="wa-floating-palette-colors">
            {WA_COLORS.map(c => (
              <button
                key={c}
                type="button"
                className={`wa-color-circle ${color === c ? 'active' : ''}`}
                style={{ backgroundColor: c }}
                onClick={() => setColor(c)}
              />
            ))}
          </div>

          <div className="wa-floating-brush-sizes">
            {BRUSH_SIZES.map(b => (
              <button
                key={b.size}
                type="button"
                className={`wa-size-circle ${brushSize === b.size ? 'active' : ''}`}
                onClick={() => setBrushSize(b.size)}
                title={b.label}
              >
                <div style={{ width: b.dotSize, height: b.dotSize, backgroundColor: '#ffffff', borderRadius: '50%' }} />
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── BANDEJA INFERIOR: PIE DE FOTO CON RENDERIZADO APPLE + MINIATURAS + ENVIAR ── */}
      <div className="wa-img-editor-bottom-tray">
        {/* Campo de pie de foto con soporte de emojis Apple */}
        <div className="wa-caption-bar-row">
          <div className="wa-caption-input-container">
            <div
              ref={captionEditableRef}
              contentEditable
              className="wa-caption-contenteditable"
              data-placeholder="Escribe un mensaje"
              onInput={handleCaptionInput}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleFinalSend();
                }
              }}
            />
            <div style={{ position: 'relative' }}>
              <button
                type="button"
                className="wa-caption-smile-btn"
                onClick={() => setShowCaptionEmoji(prev => !prev)}
                title="Añadir emoji"
              >
                <Smile size={20} />
              </button>
              {showCaptionEmoji && (
                <div className="wa-caption-emoji-popover">
                  <Picker
                    data={data}
                    onEmojiSelect={handleInsertCaptionEmoji}
                    theme="dark"
                    locale="es"
                    previewPosition="none"
                    skinTonePosition="none"
                  />
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Fila de miniaturas y botón verde flotante */}
        <div className="wa-thumbnails-send-row">
          <div className="wa-thumbnails-list">
            {images.map((imgItem, idx) => (
              <div
                key={idx}
                className={`wa-thumb-box ${currentIdx === idx ? 'active' : ''}`}
                onClick={() => {
                  setCurrentIdx(idx);
                  loadImageSource(imgItem.src);
                }}
              >
                <img src={imgItem.src} alt="thumb" />
              </div>
            ))}

            <button
              type="button"
              className="wa-add-more-thumb-btn"
              onClick={() => multiFileInputRef.current?.click()}
              title="Añadir otra imagen"
            >
              <Plus size={22} />
            </button>
            <input
              type="file"
              ref={multiFileInputRef}
              onChange={handleAddMoreImages}
              multiple
              accept="image/*"
              style={{ display: 'none' }}
            />
          </div>

          <button
            type="button"
            className="wa-floating-send-circle-btn"
            onClick={handleFinalSend}
            disabled={sending}
            title="Enviar (Enter)"
          >
            {sending ? (
              <div className="wa-spinner-white" />
            ) : (
              <Send size={22} fill="currentColor" />
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
