# CLAUDE.md — Diseño (frontend)

Este archivo va en `frontend/CLAUDE.md`. Claude Code lo lee además del `CLAUDE.md` de la raíz cada vez que trabaja en el frontend. Define cómo se ve y cómo se escribe la interfaz. Si algo de acá choca con el HTML exportado de Stitch, **manda este archivo**.

## Principios

1. **Se usa en el campo, al sol, con una mano.** Contraste alto, zonas táctiles grandes, pocos pasos. Cargar un registro completo tiene que tomar menos de 2 minutos.
2. **Sensibilizar, no competir.** Tono cálido y educativo. Nada de rankings, medallas, "mejor lugar" ni alertas alarmistas.
3. **Simple antes que lindo.** Si hay que elegir entre una pantalla más vistosa y una más clara, gana la más clara.
4. **Consistencia.** Mismo color, mismo componente y misma palabra para lo mismo en todas las pantallas.
5. **Mobile first.** Se diseña primero para 360–420 px de ancho y después se amplía.

## Colores

Usá **solo** estos tokens. Nunca escribas un hexadecimal suelto en un componente: si falta un color, se agrega acá primero.

### Base

| Token | Hex | Uso |
|---|---|---|
| `bosque` | `#1b4332` | Color principal: botones primarios, títulos destacados, ítem activo de la navegación, íconos importantes. |
| `bosque-hover` | `#2d6a4f` | Hover y presionado de `bosque`, anillos de foco, íconos de estado Vivo. |
| `hoja` | `#52b788` | Acentos: barras de progreso, bordes de foto cargada, detalles positivos. **No poner texto blanco encima** (no llega al contraste mínimo). |
| `hoja-suave` | `#74c69d` | Microinteracciones y rellenos secundarios de gráficos. |
| `brote` | `#d8f3dc` | Fondo del chip Vivo y de celdas "al día". |
| `brote-borde` | `#b7e4c7` | Borde del chip Vivo y del recuadro de foto vacío. |
| `tonal` | `#e8f5e9` | Fondo de botones tonales y de avisos informativos suaves. |
| `niebla` | `#d1e0d7` | Bordes de botones secundarios e inputs, divisores. |
| `fondo` | `#f8faf8` | Fondo de todas las páginas (blanco cálido que reduce el reflejo). |
| `superficie` | `#ffffff` | Tarjetas, paneles, barra superior, inputs. |
| `segmento` | `#eef2ef` | Fondo del control segmentado de formas de vida. |

### Texto y neutros

| Token | Hex | Uso |
|---|---|---|
| `texto` | `#1e293b` | Texto principal. |
| `texto-2` | `#475569` | Texto secundario, etiquetas, ítems inactivos. |
| `texto-3` | `#64748b` | Ayudas, fechas, texto de Muerto. |
| `placeholder` | `#94a3b8` | Placeholders e íconos deshabilitados. |
| `borde` | `#e2e8f0` | Borde de tarjetas. |
| `gris-suave` | `#f1f5f9` | Fondo del chip Muerto y de celdas sin célula. |
| `gris-borde` | `#cbd5e1` | Borde del chip Muerto. |

### Estados

| Estado | Fondo | Borde | Texto | Ícono |
|---|---|---|---|---|
| **Vivo** | `#d8f3dc` | `#b7e4c7` | `#1b4332` | `eco` en `#2d6a4f` |
| **Muerto** | `#f1f5f9` | `#cbd5e1` | `#475569` | `remove_circle` en `#64748b` |
| **Al día** (registro del mes cargado) | `#d8f3dc` | `#b7e4c7` | `#1b4332` | `check_circle` |
| **Pendiente** (falta el registro del mes) | `#fef3c7` | `#fcd34d` | `#78350f` | `schedule` |
| **Sin registro inicial** | `#f1f5f9` | `#cbd5e1` | `#475569` | `hourglass_empty` |
| **Dada de baja** | `#f1f5f9` | `#cbd5e1` | `#64748b`, tachado | `block` |
| **Error** | `#ffdad6` | `#ffb4ab` | `#93000a` | `error` |

