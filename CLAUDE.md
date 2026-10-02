# CLAUDE.md — Células de Bosque UCC

Este archivo le da a Claude Code el contexto del proyecto. Leelo completo antes de hacer cualquier cambio.

## Qué es el proyecto

Plataforma web para el programa **UCC Sostenible** (Universidad Católica de Córdoba) que registra mes a mes el crecimiento y la supervivencia de las **células de bosque** plantadas en el Campus UCC y en colegios adheridos, y muestra los resultados a cualquier persona mediante un QR.

El objetivo es la **sensibilización ambiental**, no la investigación científica ni la competencia entre lugares. Por eso:

- La carga tiene que ser simple: pocos datos y una foto, en menos de 2 minutos desde el celular.
- Los resultados se muestran con pocas métricas claras.
- Nunca se agregan rankings ni comparaciones del tipo "mejor o peor lugar".

Se lanza el día de la plantación (fin de octubre o noviembre de 2026).

## Equipo

Somos tres estudiantes con poca experiencia. Cada semana, cada persona hace una funcionalidad completa (Go + React).

| Persona | Nombre | Revisa las PR de |
|---|---|---|
| A | Magda | Cande |
| B | Cande | Fran |
| C | Fran | Magda |

**Cómo tenés que trabajar con nosotros:**

- Respondé y escribí comentarios en **español**.
- Explicá lo que hacés y por qué, en lenguaje simple. Si usás algo que un junior puede no conocer (un patrón, una función de la librería estándar, un concepto de SQL), explicalo en una o dos líneas.
- Preferí siempre la solución **más simple** que funcione, aunque no sea la más elegante.
- Antes de un cambio grande o que toque varios archivos, contá el plan y esperá confirmación.
- No agregues dependencias nuevas sin preguntar.
- Si algo del pedido contradice los requerimientos o estas reglas, avisá antes de hacerlo.

## Documentación

- `docs/Requerimientos_Celulas_de_Bosque_v4.pdf`: especificación completa. Cada requerimiento tiene un ID (AUT-01, CAR-06, RN-04…). Si un ticket nombra un ID, los criterios de aceptación están ahí.
- `docs/Plan_de_Trabajo_Equipo_v3.pdf`: tickets (T01 a T27), calendario y lista de endpoints.
- `diseno/`: pantallas exportadas de Stitch (`code.html` + `screen.png`) y `DESIGN.md` con colores y tipografía.

## Stack

- **Backend:** Go 1.22+, `net/http` de la librería estándar (sin framework), `pgx` para PostgreSQL, `goose` para migraciones, `bcrypt` para contraseñas, `excelize` para Excel, `aws-sdk-go-v2` para fotos en Cloudflare R2.
- **Frontend:** React + Vite en JavaScript, React Router, Tailwind CSS, Recharts, `browser-image-compression`, `qrcode`.
- **Base de datos:** PostgreSQL 16 (Docker en desarrollo, Railway en producción).
- **Deploy:** un solo servicio en Railway. **El servidor Go también entrega el build de React**: cualquier ruta que no empiece con `/api` devuelve `frontend/dist`. En desarrollo, Vite hace proxy de `/api` al servidor Go. No hay CORS.

## Estructura

```
backend/
  main.go                  ← arranca el servidor y registra TODAS las rutas
  migrations/              ← .sql de goose
  seed/seed.sql            ← datos de prueba
  internal/
    db/                    ← conexión a la base
    auth/                  ← login, sesiones, middleware y permisos
    respuestas/            ← JSON(w, datos) y Error(w, codigo, mensaje)
    handlers/              ← un archivo por funcionalidad (lugares.go, celulas.go, registros.go, fotos.go, metricas.go, usuarios.go, admin.go, datos.go, publico.go)
frontend/src/
  App.jsx                  ← registra TODAS las rutas
  api.js                   ← pedir(ruta, opciones): única forma de llamar al backend
  components/              ← piezas compartidas (Boton, Tarjeta, ChipEstado, ContadorMasMenos, BotonesVivoMuerto, Plano, Foto…)
  pages/<Pantalla>/        ← una carpeta por pantalla
```

