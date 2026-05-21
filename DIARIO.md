# Diario de trabajo — Caravanas2

Registro del trabajo realizado en el proyecto. Actualízalo cada vez que hagas cambios relevantes.

---

## Stack técnico

| Capa | Tecnología |
|---|---|
| Frontend | React 19 + Vite 8 |
| Estilos | CSS plano (sin librerías) |
| Backend local | Express 5 + Node.js |
| Backend producción | Netlify Functions (serverless) |
| Base de datos | MongoDB Atlas |
| Pagos | Stripe (checkout + suscripción mensual) |
| Despliegue | Netlify |

---

## Cómo arrancar en local

```bash
# Instalar dependencias
npm install

# Crear el archivo de entorno (ver sección Variables de entorno)
cp .env.example .env
# Rellenar .env con los valores reales

# Arrancar frontend + backend juntos
npm run dev:full
```

- Frontend: http://localhost:5173
- Backend API: http://localhost:4242

---

## Variables de entorno necesarias

Crea un archivo `.env` en la raíz (nunca lo subas al repo, ya está en `.gitignore`):

```
STRIPE_SECRET_KEY=sk_live_...        # Clave secreta de Stripe
MONGODB_URI=mongodb+srv://...        # URI de conexión a MongoDB Atlas
MONGODB_DB_NAME=caravanas            # Nombre de la base de datos
APP_URL=http://localhost:5173        # URL del frontend (en producción: https://caravanas2.netlify.app)
VITE_API_BASE_URL=http://localhost:4242  # Solo para desarrollo local
ADMIN_PANEL_PASSWORD=...             # Contraseña del panel de administración
PORT=4242                            # Puerto del servidor Express local
```

En producción estas variables están configuradas directamente en Netlify (sin el archivo .env).

---

## Cómo desplegar en Netlify

```bash
# Login (solo la primera vez)
netlify login

# Build + deploy a producción
netlify deploy --prod
```

URL de producción: **https://caravanas2.netlify.app**

---

## Arquitectura de la API

En local se usa `server.js` (Express). En producción, Netlify redirige las rutas a funciones serverless en `netlify/functions/`:

| Ruta | Función | Descripción |
|---|---|---|
| `GET /api/availability` | `get-availability.js` | Lee fechas disponibles de MongoDB |
| `PUT /api/admin/availability` | `update-availability.js` | Actualiza fechas (requiere contraseña) |
| `POST /api/admin/verify` | `verify-admin.js` | Valida la contraseña del panel admin |
| `POST /api/create-checkout-session` | `create-checkout-session.js` | Crea sesión de pago en Stripe |

---

## Panel de administración

- Acceder desde el botón **Admin** en la barra de navegación
- Introducir la contraseña configurada en `ADMIN_PANEL_PASSWORD`
- El calendario muestra los próximos 90 días: verde = disponible, naranja = bloqueado
- Clic en un día para cambiar su estado, luego **Guardar disponibilidad**

---

## Registro de cambios

### 2026-05-19 — Javi
- Clonado repo original `atuparking` como base del proyecto
- Configurado entorno local con MongoDB Atlas y variables de entorno
- Rediseñado panel admin: flujo de login con verificación de contraseña en backend
- Añadido calendario mensual visual en el panel admin (rejilla 7 columnas, verde/naranja)
- Nuevo endpoint `POST /api/admin/verify` en server.js y en Netlify Functions
- Desplegado en Netlify bajo el dominio `caravanas2.netlify.app`
- Corregido bug de producción: `VITE_API_BASE_URL` se metía en el bundle, creado `.env.production`
- Configuradas variables de entorno en Netlify (MongoDB, Stripe, admin password)

### 2026-05-21 — Javi
- Auditoría PageSpeed/Lighthouse: Performance 76, SEO 92
- Logo convertido de PNG 478 KB a WebP 5.5 KB (−99%)
- Google Fonts cambiado a carga no bloqueante (preload + onload)
- Street View ajustado a dimensiones reales mostradas
- Añadidos cache headers de 1 año para assets estáticos en Netlify
- Creado `public/robots.txt` válido
- Resultado tras mejoras: Performance 91, SEO 100, Accesibilidad 100, Best Practices 100

---

## Pendiente / Ideas

- [ ] Añadir clave de Stripe cuando esté lista para activar pagos reales
- [ ] Webhook de Stripe para confirmar reservas tras pago exitoso
- [ ] Panel admin: listado de reservas activas
- [ ] Sitemap.xml para mejorar indexación SEO
