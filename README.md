# 墨 Adrian Portilla Tattoo - Sitio Web & Tienda

> **Nota del Desarrollador:** Este proyecto ha sido arquitectado, creado y es mantenido por **Leo Barrantes**.

Este documento unificado describe el estado actual, la arquitectura integral y las instrucciones para gestionar el proyecto web del artista tatuador Adrian Portilla. Esta plataforma incluye un frontend moderno, una tienda online de productos, un portafolio de tatuajes, y un backend seguro pensado en brindar tranquilidad a largo plazo.

---

## 🚀 Estado Actual y Filosofía ("Cero Mantenimiento")

El proyecto ha sido diseñado pensando en ofrecer un rendimiento sobresaliente y un mantenimiento mínimo. Anteriormente se utilizó un sistema de archivos local de base de datos (SQLite), pero el sistema evolucionó y se migró a arquitecturas modernas en la nube que no requieren gestionar discos físicos de los servidores.

El proyecto principal se divide en dos:
1. **Frontend:** Construido con **Astro**, ideal para sitios de muchísimo contenido e imágenes. Es super rápido, seguro y tiene soporte multi-idioma nativo para textos e inventario.
2. **Backend API:** Un micro-servidor **Node.js (Express)** que maneja procesos delicados utilizando **Prisma ORM**.
3. **Persistencia (Desarrollo):** Actualmente utilizamos **SQLite** (`api/prisma/tattoo.db`) para agilizar el desarrollo local sin dependencias externas.
4. **Persistencia (Producción - Planificado):** Se migrará a **Supabase (PostgreSQL)** para el despliegue final, aprovechando la versatilidad de Prisma para cambiar de motor de base de datos fácilmente.

### 🛠 Tecnologías Principales Integradas
- **Astro** (Framework UI web ultrarrápido)
- **Node.js + Express** (Contratista de Lógica de Negocios y API REST)
- **Supabase / PostgreSQL** (Bases de datos remota "Serverless" + Autenticación de Google OAuth)
- **Cloudinary** (Servidor CDN de optimización fotográfica sin peso adicional al proyecto local)
- **ONVO** (Pasarela local principal para recibir pagos digitales)
- **Bcrypt / JWT** (Protección de credenciales y sistema tradicional de tokens)

---

## 🗂️ Estructura del Proyecto (Monorepo)

```text
C:\Dev\AdrianPortilla Tatto\
│
├── api/                        # Backend REST API (Node.js/Express)
│   ├── routes/                 # Lógica separada por rutas (auth, gallery, payments)
│   ├── .env                    # Variables confidenciales del backend (Ignorado en GIT)
│   └── server.js               # Archivo base y arranque de Express
│
├── astro-frontend/             # Sitio Web Frontend (Astro)
│   ├── src/                    # Código fuente UI (layouts, components)
│   │   ├── pages/[lang]/       # Páginas y soporte dinámico de idiomas (es, en, fr)
│   │   │   ├── admin/          # Panel administrativo privado
│   │   │   └── tienda.astro    # Tienda digital con carrito de compras
│   ├── astro.config.mjs        # Configuración principal del proyecto web
│   └── .env                    # Variables del Front (Ignorado en GIT)
│
├── supabase_setup.sql          # Script SQL para inyectar las tablas e info inicial
└── README.md                   # Este documento de arquitectura unificada
```

---

## ⚙️ Requisitos Previos

Si deseas descargar el repo y probar el entorno local, asegúrate de tener:
- **Node.js** (v18 o superior).
- **SQLite** (Integrado mediante Prisma, se autogenera).
- **Cloudinary:** Cuenta activa para optimización fotográfica.
  > [!IMPORTANT]
  > La cuenta de Cloudinary configurada actualmente está asociada al **correo de la Universidad**.
- Llaves activas para pagos en **ONVO**.

---

## 🔑 Variables de Entorno (.env)

Debes configurar tus secretos en ambos micro-proyectos de manera independiente antes de correr los comandos de inicio.

### 1. Variables de la API (`api/.env`)
Crea un archivo llamado `.env` en la ruta `/api` con estos esquemas base:

