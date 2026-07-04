-- 027_flujo_bot_modulo.sql
-- Registra el módulo "flujo_bot" en el catálogo y lo otorga a todos los admins.

INSERT INTO modulos(id, nombre, descripcion)
VALUES ('flujo_bot', 'Flujo del Bot', 'Editor visual del flujo de conversación del bot')
ON CONFLICT (id) DO NOTHING;

-- Actualizar template de rol admin para incluir flujo_bot
UPDATE rol_permisos_template
SET modulos = modulos || '["flujo_bot"]'::jsonb
WHERE rol = 'admin'
  AND NOT (modulos @> '["flujo_bot"]'::jsonb);

-- Otorgar acceso a todos los admins existentes
INSERT INTO usuario_modulos(usuario_id, modulo)
SELECT a.id, 'flujo_bot'
FROM agentes a
WHERE a.rol = 'admin'
ON CONFLICT DO NOTHING;