## Comandos

```bash
docker compose up -d                                  # levanta PostgreSQL
cd backend && goose -dir migrations postgres "$DATABASE_URL" up
psql "$DATABASE_URL" -f backend/seed/seed.sql         # datos de prueba
cd backend && go run .                                # backend en :8080
cd backend && go test ./...                           # tests del backend
cd frontend && npm install && npm run dev             # frontend en :5173
cd frontend && npm run build                          # build que sirve Go
```

Si algún comando cambia, actualizá esta sección.

## Dominio (vocabulario obligatorio)

Usá siempre estas palabras, en el código y en la interfaz:

| Término | Significado |
|---|---|
| **Lugar** | Institución adherida (universidad o colegio). Se identifica con una letra: A = Campus UCC, B = Colegio de Alta Gracia… |
| **Isleta** | Grupo de células dentro de un lugar. Número 1, 2, 3… |
| **Célula** (de bosque) | Contenedor con 4 plantas. Número dentro de la isleta. Es la unidad que se ubica, fotografía y registra. |
| **Individuo** | Cada una de las 4 plantas de la célula. |
| **Forma de vida** | 1 Árbol, 2 Arbusto, 3 Herbácea, 4 Rastrera. |
| **Registro** | Carga de una célula en un período: fecha, 1 foto, datos de los 4 individuos, observaciones. |
| **Período** | Mes calendario del registro (`2026-11`). |
| **Plano** | Foto de dron de la isleta con una grilla de filas y columnas donde se ubica cada célula. |

- **Código de célula:** `Lugar-Isleta-Número`, por ejemplo `A-1-45`. **Código de individuo:** `A-1-45-1`. Los códigos **no se guardan**: se calculan desde la jerarquía.
- En pantalla se muestra el nombre de la forma de vida ("Árbol"), nunca el dígito.
- **No uses** "árbol", "ejemplar" o "especie" para referirte a una célula, ni "lote", "parcela" o "cuadrante" para una isleta.
- No hay carteles, estacas ni NFC: la célula se encuentra por el plano y el código.

## Reglas de negocio

- **RN-01:** toda célula tiene exactamente 4 individuos, uno por forma de vida; se crean al crear la célula.
- **RN-02:** letra de lugar única; número de isleta único por lugar; número de célula y posición (fila, columna) únicos por isleta. Se garantizan con restricciones `UNIQUE` en la base, no solo en Go.
- **RN-03:** la letra, el número de isleta y el número de célula no se cambian si ya tienen registros.
- **RN-04:** un solo registro por célula por período (`UNIQUE (celula_id, periodo)`). Si ya existe, responder 409 y el front abre la edición.
- **RN-06:** la fecha de medición no puede ser futura ni anterior a la fecha de plantación.
- **RN-07:** la foto es obligatoria en todo registro.
- **RN-08:** vivo/muerto es obligatorio para los 4 individuos. Si está vivo, también son obligatorios altura, cantidad de flores, presencia de frutos y nuevas plántulas. Si está muerto, no se guarda ninguno de esos datos.
- **RN-09:** un individuo muerto el mes anterior se precarga como muerto; pasarlo a vivo pide confirmación.
- **RN-10:** un lugar tiene como máximo un cargador activo.
- **RN-12 y RN-13:** nunca se borran registros ni usuarios; se anulan o deshabilitan.
- **RN-15:** un lugar solo es visible sin sesión si está marcado como público (al inicio, solo el Campus UCC).
- **RN-17:** los tratamientos (maceta, bioestimulante, fertilizante) no se registran.

## Variables por individuo

Las cuatro formas de vida (Árbol, Arbusto, Herbácea, Rastrera) registran exactamente lo mismo en cada registro. Las variables viven en el catálogo `variables` de la base: no las escribas fijas en el código del formulario ni de la tabla.

