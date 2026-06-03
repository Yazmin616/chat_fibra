-- =============================================================================
-- ESQUEMA DE BASE DE DATOS — CRM Fibratec / ISP Chatbot
-- =============================================================================
-- Sistema multi-empresa de gestión de conversaciones vía chatbot (Telegram,
-- WhatsApp, Facebook, Instagram) con panel CRM para agentes humanos.
--
-- Motor:      PostgreSQL 18
-- Encoding:   UTF-8
-- Creado:     Mayo 2026
--
-- TABLAS:
--   empresas         → Empresas registradas en el sistema (Fibratec, Compusemmm, etc.)
--   usuarios         → Clientes que interactúan con el chatbot
--   agentes          → Operadores humanos del CRM
--   conversaciones   → Sesiones de atención (bot o agente humano)
--   mensajes         → Mensajes individuales de cada conversación
--   calificaciones   → Encuestas CSAT enviadas al cliente al cerrar un chat
--   configuraciones  → Parámetros configurables por empresa (tiempos, textos, etc.)
--   infracciones     → Registros de SLA incumplidos (tiempo de espera excedido)
--
-- DISEÑO MULTI-EMPRESA:
--   Todas las empresas comparten las mismas tablas. El aislamiento se logra
--   mediante el campo empresa_id presente en conversaciones, configuraciones
--   e infracciones. No se crean tablas separadas por empresa.
-- =============================================================================

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;
SET default_tablespace = '';
SET default_table_access_method = heap;


-- =============================================================================
-- TABLA: empresas
-- =============================================================================
-- Catálogo de empresas registradas en el sistema.
-- Actúa como tabla maestra referenciada por conversaciones y configuraciones.
-- Agregar una nueva empresa = insertar un registro aquí. No requiere cambios
-- en el código ni en otras tablas.
--
-- Ejemplos de registros:
--   ('fibratec',   'Fibratec')
--   ('compusemmm', 'Compusemmm')
-- =============================================================================
CREATE TABLE public.empresas (
    id      character varying(10) NOT NULL,  -- Identificador corto único (ej. "fibratec")
    nombre  text                  NOT NULL   -- Nombre completo para mostrar en la UI
);


-- =============================================================================
-- TABLA: usuarios
-- =============================================================================
-- Clientes que han interactuado con alguno de los chatbots del sistema.
-- Un mismo usuario puede tener conversaciones con múltiples empresas.
-- Se crea automáticamente la primera vez que el cliente escribe al bot.
--
-- El campo external_id almacena el ID del usuario en la plataforma de origen
-- (Telegram user_id, WhatsApp phone, Facebook PSID, etc.).
-- La combinación (canal + external_id) identifica unívocamente a un usuario.
-- =============================================================================
CREATE TABLE public.usuarios (
    id          integer                     NOT NULL,
    canal       character varying(20),               -- Plataforma: "telegram", "whatsapp", "facebook", "instagram"
    external_id character varying(50),               -- ID del usuario en la plataforma (ej. Telegram user_id)
    nombre      text,                                -- Nombre real o nombre de perfil
    username    text,                                -- Alias/username de la plataforma (ej. @usuario en Telegram)
    telefono    text,                                -- Número de teléfono si está disponible
    created_at  timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);

CREATE SEQUENCE public.usuarios_id_seq
    AS integer START WITH 1 INCREMENT BY 1 NO MINVALUE NO MAXVALUE CACHE 1;

ALTER SEQUENCE public.usuarios_id_seq OWNED BY public.usuarios.id;
ALTER TABLE ONLY public.usuarios ALTER COLUMN id SET DEFAULT nextval('public.usuarios_id_seq'::regclass);


