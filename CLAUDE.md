@AGENTS.md

# Cazurronics Planner: reglas para Claude

Web de planes de ocio en León y provincia con IA. Next.js 16 en Vercel. El README explica cómo funciona; aquí van las reglas que no se deducen del código.

## Quién y cómo

- El dueño es Alejandro. No es técnico con GitHub: explícale los cambios en lenguaje llano, sin pasos de GitHub. Si hay que fusionar un PR, lo fusionas tú cuando él dé el OK explícito.
- Español de España en textos, comentarios, commits y PR. Frases cortas.
- Ante una decisión técnica, da una sola recomendación, no un menú de opciones.

## Coste de la IA (lo primero)

La factura de Google se disparó en octubre de 2026 por búsquedas de pago. No la vuelvas a abrir:

- Los modelos Gemini 3.x cobran **cada búsqueda en Google**. Los 2.x entran en las 1.500 gratis al día.
- El barrido (`MODELOS.barrido` en `src/lib/gemini.js`) usa solo modelos 2.x. Nunca añadas ahí un 3.x ni un alias `-latest`: si los 2.x fallan, el tramo se salta y se repite en la siguiente pasada.
- Planes y retoques van en modo ahorro por defecto: sin búsqueda en Google, la IA elige entre locales ya comprobados. `PLANES_CON_GOOGLE=1` en Vercel vuelve al modo con búsqueda. No cambies ese valor por defecto.
- Antes de añadir una llamada nueva a Gemini o a Google Places, di cuánto cuesta al mes con números (llamadas al día × precio).

## Lógica que no se rompe

- No toques el contrato de `/api/plan`, `/api/retocar` ni el envío a Google Apps Script (`NEXT_PUBLIC_GAS_BUSINESS_URL`) salvo que se pida.
- Los rediseños cambian la parte visual. Los estados de React y las llamadas al servidor se quedan como estaban.
- Solo se publican eventos con fuente comprobada, y los bares y restaurantes sin ficha real en Google Places se descartan. Mantén esos filtros.
- Los crons de `vercel.json` llevan horas escalonadas para no saturar la cuota. Si añades uno, ponlo en una hora libre.

## Diseño

- Sistema visual "Vidriera": usa las clases de `src/lib/estilos.js` (`GLASS`, `BOTON_CTA`, `PRESS`…) en vez de inventar estilos nuevos.
- Solo Tailwind y React. Mobile first: debe sentirse como una app nativa en el móvil, con los botones principales al alcance del pulgar.

## Comprobar antes de dar algo por hecho

1. `npm test` y `npm run lint` sin errores.
2. `npm run build` si cambias páginas, rutas o configuración.
3. Si cambias algo visual, ábrelo en el navegador (`npm run dev`) en tamaño móvil y en escritorio antes de abrir el PR.
4. Si falta una variable de entorno para probar algo, dilo en el PR en vez de suponer que funciona.

## Palen Planner

Existe una copia para Palencia en otro repo (`amago6569/palen-planner`) que va por libre. Al acabar un cambio aquí, recuerda en el PR si convendría pasarlo a Palen. No lo portes sin que Alejandro lo pida.

## Cuando Claude se equivoque

Si Alejandro corrige algo que debería valer para siempre, añade aquí una línea con la regla.