| Variable | Código | Tipo | Rango | Control en pantalla | Valor inicial |
|---|---|---|---|---|---|
| Supervivencia | `vivo` | booleano | vivo / muerto | `BotonesVivoMuerto` | el del mes anterior |
| Altura | `altura_cm` | entero | 1 a 999 cm | `ContadorMasMenos` con tipeo | la del mes anterior |
| Cantidad de flores | `flores` | entero | 0 a 100 (propuesta) | `SelectorNumero` (desplegable) | 0 |
| Presencia de frutos | `frutos` | booleano | sí / no | `BotonesSiNo` | No |
| Nuevas plántulas | `plantulas_nuevas` | booleano | sí / no | `BotonesSiNo` | No |

- En el JSON van en camelCase: `vivo`, `alturaCm`, `flores`, `frutos`, `plantulasNuevas`.
- Altura: mostrar un aviso (no bloquear) si baja más de 20 % o sube más de 50 cm respecto del mes anterior.
- Además: polinizadores a nivel célula (contador, opcional) y diámetro del tronco solo en el Árbol (opcional). **Los dos están a confirmar** porque no figuran en la última lista de la clienta: no les agregues lógica nueva hasta que se confirmen.
- Con 20 datos por célula, el tiempo de carga (menos de 2 minutos) está en riesgo: cualquier cosa que sume toques en la carga mensual, consultala antes.

## Roles y permisos

| Rol | Puede |
|---|---|
| **Administrador** | Todo. |
| **Cargador** | Ver todos los lugares. Crear células y cargar o editar registros **solo en su lugar**. |
| **Lector** | Ver todo. No carga ni edita nada. |
| **Público** (sin sesión) | Solo `GET /api/publico/{letra}` de lugares públicos. |

- **Los permisos se validan siempre en el backend.** Ocultar un botón en React no alcanza.
- Usá el middleware `auth.RequiereSesion` y las funciones `auth.EsAdmin(usuario)` y `auth.PuedeEditarLugar(usuario, lugarID)`. No reescribas esa lógica en cada handler.
- Las fotos se sirven por `GET /api/fotos/{id}`, que verifica permisos. Nunca expongas la URL directa de R2.
- La página pública nunca muestra nombres ni emails de usuarios.

## Convenciones del backend (Go)

- Un archivo por funcionalidad en `internal/handlers/`. Las rutas se registran solo en `main.go`.
- Rutas con los patrones de Go 1.22: `mux.HandleFunc("GET /api/celulas/{id}", h.ObtenerCelula)` y `r.PathValue("id")`.
- Todas las respuestas son JSON. Usá siempre `respuestas.JSON` y `respuestas.Error`.
- Formato de error: `{ "error": "mensaje en español para mostrar al usuario" }`.
- Códigos de estado: 400 datos inválidos, 401 sin sesión, 403 sin permiso, 404 no existe, 409 ya existe, 500 error del servidor. En un 500, logueá el detalle y devolvé un mensaje genérico.
- SQL escrito a mano con `pgx` y **siempre con parámetros** (`$1`, `$2`). Nunca armes SQL concatenando strings.
- Si una operación escribe en varias tablas (registro + mediciones), usá una transacción.
- JSON en camelCase (`alturaCm`, `formaDeVida`); columnas de la base en snake_case (`altura_cm`).
- Nombres de funciones y variables en español, igual que el dominio (`ObtenerCelula`, `registro`, `individuos`).
- Guardá siempre `creado_por`, `creado_en`, `modificado_por` y `modificado_en` en los registros.
- Tests con `go test` para permisos, validaciones y métricas.

## Convenciones del frontend (React)