**Reglas de estados:**

- El **rojo es solo para errores** del sistema o de validación. Nunca para una planta muerta: Muerto es gris, no alarmante.
- Todo estado lleva **color + ícono + texto**. Nunca solo color (hay personas daltónicas y la pantalla al sol pierde color).
- En el plano de la isleta, las celdas usan un relleno más fuerte para verse de lejos: al día `#2d6a4f` con número blanco, pendiente `#f5b82e` con número `#422006`, sin célula `#e2e8f0` semitransparente.

### Formas de vida (gráficos y acentos)

| Forma de vida | Color | Ícono (Material Symbols) |
|---|---|---|
| Árbol | `#1b4332` | `park` |
| Arbusto | `#52b788` | `nature` |
| Herbácea | `#c08552` | `local_florist` |
| Rastrera | `#7c6fb0` | `grass` |

Estos colores se usan **solo** para distinguir formas de vida (líneas de gráficos, puntos de leyenda, íconos).

## Tipografía

- Fuente única: **Inter** (Google Fonts), pesos 400, 500, 600 y 700. Fallback: `system-ui, -apple-system, "Segoe UI", Roboto, sans-serif`.
- Números, métricas, alturas y códigos con cifras tabulares (`font-variant-numeric: tabular-nums;`, clase `tabular-nums`) para que se alineen.

| Token | Tamaño / interlineado | Peso | Uso |
|---|---|---|---|
| `headline-xl` | 36/44 (celular: 28/36), tracking −0.02em | 700 | Título de la página pública. Solo uno por pantalla. |
| `headline-lg` | 28/36 (celular: 22/30), tracking −0.01em | 600 | Título de cada pantalla. |
| `headline-md` | 20/28 | 600 | Títulos de sección y de tarjetas grandes. |
| `headline-sm` | 18/24 | 600 | Títulos de tarjetas y bloques del formulario. |
| `body-lg` | 16/24 | 400 | Texto normal, explicaciones, **todos los inputs**. |
| `body-md` | 14/20 | 400 | Texto secundario dentro de tarjetas. |
| `body-sm` | 12/16 | 400 | Fechas, ayudas y notas. Es el mínimo. |
| `label-lg` | 16/24 | 500 | Texto de botones. |
| `label-md` | 14/20 | 500 | Etiquetas de campos, pestañas. |
| `label-sm` | 12/16, tracking 0.02em | 600 | Chips y leyendas. |
| `code-tag` | 13/16, tracking 0.06em, mayúsculas | 600 | Códigos `A-1-45`. |

**Reglas:**

- Nada de texto menor a 12 px.
- Los inputs siempre en 16 px: con menos, iPhone hace zoom automático al tocarlos.
- Máximo tres tamaños de texto distintos por tarjeta.
- Negrita (600–700) solo en títulos, números clave y etiquetas; no para resaltar frases enteras.
- Textos largos (explicaciones de la página pública) con un ancho máximo de ~65 caracteres por línea.

## Espaciado y layout

- Ritmo de 4 px: los espacios son siempre múltiplos de 4 (4, 8, 12, 16, 24, 32, 48).
- Tokens: `space-xs` 4 px, `space-sm` 8, `space-md` 16 (interior de tarjetas), `space-lg` 24 (entre secciones de un formulario), `space-xl` 32, `space-2xl` 48.

| Pantalla | Ancho | Márgenes laterales | Separación entre columnas | Navegación |
|---|---|---|---|---|
| Celular | < 640 px | 16 px | 16 px | Barra inferior |
| Tablet | 640–1023 px | 24 px | 20 px | Barra inferior |
| Computadora | ≥ 1024 px | 40 px | 24 px | Menú lateral fijo |

