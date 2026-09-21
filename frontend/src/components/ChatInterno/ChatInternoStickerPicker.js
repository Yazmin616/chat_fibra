import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Smile, Sparkles, Star, Plus, Trash2, Heart } from 'lucide-react';
import { apiService, resolveMedia } from '../../services/api';
import data from '@emoji-mart/data/sets/15/apple.json';
import Picker from '@emoji-mart/react';

const FAVS_KEY = '__favorites__';
const MINE_PREFIX = 'agente_';

const ChatInternoStickerPicker = ({
  agenteId,
  onSelectEmoji,
  onSelectSticker,
  onOpenMaker,
  onClose
}) => {
  const [activeTab, setActiveTab] = useState('stickers'); // 'emojis' | 'stickers'
  const [packs, setPacks] = useState([]);
  const [favorites, setFavorites] = useState(new Set());
  const [favList, setFavList] = useState([]);
  const [activePack, setActivePack] = useState(FAVS_KEY);
  const [loading, setLoading] = useState(false);
  const panelRef = useRef(null);

  const myPack = agenteId ? `${MINE_PREFIX}${agenteId}` : null;
  const isMyPack = useCallback((pack) => pack === myPack, [myPack]);
  const isOtherPack = useCallback((pack) => pack.startsWith(MINE_PREFIX) && pack !== myPack, [myPack]);

  // Cerrar al hacer clic fuera
  useEffect(() => {
    const handleOutside = (e) => {
      if (panelRef.current && !panelRef.current.contains(e.target)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, [onClose]);

  // Cargar packs de stickers y favoritos
  const cargarStickers = useCallback(() => {
    setLoading(true);
    Promise.all([
      apiService.getStickers().catch(() => []),
      agenteId ? apiService.getStickerFavoritos(agenteId).catch(() => []) : Promise.resolve([]),
    ])
      .then(([packsData, favsData]) => {
        const visible = (packsData || []).filter(p => !isOtherPack(p.pack));
        setPacks(visible);
        const validFavs = (favsData || []).filter(f => f && f.pack && f.file);
        setFavList(validFavs);
        const favSet = new Set(validFavs.map(f => `${f.pack}/${f.file}`));
        setFavorites(favSet);
      })
      .finally(() => setLoading(false));
  }, [agenteId, isOtherPack]);

  useEffect(() => {
    cargarStickers();
    const handleActualizados = () => cargarStickers();
    window.addEventListener('sticker:favoritos_actualizados', handleActualizados);
    return () => window.removeEventListener('sticker:favoritos_actualizados', handleActualizados);
  }, [cargarStickers]);

  // Toggle favorito
  const toggleFavorite = useCallback((e, pack, file) => {
    e.stopPropagation();
    if (!agenteId) return;
    const key = `${pack}/${file}`;
    const isFav = favorites.has(key);
    setFavorites(prev => {
      const next = new Set(prev);
      if (isFav) next.delete(key); else next.add(key);
      return next;
    });
    setFavList(prev => {
      if (isFav) {
        return prev.filter(item => !(item.pack === pack && item.file === file));
      } else {
        return [{ pack, file }, ...prev];
      }
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
      setFavList(prev => {
        if (isFav) {
          return [{ pack, file }, ...prev];
        } else {
          return prev.filter(item => !(item.pack === pack && item.file === file));
        }
      });
    });
  }, [agenteId, favorites]);

  // Eliminar sticker personal
  const eliminarPersonal = useCallback(async (e, file) => {
    e.stopPropagation();
    if (!agenteId) return;
    try {
      await apiService.deletePersonalSticker(agenteId, file);
      setPacks(prev =>
        prev.map(p =>
          isMyPack(p.pack) ? { ...p, files: p.files.filter(f => f !== file) } : p
        )
      );
      setFavorites(prev => {
        const next = new Set(prev);
        next.delete(`${myPack}/${file}`);
        return next;
      });
      setFavList(prev => prev.filter(item => !(item.pack === myPack && item.file === file)));
    } catch {}
  }, [agenteId, myPack, isMyPack]);

  const favItems = favList;

  const activeItems = activePack === FAVS_KEY
    ? favItems
    : (packs.find(p => p.pack === activePack)?.files.map(f => ({
        pack: activePack,
        file: f,
      })) || []);

  return (
    <div ref={panelRef} className={`wa-stk-popover ${activeTab === 'emojis' ? 'emojis-active' : ''}`}>
      {/* Selector de modo: Emojis vs Stickers */}
      <div className="wa-stk-popover-mode-bar">
        <button
          type="button"
          className={`wa-stk-mode-tab ${activeTab === 'stickers' ? 'active' : ''}`}
          onClick={() => setActiveTab('stickers')}
        >
          <Sparkles size={16} />
          <span>Stickers</span>
        </button>

        <button
          type="button"
          className={`wa-stk-mode-tab ${activeTab === 'emojis' ? 'active' : ''}`}
          onClick={() => setActiveTab('emojis')}
        >
          <Smile size={16} />
          <span>Emojis</span>
        </button>

        {activeTab === 'stickers' && (
          <button
            type="button"
            className="wa-stk-create-shortcut-btn"
            onClick={() => {
              onClose();
              if (onOpenMaker) onOpenMaker();
            }}
            title="Crear un sticker nuevo"
          >
            <Plus size={15} />
            <span>Crear</span>
          </button>
        )}
      </div>

      {/* Contenido Emojis con Emoji Mart */}
      {activeTab === 'emojis' && (
        <div className="wa-stk-emojis-mart-wrap">
          <Picker
            data={data}
            set="apple"
            onEmojiSelect={(emoji) => {
              if (onSelectEmoji) onSelectEmoji(emoji.native || emoji.shortcodes);
            }}
            locale="es"
            theme={document.querySelector('.chat-dark') ? 'dark' : 'light'}
            previewPosition="none"
            skinTonePosition="none"
            searchPosition="sticky"
            navPosition="top"
            perLine={8}
            maxFrequentRows={2}
          />
        </div>
      )}

      {/* Contenido Stickers */}
      {activeTab === 'stickers' && (
        <div className="wa-stk-content-wrap">
          {/* Subpestañas de Packs */}
          <div className="wa-stk-packs-bar">
            <button
              type="button"
              className={`wa-stk-pack-pill ${activePack === FAVS_KEY ? 'active' : ''}`}
              onClick={() => setActivePack(FAVS_KEY)}
              title="Favoritos"
            >
              <Star size={14} fill={activePack === FAVS_KEY ? 'currentColor' : 'none'} />
              <span>Favoritos</span>
            </button>

            {myPack && (
              <button
                type="button"
                className={`wa-stk-pack-pill ${activePack === myPack ? 'active' : ''}`}
                onClick={() => setActivePack(myPack)}
                title="Mis stickers"
              >
                <span>Mis Stickers</span>
              </button>
            )}

            {packs.filter(p => !isMyPack(p.pack)).map(p => (
              <button
                key={p.pack}
                type="button"
                className={`wa-stk-pack-pill ${activePack === p.pack ? 'active' : ''}`}
                onClick={() => setActivePack(p.pack)}
              >
                {p.pack}
              </button>
            ))}
          </div>

          {/* Grid de Stickers */}
          <div className="wa-stk-grid">
            {loading && <div className="wa-stk-empty">Cargando stickers...</div>}

            {!loading && activePack === FAVS_KEY && !favItems.length && (
              <div className="wa-stk-empty">
                No tienes stickers favoritos aún.
                <span className="wa-stk-hint">Pasa el ratón sobre un sticker y pulsa ♥ para guardarlo.</span>
              </div>
            )}

            {!loading && activePack === myPack && !activeItems.length && (
              <div className="wa-stk-empty">
                Aún no tienes stickers creados.
                <button
                  type="button"
                  className="wa-stk-empty-create-btn"
                  onClick={() => {
                    onClose();
                    if (onOpenMaker) onOpenMaker();
                  }}
                >
                  <Plus size={16} /> Crear mi primer sticker
                </button>
              </div>
            )}

            {!loading && activeItems.map(({ pack, file }) => {
              const key = `${pack}/${file}`;
              const isFav = favorites.has(key);
              const personal = isMyPack(pack);
              return (
                <div
                  key={key}
                  className="wa-stk-cell"
                  onClick={() => {
                    if (onSelectSticker) onSelectSticker(pack, file);
                    onClose();
                  }}
                  title={file.replace(/\.\w+$/, '')}
                >
                  <img
                    src={resolveMedia(`st://${pack}/${file}`)}
                    alt={file}
                    loading="lazy"
                    className="wa-stk-thumb"
                  />
                  {personal && (
                    <button
                      type="button"
                      className="wa-stk-del-btn"
                      onClick={(e) => eliminarPersonal(e, file)}
                      title="Eliminar de mis stickers"
                    >
                      <Trash2 size={13} />
                    </button>
                  )}
                  <button
                    type="button"
                    className={`wa-stk-fav-btn ${isFav ? 'is-fav' : ''}`}
                    onClick={(e) => toggleFavorite(e, pack, file)}
                    title={isFav ? 'Quitar de favoritos' : 'Agregar a favoritos'}
                  >
                    <Heart size={14} fill={isFav ? '#ea0038' : 'none'} color={isFav ? '#ea0038' : '#8696a0'} />
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

export default ChatInternoStickerPicker;
