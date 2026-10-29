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
- Eventos: lo de fuente comprobada se publica; lo dudoso pasa por el Verificador (`lib/guardia.js`): confirmado → web, desmentido o enlace roto → fuera, sin confirmar → web marcado «por confirmar» y aviso a Alejandro (panel y Telegram) para que lo quite si no cuadra. Regla suya del 29-10-2026 (ampliada ese mismo día): «que pase los filtros que quiera, pero que se haga solo». Lo «por confirmar» no espera su Vale/Quitar: el Verificador lo vuelve a mirar solo (Google, otra web) y lo confirma o lo quita; en Telegram va una línea, no botones por evento. Los bares y restaurantes sin ficha real en Google Places se descartan. Mantén esos filtros.
- Los crons de `vercel.json` llevan horas escalonadas para no saturar la cuota. Si añades uno, ponlo en una hora libre.

## Oficina (/panel/oficina)

- Cada tarea automática es un empleado. Para meter uno nuevo basta una entrada en `DEPARTAMENTOS` de `src/lib/oficina.js` (con `rutas` de su cron) y que su tarea guarde `oficina:turno:<id>`: sale solo su monigote, su mesa (o el anexo), su ficha y su chat.
- Webs fiables (ayuntamientos, Diputación, Junta, prensa local) en `lib/fiables.js`. Esas señales solo sirven para confirmar, nunca para tirar un evento.
- Avisos a Alejandro: un fallo suelto no avisa (solo si se repite 2 días). La clave caducada, un modelo retirado o más de 1 € al día avisan al momento (`lib/avisos.js`).
- Los fallos se guardan con su motivo en cristiano (`motivoClaro` en `lib/gemini.js`) y la Repesca los repite. No vuelvas a guardar solo «Error en la IA».

- El jefe (`hablarConJefe` en `lib/jefe.js` + `lib/jefeSabe.js`) contesta con datos reales de la oficina, nunca «no tengo esa información». Si de ese pueblo y fechas no hay eventos, busca en ese momento (modelo 2.x, máx. `BUSCA_AL_DIA` al día, 6 h de memoria por pregunta) y lo sube a la agenda. Regla de Alejandro (29-10-2026): «que le pregunte algo y me responda, que sepa».

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