- En computadora, el contenido se centra con un ancho máximo de **1120 px**.
- Listas de tarjetas: 1 columna en celular, 2 en tablet, 3 en computadora.
- Dejá 88 px libres abajo en celular para que la barra inferior no tape el contenido.
- Los botones de guardar de un formulario largo quedan **fijos abajo** en celular, siempre visibles.

## Bordes, radios y sombras

| Elemento | Radio | Clase Tailwind |
|---|---|---|
| Tarjetas, paneles, modales | 16 px | `rounded-2xl` |
| Botones, inputs, foto, celdas seleccionables | 12 px | `rounded-xl` |
| Chips, etiquetas de código, control segmentado | redondo | `rounded-full` |
| Celdas del plano | 6 px | `rounded-md` |

Usá los radios por defecto de Tailwind (no los redefinas como hace el HTML de Stitch).

| Nivel | Uso | Sombra |
|---|---|---|
| 0 | Fondo de página | Ninguna |
| 1 | Tarjetas | Borde 1 px `borde` + `0 2px 8px -2px rgba(27,67,50,.05), 0 1px 4px -1px rgba(0,0,0,.03)` |
| 2 | Barra de guardar fija, botón Cargar, recuadro de foto | `0 8px 20px -4px rgba(27,67,50,.12), 0 2px 6px -1px rgba(27,67,50,.06)` |
| 3 | Modales y paneles inferiores | Fondo detrás `rgba(15,23,42,.45)` con `backdrop-blur-sm` |

Nada de sombras fuertes ni degradados llamativos.

## Íconos

- **Material Symbols Outlined** (Google Fonts), igual que el diseño de Stitch: `<span className="material-symbols-outlined">park</span>`.
- Tamaños: 20 px dentro de chips y texto, 24 px en botones y navegación, 32–40 px en estados vacíos.
- Un botón que solo tiene ícono necesita `aria-label` y un área táctil de 48 × 48 px.

| Concepto | Ícono |
|---|---|
| Inicio | `home` |
| Células | `grid_view` |
| Cargar | `add` (botón central) / `edit_note` |
| Resultados | `insights` |
| Más | `more_horiz` |
| Mapa | `map` |
| Tabla de datos | `table_chart` |
| Usuarios | `group` |
| Lugares e isletas | `location_on` |
| Plano | `flight` (vista de dron) |
| Lista | `format_list_bulleted` |
| Buscar | `search` |
| Cámara / galería | `photo_camera` / `photo_library` |
| Fecha | `calendar_month` |
| Cantidad de flores | `filter_vintage` |
| Presencia de frutos | `nutrition` |
| Nuevas plántulas | `psychiatry` |
| Polinizadores | `pest_control` |
| Observaciones | `edit_note` |
| QR | `qr_code_2` |
| Descargar | `download` |
| Notificaciones | `notifications` |
| Cambiar célula | `swap_horiz` |

## Componentes

Todos viven en `src/components/`. Antes de crear uno nuevo, revisá si ya existe.

### Botones

| Tipo | Estilo | Cuándo |
|---|---|---|
| Primario | Alto 48 px, fondo `bosque`, texto blanco `label-lg`, `rounded-xl`. Presionado: `bosque-hover`. | La acción principal de la pantalla. **Uno solo por pantalla.** |
| Secundario | Alto 48 px, fondo blanco, borde 1.5 px `niebla`, texto `bosque`. | Acciones alternativas (Elegir de galería, Ver ficha). |
| Tonal | Alto 48 px, fondo `tonal`, texto `bosque`, sin borde. | Acciones de apoyo dentro de tarjetas. |
| Texto | Sin fondo, texto `bosque` subrayado al pasar. | Enlaces como "Ver todas". |
| Peligro | Borde y texto `#ba1a1a`, fondo blanco. | Solo para anular o deshabilitar, siempre con confirmación. |

- Deshabilitado: opacidad 40 % y `cursor-not-allowed`. Mientras se guarda: spinner y texto "Guardando…", sin permitir un segundo toque.
- El texto del botón es un verbo que dice qué pasa: "Guardar registro de noviembre", no "Aceptar" ni "OK".

