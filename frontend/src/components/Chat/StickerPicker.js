import React, { useCallback, useEffect, useRef, useState } from 'react';
import { apiService, resolveMedia } from '../../services/api';

const FAVS_KEY    = '__favorites__';
const MINE_PREFIX = 'agente_';

const StickerPicker = ({ onSelect, onClose, agenteId }) => {
  const [packs,      setPacks]      = useState([]);
  const [favorites,  setFavorites]  = useState(new Set());
  const [activePack, setActivePack] = useState(null);
  const [loading,    setLoading]    = useState(true);
  const panelRef = useRef(null);

  const myPack      = agenteId ? `${MINE_PREFIX}${agenteId}` : null;
  const isMyPack    = (pack) => pack === myPack;
  const isOtherPack = (pack) => pack.startsWith(MINE_PREFIX) && !isMyPack(pack);
  const packLabel   = (pack) => isMyPack(pack) ? '👤 Mis stickers' : pack;

  // ── Carga ───────────────────────────────────────────────────────────────────
  const cargar = useCallback(() => {
    Promise.all([
      apiService.getStickers().catch(() => []),
      agenteId
        ? apiService.getStickerFavoritos(agenteId).catch(() => [])
        : Promise.resolve([]),
    ]).then(([packsData, favsData]) => {
      const visible = (packsData || []).filter(p => !isOtherPack(p.pack));
      setPacks(visible);
      const favSet = new Set((favsData || []).map(f => `${f.pack}/${f.file}`));
      setFavorites(favSet);
      const hasMine = visible.some(p => isMyPack(p.pack));
      if (hasMine)          setActivePack(myPack);
      else if (favSet.size) setActivePack(FAVS_KEY);
      else                  setActivePack(visible[0]?.pack || null);
    }).finally(() => setLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [agenteId]);

  useEffect(() => { cargar(); }, [cargar]);

  // ── Cerrar al clic fuera ────────────────────────────────────────────────────
  useEffect(() => {
    const handler = (e) => {
      if (panelRef.current && !panelRef.current.contains(e.target)) onClose();
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [onClose]);

  // ── Toggle favorito (optimista) ─────────────────────────────────────────────
  const toggleFavorite = useCallback((e, pack, file) => {
    e.stopPropagation();
    if (!agenteId) return;
    const key   = `${pack}/${file}`;
    const isFav = favorites.has(key);
    setFavorites(prev => {
      const next = new Set(prev);
      if (isFav) next.delete(key); else next.add(key);
      return next;
    });
    const call = isFav
      ? apiService.removeStickerFavorito(agenteId, pack, file)
      : apiService.addStickerFavorito(agenteId, pack, file);
    call.catch(() => {
      setFavorites(prev => {
        const next = new Set(prev);
        if (isFav) next.add(key); else next.delete(key);
        return next;
      });
    });
  }, [agenteId, favorites]);

  // ── Eliminar sticker personal ───────────────────────────────────────────────
  const eliminarPersonal = useCallback(async (e, file) => {
    e.stopPropagation();
    if (!agenteId) return;
    try {
      await apiService.deletePersonalSticker(agenteId, file);
      setPacks(prev => prev.map(p =>
        isMyPack(p.pack) ? { ...p, files: p.files.filter(f => f !== file) } : p
      ));
      setFavorites(prev => {
        const next = new Set(prev);
        next.delete(`${myPack}/${file}`);
        return next;
      });
    } catch { /* silencioso */ }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [agenteId]);

  // ── Computed ────────────────────────────────────────────────────────────────
  const favItems = packs.flatMap(p =>
    p.files.filter(f => favorites.has(`${p.pack}/${f}`)).map(f => ({ pack: p.pack, file: f }))
  );
  const showFavsTab = favItems.length > 0;

  const activeItems = activePack === FAVS_KEY
    ? favItems
    : (packs.find(p => p.pack === activePack)?.files.map(f => ({
        pack: activePack, file: f,
      })) || []);

  // ── Mensaje vacío para "Mis stickers" cuando aún no se ha guardado ninguno ──
  const myPackEmpty = !loading && activePack === myPack &&
    !packs.find(p => isMyPack(p.pack))?.files?.length;

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div ref={panelRef} className="sticker-picker">

      {/* Tabs */}
      <div className="sticker-picker-tabs">
        {myPack && (
          <button
            className={`sticker-tab${activePack === myPack ? ' active' : ''}`}
            onClick={() => setActivePack(myPack)}
            title="Mis stickers guardados de clientes"
          >
            👤 Míos
          </button>
        )}
        {showFavsTab && (
          <button
            className={`sticker-tab${activePack === FAVS_KEY ? ' active' : ''}`}
            onClick={() => setActivePack(FAVS_KEY)}
          >
            ★ Favoritos
          </button>
        )}
        {packs.filter(p => !isMyPack(p.pack)).map(p => (
          <button
            key={p.pack}
            className={`sticker-tab${p.pack === activePack ? ' active' : ''}`}
            onClick={() => setActivePack(p.pack)}
          >
            {packLabel(p.pack)}
          </button>
        ))}
      </div>

      {/* Grid */}
      <div className="sticker-picker-grid">
        {loading && <div className="sticker-picker-empty">Cargando…</div>}

        {!loading && activePack === FAVS_KEY && !favItems.length && (
          <div className="sticker-picker-empty">
            Sin favoritos aún.
            <span className="sticker-picker-hint">Pasa el cursor sobre un sticker<br />y pulsa ♥ para guardar.</span>
          </div>
        )}

        {myPackEmpty && (
          <div className="sticker-picker-empty">
            Aún no tienes stickers guardados.
            <span className="sticker-picker-hint">Pasa el cursor sobre un sticker<br />que te envíe un cliente y pulsa ♡.</span>
          </div>
        )}

        {!loading && activeItems.map(({ pack, file }) => {
          const key      = `${pack}/${file}`;
          const isFav    = favorites.has(key);
          const personal = isMyPack(pack);
          return (
            <div
              key={key}
              className="sticker-cell"
              role="button"
              tabIndex={0}
              title={file.replace(/\.\w+$/, '')}
              onClick={() => { onSelect(pack, file); onClose(); }}
              onKeyDown={(e) => { if (e.key === 'Enter') { onSelect(pack, file); onClose(); } }}
            >
              <img
                src={resolveMedia(`st://${pack}/${file}`)}
                alt={file}
                loading="lazy"
                className="sticker-thumb"
              />
              {personal && (
                <button
                  className="sticker-del-btn"
                  onClick={(e) => eliminarPersonal(e, file)}
                  title="Eliminar sticker"
                >
                  ×
                </button>
              )}
              <button
                className={`sticker-fav-btn${isFav ? ' is-fav' : ''}`}
                onClick={(e) => toggleFavorite(e, pack, file)}
                title={isFav ? 'Quitar de favoritos' : 'Agregar a favoritos'}
              >
                {isFav ? '♥' : '♡'}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default StickerPicker;
