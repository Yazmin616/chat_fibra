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
    <div className="contacts-view-container" style={{ padding: '24px', maxWidth: '1200px', margin: '0 auto' }}>
      <div className="view-header" style={{ marginBottom: '24px' }}>
        <h1 style={{ fontSize: '24px', fontWeight: '700', color: '#111b21', margin: '0 0 8px 0' }}>Contactos</h1>
        <p style={{ color: '#667781', fontSize: '14px', margin: 0 }}>Gestiona los clientes que han interactuado con el sistema.</p>
      </div>

      <div className="contacts-actions" style={{ marginBottom: '20px' }}>
        <div className="search-box" style={{ 
          display: 'flex', 
          alignItems: 'center', 
          gap: '10px', 
          background: '#fff', 
          padding: '10px 16px', 
          borderRadius: '12px',
          border: '1px solid #e9edef',
          maxWidth: '400px'
        }}>
          <Search size={18} color="#54656f" />
          <input 
            type="text" 
            placeholder="Busca por nombre o teléfono..." 
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ border: 'none', outline: 'none', width: '100%', fontSize: '14px' }}
          />
        </div>
      </div>

      <div className="contacts-table-container" style={{
        background: '#fff',
        borderRadius: '16px',
        border: '1px solid #e9edef',
        overflow: 'auto',
        boxShadow: '0 2px 5px rgba(0,0,0,0.05)'
      }}>
        {loading ? (
          <div style={{ padding: '40px', textAlign: 'center', color: '#667781' }}>Cargando contactos...</div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead>
              <tr style={{ background: '#f8f9fa', borderBottom: '1px solid #e9edef' }}>
                <th style={{ padding: '16px', fontSize: '12px', fontWeight: '700', color: '#54656f', textTransform: 'uppercase' }}>Cliente</th>
                <th style={{ padding: '16px', fontSize: '12px', fontWeight: '700', color: '#54656f', textTransform: 'uppercase' }}>Teléfono</th>
                <th style={{ padding: '16px', fontSize: '12px', fontWeight: '700', color: '#54656f', textTransform: 'uppercase' }}>Canal</th>
                <th style={{ padding: '16px', fontSize: '12px', fontWeight: '700', color: '#54656f', textTransform: 'uppercase' }}>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {filteredContacts.map(contact => (
                <tr key={contact.id} style={{ borderBottom: '1px solid #f2f2f2' }}>
                  <td style={{ padding: '16px' }}>
                    {editingId === contact.id ? (
                      <input 
                        type="text" 
                        value={editForm.nombre}
                        onChange={(e) => setEditForm({...editForm, nombre: e.target.value})}
                        style={{ padding: '6px', borderRadius: '4px', border: '1px solid #dc2626', fontSize: '14px', width: '100%' }}
                      />
                    ) : (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div style={{ 
                          width: '32px', 
                          height: '32px', 
                          borderRadius: '50%', 
                          background: '#e9edef', 
                          display: 'flex', 
                          alignItems: 'center', 
                          justifyContent: 'center' 
                        }}>
                          <User size={16} color="#54656f" />
                        </div>
                        <div>
                          <div style={{ fontWeight: '600', color: '#111b21', fontSize: '14px' }}>{contact.nombre || contact.username || 'Sin nombre'}</div>
                        </div>
                      </div>
                    )}
                  </td>
                  <td style={{ padding: '16px' }}>
                    {editingId === contact.id ? (
                      <input 
                        type="text" 
                        value={editForm.telefono}
                        onChange={(e) => setEditForm({...editForm, telefono: e.target.value})}
                        style={{ padding: '6px', borderRadius: '4px', border: '1px solid #dc2626', fontSize: '14px', width: '100%' }}
                      />
                    ) : (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#54656f', fontSize: '14px' }}>
                        <Phone size={14} />
                        {contact.telefono || 'No registrado'}
                      </div>
                    )}
                  </td>
                  <td style={{ padding: '16px' }}>
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
                  <td style={{ padding: '16px' }}>
                    {editingId === contact.id ? (
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <button onClick={() => handleSave(contact.id)} style={{ border: 'none', background: '#dc2626', color: '#fff', padding: '6px', borderRadius: '6px', cursor: 'pointer' }}>
                          <Check size={16} />
                        </button>
                        <button onClick={() => setEditingId(null)} style={{ border: 'none', background: '#ea4335', color: '#fff', padding: '6px', borderRadius: '6px', cursor: 'pointer' }}>
                          <X size={16} />
                        </button>
                      </div>
                    ) : (
                      <button onClick={() => handleEdit(contact)} style={{ border: 'none', background: 'transparent', color: '#54656f', padding: '6px', borderRadius: '6px', cursor: 'pointer', transition: 'background 0.2s' }}>
                        <Edit2 size={16} />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {!loading && filteredContacts.length === 0 && (
          <div style={{ padding: '40px', textAlign: 'center', color: '#667781' }}>No se encontraron contactos.</div>
        )}
      </div>
    </div>
  );
};

export default ContactsView;