-- =============================================================================
-- TABLA: agentes
-- =============================================================================
-- Operadores humanos que atienden los chats desde el panel CRM.
-- Tienen rol "admin" (acceso total) o "asesor" (acceso restringido a su área).
--
-- Roles:
--   admin  → Ve todas las conversaciones de todas las empresas y áreas.
--            Accede a dashboard, configuración, gestión de agentes e infracciones.
--   asesor → Solo ve las conversaciones de su área (departamento).
--            No tiene acceso a configuración ni gestión de agentes.
--
-- Áreas disponibles: "Ventas", "Cobranza", "Soporte Técnico"
-- =============================================================================
CREATE TABLE public.agentes (
    id          integer                     NOT NULL,
    nombre      character varying(100)      NOT NULL,  -- Nombre completo del agente
    email       character varying(100)      NOT NULL,  -- Email para login (único en el sistema)
    password    text                        NOT NULL,  -- Contraseña hasheada con bcrypt
    rol         character varying(20)       DEFAULT 'asesor'::character varying,  -- "admin" o "asesor"
    area        character varying(50),                 -- Departamento asignado (solo para asesores)
    esta_online boolean                     DEFAULT false, -- true cuando tiene sesión activa en el CRM
    last_seen   timestamp with time zone,              -- Última vez que el heartbeat confirmó actividad
    created_at  timestamp without time zone DEFAULT now()
);

CREATE SEQUENCE public.agentes_id_seq
    AS integer START WITH 1 INCREMENT BY 1 NO MINVALUE NO MAXVALUE CACHE 1;

ALTER SEQUENCE public.agentes_id_seq OWNED BY public.agentes.id;
ALTER TABLE ONLY public.agentes ALTER COLUMN id SET DEFAULT nextval('public.agentes_id_seq'::regclass);


-- =============================================================================
-- TABLA: conversaciones
-- =============================================================================
-- Representa una sesión de atención entre un usuario y el sistema.
-- Puede ser atendida por el bot automáticamente o derivada a un agente humano.
--
-- Ciclo de vida de estados:
--   abierta → SELECCION_EMPRESA → SELECCION_AREA → ESPERANDO_AGENTE
--   → atendiendo → ENCUESTA_AGENTE | ENCUESTA_BOT → cerrada
--
-- Estados de menú del bot (no se muestran en el CRM):
--   abierta, MENU_PRINCIPAL, SELECCION_EMPRESA, SELECCION_AREA
--
-- Estados visibles en el CRM:
--   ESPERANDO_AGENTE → en cola, sin agente asignado
--   atendiendo       → asignada a un agente, en curso
--   ENCUESTA_AGENTE  → el agente cerró el chat, se envió encuesta CSAT al cliente
--   ENCUESTA_BOT     → el bot cerró la sesión, encuesta enviada
--   cerrada          → proceso finalizado
--
-- El campo es_humano=true indica que la conversación requiere o está siendo
-- atendida por un agente humano (no es flujo de menú puro del bot).
-- =============================================================================
CREATE TABLE public.conversaciones (
    id            integer                     NOT NULL,
    usuario_id    integer,                             -- FK → usuarios.id
    empresa_id    character varying(20),               -- FK → empresas.id (ej. "fibratec")
    departamento  character varying(50),               -- Área seleccionada: "Ventas", "Cobranza", "Soporte Técnico"
    agente_id     integer,                             -- FK → agentes.id (NULL si aún no fue asignada)
    estado        character varying(50),               -- Estado actual del ciclo de vida
    es_humano     boolean                     DEFAULT false, -- true = requiere o está siendo atendida por humano
    motivo_cierre text,                                -- Razón del cierre ingresada por el agente
    cerrado_por   text,                                -- Nombre del agente que cerró el chat
    contexto      jsonb,                               -- Estado interno del bot (variables de sesión)
    created_at    timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at    timestamp without time zone DEFAULT now() -- Se actualiza en cada mensaje o cambio de estado
);

CREATE SEQUENCE public.conversaciones_id_seq
    AS integer START WITH 1 INCREMENT BY 1 NO MINVALUE NO MAXVALUE CACHE 1;

ALTER SEQUENCE public.conversaciones_id_seq OWNED BY public.conversaciones.id;
ALTER TABLE ONLY public.conversaciones ALTER COLUMN id SET DEFAULT nextval('public.conversaciones_id_seq'::regclass);


