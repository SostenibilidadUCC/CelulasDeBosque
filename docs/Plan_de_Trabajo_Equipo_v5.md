# Plan de trabajo del equipo

**Plataforma de Seguimiento de Células de Bosque** · UCC Sostenible
Versión 5 · 9 de noviembre de 2026 · Go + React + PostgreSQL

> La v5 reemplaza a `Plan_de_Trabajo_Equipo_v4.pdf` (borrado: está en la historia de Git). Usa los IDs de
> `Requerimientos_Celulas_de_Bosque_v6.md`.

## Qué cambió respecto del plan v4

- **Estado real al 9/11.** Están hechos T01 a T16 y T18 (sección 1). Faltan T17 y T19 a T29.
- **Calendario nuevo hasta el lanzamiento** (sección 5). El lanzamiento es el miércoles 25 de noviembre,
  el día de la primera plantación.
- **Base de datos en Neon**, no en Render. Render solo corre el servidor. Las migraciones se aplican solas en
  cada deploy (sección 2).
- **Todos los lugares activos son públicos** (migración 00005): cambia T20 y T22.
- **Usuarios por pedido de acceso**, sin invitaciones (T16, migración 00004).
- **Página de presentación en `/`** y el inicio de cada rol pasó a `/inicio`.
- **Inicio según el rol:** el avance del mes y el botón "Cargar" son solo para el cargador.
- **T22 (página pública y QR) queda en espera:** parece que no va a haber QR y la presentación ya explica
  qué es una célula. Hay que consultarlo (sección 6).
- Los tickets que quedan solo tienen los pasos que faltan. Los terminados quedan resumidos en la sección 1.

**Cómo leer este plan:** la sección 1 (estado), la 4 (reglas) y la 5 (calendario). Los tickets de la sección 8
los lee cada una cuando le toca.

---

## 1. Estado de los tickets al 9/11

