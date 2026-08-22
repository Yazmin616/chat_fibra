import React from 'react';
import { AlertTriangle, Trash2 } from 'lucide-react';

const ConfirmModal = ({
  isOpen,
  title = '¿Estás seguro?',
  message,
  confirmText = 'Confirmar',
  cancelText = 'Cancelar',
  isDanger = true,
  onConfirm,
  onCancel,
}) => {
  if (!isOpen) return null;

  return (
    <div className="ci-modal-backdrop" onClick={onCancel}>
      <div className="ci-confirm-modal-card" onClick={(e) => e.stopPropagation()}>
        <div className={`ci-confirm-icon-wrap ${isDanger ? 'danger' : 'info'}`}>
          {isDanger ? <Trash2 size={26} /> : <AlertTriangle size={26} />}
        </div>
        
        <h3 className="ci-confirm-title">{title}</h3>
        <p className="ci-confirm-message">{message}</p>

        <div className="ci-confirm-actions">
          <button type="button" className="ci-btn-secondary" onClick={onCancel}>
            {cancelText}
          </button>
          <button
            type="button"
            className={isDanger ? 'ci-btn-danger' : 'ci-btn-primary'}
            onClick={onConfirm}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConfirmModal;