-- =============================================================================
-- TABLA: mensajes
-- =============================================================================
-- Almacena cada mensaje individual de todas las conversaciones del sistema.
-- Es la tabla con mayor volumen de datos — todos los chats de todas las
-- empresas se guardan aquí, diferenciados por conversacion_id.
--
-- Tipos de remitente:
--   user            → Mensaje enviado por el cliente desde Telegram/WhatsApp/etc.
--   bot             → Respuesta automática generada por el chatbot
--   agente          → Mensaje enviado manualmente por un operador del CRM
--   sistema_info    → Banner informativo del sistema (ej. "Cliente en espera desde hace 5 min")
--   sistema_success → Banner de cierre exitoso de chat
--
-- Tipos de contenido (campo tipo):
--   text    → Mensaje de texto plano
--   sticker → Sticker/emoji enviado por el cliente (url_media contiene la URL)
-- =============================================================================
CREATE TABLE public.mensajes (
    id               integer                     NOT NULL,
    conversacion_id  integer,                             -- FK → conversaciones.id
    remitente        character varying(30),               -- Origen: "user", "bot", "agente", "sistema_info", "sistema_success"
    texto            text,                                -- Contenido del mensaje
    tipo             character varying(20)       DEFAULT 'text'::character varying, -- "text" o "sticker"
    url_media        text,                                -- URL del archivo de media (stickers, imágenes)
    leido            boolean                     DEFAULT false, -- true cuando el agente abrió la conversación
    created_at       timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);

CREATE SEQUENCE public.mensajes_id_seq
    AS integer START WITH 1 INCREMENT BY 1 NO MINVALUE NO MAXVALUE CACHE 1;

ALTER SEQUENCE public.mensajes_id_seq OWNED BY public.mensajes.id;
ALTER TABLE ONLY public.mensajes ALTER COLUMN id SET DEFAULT nextval('public.mensajes_id_seq'::regclass);


-- =============================================================================
-- TABLA: calificaciones
-- =============================================================================
-- Encuestas CSAT (Customer Satisfaction) enviadas al cliente al cerrar un chat.
-- El bot envía automáticamente la encuesta cuando un agente cierra la conversación.
--
-- Puntuaciones posibles:
--   "excelente", "bueno", "regular", "malo"  (o equivalentes numéricos según config)
--
-- Tipos:
--   "agente" → calificación al agente humano que atendió
--   "bot"    → calificación a la atención automática del bot
-- =============================================================================
CREATE TABLE public.calificaciones (
    id               integer                     NOT NULL,
    conversacion_id  integer,                             -- FK → conversaciones.id
    puntuacion       character varying(20),               -- Valor de la calificación
    sugerencia       text,                                -- Comentario libre del cliente (opcional)
    tipo             character varying(20),               -- "agente" o "bot"
    created_at       timestamp without time zone DEFAULT now()
);

CREATE SEQUENCE public.calificaciones_id_seq
    AS integer START WITH 1 INCREMENT BY 1 NO MINVALUE NO MAXVALUE CACHE 1;

ALTER SEQUENCE public.calificaciones_id_seq OWNED BY public.calificaciones.id;
ALTER TABLE ONLY public.calificaciones ALTER COLUMN id SET DEFAULT nextval('public.calificaciones_id_seq'::regclass);


-- =============================================================================
-- TABLA: configuraciones
-- =============================================================================
-- Parámetros configurables del sistema, separados por empresa.
-- Permite personalizar el comportamiento del bot y el CRM sin tocar el código.
--
-- Ejemplos de configuraciones:
--   clave: "tiempo_inactividad"  valor: "10"   → minutos sin actividad para auto-cerrar chat
--   clave: "mensaje_bienvenida"  valor: "Hola" → texto de bienvenida del bot
--
-- La clave + empresa_id forman la clave única (un parámetro puede tener valores
-- distintos para cada empresa).
-- =============================================================================
CREATE TABLE public.configuraciones (
    clave      character varying(50)  NOT NULL,           -- Nombre del parámetro
    valor      character varying(255),                    -- Valor del parámetro
    empresa_id character varying(20)  DEFAULT 'fibratec'::character varying -- FK → empresas.id
);


