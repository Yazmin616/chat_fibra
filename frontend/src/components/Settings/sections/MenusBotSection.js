import React, { useState, useEffect, useRef } from 'react';
import { Menu, Info, Smile } from 'lucide-react';
import { apiService } from '../../../services/api';
import data from '@emoji-mart/data';
import Picker from '@emoji-mart/react';

// Un componente interno para manejar el input y el emoji picker
const MenuButtonEditor = ({ value, onChange, onSave, onCancel, saving }) => {
  const [showPicker, setShowPicker] = useState(false);
  const inputRef = useRef(null);

  const addEmoji = (e) => {
    const sym = e.unified.split('-');
    const codesArray = [];
    sym.forEach(el => codesArray.push('0x' + el));
    const emoji = String.fromCodePoint(...codesArray);
    
    onChange(value + emoji);
    setShowPicker(false);
    if (inputRef.current) inputRef.current.focus();
  };

  return (
    <div style={{ background: '#fdfdfd', padding: '15px', border: '1px solid #e2e8f0', borderRadius: '6px', marginTop: '10px' }}>
      <div style={{ display: 'flex', gap: '10px', alignItems: 'center', position: 'relative' }}>
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          style={{ flex: 1, padding: '10px', border: '1px solid #ccc', borderRadius: '4px', fontSize: '14px' }}
        />
        <button
          onClick={() => setShowPicker(!showPicker)}
          style={{ background: '#f1f5f9', border: '1px solid #cbd5e1', padding: '8px', borderRadius: '4px', cursor: 'pointer', color: '#475569' }}
          title="Añadir Emoji"
        >
          <Smile size={18} />
        </button>
        
        {showPicker && (
          <div style={{ position: 'absolute', top: '45px', right: 0, zIndex: 100, boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1)' }}>
            <Picker data={data} onEmojiSelect={addEmoji} locale="es" />
          </div>
        )}
      </div>
      
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
        <button
          onClick={onCancel}
          disabled={saving}
          style={{ padding: '6px 12px', border: '1px solid #ccc', background: 'white', borderRadius: '4px', cursor: 'pointer', fontSize: '13px' }}
        >
          Cancelar
        </button>
        <button
          onClick={onSave}
          disabled={saving}
          className="btn-save"
          style={{ margin: 0 }}
        >
          {saving ? 'Guardando...' : 'Guardar cambios'}
        </button>
      </div>
    </div>
  );
};

const MenusBotSection = ({ empresaId }) => {
  const [menus, setMenus] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  const [editingKey, setEditingKey] = useState(null); // formato: "MENU_ID::BUTTON_ID"
  const [editTexto, setEditTexto] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchMenus();
  }, [empresaId]);

  const fetchMenus = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await apiService.getMenusBot(empresaId);
      setMenus(data);
    } catch (err) {
      console.error('Error fetching menus:', err);
      setError('No se pudieron cargar los menús del bot.');
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (menuId, buttonId, textoActual) => {
    setEditingKey(`${menuId}::${buttonId}`);
    setEditTexto(textoActual);
  };

  const handleCancel = () => {
    setEditingKey(null);
    setEditTexto('');
  };

  const handleSave = async (menuId, buttonId, newTexto, newActivo) => {
    try {
      setSaving(true);
      await apiService.updateMenuBotButton(menuId, buttonId, newTexto, newActivo, empresaId);
      
      setMenus(prev => prev.map(m => {
        if (m.menu_id === menuId) {
          const newButtons = m.buttons.map(b => 
            b.button_id === buttonId ? { ...b, texto: newTexto, activo: newActivo, es_personalizado: true } : b
          );
          return { ...m, buttons: newButtons };
        }
        return m;
      }));
      
      setEditingKey(null);
    } catch (err) {
      console.error('Error saving menu button:', err);
      alert('Error al guardar el botón: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const toggleVisibility = async (menuId, btn) => {
    const newActivo = !btn.activo;
    await handleSave(menuId, btn.button_id, btn.texto, newActivo);
  };

  if (loading) return <div style={{ padding: '20px', color: '#666' }}>Cargando menús...</div>;
  if (error) return <div style={{ padding: '20px', color: 'red' }}>{error}</div>;

  return (
    <div className="cfg-section-wrap">
      <div className="cfg-section-header">
        <h2>
          <span className="cfg-section-icon-h"><Menu size={20} /></span> 
          Menús Interactivos de WhatsApp
        </h2>
        <p>
          Personaliza los textos y emojis de los botones que el bot envía a los clientes para interactuar.
        </p>
      </div>

      <div className="sc-alert sc-alert--info" style={{ marginBottom: 20 }}>
        <Info size={14} style={{ verticalAlign: 'middle', marginRight: 5, flexShrink: 0 }} />
        Para mantener la estabilidad del bot, puedes editar el texto o apagar (ocultar) opciones, pero no puedes crear botones nuevos.
      </div>

      <div className="settings-card sc-card" style={{ gap: 0, padding: 0 }}>
        {menus.map((menu, index) => (
          <div key={menu.menu_id} className="setting-item sc-row" style={{ padding: '20px', borderBottom: '1px solid #eee', display: 'block' }}>
            
            <div style={{ marginBottom: '15px' }}>
              <h3 style={{ margin: '0 0 5px 0', fontSize: '16px', color: '#0f172a' }}>{menu.menu_id}</h3>
              <p style={{ margin: 0, fontSize: '13px', color: '#64748b' }}>{menu.descripcion}</p>
            </div>

            <div style={{ display: 'grid', gap: '10px' }}>
              {menu.buttons.map(btn => {
                const isEditing = editingKey === `${menu.menu_id}::${btn.button_id}`;
                const opacity = btn.activo ? 1 : 0.5;
                
                return (
                  <div key={btn.button_id} style={{ padding: '10px 15px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '6px', opacity }}>
                    
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <span style={{ fontSize: '14px', fontWeight: '500', color: btn.activo ? '#334155' : '#94a3b8', textDecoration: btn.activo ? 'none' : 'line-through' }}>
                          {isEditing ? 'Editando...' : btn.texto}
                        </span>
                        {!btn.activo && (
                          <span style={{ fontSize: '10px', backgroundColor: '#f1f5f9', color: '#64748b', padding: '2px 6px', borderRadius: '10px', fontWeight: 'bold' }}>
                            Oculto
                          </span>
                        )}
                        {btn.es_personalizado && btn.activo && !isEditing && (
                          <span style={{ fontSize: '10px', backgroundColor: '#e0f2fe', color: '#0369a1', padding: '2px 6px', borderRadius: '10px', fontWeight: 'bold' }}>
                            Editado
                          </span>
                        )}
                      </div>
                      
                      {!isEditing && (
                        <div style={{ display: 'flex', gap: '8px' }}>
                          <button 
                            onClick={() => toggleVisibility(menu.menu_id, btn)}
                            style={{ background: 'none', border: '1px solid #cbd5e1', padding: '4px 10px', borderRadius: '4px', cursor: 'pointer', fontSize: '12px', color: '#64748b' }}
                          >
                            {btn.activo ? 'Ocultar' : 'Mostrar'}
                          </button>
                          <button 
                            onClick={() => handleEdit(menu.menu_id, btn.button_id, btn.texto)}
                            style={{ background: 'none', border: '1px solid #cbd5e1', padding: '4px 10px', borderRadius: '4px', cursor: 'pointer', fontSize: '12px', color: '#64748b' }}
                            disabled={!btn.activo}
                          >
                            Modificar
                          </button>
                        </div>
                      )}
                    </div>

                    {isEditing && (
                      <MenuButtonEditor
                        value={editTexto}
                        onChange={setEditTexto}
                        onCancel={handleCancel}
                        onSave={() => handleSave(menu.menu_id, btn.button_id, editTexto, btn.activo)}
                        saving={saving}
                      />
                    )}
                  </div>
                );
              })}
            </div>
            
          </div>
        ))}
      </div>
    </div>
  );
};

export default MenusBotSection;
