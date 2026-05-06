# Documentación Técnica - ISP Chatbot CRM 🚀

Este proyecto es un sistema de gestión de clientes (CRM) con un chatbot integrado para Telegram, diseñado para automatizar la atención inicial y permitir la intervención humana fluida.

## 🏗️ Arquitectura General
El sistema sigue una arquitectura de **Servicios y Adaptadores**:
- **Backend**: Node.js + Express + PostgreSQL.
- **Frontend**: React + Lucide-react + Socket.io-client.
- **Comunicación Real-time**: Socket.io para actualizaciones instantáneas en el Dashboard.

---

## 📂 Estructura del Backend (`/backend`)

### 1. `src/index.js` (Punto de Entrada)
- **Función**: Configura el servidor HTTP, Express y Socket.io.
- **Bloque Clave**: Orquesta el arranque de adaptadores (`iniciarTelegram`) y servicios de fondo (`iniciarAutoCierre`).

### 2. `src/core/` (El "Cerebro")
- **`core.js`**: Contiene la **Máquina de Estados (FSM)** del bot. 
    - Estados: `MENU_PRINCIPAL`, `IDENTIFICACION`, `ENCUESTA_AGENTE`, `ENCUESTA_BOT`.
    - Lógica: Procesa el mensaje del usuario y decide la respuesta y el siguiente estado.
- **`conversaciones.js`**: Abstracción de la base de datos. Funciones para crear usuarios, buscar conversaciones activas y guardar mensajes.

### 3. `src/adapters/telegram.js`
- **Función**: Actúa como puente entre Telegram y el `core`.
- **Bloque Clave**: Escucha mensajes vía Telegraf, los formatea para el `core` y emite eventos de Socket.io para que el Dashboard se actualice sin recargar.

### 4. `src/services/autoClose.service.js`
- **Función**: Tarea programada que corre cada minuto.
- **Lógica**: Consulta el `tiempo_inactividad` de la DB y cierra automáticamente los chats que no han tenido actividad (`updated_at`). Dispara la encuesta de satisfacción antes de cerrar.

---

## 📂 Estructura del Frontend (`/frontend`)

### 1. `src/services/api.js`
- **Función**: Capa de servicio que centraliza todos los `fetch` hacia el backend. 
- **Ventaja**: El resto de componentes no necesitan saber la URL del servidor ni manejar cabeceras HTTP.

### 2. `src/components/`
- **`Chat/`**: 
    - `ChatList.js`: Maneja el filtrado de chats (Abiertos, Míos, Todos) y la búsqueda.
    - `ChatWindow.js`: Renderiza la burbujas de chat, banners de sistema y el área de escritura.
- **`Layout/`**: Estructura visual (Sidebar colapsable y TopBar).
- **`Settings/`**: Interfaz para que el administrador cambie parámetros como el tiempo de inactividad.

---

## 🗄️ Modelo de Datos (PostgreSQL)

- **`usuarios`**: Almacena el `external_id` (Telegram ID) y datos básicos.
- **`conversaciones`**: El registro central. 
    - `es_humano`: Boolean que indica si el bot está desactivado para ese cliente.
    - `estado`: Controla en qué parte del flujo está el bot.
    - `updated_at`: Timestamp crucial para el auto-cierre.
- **`mensajes`**: Historial completo de la charla.
- **`configuraciones`**: Tabla clave-valor para ajustes dinámicos.
- **`calificaciones`**: Almacena el feedback (CSAT) con el `tipo` (agente o bot).

---

## 🔄 Flujos Críticos

### Cierre de Chat y Encuesta (CSAT)
1. El Agente hace POST a `/agente/liberar`.
2. El sistema cambia el estado a `ENCUESTA_AGENTE`.
3. El Adaptador envía un mensaje de opciones (1, 2, 3) al Telegram del cliente.
4. Cuando el cliente responde, el `core.js` detecta el estado `ENCUESTA_AGENTE`, guarda la puntuación y cierra el chat definitivamente.

---

## 🛠️ Comandos de Desarrollo
- **Backend**: `node src/index.js`
- **Frontend**: `npm start`
- **Migraciones**: `node migrate_vX.js` (Para actualizar la estructura de la base de datos).