-- =============================================================================
-- TABLA: infracciones
-- =============================================================================
-- Registro de incumplimientos de SLA: conversaciones que estuvieron en estado
-- ESPERANDO_AGENTE más tiempo del permitido sin ser atendidas.
-- Solo visible para usuarios con rol "admin".
--
-- Tipos de infracción:
--   "area"   → Ningún agente del área atendió a tiempo
--   "agente" → El agente asignado tardó demasiado en responder
--
-- El campo tiempo_espera almacena los minutos reales de espera al momento
-- de registrarse la infracción.
-- =============================================================================
CREATE TABLE public.infracciones (
    id               integer                     NOT NULL,
    conversacion_id  integer,                             -- FK → conversaciones.id (CASCADE DELETE)
    empresa_id       character varying           NOT NULL, -- Empresa a la que pertenece la conversación
    departamento     character varying,                   -- Área que incumplió el SLA
    cliente_nombre   character varying,                   -- Nombre del cliente afectado
    agente_id        integer,                             -- FK → agentes.id (NULL si no había agente asignado)
    agente_nombre    character varying,                   -- Nombre del agente al momento de la infracción
    tiempo_espera    integer                     NOT NULL, -- Minutos que el cliente esperó sin ser atendido
    tipo             character varying           DEFAULT 'area'::character varying NOT NULL, -- "area" o "agente"
    created_at       timestamp without time zone DEFAULT now()
);

CREATE SEQUENCE public.infracciones_id_seq
    AS integer START WITH 1 INCREMENT BY 1 NO MINVALUE NO MAXVALUE CACHE 1;

ALTER SEQUENCE public.infracciones_id_seq OWNED BY public.infracciones.id;
ALTER TABLE ONLY public.infracciones ALTER COLUMN id SET DEFAULT nextval('public.infracciones_id_seq'::regclass);


-- =============================================================================
-- CLAVES PRIMARIAS
-- =============================================================================
ALTER TABLE ONLY public.empresas        ADD CONSTRAINT empresas_pkey        PRIMARY KEY (id);
ALTER TABLE ONLY public.usuarios        ADD CONSTRAINT usuarios_pkey        PRIMARY KEY (id);
ALTER TABLE ONLY public.agentes         ADD CONSTRAINT agentes_pkey         PRIMARY KEY (id);
ALTER TABLE ONLY public.conversaciones  ADD CONSTRAINT conversaciones_pkey  PRIMARY KEY (id);
ALTER TABLE ONLY public.mensajes        ADD CONSTRAINT mensajes_pkey        PRIMARY KEY (id);
ALTER TABLE ONLY public.calificaciones  ADD CONSTRAINT calificaciones_pkey  PRIMARY KEY (id);
ALTER TABLE ONLY public.configuraciones ADD CONSTRAINT configuraciones_pkey PRIMARY KEY (clave);
ALTER TABLE ONLY public.infracciones    ADD CONSTRAINT infracciones_pkey    PRIMARY KEY (id);


-- =============================================================================
-- RESTRICCIONES DE UNICIDAD
-- =============================================================================

-- El email de cada agente debe ser único en todo el sistema
ALTER TABLE ONLY public.agentes
    ADD CONSTRAINT agentes_email_key UNIQUE (email);

-- Una configuración (clave + empresa) no puede repetirse — permite valores
-- distintos del mismo parámetro para diferentes empresas
ALTER TABLE ONLY public.configuraciones
    ADD CONSTRAINT unique_clave_empresa UNIQUE (clave, empresa_id);


-- =============================================================================
-- CLAVES FORÁNEAS (INTEGRIDAD REFERENCIAL)
-- =============================================================================

