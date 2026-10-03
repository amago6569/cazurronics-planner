# Cazurronics Planner

Web que monta planes por horas en León y su provincia con IA: la persona dice qué le apetece, su presupuesto y una zona en el mapa, y recibe una ruta con sitios reales (comprobados en Google Places), la previsión del tiempo y la agenda de eventos de ese día. Los planes se pueden compartir y votar en grupo.

Hecha con Next.js 16 (App Router), React 19, Tailwind 4 y Leaflet. Se despliega en Vercel.

## Arrancar en local

```bash
npm install
npm run dev
```

Abre <http://localhost:3000>. Sin Redis configurado, los datos se guardan en memoria y se borran al reiniciar.

| Comando | Para qué |
| --- | --- |
| `npm run dev` | Servidor de desarrollo |
| `npm run build` | Compilar para producción |
| `npm run lint` | Revisar el código con ESLint |
| `npm test` | Tests de la lógica (duplicados, horas, presupuesto, finde, votos…) |

## Variables de entorno

Van en `.env.local` en local y en Vercel → Settings → Environment Variables.

| Variable | Obligatoria | Qué es |
| --- | --- | --- |
| `GEMINI_API_KEY` | Sí | Clave de Google AI Studio (Gemini). Solo se usa en el servidor. |
| `GOOGLE_MAPS_API_KEY` | Sí | Places, Geocoding y fotos de Google Maps. |
| `STREET_VIEW_API_KEY` | No | Clave para la vista 360º. **Acaba en el navegador** (va dentro del iframe), así que restríngela por dominio en Google Cloud. Si falta, se usa `GOOGLE_MAPS_API_KEY` (nunca la de Gemini). |
| `KV_REST_API_URL` / `KV_REST_API_TOKEN` | En producción | Redis de Upstash (Vercel → Storage → Upstash for Redis). También valen `UPSTASH_REDIS_REST_URL` / `_TOKEN`. |
| `PANEL_CLAVE` | Para `/panel` | Contraseña del panel del equipo. |
| `NEGOCIOS_SECRETO` | Recomendada | Firma los enlaces privados de cada local (`/negocio/…`). Si falta, se usa `PANEL_CLAVE`. |
| `CRON_SECRET` | En producción | Vercel la manda a los crons. Sin ella, los crons responden 401. |
| `NEXT_PUBLIC_SITE_URL` | Con dominio propio | Por ejemplo `https://cazurronics.es` (sitemap, enlaces y textos para compartir). |
| `NEXT_PUBLIC_GAS_BUSINESS_URL` | No | Google Apps Script que recibe las solicitudes de negocios (además se guardan en `/panel`). |
| `RESEND_API_KEY`, `AVISO_EMAIL`, `AVISO_DE` | No | Correos de aviso al equipo (resumen del finde y locales listos para escribirles). |

## Cómo funciona

**Montar un plan** (`/api/plan`):

1. Se comprueba lo que llega (fecha, punto del mapa, números) y se aplica un freno por conexión (20 planes cada 10 minutos).
2. A la vez: el tiempo (Open-Meteo), la agenda guardada de ese día, una búsqueda de eventos a medida con Gemini y los sitios que la comunidad ha valorado bien o mal en la zona.
3. Gemini (con Google Search) propone las paradas. Si un modelo está saturado, prueba el siguiente (`src/lib/gemini.js`).
4. Todas las paradas se comprueban a la vez en Google Places: coordenadas reales, teléfono, web, horario, foto y Street View. Los bares y restaurantes sin ficha real se descartan.
5. Se ajusta al presupuesto, se quitan duplicados, se ordena por hora y se guarda para compartir (`/plan/ID`). Las estadísticas y los rankings se escriben en segundo plano.

**Agenda de eventos** (`src/lib/eventos.js`): los crons de `vercel.json` barren cada día las fuentes de la provincia (datos abiertos de la Junta y búsquedas dirigidas con Gemini). Solo se publica lo que tiene una fuente comprobada. De ahí salen `/agenda-leon`, las páginas por zona, `/finde` y "Qué hacer hoy/mañana".

**Panel del equipo** (`/panel`): analítica propia sin cookies, ranking de locales con su enlace privado, estado del barrido, resumen del finde para redes y captación de negocios.

## Estructura

```
src/
  app/            páginas y rutas de la API (App Router)
    api/          plan, retocar, planes (compartir y votar), barrido, panel, finde, captación…
    components/   componentes de la interfaz
  lib/            lógica: almacén (Redis), IA, eventos, agenda, zonas, lugares, freno anti-abuso…
tests/            tests de la lógica (Vitest)
vercel.json       crons del barrido y de los avisos
```
