/**
 * @file ContactsView.js
 * @description Vista del directorio de clientes (contactos) del CRM.
 *
 * Responsabilidades:
 *   - Cargar y mostrar todos los usuarios que han interactuado con el sistema.
 *   - Búsqueda en tiempo real por nombre, username o teléfono.
 *   - Edición inline de nombre y teléfono de cada contacto.
 *   - Persistir los cambios a través de `apiService.updateContacto`.
 *
 * Uso:
 *   <ContactsView />   (sin props — obtiene sus propios datos)
 */

import React, { useState, useEffect, useCallback } from 'react';
import { apiService } from '../../services/api';
import { Search, Phone, User, Edit2, Check, X } from 'lucide-react';
import '../../styles/contacts.css';

/**
 * Vista sin props. Gestiona su propio estado de lista, búsqueda y edición inline.
 */
const ContactsView = () => {
  const [contacts, setContacts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({ nombre: "", telefono: "" });

  const fetchContacts = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiService.getContactos();
      setContacts(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error("Error fetching contacts:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  // Carga inicial
  useEffect(() => { fetchContacts(); }, [fetchContacts]);

  // Actualización en tiempo real: se dispara cuando llega un nuevo cliente o se elimina uno
  useEffect(() => {
    window.addEventListener('contactos:actualizar', fetchContacts);
    return () => window.removeEventListener('contactos:actualizar', fetchContacts);
  }, [fetchContacts]);

  const handleEdit = (contact) => {
    setEditingId(contact.id);
    setEditForm({ nombre: contact.nombre || "", telefono: contact.telefono || "" });
  };

  const handleSave = async (id) => {
    try {
      await apiService.updateContacto(id, editForm);
      setEditingId(null);
      fetchContacts();
    } catch (error) {
      console.error("Error saving contact:", error);
    }
  };

  const filteredContacts = contacts.filter(c => 
    (c.nombre || "").toLowerCase().includes(search.toLowerCase()) ||
    (c.username || "").toLowerCase().includes(search.toLowerCase()) ||
    (c.telefono || "").includes(search)
  );

  return (
    <div className="contacts-view-container">
      <div className="contacts-header">
        <h1>Contactos</h1>
        <p>Gestiona los clientes que han interactuado con el sistema.</p>
      </div>

      <div className="contacts-actions">
        <div className="contacts-search-box">
          <Search size={18} color="#94a3b8" />
          <input 
            type="text" 
            placeholder="Busca por nombre o teléfono..." 
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {loading ? (
        <div style={{ padding: '40px', textAlign: 'center', color: '#64748b' }}>Cargando contactos...</div>
      ) : (
        <>
          {/* TABLA DE ESCRITORIO / TABLET */}
          <div className="contacts-table-wrapper">
            <table className="contacts-table">
              <thead>
                <tr>
                  <th style={{ width: '40%' }}>Cliente</th>
                  <th style={{ width: '30%' }}>Teléfono</th>
                  <th style={{ width: '15%' }}>Canal</th>
                  <th style={{ width: '15%' }}>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {filteredContacts.map(contact => (
                  <tr key={contact.id}>
                    <td>
                      {editingId === contact.id ? (
                        <input 
                          type="text" 
                          value={editForm.nombre}
                          onChange={(e) => setEditForm({...editForm, nombre: e.target.value})}
                          style={{ padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px', width: '100%', outline: 'none' }}
                        />
                      ) : (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <div style={{ 
                            width: '32px', 
                            height: '32px', 
                            borderRadius: '50%', 
                            background: '#eff6ff', 
                            color: '#3b82f6',
                            display: 'flex', 
                            alignItems: 'center', 
                            justifyContent: 'center' 
                          }}>
                            <User size={16} />
                          </div>
                          <div>
                            <div style={{ fontWeight: '600', color: '#0f172a', fontSize: '13px' }}>{contact.nombre || contact.username || 'Sin nombre'}</div>
                          </div>
                        </div>
                      )}
                    </td>
                    <td>
                      {editingId === contact.id ? (
                        <input 
                          type="text" 
                          value={editForm.telefono}
                          onChange={(e) => setEditForm({...editForm, telefono: e.target.value})}
                          style={{ padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px', width: '100%', outline: 'none' }}
                        />
                      ) : (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#475569', fontSize: '13px' }}>
                          <Phone size={13} color="#64748b" />
                          {contact.telefono || 'No registrado'}
                        </div>
                      )}
                    </td>
                    <td>
                      <span style={{ 
                        padding: '4px 8px', 
                        borderRadius: '6px', 
                        background: contact.canal === 'telegram' ? '#e1f5fe' : '#e8f5e9',
                        color: contact.canal === 'telegram' ? '#039be5' : '#2e7d32',
                        fontSize: '11px',
                        fontWeight: '700',
                        textTransform: 'uppercase'
                      }}>
                        {contact.canal}
                      </span>
                    </td>
                    <td>
                      {editingId === contact.id ? (
                        <div style={{ display: 'flex', gap: '6px' }}>
                          <button onClick={() => handleSave(contact.id)} style={{ border: 'none', background: '#3b82f6', color: '#fff', padding: '6px', borderRadius: '6px', cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
                            <Check size={14} />
                          </button>
                          <button onClick={() => setEditingId(null)} style={{ border: 'none', background: '#ef4444', color: '#fff', padding: '6px', borderRadius: '6px', cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
                            <X size={14} />
                          </button>
                        </div>
                      ) : (
                        <button onClick={() => handleEdit(contact)} style={{ border: 'none', background: '#f1f5f9', color: '#475569', padding: '6px', borderRadius: '6px', cursor: 'pointer', transition: 'background 0.2s' }}>
                          <Edit2 size={14} />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* LISTA DE TARJETAS PARA MÓVILES */}
          <div className="contacts-mobile-list">
            {filteredContacts.map(contact => {
              const isEditing = editingId === contact.id;

              return (
                <div key={contact.id} className="contact-mobile-card">
                  <div className="contact-card-header">
                    <div className="contact-card-user">
                      <div className="contact-card-avatar">
                        <User size={16} />
                      </div>
                      
                      {isEditing ? (
                        <input 
                          type="text" 
                          className="contact-mobile-input"
                          value={editForm.nombre}
                          onChange={(e) => setEditForm({...editForm, nombre: e.target.value})}
                          placeholder="Nombre del Cliente"
                        />
                      ) : (
                        <span className="contact-card-name">
                          {contact.nombre || contact.username || 'Sin nombre'}
                        </span>
                      )}
                    </div>
                    
                    <span style={{ 
                      padding: '4px 8px', 
                      borderRadius: '6px', 
                      background: contact.canal === 'telegram' ? '#e1f5fe' : '#e8f5e9',
                      color: contact.canal === 'telegram' ? '#039be5' : '#2e7d32',
                      fontSize: '10px',
                      fontWeight: '700',
                      textTransform: 'uppercase',
                      marginLeft: '10px'
                    }}>
                      {contact.canal}
                    </span>
                  </div>

                  <div className="contact-card-body">
                    {isEditing ? (
                      <input 
                        type="text" 
                        className="contact-mobile-input"
                        value={editForm.telefono}
                        onChange={(e) => setEditForm({...editForm, telefono: e.target.value})}
                        placeholder="Teléfono"
                      />
                    ) : (
                      <div className="contact-card-phone">
                        <Phone size={13} color="#64748b" />
                        <span>{contact.telefono || 'No registrado'}</span>
                      </div>
                    )}
                  </div>

                  <div className="contact-card-actions">
                    {isEditing ? (
                      <>
                        <button 
                          onClick={() => handleSave(contact.id)} 
                          style={{ border: 'none', background: '#3b82f6', color: '#fff', padding: '6px 12px', borderRadius: '6px', cursor: 'pointer', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '4px' }}
                        >
                          <Check size={14} /> Guardar
                        </button>
                        <button 
                          onClick={() => setEditingId(null)} 
                          style={{ border: 'none', background: '#ef4444', color: '#fff', padding: '6px 12px', borderRadius: '6px', cursor: 'pointer', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '4px' }}
                        >
                          <X size={14} /> Cancelar
                        </button>
                      </>
                    ) : (
                      <button 
                        onClick={() => handleEdit(contact)} 
                        style={{ border: 'none', background: '#f1f5f9', color: '#475569', padding: '8px 16px', borderRadius: '6px', cursor: 'pointer', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '4px', fontWeight: '500' }}
                      >
                        <Edit2 size={13} /> Editar
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {!loading && filteredContacts.length === 0 && (
        <div style={{ padding: '40px', textAlign: 'center', color: '#64748b' }}>No se encontraron contactos.</div>
      )}
    </div>
  );
};

export default ContactsView;