- Componentes funcionales con hooks. Un componente por archivo.
- Las llamadas al backend pasan **solo** por `api.js`. Nunca uses `fetch` directo en una pantalla.
- Antes de crear un componente, fijate si ya existe en `components/`. Usá los compartidos: `Boton`, `Tarjeta`, `ChipEstado`, `ContadorMasMenos`, `BotonesVivoMuerto`, `BotonesSiNo`, `SelectorNumero`, `Modal`, `PanelInferior`, `Cargando`, `Vacio`, `MensajeError`, `Plano`, `Foto`.
- Toda pantalla maneja los estados cargando, vacío, error y sin permiso.
- Diseño **mobile first**: botones y zonas táctiles de al menos 48 px, texto de al menos 16 px en campos de carga.
- Los estados usan color **y** ícono, nunca solo color.
- Colores y tipografía solo desde Tailwind, configurados con el `DESIGN.md`. No uses colores sueltos en hexadecimal.
- Textos de la interfaz en español rioplatense con voseo ("Cargá", "Elegí").
- Del HTML de Stitch se toma el diseño, no el código: no copies las fotos ni los datos de ejemplo ("Silvalog", "Lucía Méndez", fechas de 2024 o 2025, nombres de especies).
- Si el endpoint todavía no existe, usá un mock con el formato exacto de la lista de endpoints del plan y dejá `// TODO: reemplazar mock por api` con el número de ticket.

## Base de datos y migraciones

- Todas las tablas se crearon en la semana 0. Tablas: lugares, isletas, celulas, formas_de_vida, individuos, variables, registros, mediciones, usuarios, sesiones, cambios, fotos.
- **No modifiques una migración que ya está en `main`.** Para cambiar algo, creá una migración nueva con `goose create <nombre> sql`.
- **Antes de crear una migración, avisá**: el equipo tiene que coordinarlo en el grupo para que no haya dos al mismo tiempo.
- Si agregás datos necesarios para probar, actualizá `seed/seed.sql`.

## Git y trabajo en equipo

- **Nunca hagas commit ni push directo a `main`.** Una rama por ticket: `t14-carga-mensual`.
- Commits chicos, en español, con el ticket: `T14: agrega bloque de individuos a la carga`.
- En los tres archivos compartidos (`main.go`, `App.jsx`, `api.js`) **solo agregá líneas**; no reordenes ni borres las de otros.
- No toques archivos de la funcionalidad de otra persona salvo que te lo pidan; si hace falta, avisá.
- Antes de dar algo por terminado: compila, pasan los tests, funciona en el celular y cumple el "está listo cuando" del ticket.

## Seguridad y privacidad

- Nunca subas `.env`, claves ni contraseñas al repositorio. Usá variables de entorno y mantené actualizado `.env.example`.
- Contraseñas solo con bcrypt. Nunca en texto plano ni en logs.
- La sesión es un token al azar en una cookie `HttpOnly`, `Secure` y `SameSite=Lax`, guardado en la tabla `sesiones`.
- Al subir una foto, eliminá la ubicación GPS de los metadatos.
- Puede haber menores en las fotos de colegios: la foto se pide solo de la célula desde arriba, sin personas.

## Qué no hacer

- No agregar funciones fuera del alcance: datos de ensayos científicos, datos de invernadero, tratamientos, carga por alumnos, autogestión de usuarios por institución, rankings.
- No usar un ORM ni un framework web.
- No agregar librerías de UI (Material, Bootstrap, etc.): se usa Tailwind con los componentes propios.
- No usar TypeScript salvo que el equipo lo decida.
- No inventar valores de negocio: si algo no está en los requerimientos, preguntá.

## Decisiones pendientes con la clienta

Si un cambio depende de alguna de estas, avisá antes de asumir un valor:

1. Si cada individuo tiene especie.
2. Qué pasa cuando un individuo muerto se repone.
3. Si hay señal de internet en los lotes (define si hace falta carga sin conexión).
4. Qué 3 o 4 métricas se muestran en el resumen.
5. Si la supervivencia principal es sobre los 4 individuos o solo el árbol.
6. Si el cargador puede editar meses anteriores (por ahora, solo el admin).
7. Si la altura tiene que ser un desplegable (la clienta lo pidió así; por ahora se usan −1/+1 con tipeo).
8. Hasta cuántas flores se cuentan y si sirven rangos en lugar del número exacto (por ahora, 0 a 100).
9. Qué cuenta como nueva plántula y si se registra aunque el individuo esté muerto (por ahora, no se registra).
10. Si se mantienen diámetro y polinizadores.

Ya respondidas: la cuarta forma de vida es **Rastrera** y en ella se mide la **altura**.