### Chips de estado (`ChipEstado`)

Alto 28 px, padding horizontal 12 px, `rounded-full`, ícono de 14–16 px + texto `label-sm`. Colores de la tabla de estados.

### Código de célula (`CodigoCelula`)

Pastilla `rounded-full` con fondo `tonal`, texto `bosque`, estilo `code-tag` y cifras tabulares: `A-1-45`. Se usa igual en tarjetas, fichas, plano y encabezados.

### Inputs

- Alto 48 px, fondo blanco, borde 1.5 px `niebla`, `rounded-xl`, texto `body-lg`, placeholder `placeholder`.
- Foco: borde `bosque-hover` y anillo de 3 px `rgba(82,183,136,.25)`.
- La etiqueta va **arriba** del campo, siempre visible (nunca solo placeholder).
- Error: borde `#ba1a1a` y mensaje debajo en `body-sm` con ícono `error`.
- Campos numéricos con `inputMode="numeric"` para que el celular abra el teclado de números.

### `ContadorMasMenos` (altura y polinizadores)

Botón −1 · número grande (`headline-md`, tabular) con unidad (`cm`) · botón +1. Botones de 48 × 48 px, fondo `tonal`. El número también se puede tipear. Debajo, en `body-sm`, el valor del mes anterior y la diferencia: "Octubre: 173 cm · +12".

### `BotonesVivoMuerto`

Dos botones lado a lado de 48 px de alto y el mismo ancho. Seleccionado Vivo: fondo `bosque`, texto blanco, ícono `eco`. Seleccionado Muerto: fondo `#475569`, texto blanco, ícono `remove_circle`. No seleccionado: fondo blanco con borde `niebla`.

### `SelectorNumero` (cantidad de flores)

Desplegable nativo (`<select>`) para que el celular abra su propio selector, alto 48 px, mismo estilo que los inputs, texto en 16 px y cifras tabulares. Opciones de 0 a 100 (propuesta, a confirmar con la clienta). Al lado, la etiqueta con ícono `filter_vintage`; debajo, en `body-sm`, el valor del mes anterior ("Octubre: 3 flores"). Si la clienta pide rangos, el componente recibe las opciones por props, así que no hace falta reescribirlo.

### `BotonesSiNo` (presencia de frutos y nuevas plántulas)

Igual que `BotonesVivoMuerto` pero más compacto: dos botones lado a lado de 48 px de alto. Seleccionado Sí: fondo `bosque` y texto blanco. Seleccionado No: fondo `texto-2` y texto blanco. No seleccionado: fondo blanco con borde `niebla`. La etiqueta va a la izquierda con su ícono (`nutrition` para frutos, `psychiatry` para plántulas).

### Bloque de individuo (carga mensual)

Tarjeta, una por forma de vida y siempre en el orden Árbol, Arbusto, Herbácea, Rastrera:

1. Arriba: ícono y nombre de la forma de vida.
2. `BotonesVivoMuerto`.
3. Altura con `ContadorMasMenos` (arranca en la altura del mes anterior).
4. Cantidad de flores con `SelectorNumero` (arranca en 0).
5. Presencia de frutos y nuevas plántulas con `BotonesSiNo` (arrancan en No). En pantallas de 400 px o más pueden ir en la misma fila.
6. Diámetro, solo en el Árbol, como campo opcional al final (a confirmar).

Si se marca Muerto, los puntos 3 a 6 se ocultan juntos con una transición corta. El bloque tiene que ser compacto: cuatro bloques con cinco datos cada uno tienen que poder recorrerse rápido con el pulgar. Separación de 12 px entre filas dentro del bloque y de 16 px entre bloques.

### Control segmentado de formas de vida (filtros)

Barra `rounded-full` con fondo `segmento` y 4 px de relleno interior. Opción elegida: fondo blanco, sombra nivel 1, texto `bosque` en 600 e ícono. Opciones no elegidas: transparentes, texto `texto-2`. Incluye la opción "Todas".

