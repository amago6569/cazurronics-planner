# Reglas de un plan de Cazurronics

Regla de Alejandro (24-11-2026). Un plan tiene que poder firmarlo un leonés de toda la vida. Cada regla se comprueba con código (`evals/reglas.js`) sobre los 20 casos de `evals/casos.json`: `npm run evals`.

## Reglas comprobables

| Id | Regla | Cómo se comprueba |
|---|---|---|
| R1 `real` | 0 sitios o eventos inventados. | Cada parada tiene ficha de Google Places (`placeId`), es un evento de la agenda con su enlace (`fuente`) o es una ruta o paraje de la lista (`lib/rutas.js`). |
| R2 `leon` | 0 paradas fuera de la provincia de León. | Coordenadas dentro de la frontera de `lib/provincia.js`. |
| R3 `sin-repetir` | 0 paradas duplicadas. | Ni el mismo `placeId` dos veces ni dos nombres parecidos (`lib/nombres.js`). |
| R4 `hora` | Cada parada con hora concreta. Nunca «Todo el día». | `hora` en formato HH:MM. |
| R5 `donde` | Cada parada con zona o dirección. | Campo `direccion` o `lugar` con texto. |
| R6 `precio` | Cada parada con precio estimado. | Campo `precio` con texto («Gratis» vale). |
| R7 `abierto` | Cada sitio abierto a la hora propuesta. | Bares, restaurantes, cafeterías, discotecas y museos: la hora cae dentro de su horario de Google de ese día. Sin horario no cuenta como abierto. |
| R8 `presupuesto` | Suma de precios ≤ presupuesto. | Suma con `parsePrecio` (un rango cuenta su media) ≤ presupuesto máximo. Con 0 € todo tiene que ser gratis. |
| R9 `andando` | Máximo 15 min andando entre paradas seguidas. | 1,2 km en línea recta como mucho. Solo se salta si el caso lo marca como `zonaLibre` (el usuario elige otra zona o un plan de día por la provincia). |
| R10 `lo-pedido` | Si faltan datos, el plan lo dice y no rellena. | Cada parada es de un tipo que encaja con lo pedido. Si hay menos de lo pedido, el plan lleva aviso. Si no hay nada, sale vacío con mensaje. |
| R11 `rapido` | Respuesta en menos de 5 s. | Tiempo de `/api/panel/comparar` para ese caso. |

Un plan vacío cumple R1-R9 (no tiene paradas que fallen) y solo aprueba R10 si el caso admite que no haya nada.

## Objetivos de la web

| Área | Objetivo |
|---|---|
| Planes | Los 20 casos cumplen todas las reglas (100 %). |
| Gasto | IA ≤ 0,40 € al día. 0 pantallas «Estamos recargando la IA». |
| Rendimiento | Lighthouse móvil ≥ 90. LCP < 2,5 s, CLS < 0,1, INP < 200 ms. |
| Accesibilidad, buenas prácticas y SEO | Lighthouse 100. 0 fallos graves o críticos de axe. |
| Seguridad | 0 claves en el navegador. Límite por IP en todo lo que gasta dinero. Entradas validadas. CSP y HSTS. 0 vulnerabilidades altas o críticas. |
| SEO | sitemap.xml, robots.txt, título y descripción únicos, Open Graph del plan compartido, datos estructurados de eventos en la agenda. |
| Legal | Aviso legal, privacidad y cookies publicados, con la ubicación explicada. |
| Código | 0 errores de lint. Todas las pruebas en verde. |

## Cómo se usa

- `npm run check`: lint y pruebas. Sin gasto.
- `npm run evals`: monta los 20 planes en la web publicada (`/api/panel/comparar`, no guarda nada ni suma visitas) y saca la tabla caso × regla, el tiempo medio y el coste. Necesita `PANEL_CLAVE` en el entorno. Opciones: `--casos 5`, `--solo humedo-20,martes-23`, `--modo sinIA` (el plan B, sin gastar IA).
- Coste de una pasada completa: IA ≈ 0,16 € (20 × 0,008 €). Google Maps: 0 € dentro de la capa gratis del mes. Si ya se pasó, como mucho unos 2,90 € la primera pasada (60 búsquedas, 60 fichas y 20 localidades) y casi 0 las siguientes, porque las búsquedas se guardan 72 h y las fichas 24 h. El script cuenta lo que gasta cada caso y para al llegar a `EVALS_MAX_EUROS` (1 € de serie).
- El hook de parada (`.claude/settings.json`, `scripts/hook-parada.mjs`) pasa `npm run check` siempre y `npm run evals` con 5 casos solo en trabajos que tocan los planes, con clave y como mucho cada 12 h. Cuentan dentro del tope de IA del día de la web. Si algo falla, Claude no puede dar el trabajo por acabado sin verlo.
- Las pruebas miden la web publicada: un cambio se mide después de publicarlo. Si baja algún número, se revierte.
