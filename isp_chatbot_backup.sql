--
-- PostgreSQL database dump
--

\restrict HWvh3cQiivigsmVpTOK5zy7KRJaFtuy4bI8mHb44jUhPCzc3H30cIN7PejNFmP0

-- Dumped from database version 18.3
-- Dumped by pg_dump version 18.2

-- Started on 2026-08-20 11:58:55

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

--
-- TOC entry 271 (class 1255 OID 26040)
-- Name: update_menus_bot_updated_at_column(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.update_menus_bot_updated_at_column() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$;


ALTER FUNCTION public.update_menus_bot_updated_at_column() OWNER TO postgres;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- TOC entry 230 (class 1259 OID 16489)
-- Name: agentes; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.agentes (
    id integer NOT NULL,
    nombre character varying(100) NOT NULL,
    email character varying(100) NOT NULL,
    password text NOT NULL,
    rol character varying(20) DEFAULT 'asesor'::character varying,
    area character varying(50),
    esta_online boolean DEFAULT false,
    created_at timestamp without time zone DEFAULT now(),
    last_seen timestamp with time zone,
    foto_perfil character varying(255),
    ultimo_chat_asignado timestamp without time zone
);


ALTER TABLE public.agentes OWNER TO postgres;

--
-- TOC entry 229 (class 1259 OID 16488)
-- Name: agentes_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.agentes_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.agentes_id_seq OWNER TO postgres;

--
-- TOC entry 5328 (class 0 OID 0)
-- Dependencies: 229
-- Name: agentes_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.agentes_id_seq OWNED BY public.agentes.id;


--
-- TOC entry 270 (class 1259 OID 26352)
-- Name: areas_soluciones; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.areas_soluciones (
    id integer NOT NULL,
    empresa_id jsonb,
    nombre_area character varying(100),
    descripcion text,
    soluciones jsonb,
    activo boolean DEFAULT true,
    coordinador_id integer
);


ALTER TABLE public.areas_soluciones OWNER TO postgres;

--
-- TOC entry 269 (class 1259 OID 26351)
-- Name: areas_soluciones_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.areas_soluciones_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.areas_soluciones_id_seq OWNER TO postgres;

--
-- TOC entry 5329 (class 0 OID 0)
-- Dependencies: 269
-- Name: areas_soluciones_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.areas_soluciones_id_seq OWNED BY public.areas_soluciones.id;


--
-- TOC entry 227 (class 1259 OID 16448)
-- Name: calificaciones; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.calificaciones (
    id integer NOT NULL,
    conversacion_id integer,
    puntuacion character varying(20),
    sugerencia text,
    created_at timestamp without time zone DEFAULT now(),
    tipo character varying(20)
);


ALTER TABLE public.calificaciones OWNER TO postgres;

--
-- TOC entry 226 (class 1259 OID 16447)
-- Name: calificaciones_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.calificaciones_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.calificaciones_id_seq OWNER TO postgres;

--
-- TOC entry 5330 (class 0 OID 0)
-- Dependencies: 226
-- Name: calificaciones_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.calificaciones_id_seq OWNED BY public.calificaciones.id;


--
-- TOC entry 251 (class 1259 OID 25825)
-- Name: cat_cierre_empresas; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.cat_cierre_empresas (
    cat_cierre_id integer NOT NULL,
    empresa_id character varying(50) NOT NULL
);


ALTER TABLE public.cat_cierre_empresas OWNER TO postgres;

--
-- TOC entry 249 (class 1259 OID 25775)
-- Name: categoria_cierre; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.categoria_cierre (
    id integer NOT NULL,
    empresa_id character varying(50) DEFAULT 'fibratec'::character varying NOT NULL,
    nombre character varying(100) NOT NULL,
    descripcion text,
    area character varying(100) DEFAULT NULL::character varying,
    activa boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    color character varying(7) DEFAULT '#6366f1'::character varying NOT NULL
);


ALTER TABLE public.categoria_cierre OWNER TO postgres;

--
-- TOC entry 248 (class 1259 OID 25774)
-- Name: categoria_cierre_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.categoria_cierre_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.categoria_cierre_id_seq OWNER TO postgres;

--
-- TOC entry 5331 (class 0 OID 0)
-- Dependencies: 248
-- Name: categoria_cierre_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.categoria_cierre_id_seq OWNED BY public.categoria_cierre.id;


--
-- TOC entry 228 (class 1259 OID 16463)
-- Name: configuraciones; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.configuraciones (
    clave character varying(50) NOT NULL,
    valor text,
    empresa_id character varying(20) DEFAULT 'fibratec'::character varying NOT NULL,
    area character varying(255) DEFAULT NULL::character varying NOT NULL
);


ALTER TABLE public.configuraciones OWNER TO postgres;

--
-- TOC entry 247 (class 1259 OID 25746)
-- Name: conversacion_etiquetas; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.conversacion_etiquetas (
    conversacion_id integer NOT NULL,
    etiqueta_id integer NOT NULL,
    asignada_por integer,
    asignada_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.conversacion_etiquetas OWNER TO postgres;

--
-- TOC entry 223 (class 1259 OID 16408)
-- Name: conversaciones; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.conversaciones (
    id integer NOT NULL,
    usuario_id integer,
    empresa_id character varying(20),
    estado character varying(50),
    es_humano boolean DEFAULT false,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    contexto jsonb,
    motivo_cierre text,
    cerrado_por text,
    updated_at timestamp without time zone DEFAULT now(),
    departamento character varying(50),
    agente_id integer,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    ultimo_mensaje_cliente timestamp with time zone,
    aviso_inactividad_enviado smallint DEFAULT 0 NOT NULL,
    sla_pendiente_desde timestamp with time zone,
    aviso_horario_enviado boolean DEFAULT false NOT NULL,
    nota_transferencia text,
    transferida_en timestamp with time zone,
    transferida_desde character varying(100),
    categoria_cierre_id integer,
    comentario_cierre text,
    tipo_cierre character varying(20) DEFAULT NULL::character varying,
    cerrado_por_id integer,
    cerrado_en timestamp with time zone
);


ALTER TABLE public.conversaciones OWNER TO postgres;

--
-- TOC entry 222 (class 1259 OID 16407)
-- Name: conversaciones_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.conversaciones_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.conversaciones_id_seq OWNER TO postgres;

--
-- TOC entry 5332 (class 0 OID 0)
-- Dependencies: 222
-- Name: conversaciones_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.conversaciones_id_seq OWNED BY public.conversaciones.id;


--
-- TOC entry 219 (class 1259 OID 16389)
-- Name: empresas; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.empresas (
    id character varying(10) NOT NULL,
    nombre text NOT NULL
);


ALTER TABLE public.empresas OWNER TO postgres;

--
-- TOC entry 250 (class 1259 OID 25812)
-- Name: etiqueta_empresas; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.etiqueta_empresas (
    etiqueta_id integer NOT NULL,
    empresa_id character varying(50) NOT NULL
);


ALTER TABLE public.etiqueta_empresas OWNER TO postgres;

--
-- TOC entry 246 (class 1259 OID 25727)
-- Name: etiquetas; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.etiquetas (
    id integer NOT NULL,
    empresa_id character varying(50) DEFAULT 'fibratec'::character varying NOT NULL,
    nombre character varying(80) NOT NULL,
    descripcion text,
    color character varying(7) DEFAULT '#3b82f6'::character varying NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    area character varying(100) DEFAULT NULL::character varying
);


ALTER TABLE public.etiquetas OWNER TO postgres;

--
-- TOC entry 245 (class 1259 OID 25726)
-- Name: etiquetas_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.etiquetas_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.etiquetas_id_seq OWNER TO postgres;

--
-- TOC entry 5333 (class 0 OID 0)
-- Dependencies: 245
-- Name: etiquetas_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.etiquetas_id_seq OWNED BY public.etiquetas.id;


--
-- TOC entry 242 (class 1259 OID 25659)
-- Name: festivos; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.festivos (
    id integer NOT NULL,
    empresa_id text DEFAULT 'fibratec'::text NOT NULL,
    fecha date NOT NULL,
    nombre text,
    area text
);


ALTER TABLE public.festivos OWNER TO postgres;

--
-- TOC entry 241 (class 1259 OID 25658)
-- Name: festivos_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.festivos_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.festivos_id_seq OWNER TO postgres;

--
-- TOC entry 5334 (class 0 OID 0)
-- Dependencies: 241
-- Name: festivos_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.festivos_id_seq OWNED BY public.festivos.id;


--
-- TOC entry 262 (class 1259 OID 25963)
-- Name: flujos_bot; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.flujos_bot (
    id integer NOT NULL,
    empresa_id character varying(100) NOT NULL,
    nombre character varying(100) DEFAULT 'Flujo principal'::character varying NOT NULL,
    nodos jsonb DEFAULT '[]'::jsonb NOT NULL,
    conexiones jsonb DEFAULT '[]'::jsonb NOT NULL,
    root_node character varying(100) DEFAULT 'entrada'::character varying NOT NULL,
    activo boolean DEFAULT true NOT NULL,
    version integer DEFAULT 1 NOT NULL,
    updated_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.flujos_bot OWNER TO postgres;

--
-- TOC entry 261 (class 1259 OID 25962)
-- Name: flujos_bot_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.flujos_bot_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.flujos_bot_id_seq OWNER TO postgres;

--
-- TOC entry 5335 (class 0 OID 0)
-- Dependencies: 261
-- Name: flujos_bot_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.flujos_bot_id_seq OWNED BY public.flujos_bot.id;


--
-- TOC entry 232 (class 1259 OID 16515)
-- Name: infracciones; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.infracciones (
    id integer NOT NULL,
    conversacion_id integer,
    empresa_id character varying NOT NULL,
    departamento character varying,
    cliente_nombre character varying,
    tiempo_espera integer NOT NULL,
    created_at timestamp without time zone DEFAULT now(),
    tipo character varying DEFAULT 'area'::character varying NOT NULL,
    agente_id integer,
    agente_nombre character varying
);


ALTER TABLE public.infracciones OWNER TO postgres;

--
-- TOC entry 231 (class 1259 OID 16514)
-- Name: infracciones_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.infracciones_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.infracciones_id_seq OWNER TO postgres;

--
-- TOC entry 5336 (class 0 OID 0)
-- Dependencies: 231
-- Name: infracciones_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.infracciones_id_seq OWNED BY public.infracciones.id;


--
-- TOC entry 225 (class 1259 OID 16428)
-- Name: mensajes; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.mensajes (
    id integer NOT NULL,
    conversacion_id integer,
    remitente character varying(30),
    texto text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    leido boolean DEFAULT false,
    tipo character varying(20) DEFAULT 'text'::character varying,
    url_media text,
    estado character varying(20) DEFAULT 'enviado'::character varying NOT NULL,
    telegram_msg_id bigint,
    reacciones jsonb DEFAULT '[]'::jsonb,
    wamid character varying(255),
    agente_id integer
);


ALTER TABLE public.mensajes OWNER TO postgres;

--
-- TOC entry 224 (class 1259 OID 16427)
-- Name: mensajes_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.mensajes_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.mensajes_id_seq OWNER TO postgres;

--
-- TOC entry 5337 (class 0 OID 0)
-- Dependencies: 224
-- Name: mensajes_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.mensajes_id_seq OWNED BY public.mensajes.id;


--
-- TOC entry 266 (class 1259 OID 26025)
-- Name: menus_bot; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.menus_bot (
    id integer NOT NULL,
    empresa_id character varying(50) NOT NULL,
    menu_id character varying(50) NOT NULL,
    button_id character varying(50) NOT NULL,
    texto character varying(255) NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    activo boolean DEFAULT true
);


ALTER TABLE public.menus_bot OWNER TO postgres;

--
-- TOC entry 265 (class 1259 OID 26024)
-- Name: menus_bot_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.menus_bot_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.menus_bot_id_seq OWNER TO postgres;

--
-- TOC entry 5338 (class 0 OID 0)
-- Dependencies: 265
-- Name: menus_bot_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.menus_bot_id_seq OWNED BY public.menus_bot.id;


--
-- TOC entry 234 (class 1259 OID 16544)
-- Name: migrations; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.migrations (
    id integer NOT NULL,
    filename character varying(255) NOT NULL,
    applied_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.migrations OWNER TO postgres;

--
-- TOC entry 233 (class 1259 OID 16543)
-- Name: migrations_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.migrations_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.migrations_id_seq OWNER TO postgres;

--
-- TOC entry 5339 (class 0 OID 0)
-- Dependencies: 233
-- Name: migrations_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.migrations_id_seq OWNED BY public.migrations.id;


--
-- TOC entry 252 (class 1259 OID 25838)
-- Name: modulos; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.modulos (
    id character varying(50) NOT NULL,
    nombre character varying(100) NOT NULL,
    descripcion text
);


ALTER TABLE public.modulos OWNER TO postgres;

--
-- TOC entry 260 (class 1259 OID 25942)
-- Name: palabras_clave_bot; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.palabras_clave_bot (
    id integer NOT NULL,
    empresa_id character varying(100) DEFAULT '__todas__'::character varying NOT NULL,
    intencion character varying(50) NOT NULL,
    palabras text[] NOT NULL,
    activo boolean DEFAULT true NOT NULL
);


ALTER TABLE public.palabras_clave_bot OWNER TO postgres;

--
-- TOC entry 259 (class 1259 OID 25941)
-- Name: palabras_clave_bot_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.palabras_clave_bot_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.palabras_clave_bot_id_seq OWNER TO postgres;

--
-- TOC entry 5340 (class 0 OID 0)
-- Dependencies: 259
-- Name: palabras_clave_bot_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.palabras_clave_bot_id_seq OWNED BY public.palabras_clave_bot.id;


--
-- TOC entry 257 (class 1259 OID 25890)
-- Name: permiso_log; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.permiso_log (
    id integer NOT NULL,
    admin_id integer NOT NULL,
    usuario_id integer,
    payload jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.permiso_log OWNER TO postgres;

--
-- TOC entry 256 (class 1259 OID 25889)
-- Name: permiso_log_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.permiso_log_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.permiso_log_id_seq OWNER TO postgres;

--
-- TOC entry 5341 (class 0 OID 0)
-- Dependencies: 256
-- Name: permiso_log_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.permiso_log_id_seq OWNED BY public.permiso_log.id;


--
-- TOC entry 264 (class 1259 OID 26007)
-- Name: plantillas_bot; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.plantillas_bot (
    id integer NOT NULL,
    empresa_id character varying(50) NOT NULL,
    clave character varying(100) NOT NULL,
    texto text NOT NULL,
    descripcion text,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.plantillas_bot OWNER TO postgres;

--
-- TOC entry 263 (class 1259 OID 26006)
-- Name: plantillas_bot_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.plantillas_bot_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.plantillas_bot_id_seq OWNER TO postgres;

--
-- TOC entry 5342 (class 0 OID 0)
-- Dependencies: 263
-- Name: plantillas_bot_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.plantillas_bot_id_seq OWNED BY public.plantillas_bot.id;


--
-- TOC entry 268 (class 1259 OID 26135)
-- Name: plantillas_meta; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.plantillas_meta (
    id integer NOT NULL,
    empresa_id character varying(50) NOT NULL,
    nombre character varying(100) NOT NULL,
    categoria character varying(50) NOT NULL,
    idioma character varying(10) DEFAULT 'es'::character varying,
    estado character varying(20) DEFAULT 'APPROVED'::character varying,
    cuerpo text,
    variables jsonb DEFAULT '[]'::jsonb,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.plantillas_meta OWNER TO postgres;

--
-- TOC entry 267 (class 1259 OID 26134)
-- Name: plantillas_meta_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.plantillas_meta_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.plantillas_meta_id_seq OWNER TO postgres;

--
-- TOC entry 5343 (class 0 OID 0)
-- Dependencies: 267
-- Name: plantillas_meta_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.plantillas_meta_id_seq OWNED BY public.plantillas_meta.id;


--
-- TOC entry 236 (class 1259 OID 16561)
-- Name: respuestas_rapidas; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.respuestas_rapidas (
    id integer NOT NULL,
    agente_id integer NOT NULL,
    titulo character varying(100) NOT NULL,
    contenido text NOT NULL,
    created_at timestamp without time zone DEFAULT now(),
    url_media text,
    tipo_media character varying(20),
    nombre_archivo character varying(255)
);


ALTER TABLE public.respuestas_rapidas OWNER TO postgres;

--
-- TOC entry 235 (class 1259 OID 16560)
-- Name: respuestas_rapidas_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.respuestas_rapidas_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.respuestas_rapidas_id_seq OWNER TO postgres;

--
-- TOC entry 5344 (class 0 OID 0)
-- Dependencies: 235
-- Name: respuestas_rapidas_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.respuestas_rapidas_id_seq OWNED BY public.respuestas_rapidas.id;


--
-- TOC entry 258 (class 1259 OID 25920)
-- Name: rol_permisos_template; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.rol_permisos_template (
    rol character varying(50) NOT NULL,
    empresas jsonb DEFAULT '["__todas__"]'::jsonb NOT NULL,
    areas jsonb DEFAULT '[{"areas": ["__todas__"], "empresa_id": "__todas__"}]'::jsonb NOT NULL,
    modulos jsonb DEFAULT '[]'::jsonb NOT NULL,
    updated_by integer,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.rol_permisos_template OWNER TO postgres;

--
-- TOC entry 238 (class 1259 OID 25613)
-- Name: sticker_favoritos; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.sticker_favoritos (
    id integer NOT NULL,
    agente_id integer NOT NULL,
    pack character varying(100) NOT NULL,
    file character varying(100) NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.sticker_favoritos OWNER TO postgres;

--
-- TOC entry 237 (class 1259 OID 25612)
-- Name: sticker_favoritos_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.sticker_favoritos_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.sticker_favoritos_id_seq OWNER TO postgres;

--
-- TOC entry 5345 (class 0 OID 0)
-- Dependencies: 237
-- Name: sticker_favoritos_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.sticker_favoritos_id_seq OWNED BY public.sticker_favoritos.id;


--
-- TOC entry 244 (class 1259 OID 25685)
-- Name: transferencias; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.transferencias (
    id integer NOT NULL,
    conversacion_id integer NOT NULL,
    empresa_id character varying(50) NOT NULL,
    agente_origen_id integer NOT NULL,
    agente_origen_nombre character varying(100) NOT NULL,
    area_origen character varying(100) NOT NULL,
    area_destino character varying(100) NOT NULL,
    tipo character varying(20) NOT NULL,
    nota text NOT NULL,
    tomado_por_id integer,
    tomado_por_nombre character varying(100),
    tomado_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT transferencias_tipo_check CHECK (((tipo)::text = ANY ((ARRAY['mismo_equipo'::character varying, 'entre_equipos'::character varying])::text[])))
);


ALTER TABLE public.transferencias OWNER TO postgres;

--
-- TOC entry 243 (class 1259 OID 25684)
-- Name: transferencias_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.transferencias_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.transferencias_id_seq OWNER TO postgres;

--
-- TOC entry 5346 (class 0 OID 0)
-- Dependencies: 243
-- Name: transferencias_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.transferencias_id_seq OWNED BY public.transferencias.id;


--
-- TOC entry 240 (class 1259 OID 25638)
-- Name: turnos; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.turnos (
    id integer NOT NULL,
    empresa_id text DEFAULT 'fibratec'::text NOT NULL,
    area text,
    nombre text NOT NULL,
    hora_inicio text NOT NULL,
    hora_fin text NOT NULL,
    dias text NOT NULL,
    activo boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.turnos OWNER TO postgres;

--
-- TOC entry 239 (class 1259 OID 25637)
-- Name: turnos_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.turnos_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.turnos_id_seq OWNER TO postgres;

--
-- TOC entry 5347 (class 0 OID 0)
-- Dependencies: 239
-- Name: turnos_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.turnos_id_seq OWNED BY public.turnos.id;


--
-- TOC entry 254 (class 1259 OID 25859)
-- Name: usuario_areas; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.usuario_areas (
    usuario_id integer NOT NULL,
    empresa_id character varying(50) NOT NULL,
    area character varying(100) NOT NULL
);


ALTER TABLE public.usuario_areas OWNER TO postgres;

--
-- TOC entry 253 (class 1259 OID 25847)
-- Name: usuario_empresas; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.usuario_empresas (
    usuario_id integer NOT NULL,
    empresa_id character varying(50) NOT NULL
);


ALTER TABLE public.usuario_empresas OWNER TO postgres;

--
-- TOC entry 255 (class 1259 OID 25872)
-- Name: usuario_modulos; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.usuario_modulos (
    usuario_id integer NOT NULL,
    modulo character varying(50) NOT NULL
);


ALTER TABLE public.usuario_modulos OWNER TO postgres;

--
-- TOC entry 221 (class 1259 OID 16399)
-- Name: usuarios; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.usuarios (
    id integer NOT NULL,
    canal character varying(20),
    external_id character varying(50),
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    nombre text,
    username text,
    telefono text,
    wisp_data jsonb,
    opt_in boolean DEFAULT true
);


ALTER TABLE public.usuarios OWNER TO postgres;

--
-- TOC entry 220 (class 1259 OID 16398)
-- Name: usuarios_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.usuarios_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.usuarios_id_seq OWNER TO postgres;

--
-- TOC entry 5348 (class 0 OID 0)
-- Dependencies: 220
-- Name: usuarios_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.usuarios_id_seq OWNED BY public.usuarios.id;


--
-- TOC entry 4971 (class 2604 OID 16492)
-- Name: agentes id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.agentes ALTER COLUMN id SET DEFAULT nextval('public.agentes_id_seq'::regclass);


--
-- TOC entry 5034 (class 2604 OID 26355)
-- Name: areas_soluciones id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.areas_soluciones ALTER COLUMN id SET DEFAULT nextval('public.areas_soluciones_id_seq'::regclass);


--
-- TOC entry 4967 (class 2604 OID 16451)
-- Name: calificaciones id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.calificaciones ALTER COLUMN id SET DEFAULT nextval('public.calificaciones_id_seq'::regclass);


--
-- TOC entry 4998 (class 2604 OID 25778)
-- Name: categoria_cierre id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.categoria_cierre ALTER COLUMN id SET DEFAULT nextval('public.categoria_cierre_id_seq'::regclass);


--
-- TOC entry 4953 (class 2604 OID 16411)
-- Name: conversaciones id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.conversaciones ALTER COLUMN id SET DEFAULT nextval('public.conversaciones_id_seq'::regclass);


--
-- TOC entry 4992 (class 2604 OID 25730)
-- Name: etiquetas id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.etiquetas ALTER COLUMN id SET DEFAULT nextval('public.etiquetas_id_seq'::regclass);


--
-- TOC entry 4988 (class 2604 OID 25662)
-- Name: festivos id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.festivos ALTER COLUMN id SET DEFAULT nextval('public.festivos_id_seq'::regclass);


--
-- TOC entry 5014 (class 2604 OID 25966)
-- Name: flujos_bot id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.flujos_bot ALTER COLUMN id SET DEFAULT nextval('public.flujos_bot_id_seq'::regclass);


--
-- TOC entry 4975 (class 2604 OID 16518)
-- Name: infracciones id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.infracciones ALTER COLUMN id SET DEFAULT nextval('public.infracciones_id_seq'::regclass);


--
-- TOC entry 4961 (class 2604 OID 16431)
-- Name: mensajes id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.mensajes ALTER COLUMN id SET DEFAULT nextval('public.mensajes_id_seq'::regclass);


--
-- TOC entry 5025 (class 2604 OID 26028)
-- Name: menus_bot id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.menus_bot ALTER COLUMN id SET DEFAULT nextval('public.menus_bot_id_seq'::regclass);


--
-- TOC entry 4978 (class 2604 OID 16547)
-- Name: migrations id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.migrations ALTER COLUMN id SET DEFAULT nextval('public.migrations_id_seq'::regclass);


--
-- TOC entry 5011 (class 2604 OID 25945)
-- Name: palabras_clave_bot id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.palabras_clave_bot ALTER COLUMN id SET DEFAULT nextval('public.palabras_clave_bot_id_seq'::regclass);


--
-- TOC entry 5004 (class 2604 OID 25893)
-- Name: permiso_log id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.permiso_log ALTER COLUMN id SET DEFAULT nextval('public.permiso_log_id_seq'::regclass);


--
-- TOC entry 5022 (class 2604 OID 26010)
-- Name: plantillas_bot id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.plantillas_bot ALTER COLUMN id SET DEFAULT nextval('public.plantillas_bot_id_seq'::regclass);


--
-- TOC entry 5029 (class 2604 OID 26138)
-- Name: plantillas_meta id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.plantillas_meta ALTER COLUMN id SET DEFAULT nextval('public.plantillas_meta_id_seq'::regclass);


--
-- TOC entry 4980 (class 2604 OID 16564)
-- Name: respuestas_rapidas id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.respuestas_rapidas ALTER COLUMN id SET DEFAULT nextval('public.respuestas_rapidas_id_seq'::regclass);


--
-- TOC entry 4982 (class 2604 OID 25616)
-- Name: sticker_favoritos id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.sticker_favoritos ALTER COLUMN id SET DEFAULT nextval('public.sticker_favoritos_id_seq'::regclass);


--
-- TOC entry 4990 (class 2604 OID 25688)
-- Name: transferencias id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.transferencias ALTER COLUMN id SET DEFAULT nextval('public.transferencias_id_seq'::regclass);


--
-- TOC entry 4984 (class 2604 OID 25641)
-- Name: turnos id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.turnos ALTER COLUMN id SET DEFAULT nextval('public.turnos_id_seq'::regclass);


--
-- TOC entry 4950 (class 2604 OID 16402)
-- Name: usuarios id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.usuarios ALTER COLUMN id SET DEFAULT nextval('public.usuarios_id_seq'::regclass);


--
-- TOC entry 5062 (class 2606 OID 16505)
-- Name: agentes agentes_email_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.agentes
    ADD CONSTRAINT agentes_email_key UNIQUE (email);


--
-- TOC entry 5064 (class 2606 OID 16503)
-- Name: agentes agentes_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.agentes
    ADD CONSTRAINT agentes_pkey PRIMARY KEY (id);


--
-- TOC entry 5146 (class 2606 OID 26361)
-- Name: areas_soluciones areas_soluciones_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.areas_soluciones
    ADD CONSTRAINT areas_soluciones_pkey PRIMARY KEY (id);


--
-- TOC entry 5058 (class 2606 OID 16457)
-- Name: calificaciones calificaciones_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.calificaciones
    ADD CONSTRAINT calificaciones_pkey PRIMARY KEY (id);


--
-- TOC entry 5108 (class 2606 OID 25831)
-- Name: cat_cierre_empresas cat_cierre_empresas_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.cat_cierre_empresas
    ADD CONSTRAINT cat_cierre_empresas_pkey PRIMARY KEY (cat_cierre_id, empresa_id);


--
-- TOC entry 5100 (class 2606 OID 25793)
-- Name: categoria_cierre categoria_cierre_empresa_id_nombre_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.categoria_cierre
    ADD CONSTRAINT categoria_cierre_empresa_id_nombre_key UNIQUE (empresa_id, nombre);


--
-- TOC entry 5102 (class 2606 OID 25791)
-- Name: categoria_cierre categoria_cierre_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.categoria_cierre
    ADD CONSTRAINT categoria_cierre_pkey PRIMARY KEY (id);


--
-- TOC entry 5060 (class 2606 OID 27153)
-- Name: configuraciones configuraciones_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.configuraciones
    ADD CONSTRAINT configuraciones_pkey PRIMARY KEY (clave, empresa_id, area);


--
-- TOC entry 5096 (class 2606 OID 25754)
-- Name: conversacion_etiquetas conversacion_etiquetas_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.conversacion_etiquetas
    ADD CONSTRAINT conversacion_etiquetas_pkey PRIMARY KEY (conversacion_id, etiqueta_id);


--
-- TOC entry 5042 (class 2606 OID 16416)
-- Name: conversaciones conversaciones_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.conversaciones
    ADD CONSTRAINT conversaciones_pkey PRIMARY KEY (id);


--
-- TOC entry 5038 (class 2606 OID 16397)
-- Name: empresas empresas_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.empresas
    ADD CONSTRAINT empresas_pkey PRIMARY KEY (id);


--
-- TOC entry 5105 (class 2606 OID 25818)
-- Name: etiqueta_empresas etiqueta_empresas_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.etiqueta_empresas
    ADD CONSTRAINT etiqueta_empresas_pkey PRIMARY KEY (etiqueta_id, empresa_id);


--
-- TOC entry 5090 (class 2606 OID 25744)
-- Name: etiquetas etiquetas_empresa_id_nombre_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.etiquetas
    ADD CONSTRAINT etiquetas_empresa_id_nombre_key UNIQUE (empresa_id, nombre);


--
-- TOC entry 5092 (class 2606 OID 25742)
-- Name: etiquetas etiquetas_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.etiquetas
    ADD CONSTRAINT etiquetas_pkey PRIMARY KEY (id);


--
-- TOC entry 5082 (class 2606 OID 25670)
-- Name: festivos festivos_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.festivos
    ADD CONSTRAINT festivos_pkey PRIMARY KEY (id);


--
-- TOC entry 5131 (class 2606 OID 25987)
-- Name: flujos_bot flujos_bot_empresa_nombre; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.flujos_bot
    ADD CONSTRAINT flujos_bot_empresa_nombre UNIQUE (empresa_id, nombre);


--
-- TOC entry 5133 (class 2606 OID 25985)
-- Name: flujos_bot flujos_bot_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.flujos_bot
    ADD CONSTRAINT flujos_bot_pkey PRIMARY KEY (id);


--
-- TOC entry 5066 (class 2606 OID 16526)
-- Name: infracciones infracciones_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.infracciones
    ADD CONSTRAINT infracciones_pkey PRIMARY KEY (id);


--
-- TOC entry 5056 (class 2606 OID 16437)
-- Name: mensajes mensajes_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.mensajes
    ADD CONSTRAINT mensajes_pkey PRIMARY KEY (id);


--
-- TOC entry 5140 (class 2606 OID 26039)
-- Name: menus_bot menus_bot_empresa_id_menu_id_button_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.menus_bot
    ADD CONSTRAINT menus_bot_empresa_id_menu_id_button_id_key UNIQUE (empresa_id, menu_id, button_id);


--
-- TOC entry 5142 (class 2606 OID 26037)
-- Name: menus_bot menus_bot_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.menus_bot
    ADD CONSTRAINT menus_bot_pkey PRIMARY KEY (id);


--
-- TOC entry 5068 (class 2606 OID 16554)
-- Name: migrations migrations_filename_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.migrations
    ADD CONSTRAINT migrations_filename_key UNIQUE (filename);


--
-- TOC entry 5070 (class 2606 OID 16552)
-- Name: migrations migrations_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.migrations
    ADD CONSTRAINT migrations_pkey PRIMARY KEY (id);


--
-- TOC entry 5111 (class 2606 OID 25846)
-- Name: modulos modulos_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.modulos
    ADD CONSTRAINT modulos_pkey PRIMARY KEY (id);


--
-- TOC entry 5127 (class 2606 OID 25956)
-- Name: palabras_clave_bot palabras_clave_bot_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.palabras_clave_bot
    ADD CONSTRAINT palabras_clave_bot_pkey PRIMARY KEY (id);


--
-- TOC entry 5129 (class 2606 OID 25958)
-- Name: palabras_clave_bot palabras_clave_bot_uq; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.palabras_clave_bot
    ADD CONSTRAINT palabras_clave_bot_uq UNIQUE (empresa_id, intencion);


--
-- TOC entry 5123 (class 2606 OID 25904)
-- Name: permiso_log permiso_log_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.permiso_log
    ADD CONSTRAINT permiso_log_pkey PRIMARY KEY (id);


--
-- TOC entry 5136 (class 2606 OID 26022)
-- Name: plantillas_bot plantillas_bot_empresa_id_clave_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.plantillas_bot
    ADD CONSTRAINT plantillas_bot_empresa_id_clave_key UNIQUE (empresa_id, clave);


--
-- TOC entry 5138 (class 2606 OID 26020)
-- Name: plantillas_bot plantillas_bot_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.plantillas_bot
    ADD CONSTRAINT plantillas_bot_pkey PRIMARY KEY (id);


--
-- TOC entry 5144 (class 2606 OID 26150)
-- Name: plantillas_meta plantillas_meta_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.plantillas_meta
    ADD CONSTRAINT plantillas_meta_pkey PRIMARY KEY (id);


--
-- TOC entry 5072 (class 2606 OID 16573)
-- Name: respuestas_rapidas respuestas_rapidas_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.respuestas_rapidas
    ADD CONSTRAINT respuestas_rapidas_pkey PRIMARY KEY (id);


--
-- TOC entry 5125 (class 2606 OID 25935)
-- Name: rol_permisos_template rol_permisos_template_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.rol_permisos_template
    ADD CONSTRAINT rol_permisos_template_pkey PRIMARY KEY (rol);


--
-- TOC entry 5075 (class 2606 OID 25626)
-- Name: sticker_favoritos sticker_favoritos_agente_id_pack_file_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.sticker_favoritos
    ADD CONSTRAINT sticker_favoritos_agente_id_pack_file_key UNIQUE (agente_id, pack, file);


--
-- TOC entry 5077 (class 2606 OID 25624)
-- Name: sticker_favoritos sticker_favoritos_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.sticker_favoritos
    ADD CONSTRAINT sticker_favoritos_pkey PRIMARY KEY (id);


--
-- TOC entry 5088 (class 2606 OID 25704)
-- Name: transferencias transferencias_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.transferencias
    ADD CONSTRAINT transferencias_pkey PRIMARY KEY (id);


--
-- TOC entry 5080 (class 2606 OID 25656)
-- Name: turnos turnos_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.turnos
    ADD CONSTRAINT turnos_pkey PRIMARY KEY (id);


--
-- TOC entry 5117 (class 2606 OID 25866)
-- Name: usuario_areas usuario_areas_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.usuario_areas
    ADD CONSTRAINT usuario_areas_pkey PRIMARY KEY (usuario_id, empresa_id, area);


--
-- TOC entry 5114 (class 2606 OID 25853)
-- Name: usuario_empresas usuario_empresas_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.usuario_empresas
    ADD CONSTRAINT usuario_empresas_pkey PRIMARY KEY (usuario_id, empresa_id);


--
-- TOC entry 5120 (class 2606 OID 25878)
-- Name: usuario_modulos usuario_modulos_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.usuario_modulos
    ADD CONSTRAINT usuario_modulos_pkey PRIMARY KEY (usuario_id, modulo);


--
-- TOC entry 5040 (class 2606 OID 16406)
-- Name: usuarios usuarios_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.usuarios
    ADD CONSTRAINT usuarios_pkey PRIMARY KEY (id);


--
-- TOC entry 5103 (class 1259 OID 25794)
-- Name: idx_cat_cierre_empresa_area; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_cat_cierre_empresa_area ON public.categoria_cierre USING btree (empresa_id, area);


--
-- TOC entry 5109 (class 1259 OID 25837)
-- Name: idx_cat_emp_empresa; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_cat_emp_empresa ON public.cat_cierre_empresas USING btree (empresa_id);


--
-- TOC entry 5043 (class 1259 OID 25808)
-- Name: idx_conv_categoria_cierre_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_conv_categoria_cierre_id ON public.conversaciones USING btree (categoria_cierre_id);


--
-- TOC entry 5044 (class 1259 OID 25809)
-- Name: idx_conv_cerrado_en; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_conv_cerrado_en ON public.conversaciones USING btree (cerrado_en);


--
-- TOC entry 5045 (class 1259 OID 25807)
-- Name: idx_conv_cerrado_por_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_conv_cerrado_por_id ON public.conversaciones USING btree (cerrado_por_id);


--
-- TOC entry 5097 (class 1259 OID 25770)
-- Name: idx_conv_etiquetas_conv; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_conv_etiquetas_conv ON public.conversacion_etiquetas USING btree (conversacion_id);


--
-- TOC entry 5098 (class 1259 OID 25771)
-- Name: idx_conv_etiquetas_etiqueta; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_conv_etiquetas_etiqueta ON public.conversacion_etiquetas USING btree (etiqueta_id);


--
-- TOC entry 5046 (class 1259 OID 25636)
-- Name: idx_conv_sla; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_conv_sla ON public.conversaciones USING btree (sla_pendiente_desde) WHERE (sla_pendiente_desde IS NOT NULL);


--
-- TOC entry 5047 (class 1259 OID 25806)
-- Name: idx_conv_tipo_cierre; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_conv_tipo_cierre ON public.conversaciones USING btree (tipo_cierre);


--
-- TOC entry 5048 (class 1259 OID 16542)
-- Name: idx_conversaciones_area_empresa; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_conversaciones_area_empresa ON public.conversaciones USING btree (departamento, empresa_id);


--
-- TOC entry 5049 (class 1259 OID 16541)
-- Name: idx_conversaciones_empresa; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_conversaciones_empresa ON public.conversaciones USING btree (empresa_id);


--
-- TOC entry 5050 (class 1259 OID 24754)
-- Name: idx_conversaciones_metadata; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_conversaciones_metadata ON public.conversaciones USING gin (metadata);


--
-- TOC entry 5093 (class 1259 OID 25745)
-- Name: idx_etiquetas_empresa; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_etiquetas_empresa ON public.etiquetas USING btree (empresa_id);


--
-- TOC entry 5094 (class 1259 OID 25773)
-- Name: idx_etiquetas_empresa_area; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_etiquetas_empresa_area ON public.etiquetas USING btree (empresa_id, area);


--
-- TOC entry 5106 (class 1259 OID 25824)
-- Name: idx_etq_emp_empresa; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_etq_emp_empresa ON public.etiqueta_empresas USING btree (empresa_id);


--
-- TOC entry 5083 (class 1259 OID 25672)
-- Name: idx_festivos_empresa_fecha; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_festivos_empresa_fecha ON public.festivos USING btree (empresa_id, fecha);


--
-- TOC entry 5084 (class 1259 OID 25671)
-- Name: idx_festivos_unique; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX idx_festivos_unique ON public.festivos USING btree (empresa_id, fecha, COALESCE(area, ''::text));


--
-- TOC entry 5051 (class 1259 OID 25720)
-- Name: idx_mensajes_agente_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_mensajes_agente_id ON public.mensajes USING btree (agente_id);


--
-- TOC entry 5052 (class 1259 OID 16540)
-- Name: idx_mensajes_conversacion; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_mensajes_conversacion ON public.mensajes USING btree (conversacion_id);


--
-- TOC entry 5053 (class 1259 OID 16557)
-- Name: idx_mensajes_estado; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_mensajes_estado ON public.mensajes USING btree (conversacion_id, estado);


--
-- TOC entry 5054 (class 1259 OID 25601)
-- Name: idx_mensajes_wamid; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_mensajes_wamid ON public.mensajes USING btree (wamid) WHERE (wamid IS NOT NULL);


--
-- TOC entry 5121 (class 1259 OID 25918)
-- Name: idx_pl_usuario; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_pl_usuario ON public.permiso_log USING btree (usuario_id);


--
-- TOC entry 5134 (class 1259 OID 26023)
-- Name: idx_plantillas_bot_empresa; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_plantillas_bot_empresa ON public.plantillas_bot USING btree (empresa_id);


--
-- TOC entry 5073 (class 1259 OID 25632)
-- Name: idx_sticker_fav_agente; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_sticker_fav_agente ON public.sticker_favoritos USING btree (agente_id);


--
-- TOC entry 5085 (class 1259 OID 25710)
-- Name: idx_transferencias_conversacion; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_transferencias_conversacion ON public.transferencias USING btree (conversacion_id);


--
-- TOC entry 5086 (class 1259 OID 25711)
-- Name: idx_transferencias_empresa_fecha; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_transferencias_empresa_fecha ON public.transferencias USING btree (empresa_id, created_at DESC);


--
-- TOC entry 5078 (class 1259 OID 25657)
-- Name: idx_turnos_empresa_area; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_turnos_empresa_area ON public.turnos USING btree (empresa_id, area);


--
-- TOC entry 5115 (class 1259 OID 25916)
-- Name: idx_ua_usuario; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_ua_usuario ON public.usuario_areas USING btree (usuario_id);


--
-- TOC entry 5112 (class 1259 OID 25915)
-- Name: idx_ue_usuario; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_ue_usuario ON public.usuario_empresas USING btree (usuario_id);


--
-- TOC entry 5118 (class 1259 OID 25917)
-- Name: idx_um_usuario; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_um_usuario ON public.usuario_modulos USING btree (usuario_id);


--
-- TOC entry 5175 (class 2620 OID 26041)
-- Name: menus_bot update_menus_bot_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER update_menus_bot_updated_at BEFORE UPDATE ON public.menus_bot FOR EACH ROW EXECUTE FUNCTION public.update_menus_bot_updated_at_column();


--
-- TOC entry 5174 (class 2606 OID 27096)
-- Name: areas_soluciones areas_soluciones_coordinador_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.areas_soluciones
    ADD CONSTRAINT areas_soluciones_coordinador_id_fkey FOREIGN KEY (coordinador_id) REFERENCES public.agentes(id) ON DELETE SET NULL;


--
-- TOC entry 5155 (class 2606 OID 16458)
-- Name: calificaciones calificaciones_conversacion_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.calificaciones
    ADD CONSTRAINT calificaciones_conversacion_id_fkey FOREIGN KEY (conversacion_id) REFERENCES public.conversaciones(id);


--
-- TOC entry 5166 (class 2606 OID 25832)
-- Name: cat_cierre_empresas cat_cierre_empresas_cat_cierre_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.cat_cierre_empresas
    ADD CONSTRAINT cat_cierre_empresas_cat_cierre_id_fkey FOREIGN KEY (cat_cierre_id) REFERENCES public.categoria_cierre(id) ON DELETE CASCADE;


--
-- TOC entry 5156 (class 2606 OID 16481)
-- Name: configuraciones configuraciones_empresa_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.configuraciones
    ADD CONSTRAINT configuraciones_empresa_id_fkey FOREIGN KEY (empresa_id) REFERENCES public.empresas(id);


--
-- TOC entry 5162 (class 2606 OID 25765)
-- Name: conversacion_etiquetas conversacion_etiquetas_asignada_por_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.conversacion_etiquetas
    ADD CONSTRAINT conversacion_etiquetas_asignada_por_fkey FOREIGN KEY (asignada_por) REFERENCES public.agentes(id) ON DELETE SET NULL;


--
-- TOC entry 5163 (class 2606 OID 25755)
-- Name: conversacion_etiquetas conversacion_etiquetas_conversacion_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.conversacion_etiquetas
    ADD CONSTRAINT conversacion_etiquetas_conversacion_id_fkey FOREIGN KEY (conversacion_id) REFERENCES public.conversaciones(id) ON DELETE CASCADE;


--
-- TOC entry 5164 (class 2606 OID 25760)
-- Name: conversacion_etiquetas conversacion_etiquetas_etiqueta_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.conversacion_etiquetas
    ADD CONSTRAINT conversacion_etiquetas_etiqueta_id_fkey FOREIGN KEY (etiqueta_id) REFERENCES public.etiquetas(id) ON DELETE CASCADE;


--
-- TOC entry 5147 (class 2606 OID 16506)
-- Name: conversaciones conversaciones_agente_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.conversaciones
    ADD CONSTRAINT conversaciones_agente_id_fkey FOREIGN KEY (agente_id) REFERENCES public.agentes(id);


--
-- TOC entry 5148 (class 2606 OID 25796)
-- Name: conversaciones conversaciones_categoria_cierre_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.conversaciones
    ADD CONSTRAINT conversaciones_categoria_cierre_id_fkey FOREIGN KEY (categoria_cierre_id) REFERENCES public.categoria_cierre(id) ON DELETE SET NULL;


--
-- TOC entry 5149 (class 2606 OID 25801)
-- Name: conversaciones conversaciones_cerrado_por_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.conversaciones
    ADD CONSTRAINT conversaciones_cerrado_por_id_fkey FOREIGN KEY (cerrado_por_id) REFERENCES public.agentes(id) ON DELETE SET NULL;


--
-- TOC entry 5150 (class 2606 OID 16470)
-- Name: conversaciones conversaciones_empresa_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.conversaciones
    ADD CONSTRAINT conversaciones_empresa_id_fkey FOREIGN KEY (empresa_id) REFERENCES public.empresas(id);


--
-- TOC entry 5151 (class 2606 OID 16417)
-- Name: conversaciones conversaciones_usuario_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.conversaciones
    ADD CONSTRAINT conversaciones_usuario_id_fkey FOREIGN KEY (usuario_id) REFERENCES public.usuarios(id);


--
-- TOC entry 5165 (class 2606 OID 25819)
-- Name: etiqueta_empresas etiqueta_empresas_etiqueta_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.etiqueta_empresas
    ADD CONSTRAINT etiqueta_empresas_etiqueta_id_fkey FOREIGN KEY (etiqueta_id) REFERENCES public.etiquetas(id) ON DELETE CASCADE;


--
-- TOC entry 5152 (class 2606 OID 16475)
-- Name: conversaciones fk_empresa; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.conversaciones
    ADD CONSTRAINT fk_empresa FOREIGN KEY (empresa_id) REFERENCES public.empresas(id);


--
-- TOC entry 5157 (class 2606 OID 16534)
-- Name: infracciones infracciones_agente_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.infracciones
    ADD CONSTRAINT infracciones_agente_id_fkey FOREIGN KEY (agente_id) REFERENCES public.agentes(id) ON DELETE SET NULL;


--
-- TOC entry 5158 (class 2606 OID 16527)
-- Name: infracciones infracciones_conversacion_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.infracciones
    ADD CONSTRAINT infracciones_conversacion_id_fkey FOREIGN KEY (conversacion_id) REFERENCES public.conversaciones(id) ON DELETE CASCADE;


--
-- TOC entry 5153 (class 2606 OID 25715)
-- Name: mensajes mensajes_agente_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.mensajes
    ADD CONSTRAINT mensajes_agente_id_fkey FOREIGN KEY (agente_id) REFERENCES public.agentes(id) ON DELETE SET NULL;


--
-- TOC entry 5154 (class 2606 OID 16438)
-- Name: mensajes mensajes_conversacion_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.mensajes
    ADD CONSTRAINT mensajes_conversacion_id_fkey FOREIGN KEY (conversacion_id) REFERENCES public.conversaciones(id);


--
-- TOC entry 5171 (class 2606 OID 25905)
-- Name: permiso_log permiso_log_admin_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.permiso_log
    ADD CONSTRAINT permiso_log_admin_id_fkey FOREIGN KEY (admin_id) REFERENCES public.agentes(id);


--
-- TOC entry 5172 (class 2606 OID 25910)
-- Name: permiso_log permiso_log_usuario_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.permiso_log
    ADD CONSTRAINT permiso_log_usuario_id_fkey FOREIGN KEY (usuario_id) REFERENCES public.agentes(id);


--
-- TOC entry 5159 (class 2606 OID 16574)
-- Name: respuestas_rapidas respuestas_rapidas_agente_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.respuestas_rapidas
    ADD CONSTRAINT respuestas_rapidas_agente_id_fkey FOREIGN KEY (agente_id) REFERENCES public.agentes(id) ON DELETE CASCADE;


--
-- TOC entry 5173 (class 2606 OID 25936)
-- Name: rol_permisos_template rol_permisos_template_updated_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.rol_permisos_template
    ADD CONSTRAINT rol_permisos_template_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES public.agentes(id) ON DELETE SET NULL;


--
-- TOC entry 5160 (class 2606 OID 25627)
-- Name: sticker_favoritos sticker_favoritos_agente_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.sticker_favoritos
    ADD CONSTRAINT sticker_favoritos_agente_id_fkey FOREIGN KEY (agente_id) REFERENCES public.agentes(id) ON DELETE CASCADE;


--
-- TOC entry 5161 (class 2606 OID 25705)
-- Name: transferencias transferencias_conversacion_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.transferencias
    ADD CONSTRAINT transferencias_conversacion_id_fkey FOREIGN KEY (conversacion_id) REFERENCES public.conversaciones(id) ON DELETE CASCADE;


--
-- TOC entry 5168 (class 2606 OID 25867)
-- Name: usuario_areas usuario_areas_usuario_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.usuario_areas
    ADD CONSTRAINT usuario_areas_usuario_id_fkey FOREIGN KEY (usuario_id) REFERENCES public.agentes(id) ON DELETE CASCADE;


--
-- TOC entry 5167 (class 2606 OID 25854)
-- Name: usuario_empresas usuario_empresas_usuario_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.usuario_empresas
    ADD CONSTRAINT usuario_empresas_usuario_id_fkey FOREIGN KEY (usuario_id) REFERENCES public.agentes(id) ON DELETE CASCADE;


--
-- TOC entry 5169 (class 2606 OID 25884)
-- Name: usuario_modulos usuario_modulos_modulo_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.usuario_modulos
    ADD CONSTRAINT usuario_modulos_modulo_fkey FOREIGN KEY (modulo) REFERENCES public.modulos(id) ON DELETE CASCADE;


--
-- TOC entry 5170 (class 2606 OID 25879)
-- Name: usuario_modulos usuario_modulos_usuario_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.usuario_modulos
    ADD CONSTRAINT usuario_modulos_usuario_id_fkey FOREIGN KEY (usuario_id) REFERENCES public.agentes(id) ON DELETE CASCADE;


-- Completed on 2026-08-20 11:58:55

--
-- PostgreSQL database dump complete
--

\unrestrict HWvh3cQiivigsmVpTOK5zy7KRJaFtuy4bI8mHb44jUhPCzc3H30cIN7PejNFmP0