### `Foto`

- Relación 4:3, `rounded-xl`.
- Vacío: fondo `fondo`, borde 2 px discontinuo `brote-borde`, ícono de cámara `bosque-hover` al centro y el texto "Tocá para sacar la foto desde arriba, con las 4 plantas en el cuadro".
- Con foto: imagen de borde a borde, fecha en una etiqueta abajo a la izquierda y botón "Cambiar foto".
- Subiendo: barra de progreso `hoja`. Si falla: mensaje de error y botón "Reintentar".
- Al lado (o arriba en celular), la foto del mes anterior con la etiqueta "Mes anterior".

### Tarjeta de célula

Fondo blanco, borde `borde`, `rounded-2xl`, sombra nivel 1. Arriba: `CodigoCelula` + chip de estado del mes. Al medio: foto (4:3) y los 4 individuos con ícono y estado. Abajo: acción principal ("Cargar registro del mes" o "Ver ficha"). Toda la tarjeta es tocable y lleva a la ficha.

### Plano de isleta

- Imagen de dron de fondo con la grilla encima. Cada celda: número en `label-sm` tabular, color según estado, mínimo 36 × 36 px (con zoom para agrandar).
- Celda seleccionada: borde blanco de 3 px y sombra nivel 2.
- Arriba, contadores tipo chip: "Cargadas: 42 · Pendientes: 18 · Libres".
- Al tocar una celda se abre el `PanelInferior` con la célula.

### Navegación

- **Celular y tablet:** barra inferior blanca fija con borde superior `borde`: Inicio · Células · **Cargar** · Resultados · Más. "Cargar" es un botón circular de 56 px en `bosque` que sobresale, y solo aparece para Administrador y Cargador. Ítem activo: ícono relleno y texto `bosque`; inactivos: `texto-2`.
- **Computadora:** menú lateral fijo de 256 px con las mismas secciones más Mapa, Tabla de datos y Administración (esta solo para admin).
- **Barra superior:** blanca, con el logo de UCC Sostenible, el nombre de la pantalla, la campana de notificaciones y el avatar. En pantallas internas, flecha de volver a la izquierda.
- **Migas de pan** en ficha e isleta: `Campus UCC › Isleta 1 › A-1-45`, en `body-md` `texto-2`.
- No usar el menú hamburguesa ni los ítems del drawer de Stitch ("Guía pedagógica de especies", "Protocolo de riego"): no están en el alcance.

### Panel inferior y modal

- `PanelInferior`: sube desde abajo, `rounded-t-2xl`, con una manija gris de 40 × 4 px arriba; se cierra deslizando hacia abajo o tocando el fondo.
- `Modal`: centrado, ancho máximo 400 px, `rounded-2xl`, título `headline-sm`, botones abajo (primario a la derecha en computadora, apilados con el primario arriba en celular).
- Las confirmaciones dicen qué va a pasar: "¿Descartar los datos cargados?" con botones "Seguir cargando" y "Descartar".

### Pestañas

Texto `label-md`, indicador inferior de 3 px `bosque` en la activa. En celular se desplazan horizontalmente.

### Avisos (toasts)

Abajo en celular (sobre la barra), arriba a la derecha en computadora. Duran 4 segundos. Éxito con ícono `check_circle` en `bosque-hover`; error con ícono `error` y fondo `#ffdad6`. Un aviso a la vez.

### Estados de pantalla

- **Cargando:** esqueletos grises (`gris-suave`) con la forma del contenido, no un spinner en pantalla en blanco.
- **Vacío:** ícono de 40 px `placeholder`, título `headline-sm`, una línea de explicación y, si corresponde, un botón ("Limpiar filtros", "Dar de alta la primera célula").
- **Error:** ícono `cloud_off`, mensaje de qué pasó y botón "Reintentar".
- **Sin permiso:** ícono `lock` y "Esta sección es solo para administradores".

## Gráficos (Recharts)

