import React from 'react';
import EquiposView from '../../Equipos/EquiposView';

const EquiposSection = ({ empresaId, user }) => {
  return (
    <div style={{ padding: '4px 0', width: '100%' }}>
      <EquiposView empresaId={empresaId} user={user} isSettingsSection={true} />
    </div>
  );
};

export default EquiposSection;