| Ticket | Qué es | Persona | Estado | PR |
|---|---|---|---|---|
| T01 | Instalar herramientas | Todas | Hecho | — |
| T02 | Repositorio y base de datos | A | Hecho | #4 |
| T03 | Esqueleto del servidor Go | B | Hecho | — |
| T04 | Esqueleto de React y componentes base | C | Hecho | — |
| T05 | Repasar juntas la API | Todas | Hecho | — |
| T06 | Datos de prueba (seed) | B y C | Hecho | #7 |
| T07 | Publicar la app (Render + Neon) | A | Hecho | — |
| T08 | Preguntas a la clienta | B | Sigue abierto: las preguntas pendientes están en la sección 13 de la v6 | — |
| T09 | Diseño en Stitch | B | Hecho | — |
| T10 | Login y permisos | A | Hecho | — |
| T11 | Inicio y explorar células | B | Hecho (rediseñado en #23 y #24) | — |
| T12 | Plano de la isleta | C | Hecho | #9, #13 |
| T13 | Fotos y guardar registro | A | Hecho. Falta probar el corte de señal a mitad de subida: pasa a T23 | #14, #16 |
| T14 | Pantalla de carga mensual | B | Hecho | #19 |
| T15 | Ficha de la célula | C | Hecho, más fotos mes por mes (FIC-07) y "Editar" en cada mes (FIC-05) | #15, #24 |
| T16 | Usuarios | A | Hecho, con pedido de acceso en lugar de invitaciones | #21 |
| T17 | Nueva célula y borrador | B | **Falta** | — |
| T18 | Resultados y métricas | C | Hecho | #20 |
| T19 | Versión de prueba para la clienta | Todas | **Falta** (fecha a confirmar) | — |
| T20 | Lugares, isletas y planos | A | **Falta** | — |
| T21 | Tabla de datos y Excel | C | **Falta** | — |
| T22 | Página pública y QR | C | **En espera** (decisión pendiente, sección 6) | — |
| T23 | Prueba en campo y datos reales | Todas | **Falta** | — |
| T24 | Correcciones | Todas | **Falta** | — |
| T25 | Manual para cargadores | B | **Falta** | — |
| T26 | Demo de la plantación | C | **Falta** | — |
| T27 | Documento de traspaso | A | **Falta** | — |
| T28 | Cambiar Herbácea por Gramínea | B | **Falta** | — |
| T29 | Backups de la base y de las fotos (sale de T20) | C | **Falta** | — |

Además, sin ticket: página de presentación pública en `/` (#23), inicio según el rol (#24) y rediseño de carga,
ficha y cuenta (#24).

## 2. Cómo está armada la app

```
Celular o compu ──> Servidor Go en Render ──> PostgreSQL en Neon (datos)
                     (API /api/... y          Cloudflare R2 (fotos y planos)
                      las pantallas de React)
```

El mismo programa de Go entrega la API y las pantallas de React. Así hay una sola dirección web, un solo
deploy y no hace falta configurar CORS.

- **Deploy:** cada merge a `main` se publica solo. Render arma la imagen con el `Dockerfile` y, al arrancar,
  corre `goose up` contra Neon antes de prender el servidor. Si una migración falla, el servidor no arranca
  y queda la versión anterior: **revisá los logs de Render después de mergear una migración**.
- **Plan gratuito:** Render apaga el servidor a los 15 minutos sin visitas y tarda alrededor de un minuto en
  volver. Neon suspende la base a los 5 minutos sin uso y vuelve rápido.
- **Fotos:** en la cuenta de Cloudflare R2 de la UCC.

Las carpetas y los comandos para levantar el proyecto están en el `README.md` y en el `CLAUDE.md`.

## 3. Cómo nos dividimos

| Persona | Nombre | Revisa las PR de |
|---|---|---|
| A | Magda | Cande |
| B | Cande | Fran |
| C | Fran | Magda |

Cada semana, cada persona hace una funcionalidad completa: su endpoint en Go, su pantalla en React y la prueba
en el celular. Revisar no es solo aprobar: bajá la rama, probala y preguntá lo que no entiendas.

## 4. Reglas para no pisarse

| # | Regla | Por qué |
|---|---|---|
| 1 | Cada ticket tiene sus archivos: trabajá en el archivo de tu funcionalidad (`handlers/lugares.go`, `pages/Lugares/`). | Si cada una toca archivos distintos, Git junta todo sin conflictos. |
| 2 | En los archivos compartidos (`main.go`, `App.jsx`, `api.js`) solo se agregan líneas, y la PR se hace ese mismo día. | Son los únicos lugares donde escribimos las tres. |
| 3 | Para cambiar la base, creá una migración nueva y **avisá en el grupo antes**. La próxima es la **00006**. Nunca edites una migración que ya está en `main`. | Dos migraciones con el mismo número rompen el deploy. |
| 4 | Después de mergear una migración, cada una corre `goose up` en su compu y vuelve a cargar el seed. En Neon se corre sola con el deploy. | Si no, tu base local queda distinta y los tests fallan. |
| 5 | Nunca se sube nada directo a `main`. Rama por ticket (`t20-lugares`), PR, revisión de otra persona y recién ahí se une. | `main` se publica solo: si se rompe, se rompe para la clienta. |
| 6 | Si el endpoint de otra no está listo, usá un mock con el formato de la sección 7 y dejá `// TODO: reemplazar mock por api` con el número de ticket. | Así nadie espera a nadie. |
| 7 | Todas las mañanas: `git pull` de `main` y actualizá tu rama. | Cuanto más seguido se junta el código, más chicos son los conflictos. |
| 8 | Un mensaje por día en el grupo: qué hice, qué hago hoy, en qué estoy trabada. | Un problema dicho a tiempo se resuelve en 10 minutos. |

## 5. Calendario hasta el lanzamiento *(propuesta)*

El lanzamiento es el día de la primera plantación: el **miércoles 25 de noviembre de 2026**. Ese día se dan de
alta las células y se cargan sus **registros iniciales**. Por eso lo primero es lo que se usa ese día: dar de
alta células (T17 y T20) y cargar los lugares reales (T20).

| Semana | Persona A (Magda) | Persona B (Cande) | Persona C (Fran) | Todas |
|---|---|---|---|---|
| 6 · 9/11 – 15/11 | T20 | T28 (primero) y T17 | T21 y T29 | T19 (demo para la clienta) |
| 7 · 16/11 – 22/11 | T27 | T25 | T26 | T23 (prueba en campo y datos reales) y T24 |
| 8 · 23/11 – 24/11 | T24 | T24 | T24 | Ensayo de la demo (T26) |
| **Miércoles 25/11** | | | | **Lanzamiento: plantación y registros iniciales** |
| Diciembre | | | | Primera carga mensual (período 2026-12) |

- **T28 va primero** en la semana de B: toca archivos de las tres y crea la migración 00006. Cuanto antes
  se mergee, menos conflictos.
- **T17 y T20 tienen que estar en `main` al terminar la semana 6**, para que la prueba en campo (T23) de la
  semana 7 use lo mismo que se va a usar el 25.
- *(Propuesta)* El martes 24 se congela `main`: solo se mergean arreglos de algo que impida cargar. Un
  deploy que falla el día de la plantación deja la app con la versión anterior.
- Si un ticket no está completo para la demo, se muestra lo que haya y se anota qué falta.

## 6. Decisiones pendientes del plan

Se consultan en la demo (T19). Mientras no haya respuesta, no se programan.

| # | Decisión | Por qué está abierta | Afecta |
|---|---|---|---|
| D1 | ¿Se hace la página pública `/publico/{letra}` y los QR? | Parece que no va a haber QR. Sin QR, la página pública por lugar pierde su entrada principal. Además, PUB-02 pide "explicar qué es una célula", y eso ya lo hace la presentación (`/`): si la página se hace, debería mostrar solo los resultados del lugar, con un enlace a la presentación en vez de repetir la explicación. | T22, T26 · PUB-01 a 03, PUB-07 · QR-01, 02 · `pages/Publico/` (hoy vacía) |
| D2 | ¿A dónde lleva el botón "Ver cómo crecen" de la presentación? | Hoy lleva fijo a `/publico/A`, que no existe todavía. Ahora todos los lugares activos son públicos, así que dejarlo solo en el Campus UCC deja afuera a los colegios. Depende de D1. | `Presentacion.jsx` · T22 |

## 7. La API: lista de endpoints

Todas las respuestas son JSON. Si necesitás cambiar un endpoint, avisá antes: otra pantalla puede estar
usándolo.

| Método y ruta | Qué hace | Quién puede | Ticket | Estado |
|---|---|---|---|---|
| `POST /api/login` | Inicia sesión con email y contraseña. | Cualquiera | T10 | Hecho |
| `POST /api/logout` | Cierra la sesión. | Con sesión | T10 | Hecho |
| `GET /api/yo` | Usuario actual (nombre, rol, lugar). | Con sesión | T10 | Hecho |
| `GET /api/lugares` | Lugares con cantidad de células e isletas. | Con sesión | T11 | Hecho |
| `GET /api/lugares/{id}/celulas` | Células de un lugar, con filtros de isleta, estado y código. | Con sesión | T11 | Hecho |
| `GET /api/isletas/{id}` | Isleta con plano, filas, columnas y cada célula con su posición y estado. | Con sesión | T12 | Hecho |
| `GET /api/celulas/{id}` | Ficha: datos, 4 individuos y todos sus registros. | Con sesión | T15 | Hecho |
| `GET /api/celulas/{id}/ultimo-registro` | Registro del mes en curso y el último anterior, para precargar la carga. | Con sesión | T14 | Hecho |
| `GET /api/celulas/{id}/siguiente-pendiente` | La próxima célula pendiente del lugar. | Con sesión | T14 | Hecho |
| `POST /api/fotos` | Sube una foto, le borra los metadatos y devuelve su id. | Admin; cargador | T13 | Hecho |
| `GET /api/fotos/{id}` | Devuelve la imagen. Sin sesión, solo fotos de registros no anulados de lugares activos. | Según el lugar | T13 | Hecho |
| `POST /api/celulas/{id}/registros` | Guarda el registro del mes. 409 con `registroId` si ya hay uno. | Admin; cargador en su lugar | T13 | Hecho |
| `PUT /api/registros/{id}` | Modifica un registro (RN-11). | Admin; cargador en su lugar | T13 | Hecho |
| `GET /api/metricas` | Métricas y datos de gráficos, con filtros. | Con sesión | T18 | Hecho |
| `POST /api/solicitar-acceso` | Pide acceso: la cuenta queda pendiente. | Cualquiera | T16 | Hecho |
| `GET /api/usuarios` | Lista de usuarios. | Admin | T16 | Hecho |
| `PUT /api/usuarios/{id}` | Aprueba, edita o quita el acceso. | Admin | T16 | Hecho |
| `POST /api/usuarios/{id}/contrasena-nueva` | Genera una contraseña nueva y cierra sus sesiones (AUT-05). | Admin | T16 | Hecho |
| `POST /api/celulas` | Crea una célula y sus 4 individuos. | Admin; cargador en su lugar | T17 | Falta |
| `GET · POST · PUT /api/admin/lugares` | Listar, crear y modificar lugares. | Admin | T20 | Falta |
| `GET · POST · PUT /api/admin/isletas` | Listar, crear y modificar isletas. | Admin | T20 | Falta |
| `POST /api/admin/isletas/{id}/plano` | Sube la imagen del plano. | Admin | T20 | Falta |
| `POST /api/admin/isletas/{id}/celulas-lote` | Crea varias células de una vez. | Admin | T20 | Falta |
| `GET /api/datos` | Tabla de datos paginada, con los filtros de Resultados. | Con sesión | T21 | Falta |
| `GET /api/datos/excel` | Descarga el Excel con los mismos filtros. | Con sesión | T21 | Falta |
| `GET /api/publico/{letra}` | Resultados de un lugar activo. | Cualquiera, sin sesión | T22 | En espera (D1) |

**Errores:** siempre `{ "error": "mensaje en español" }`. 400 datos inválidos · 401 sin sesión · 403 sin
permiso · 404 no existe · 409 ya existe · 500 error del servidor. El 409 de un registro trae además el
`registroId` del que ya existe, para abrirlo en modo edición.

## 8. Tickets que faltan, paso a paso

"Está listo cuando" es lo que hay que poder mostrar para moverlo a Hecho. Los IDs son los de la v6.

### T28 · Cambiar Herbácea por Gramínea — Persona B · Semana 6 (primero)

**Qué es:** la tercera forma de vida se llama Gramínea. El dígito 3 y los ids no cambian.

- [ ] Avisar en el grupo: se crea la migración **00006** y se tocan archivos de las tres.
- [ ] Crear la rama desde `main` actualizado (por ejemplo `t28-graminea`).
- [ ] Buscar "herb" (con y sin tilde, singular y plural) en backend, frontend, seed, migraciones, tests,
      README, los `CLAUDE.md` y `diseno/`. Hoy aparece en `00001_tablas.sql`, `registros_validacion.go`,
      `registros.go`, `ficha.go`, `seed.sql`, `index.css`, `Ficha/formato.js` y `Presentacion.jsx`.
- [ ] Migración 00006 que cambia el nombre en `formas_de_vida`, con su Down. La 00001 no se edita.
- [ ] Actualizar el seed, el código, los textos y los tests, cuidando el género ("una gramínea").
- [ ] Sacar la nota de T28 del `CLAUDE.md`.
- [ ] Correr `go vet`, `go test` y el build del frontend.

**Está listo cuando:** una búsqueda de "herb" no encuentra nada (salvo en la 00001), los tests pasan y en el
celular se ve Gramínea en la carga, la ficha y los gráficos.
**Requerimientos:** sección 2 y RNF-USA-06.

### T17 · Nueva célula y borrador — Persona B · Semana 6

**Qué es:** dar de alta células desde el celular el día de la plantación, y no perder lo cargado.

- [ ] Backend: `POST /api/celulas` valida número y celda libres (RN-02) y crea los 4 individuos en una
      transacción (RN-01). Permiso con `auth.PuedeEditarLugar`.
- [ ] Pantalla Nueva célula (`pages/NuevaCelula/`, hoy vacía): elegir isleta, número (sugiere el siguiente
      libre) y celda libre en el `Plano`; mostrar el código grande.
- [ ] Al confirmar, seguir con el registro inicial reutilizando la pantalla de carga (ALT-06).
- [ ] Cancelar con datos cargados pide confirmación (ALT-09).
- [ ] Borrador (CAR-16): guardar lo cargado en el celular (`localStorage`) y ofrecer retomarlo. Hay dos
      `TODO T17` en `Carga.jsx` y `ElegirCelula.jsx`. Depende de la pregunta 5 (señal en los lotes):
      si no hay respuesta, se hace igual, porque también cubre la sesión vencida.

**Está listo cuando:** se da de alta la célula A-1-61, se carga su registro inicial y aparece en el plano; si se
cierra la app a mitad de carga, al volver se ofrece retomarla.
**Requerimientos:** ALT-01 a 06, ALT-09 · CAR-16.

### T20 · Lugares, isletas, planos y backups — Persona A · Semana 6

**Qué es:** que el admin cargue los lugares reales y que los datos estén protegidos.

- [ ] Endpoints de `/api/admin/lugares` e `/api/admin/isletas` (crear y editar). El formulario de lugar
      **no** pide "público": todo lugar activo es público. Deshabilitar es la única forma de ocultarlo
      (LUG-03).
- [ ] RN-03: la letra y el número de isleta no se cambian si ya tienen registros.
- [ ] Subir el plano (imagen a R2, filas y columnas de 1 a 30, hasta 10 MB) con vista previa de la grilla,
      reutilizando el `Plano`.
- [ ] Crear células en lote (LUG-07): sirve para el día de la plantación si son muchas.
- [ ] Pantallas `pages/Lugares/` (hoy vacía) e Isletas, con acceso desde Más para el admin.

Los backups, que en el v4 estaban en este ticket, pasaron a T29 (Fran).

**Está listo cuando:** se carga un lugar nuevo con su isleta, plano y 20 células desde la app.
**Requerimientos:** LUG-01 a 08 · RN-03 · RN-15.

### T29 · Backups de la base y de las fotos — Persona C · Semana 6

**Qué es:** tener una copia de los datos guardada aparte, para recuperarlos si algo sale mal. Los registros no
se pueden volver a medir: si se pierden, se pierde la historia de cada célula. Es una tarea chica al costado de
T21: es más averiguar y configurar que programar.

- [ ] Averiguar qué ofrece Neon en el plan gratuito (cuánto historial guarda para volver la base a un momento
      anterior) y anotarlo en la sección 13 de la v6, que lo tiene *(a confirmar)*.
- [ ] Si no llega a 30 días, programar una copia diaria con `pg_dump` (exporta toda la base a un archivo)
      guardada en R2. Como el servidor de Render se apaga cuando nadie lo usa, la tarea diaria tiene que
      correr afuera: por ejemplo, una GitHub Action programada. Consultar en el grupo antes de elegir.
- [ ] Copia semanal de las fotos de R2 a otro lugar.
- [ ] Probar restaurar un backup en una base de prueba (nunca en Neon de producción) y anotar los pasos para
      T27.

**Está listo cuando:** hay una copia diaria de la base y una semanal de las fotos, y se restauró un backup en una
base de prueba con los datos completos.
**Requerimientos:** RNF-DIS-01 a 03.

### T22 · Página pública y QR — Persona C · En espera

**En espera de las decisiones D1 y D2 (sección 6).** No se arranca hasta que estén respondidas. Cuando lo
estén, se reescriben acá los pasos y el "Está listo cuando".

Lo que ya se sabe, si se hace:

- `GET /api/publico/{letra}` responde para **cualquier lugar activo** (RN-15), sin sesión, reutilizando el
  cálculo de métricas de T18 y sin nombres ni emails de usuarios.
- No repite la explicación de qué es una célula: eso está en la presentación (`/`).
- No compara lugares (RN-20).

**Requerimientos:** PUB-01 a 03, PUB-07 · QR-01, 02 · RNF-REN-01 · PRI-02.

### T19 · Versión de prueba para la clienta — Todas · Semana 6

**Qué es:** mostrarle a la clienta los avances con los requerimientos v6 y anotar lo que pida.

- [ ] Llevar la lista de preguntas de la sección 13 de la v6, sobre todo la 5
      (señal en los lotes), la 4 (métricas del resumen) y la 9 (editar meses anteriores).
- [ ] Consultar las decisiones D1 (página pública y QR) y D2 (botón "Ver cómo crecen") de la sección 6.

**Está listo cuando:** se hizo la demo y las observaciones están como tickets nuevos en el tablero.

### T23 · Prueba en campo y datos reales — Todas · Semana 7, antes de la plantación

- [ ] Un cargador real carga varias células en el lote; se mide el tiempo y se anotan los pasos lentos
      (CAR-17).
- [ ] Probar el corte de señal a mitad de la subida de una foto (pendiente de T13).
- [ ] Cargar los lugares, isletas, planos y usuarios reales (pendientes 5 y 6 de la v6).

**Está listo cuando:** se hizo la prueba, están cargados los datos reales y los problemas quedaron como tickets.

### T21 · Tabla de datos y Excel — Persona C · Semana 6

**Qué es:** los datos crudos de todas las mediciones, en una tabla que se puede filtrar y descargar en Excel.
Es lo que pidió la clienta para trabajar los datos por su cuenta. Pasó de Cande a Fran, porque usa los mismos
filtros que Resultados (T18).

- [ ] `GET /api/datos` paginado (50 filas, ordenable) con los filtros de Resultados y buscador por código.
- [ ] `GET /api/datos/excel` con `excelize`, con las columnas de la sección 11.1 de la v6. `excelize` está en
      el stack pero todavía no en `go.mod`: se agrega con `go get`.
- [ ] La columna `cobertura_pct` depende de la pregunta 8 (RN-19): hasta que se responda, va vacía.
- [ ] Pantalla `pages/Datos/` (hoy vacía): columna de código fija y desplazamiento horizontal en el celular.
- [ ] La vista matriz (TAB-02) es prioridad B: solo si sobra tiempo.

**Está listo cuando:** se filtra por un lugar, se descarga el Excel y abre bien con acentos y decimales.
**Requerimientos:** TAB-01, 03 a 05 · sección 11.1.

### T26 · Demo de la plantación — Persona C · Semana 7 (ensayo el 23 o 24)

Guion corto y recorrido para presentar la app el día de la plantación. El QR impreso depende de D1.
**Está listo cuando:** se ensayó la demo entre las tres.

### T27 · Documento de traspaso — Persona A · Semana 7

Todo lo que necesita quien siga: cuentas de Render, Neon, Cloudflare R2 y GitHub (las contraseñas se entregan
en persona), costos, cómo publicar, cómo agregar un lugar o una variable y cómo restaurar un backup.
**Está listo cuando:** UCC Sostenible recibió el documento y tiene acceso a todas las cuentas.
**Requerimientos:** RNF-MAN-03, 04.

### T24 · Correcciones — Todas · Semanas 7 y 8

Resolver lo que salió de la demo y de la prueba en campo, empezando por lo que impide cargar.
**Está listo cuando:** no queda ningún problema que impida cargar un registro o ver la página pública.

### T25 · Manual para cargadores — Persona B · Semana 7

Una hoja con capturas: encontrar la célula en el plano, sacar la foto, cargar el mes y qué hacer si un individuo
murió o se repuso.
**Está listo cuando:** un docente que nunca vio la app carga un registro solo con la hoja.

## 9. Qué hacer si te trabás

| Tiempo trabada | Qué hacer |
|---|---|
| 30 minutos | Releé el error completo, buscalo y probá con un ejemplo más chico. Preguntale a Claude pegando el error y el código. |
| 1 hora | Escribí en el grupo: qué querés hacer, qué probaste y el error exacto. |
| 2 horas | Sesión en pareja con quien esté más libre, compartiendo pantalla. |
| Medio día | Se habla en el grupo: se simplifica el ticket, se parte en dos o lo toma otra persona. |

## 10. Lo que queda para después

No entran antes del lanzamiento. Quedan en la columna "Después" del tablero.

| Función | Requerimientos | Nota |
|---|---|---|
| Cambiar la contraseña propia | AUT-08 | Propuesta subirla a prioridad A: con AUT-05 el admin conoce la contraseña que generó. |
| Recuperar la contraseña por enlace o mail | AUT-05 | Hoy el admin genera una contraseña nueva. |
| Ingreso con Google | — | Pendiente de decidir. |
| Mapa de lugares | MAP-01 a 03 · INI-06 | Prioridad media. |
| Galería pública y vista previa al compartir | PUB-04, 05 | — |
| Recordatorios de carga | NOT-01, 02, 05 | Depende de la pregunta 10. |
| Historial de cambios de cada registro | FIC-06 · AUD-02, 03 | Ya se guarda quién modificó (T13). |
| Baja de célula y anulación de registro | LUG-09 · FIC-08 | Mientras tanto, lo hace el admin en la base. |
| Descargar fotos en ZIP | TAB-06 | — |
| Vista matriz de la tabla | TAB-02 | — |
| Límite de intentos de login | AUT-10 | — |
| Marca de individuo repuesto | Pregunta 19 | Cambia la métrica de crecimiento de T18. |
| Carga sin conexión con sincronización | RNF-OFF-01 | Si no hay señal en los lotes (pregunta 5), pasa a ser prioritaria. |