-- conversaciones.usuario_id → usuarios.id
-- Una conversación siempre pertenece a un usuario registrado
ALTER TABLE ONLY public.conversaciones
    ADD CONSTRAINT conversaciones_usuario_id_fkey
    FOREIGN KEY (usuario_id) REFERENCES public.usuarios(id);

-- conversaciones.empresa_id → empresas.id
-- Una conversación siempre está asociada a una empresa válida
ALTER TABLE ONLY public.conversaciones
    ADD CONSTRAINT conversaciones_empresa_id_fkey
    FOREIGN KEY (empresa_id) REFERENCES public.empresas(id);

-- conversaciones.agente_id → agentes.id
-- El agente asignado debe existir en el sistema
ALTER TABLE ONLY public.conversaciones
    ADD CONSTRAINT conversaciones_agente_id_fkey
    FOREIGN KEY (agente_id) REFERENCES public.agentes(id);

-- mensajes.conversacion_id → conversaciones.id
-- Todo mensaje pertenece a una conversación existente
ALTER TABLE ONLY public.mensajes
    ADD CONSTRAINT mensajes_conversacion_id_fkey
    FOREIGN KEY (conversacion_id) REFERENCES public.conversaciones(id);

-- calificaciones.conversacion_id → conversaciones.id
-- Toda calificación está vinculada a la conversación que la generó
ALTER TABLE ONLY public.calificaciones
    ADD CONSTRAINT calificaciones_conversacion_id_fkey
    FOREIGN KEY (conversacion_id) REFERENCES public.conversaciones(id);

-- configuraciones.empresa_id → empresas.id
-- Solo se pueden guardar configuraciones para empresas registradas
ALTER TABLE ONLY public.configuraciones
    ADD CONSTRAINT configuraciones_empresa_id_fkey
    FOREIGN KEY (empresa_id) REFERENCES public.empresas(id);

-- infracciones.conversacion_id → conversaciones.id (CASCADE DELETE)
-- Si se elimina una conversación (GDPR), sus infracciones también se eliminan
ALTER TABLE ONLY public.infracciones
    ADD CONSTRAINT infracciones_conversacion_id_fkey
    FOREIGN KEY (conversacion_id) REFERENCES public.conversaciones(id) ON DELETE CASCADE;

-- infracciones.agente_id → agentes.id (SET NULL al eliminar agente)
-- Si se elimina un agente, sus infracciones quedan con agente_id = NULL
-- pero no se pierden — el agente_nombre sigue guardado como texto
ALTER TABLE ONLY public.infracciones
    ADD CONSTRAINT infracciones_agente_id_fkey
    FOREIGN KEY (agente_id) REFERENCES public.agentes(id) ON DELETE SET NULL;


-- =============================================================================
-- ÍNDICES DE RENDIMIENTO
-- =============================================================================
-- Optimizan las consultas más frecuentes del sistema. Sin estos índices,
-- PostgreSQL escanea la tabla completa en cada consulta (ineficiente con
-- miles de registros).

-- Acelera la carga de mensajes al abrir una conversación en el CRM.
-- Query beneficiada: SELECT * FROM mensajes WHERE conversacion_id = $1
CREATE INDEX idx_mensajes_conversacion
    ON public.mensajes USING btree (conversacion_id);

-- Acelera el filtrado de conversaciones por empresa en el panel CRM.
-- Query beneficiada: SELECT * FROM conversaciones WHERE empresa_id = $1
CREATE INDEX idx_conversaciones_empresa
    ON public.conversaciones USING btree (empresa_id);

-- Acelera la carga de conversaciones por área y empresa (vista del asesor).
-- Query beneficiada: SELECT * FROM conversaciones WHERE departamento = $1 AND empresa_id = $2
CREATE INDEX idx_conversaciones_area_empresa
    ON public.conversaciones USING btree (departamento, empresa_id);


-- =============================================================================
-- FIN DEL ESQUEMA
-- =============================================================================
