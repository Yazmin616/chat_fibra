import React, { useState, useRef, useEffect } from 'react';
import { X, Upload, Check, Sparkles, RefreshCw } from 'lucide-react';
import { apiService } from '../../services/api';

const SHAPES = [
  { id: 'contain', label: 'Completo' },
  { id: 'square', label: 'Cuadrado' },
  { id: 'circle', label: 'Circular' }
];

const ChatInternoStickerMakerModal = ({
  agenteId,
  onClose,
  onSendSticker
}) => {
  const [imageSrc, setImageSrc] = useState(null);
  const [shape, setShape] = useState('square');
  const [zoom, setZoom] = useState(1);
  const [textOverlay, setTextOverlay] = useState('');
  const [textColor, setTextColor] = useState('#ffffff');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const canvasRef = useRef(null);
  const imgRef = useRef(null);
  const fileInputRef = useRef(null);

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setError('Por favor selecciona un archivo de imagen (PNG, JPG o WebP).');
      return;
    }
    setError('');
    const reader = new FileReader();
    reader.onload = (event) => {
      setImageSrc(event.target?.result);
    };
    reader.readAsDataURL(file);
  };

  // Dibujar sticker en el canvas cada vez que cambian los parámetros
  useEffect(() => {
    if (!imageSrc) return;
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      imgRef.current = img;
      renderSticker();
    };
    img.src = imageSrc;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [imageSrc, shape, zoom, textOverlay, textColor]);

  const renderSticker = () => {
    const canvas = canvasRef.current;
    const img = imgRef.current;
    if (!canvas || !img) return;

    const ctx = canvas.getContext('2d');
    const size = 512;
    canvas.width = size;
    canvas.height = size;
    ctx.clearRect(0, 0, size, size);

    ctx.save();

    // Aplicar máscara de recorte según la forma elegida
    if (shape === 'circle') {
      ctx.beginPath();
      ctx.arc(size / 2, size / 2, (size / 2) - 8, 0, Math.PI * 2);
      ctx.closePath();
      ctx.clip();
    } else if (shape === 'square') {
      const radius = 32;
      const x = 12, y = 12, w = size - 24, h = size - 24;
      ctx.beginPath();
      ctx.moveTo(x + radius, y);
      ctx.lineTo(x + w - radius, y);
      ctx.quadraticCurveTo(x + w, y, x + w, y + radius);
      ctx.lineTo(x + w, y + h - radius);
      ctx.quadraticCurveTo(x + w, y + h, x + w - radius, y + h);
      ctx.lineTo(x + radius, y + h);
      ctx.quadraticCurveTo(x, y + h, x, y + h - radius);
      ctx.lineTo(x, y + radius);
      ctx.quadraticCurveTo(x, y, x + radius, y);
      ctx.closePath();
      ctx.clip();
    }

    // Dibujar imagen centrada con zoom
    const aspect = img.width / img.height;
    let drawW, drawH;
    if (shape === 'contain') {
      if (aspect > 1) {
        drawW = size * zoom;
        drawH = (size / aspect) * zoom;
      } else {
        drawH = size * zoom;
        drawW = (size * aspect) * zoom;
      }
    } else {
      if (aspect > 1) {
        drawH = size * zoom;
        drawW = size * aspect * zoom;
      } else {
        drawW = size * zoom;
        drawH = (size / aspect) * zoom;
      }
    }

    const drawX = (size - drawW) / 2;
    const drawY = (size - drawH) / 2;

    ctx.drawImage(img, drawX, drawY, drawW, drawH);
    ctx.restore();

    // Texto overlay opcional estilo sticker meme
    if (textOverlay.trim()) {
      ctx.save();
      ctx.font = 'bold 36px "Segoe UI", sans-serif';
      ctx.textAlign = 'center';
      ctx.fillStyle = textColor;
      ctx.shadowColor = 'rgba(0,0,0,0.8)';
      ctx.shadowBlur = 8;
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 4;
      const textX = size / 2;
      const textY = size - 36;
      ctx.strokeText(textOverlay.trim(), textX, textY);
      ctx.fillText(textOverlay.trim(), textX, textY);
      ctx.restore();
    }
  };

  const generarBlob = () => {
    return new Promise((resolve) => {
      const canvas = canvasRef.current;
      if (!canvas) return resolve(null);
      canvas.toBlob((blob) => {
        resolve(blob);
      }, 'image/webp', 0.92);
    });
  };

  const handleEnviar = async () => {
    if (!imageSrc || saving) return;
    setSaving(true);
    try {
      const blob = await generarBlob();
      if (!blob) throw new Error('No se pudo generar el sticker');
      if (onSendSticker) {
        await onSendSticker(blob);
      }
      onClose();
    } catch (err) {
      setError(err.message || 'Error al enviar sticker');
    } finally {
      setSaving(false);
    }
  };

  const handleGuardarYEnviar = async () => {
    if (!imageSrc || saving) return;
    setSaving(true);
    try {
      const blob = await generarBlob();
      if (!blob) throw new Error('No se pudo generar el sticker');
      let created = null;
      if (agenteId) {
        created = await apiService.crearSticker(agenteId, blob);
      }
      if (onSendSticker) {
        const stickerUri = (created && created.pack && created.file)
          ? `st://${created.pack}/${created.file}`
          : null;
        await onSendSticker(blob, stickerUri);
      }
      onClose();
    } catch (err) {
      setError(err.message || 'Error al guardar sticker');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="wa-stk-maker-overlay" onClick={onClose}>
      <div className="wa-stk-maker-card" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="wa-stk-maker-header">
          <div className="wa-stk-maker-title-wrap">
            <Sparkles size={20} color="#00a884" />
            <h3 className="wa-stk-maker-title">Crear Sticker</h3>
          </div>
          <button type="button" className="wa-stk-maker-close-btn" onClick={onClose} title="Cerrar">
            <X size={20} />
          </button>
        </div>

        {error && <div className="wa-stk-maker-alert">{error}</div>}

        <div className="wa-stk-maker-body">
          {!imageSrc ? (
            <div
              className="wa-stk-maker-dropzone"
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload size={44} color="#8696a0" />
              <div className="wa-stk-maker-drop-title">Haz clic para subir una imagen</div>
              <div className="wa-stk-maker-drop-sub">Soporta PNG, JPG, JPEG y WebP</div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp,image/gif"
                style={{ display: 'none' }}
                onChange={handleFileChange}
              />
            </div>
          ) : (
            <div className="wa-stk-maker-stage">
              {/* Escenario con canvas preview transparente */}
              <div className="wa-stk-canvas-wrap">
                <canvas ref={canvasRef} className="wa-stk-canvas" />
              </div>

              {/* Controles de edición */}
              <div className="wa-stk-controls">
                {/* Formas */}
                <div className="wa-stk-ctrl-group">
                  <label className="wa-stk-label">Forma de recorte:</label>
                  <div className="wa-stk-shape-btns">
                    {SHAPES.map(s => (
                      <button
                        key={s.id}
                        type="button"
                        className={`wa-stk-shape-btn ${shape === s.id ? 'active' : ''}`}
                        onClick={() => setShape(s.id)}
                      >
                        {s.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Zoom */}
                <div className="wa-stk-ctrl-group">
                  <div className="wa-stk-label-row">
                    <label className="wa-stk-label">Tamaño / Zoom:</label>
                    <span className="wa-stk-zoom-val">{Math.round(zoom * 100)}%</span>
                  </div>
                  <input
                    type="range"
                    min="0.5"
                    max="2.5"
                    step="0.05"
                    value={zoom}
                    onChange={(e) => setZoom(parseFloat(e.target.value))}
                    className="wa-stk-range"
                  />
                </div>

                {/* Texto opcional */}
                <div className="wa-stk-ctrl-group">
                  <label className="wa-stk-label">Texto o frase (opcional):</label>
                  <div className="wa-stk-text-input-wrap">
                    <input
                      type="text"
                      className="wa-stk-text-input"
                      placeholder="Escribe algo en el sticker..."
                      value={textOverlay}
                      onChange={(e) => setTextOverlay(e.target.value)}
                      maxLength={30}
                    />
                    <input
                      type="color"
                      value={textColor}
                      onChange={(e) => setTextColor(e.target.value)}
                      className="wa-stk-color-picker"
                      title="Color del texto"
                    />
                  </div>
                </div>

                {/* Cambiar foto */}
                <button
                  type="button"
                  className="wa-stk-change-img-btn"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <RefreshCw size={15} /> Cambiar imagen
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/gif"
                  style={{ display: 'none' }}
                  onChange={handleFileChange}
                />
              </div>
            </div>
          )}
        </div>

        {/* Footer actions */}
        {imageSrc && (
          <div className="wa-stk-maker-footer">
            <button
              type="button"
              className="wa-stk-btn secondary"
              onClick={handleGuardarYEnviar}
              disabled={saving}
            >
              Guardar en Mis Stickers y Enviar
            </button>
            <button
              type="button"
              className="wa-stk-btn primary"
              onClick={handleEnviar}
              disabled={saving}
            >
              <Check size={18} /> {saving ? 'Enviando...' : 'Enviar Sticker'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default ChatInternoStickerMakerModal;