```env
PORT=3001

# Cloudinary (Imágenes)
CLOUDINARY_CLOUD_NAME=tu_cloud_name_aqui
CLOUDINARY_API_KEY=tu_api_key_aqui
CLOUDINARY_API_SECRET=tu_api_secret_aqui

# ONVO (Tarjetas y Pagos)
ONVO_SECRET_KEY=tu_clave_secreta_de_onvo_aqui
ONVO_PUBLIC_KEY=tu_clave_publica_de_onvo_aqui

# Supabase (Tu PostgreSQL y Usuarios)
SUPABASE_URL=tu_url_de_supabase_aqui
SUPABASE_ANON_KEY=tu_anon_key_de_supabase_aqui
SUPABASE_SERVICE_ROLE_KEY=tu_service_role_key_aqui

# Autenticadores adicionales
JWT_SECRET=tu_secreto_hasheado_1234
GOOGLE_CLIENT_ID=tu_cliente_id_de_google_aqui
GOOGLE_CLIENT_SECRET=tu_secreto_de_google_aqui
```

### 2. Variables del Frontend (`astro-frontend/.env`)
Crea otro `.env` dentro de `astro-frontend/`:

```env
PUBLIC_API_URL=http://localhost:3001
PUBLIC_SUPABASE_URL=tu_url_de_supabase_aqui
PUBLIC_SUPABASE_ANON_KEY=tu_anon_key_de_supabase_aqui
```

*(Nota general: Mantén tus accesos `.env` locales seguros, nunca los subas a ningún control de versiones público).*

---

## 🗄️ Configuración Inicial de Base de Datos (Supabase)

Para construir toda la base del sitio al mudarlo a PostgreSQL:
1. Ve al panel administrativo en [Supabase](https://supabase.com) y ubica el **SQL Editor**.
2. Copia todo el contenido del archivo principal `supabase_setup.sql` ubicado en la raíz del proyecto.
3. Ejecuta el script. Este comando levantará toda la estructura de tablas para `users` / `products` e inyectará los usuarios semilla por defecto.

---

## 💻 Desarrollo Local (Cómo Levantar Todo)

Necesitas tener dos instancias del servidor escuchando; lo logramos en dos terminales en paralelo.

**Terminal 1 (Backend API):**
```bash
cd api
npm install
npm run dev
```
👉 *Deberías ver un mensaje en verde que indica que la API escucha en: http://localhost:3001*

**Terminal 2 (Frontend Web):**
```bash
cd astro-frontend
npm install
npm run dev
```
👉 *El sitio visual interactivo se mostrará en: http://localhost:4321 / http://localhost:4321/es*

---

## 👮‍♂️ Credenciales por Defecto (Acceso Semilla)

Si aplicaste con éxito el script `supabase_setup.sql`, el sistema inyecta directamente dos usuarios de prueba en sus respectivos roles:

- **Rol Admin (Entrada al Panel `/es/admin`):**
  - **Correo:** `lbarrantesm@ucenfotec.ac.cr`
  - **Password:** `TestAdmin#123`

- **Rol Cliente Normal:**
  - **Correo:** `leobarrantes8@gmail.com`
  - **Password:** `TestUser#123`

---

## 🚀 Despliegue Oficial en Producción (Guía Rápida)

Para asegurar que tu trabajo minimice los reinicios y los gastos estáticos, la magia de usar estos BaaS (Backend-as-a-Service) te abre las siguientes puertas:

1. **Frontend (Astro):** Súbelo atando tu repositorio en GitHub con un host como **Vercel** o **Netlify**. Cada push aplicará los cambios visualmente de inmediato. (Comúnmente es totalmente gratis).
2. **Backend API (Node.js):** Sincroniza la carpeta `/api` en **Render** o **Railway**. Al no tener la BD local, este micro-servicio se puede suspender (en casos gratuitos) e inicializar dinámicamente sin que pierdas jamás ningún dato. Todo vivirá seguro de forma externa.
3. **Database (Supabase):** Su generoso plan gratuito aloja tu data con copias de seguridad pasivas.
4. **Media (Cloudinary):** Todas las fotos pesadas de tatuajes vivirán optimizadas lejos de tus gastos en Vercel o Render.
