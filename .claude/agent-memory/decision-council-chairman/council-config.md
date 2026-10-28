# Decision Council Configuration
Domain: Negocio digital — producto web (Cazurronics Planner: planes de ocio con IA en León)
Primary tension: Coste a corto plazo vs valor a largo plazo (y construir funciones vs conseguir usuarios)
Key constraints: No subir el gasto de Google (Gemini 3.x y búsquedas de pago prohibidas en el barrido; planes en modo ahorro por defecto); no tocar el contrato de /api/plan, /api/retocar ni el envío a Apps Script; dueño no técnico (Alejandro); equipo pequeño; solo eventos con fuente comprobada y locales con ficha real en Google Places. Ojo: PLANES_MAX_DIA=0 en Vercel significa SIN tope.
Domain context: Next.js 16 en Vercel. Monetización prevista: Cazurronics Choices (locales destacados). Copia aparte para Palencia (Palen Planner).
Default advisor origin: pre-built
Default decision type: auto-detect
Language: español de España, frases cortas, una sola recomendación
Last updated: 2026-10-28
Setup note: configuración inferida de CLAUDE.md y README; el Chair no pudo hacer la entrevista inicial (sin AskUserQuestion en subagente). Ajustable con /decision-council:configure.

## Panel Composition
- The Optimist
- The Pessimist
- The Devil's Advocate
- The Pragmatist
- The Behaviourist (process role)

## Structural Advisors
Devil's Advocate: included
Behaviourist: included
