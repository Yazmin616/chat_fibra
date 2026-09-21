-- =============================================================================
-- 042 - Catálogo completo de módulos del sistema
-- =============================================================================

INSERT INTO modulos(id, nombre, descripcion) VALUES
  ('comunicados',   'Avisos y Mural',          'Mural corporativo de avisos, efemérides y cumpleaños'),
  ('chat_interno',  'Chat Interno',            'Mensajería interna corporativa entre colaboradores'),
  ('chat',          'Chat Clientes',           'Panel de conversaciones y atención al cliente'),
  ('contactos',     'Contactos',               'Directorio de clientes'),
  ('infracciones',  'Infracciones',            'Registro de infracciones del equipo'),
  ('dashboard',     'Dashboard',               'Analíticas y métricas del sistema'),
  ('nps',           'Dashboard de Staff',      'Métricas de rendimiento y NPS del staff'),
  ('soluciones',    'Soluciones Staff',        'Historial de cierres y soluciones del staff'),
  ('usuarios',      'Usuarios',                'Gestión de agentes y cuentas'),
  ('configuracion', 'Configuración',           'Parámetros globales: jornadas, SLA, etc.'),
  ('etiquetas',     'Etiquetas',               'Catálogo de etiquetas para conversaciones'),
  ('notas_cierre',  'Notas de Cierre',         'Categorías de cierre de conversaciones'),
  ('equipos',       'Equipos',                 'Gestión de equipos y coordinadores de área'),
  ('tickets',       'Tickets / Soporte TI',    'Levantar y consultar solicitudes de soporte y tareas TI'),
  ('flujos',        'Flujos de Bot',           'Diseño y configuración de flujos automáticos del bot')
ON CONFLICT (id) DO UPDATE SET
  nombre = EXCLUDED.nombre,
  descripcion = EXCLUDED.descripcion;