- Colores por forma de vida (tabla de arriba). Si hay una sola serie, `bosque`.
- Máximo 4 series por gráfico. Además del color, diferenciá con la forma del punto en líneas.
- Grilla horizontal suave (`borde`), sin grilla vertical. Ejes y etiquetas en `body-sm` `texto-3`.
- Barras que empiezan en 0. Porcentajes de 0 a 100.
- Eje X con meses abreviados en español: "nov", "dic", "ene".
- Tooltip blanco `rounded-xl` con sombra nivel 2, valores con unidad ("185 cm", "92 %").
- Leyenda arriba, con los nombres de las formas de vida.
- Nada de gráficos de torta, 3D ni animaciones largas.
- Si no hay datos suficientes, el estado vacío de gráficos: "Todavía no hay registros suficientes para este gráfico".

## Tarjetas de métricas

Número grande (`headline-xl` en computadora, `headline-lg` en celular, tabular, `bosque`), nombre de la métrica arriba en `label-md` `texto-2`, e ícono en un círculo `tonal`. Debajo, una línea de contexto en `body-sm` ("desde la plantación", "de 240 individuos"). Nunca flechas rojas de "bajó": el tono es informativo.

## Página pública

- Misma paleta y tipografía, pero más aire: secciones separadas por `space-2xl` y texto explicativo en `body-lg`.
- Sin barra inferior, sin menú y sin botones de carga. Solo un botón discreto "Ingresar" arriba a la derecha.
- Estructura: título motivador → qué es una célula de bosque (2 o 3 líneas) → métricas → supervivencia por forma de vida con "por qué importa" → evolución → cómo participar.
- Tiene que cargar en menos de 3 segundos en 4G: fotos en miniatura y carga diferida (`loading="lazy"`).

## Redacción

- Español rioplatense con **voseo**: "Cargá", "Elegí", "Tocá", "Revisá". Nunca "Carga", "Elige", "Toca".
- Frases cortas y concretas. Una idea por oración.
- Vocabulario del dominio (ver `CLAUDE.md` de la raíz): célula, isleta, lugar, individuo, forma de vida, registro. Nunca "ejemplar", "especie", "lote", "parcela" ni "cuadrante".
- Botones con verbo + objeto: "Guardar registro", "Dar de alta célula", "Descargar Excel".
- Errores: qué pasó + qué hacer. "No se pudo subir la foto. Revisá la conexión y tocá Reintentar." Nunca "Error 500" ni mensajes técnicos.
- Tono alentador sin exagerar: "¡Registro guardado!" está bien; "¡Increíble, sos un héroe del bosque!" no.
- **Fechas:** "18 nov 2026" en tarjetas; "18/11/2026" en tablas y formularios; "noviembre 2026" para períodos.
- **Números:** formato argentino, con `Intl.NumberFormat("es-AR")`: coma decimal (4,2 cm) y punto de miles (1.420).
- **Unidades:** con espacio: "185 cm", "92 %".
- Sin emojis en la interfaz.
- No copiar textos de ejemplo de Stitch (por ejemplo, "Toca para fotografiar la planta en su cuadrante" tiene tuteo y la palabra "cuadrante").

## Accesibilidad

- Contraste mínimo WCAG AA: 4.5:1 para texto normal y 3:1 para texto grande e íconos. `hoja` (`#52b788`) no sirve para texto sobre blanco ni con texto blanco encima.
- Zonas táctiles de al menos 48 × 48 px y 8 px de separación entre ellas.
- Foco visible siempre (anillo `bosque-hover`); nunca `outline: none` sin reemplazo.
- Todas las imágenes con `alt` ("Foto de la célula A-1-45, noviembre 2026").
- Formularios con `<label>` asociado a cada campo.
- Respetá `prefers-reduced-motion`: sin transiciones si el usuario lo pidió.
- La app tiene que poder usarse con zoom del navegador al 200 %.

## Movimiento

Transiciones de 150–200 ms con `ease-out`, solo en: apertura de paneles y modales, cambio de estado de botones y aparición de avisos. Nada de animaciones decorativas ni de carga que demoren el uso.

