import React, { useRef, useState, useCallback } from 'react';
import { Image, X, Send, Camera } from 'lucide-react';

const MAX_DIMENSION = 1920;
const JPEG_QUALITY  = 0.85;
const MAX_BYTES     = 10 * 1024 * 1024; // 10 MB

/**
 * Comprime una imagen usando Canvas antes de subirla.
 * Mantiene relación de aspecto y limita la dimensión mayor a MAX_DIMENSION.
 * @param {File} file
 * @returns {Promise<Blob>} JPEG comprimido
 */
function comprimirImagen(file) {
  return new Promise((resolve, reject) => {
    const img = new window.Image();
    img.onload = () => {
      let { width, height } = img;
      if (width > MAX_DIMENSION || height > MAX_DIMENSION) {
        if (width >= height) { height = Math.round(height * MAX_DIMENSION / width); width = MAX_DIMENSION; }
        else                  { width  = Math.round(width  * MAX_DIMENSION / height); height = MAX_DIMENSION; }
      }
      const canvas = document.createElement('canvas');
      canvas.width  = width;
      canvas.height = height;
      canvas.getContext('2d').drawImage(img, 0, 0, width, height);
      canvas.toBlob(
        (blob) => blob ? resolve(blob) : reject(new Error('toBlob falló')),
        'image/jpeg',
        JPEG_QUALITY
      );
    };
    img.onerror = reject;
    img.src = URL.createObjectURL(file);
  });
}

/**
 * Botón de adjuntar imagen con preview antes de enviar.
 * Props:
 *   onSend(blob, caption) — callback para enviar.
 *   disabled              — desactiva el botón mientras se envía.
 */
const MediaUpload = ({ onSend, disabled }) => {
  const fileInputRef   = useRef(null);
  const cameraInputRef = useRef(null);
  const [preview, setPreview]   = useState(null); // { url, blob }
  const [caption, setCaption]   = useState('');
  const [loading, setLoading]   = useState(false);
  const [error,   setError]     = useState('');

  const handleFile = useCallback(async (file) => {
    if (!file) return;
    setError('');
    if (!file.type.startsWith('image/')) { setError('Solo se permiten imágenes.'); return; }
    if (file.size > MAX_BYTES) { setError('La imagen supera los 10 MB.'); return; }
    try {
      const blob = await comprimirImagen(file);
      const url  = URL.createObjectURL(blob);
      setPreview({ url, blob });
    } catch { setError('No se pudo procesar la imagen.'); }
  }, []);

  const handleInputChange = (e) => handleFile(e.target.files[0]);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    handleFile(e.dataTransfer.files[0]);
  }, [handleFile]);

  const handleSend = async () => {
    if (!preview || loading) return;
    setLoading(true);
    try {
      await onSend(preview.blob, caption.trim());
      handleCancel();
    } catch { setError('Error al enviar la imagen.'); }
    finally  { setLoading(false); }
  };

  const handleCancel = () => {
    if (preview?.url) URL.revokeObjectURL(preview.url);
    setPreview(null);
    setCaption('');
    setError('');
    if (fileInputRef.current)   fileInputRef.current.value   = '';
    if (cameraInputRef.current) cameraInputRef.current.value = '';
  };

  return (
    <>
      {/* Inputs ocultos */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        style={{ display: 'none' }}
        onChange={handleInputChange}
      />
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        style={{ display: 'none' }}
        onChange={handleInputChange}
      />

      {/* Botones en la barra */}
      <button
        className="icon-btn-gray"
        title="Adjuntar imagen"
        disabled={disabled}
        onClick={() => fileInputRef.current?.click()}
      >
        <Image size={20} />
      </button>
      <button
        className="icon-btn-gray"
        title="Tomar foto"
        disabled={disabled}
        onClick={() => cameraInputRef.current?.click()}
      >
        <Camera size={20} />
      </button>

      {/* Modal de preview */}
      {preview && (
        <div className="media-preview-overlay" onDrop={handleDrop} onDragOver={(e) => e.preventDefault()}>
          <div className="media-preview-modal">
            <div className="media-preview-header">
              <span>Vista previa</span>
              <button className="media-preview-close" onClick={handleCancel}><X size={18} /></button>
            </div>
            <div className="media-preview-img-wrap">
              <img src={preview.url} alt="Vista previa" className="media-preview-img" />
            </div>
            <input
              className="media-preview-caption"
              placeholder="Añadir pie de foto (opcional)..."
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSend()}
              maxLength={1024}
              autoFocus
            />
            {error && <p className="media-preview-error">{error}</p>}
            <div className="media-preview-actions">
              <button className="media-cancel-btn" onClick={handleCancel}>Cancelar</button>
              <button className="media-send-btn" onClick={handleSend} disabled={loading}>
                {loading ? <span className="media-spinner" /> : <><Send size={14} style={{ marginRight: 6 }} />Enviar</>}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default MediaUpload;