## Qué no hacer

- Colores hexadecimales sueltos en componentes.
- Rojo para plantas muertas.
- Más de un botón primario por pantalla.
- Texto menor a 12 px o inputs menores a 16 px.
- Modo oscuro (por ahora no está en el alcance, aunque Stitch lo configure).
- Fotos de stock o de ejemplo en producción.
- Librerías de componentes (Material UI, Bootstrap, shadcn): usamos Tailwind con componentes propios.
- Estilos en línea (`style={{...}}`) salvo para valores calculados, como la posición de una celda en el plano.

## Configuración de Tailwind

Para Tailwind v4, en `src/index.css`. Si el proyecto usa Tailwind v3, los mismos valores van en `theme.extend` de `tailwind.config.js`.

```css
@import url("https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap");
@import url("https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200");
@import "tailwindcss";

@theme {
  --font-sans: "Inter", system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;

  /* Base */
  --color-bosque: #1b4332;
  --color-bosque-hover: #2d6a4f;
  --color-hoja: #52b788;
  --color-hoja-suave: #74c69d;
  --color-brote: #d8f3dc;
  --color-brote-borde: #b7e4c7;
  --color-tonal: #e8f5e9;
  --color-niebla: #d1e0d7;
  --color-fondo: #f8faf8;
  --color-superficie: #ffffff;
  --color-segmento: #eef2ef;

  /* Texto y neutros */
  --color-texto: #1e293b;
  --color-texto-2: #475569;
  --color-texto-3: #64748b;
  --color-placeholder: #94a3b8;
  --color-borde: #e2e8f0;
  --color-gris-suave: #f1f5f9;
  --color-gris-borde: #cbd5e1;

  /* Estados */
  --color-pendiente: #fef3c7;
  --color-pendiente-borde: #fcd34d;
  --color-pendiente-texto: #78350f;
  --color-pendiente-celda: #f5b82e;
  --color-error: #ba1a1a;
  --color-error-fondo: #ffdad6;
  --color-error-texto: #93000a;

  /* Formas de vida */
  --color-arbol: #1b4332;
  --color-arbusto: #52b788;
  --color-herbacea: #c08552;
  --color-rastrera: #7c6fb0;

  /* Tipografía */
  --text-headline-xl: 36px;   --text-headline-xl--line-height: 44px;
  --text-headline-lg: 28px;   --text-headline-lg--line-height: 36px;
  --text-headline-md: 20px;   --text-headline-md--line-height: 28px;
  --text-headline-sm: 18px;   --text-headline-sm--line-height: 24px;
  --text-body-lg: 16px;       --text-body-lg--line-height: 24px;
  --text-body-md: 14px;       --text-body-md--line-height: 20px;
  --text-body-sm: 12px;       --text-body-sm--line-height: 16px;
  --text-label-lg: 16px;      --text-label-lg--line-height: 24px;
  --text-label-md: 14px;      --text-label-md--line-height: 20px;
  --text-label-sm: 12px;      --text-label-sm--line-height: 16px;
  --text-code-tag: 13px;      --text-code-tag--line-height: 16px;

  /* Sombras */
  --shadow-nivel-1: 0 2px 8px -2px rgb(27 67 50 / 0.05), 0 1px 4px -1px rgb(0 0 0 / 0.03);
  --shadow-nivel-2: 0 8px 20px -4px rgb(27 67 50 / 0.12), 0 2px 6px -1px rgb(27 67 50 / 0.06);
}

body {
  @apply bg-fondo text-texto font-sans text-body-lg antialiased;
}
```

El peso y el tracking se agregan con clases (`font-semibold`, `tracking-tight`). Para los títulos que cambian de tamaño en celular, usá el componente `Titulo` de `components/`, que aplica por ejemplo `text-[22px] leading-[30px] md:text-headline-lg` para `headline-lg`. Así nadie tiene que acordarse de los tamaños de celular.
