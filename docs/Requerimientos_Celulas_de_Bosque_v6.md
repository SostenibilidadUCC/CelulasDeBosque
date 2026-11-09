# Especificación de requerimientos

**Plataforma de Seguimiento de Células de Bosque**
Programa UCC Sostenible · Universidad Católica de Córdoba
Versión 6 · noviembre de 2026

> La v6 reemplaza a `Requerimientos_Celulas_de_Bosque_v5.pdf`. Aplica los cambios de
> `Cambios_Requerimientos_y_Plan.md` y el rediseño de noviembre de 2026: menos información, sin botones
> repetidos y fácil de usar para personas mayores. Lo descartado se borró del documento.

**Cómo leer este documento:** cada requerimiento tiene un ID único que se usa en los tickets. La prioridad es
**A** (necesario para el lanzamiento), **M** (deseable para el lanzamiento) o **B** (posterior). Lo marcado
como *(propuesta)* lo fijó el equipo para poder avanzar y se valida con la clienta; lo marcado como
*(a confirmar)* depende de una pregunta pendiente (sección 13).

## Contenido

1. Introducción
2. Glosario y código de identificación
3. Usuarios y roles
4. Reglas de negocio
5. Estados
6. Variables a registrar
7. Definición de métricas
8. Requerimientos funcionales
9. Requerimientos no funcionales
10. Privacidad y datos personales
11. Modelo de datos conceptual (11.1 Formato de exportación)
12. Supuestos, restricciones y fuera de alcance
13. Pendientes y preguntas abiertas
14. Plazos e hitos

---

## 1. Introducción

### 1.1 Propósito

Este documento describe qué tiene que hacer la plataforma, para quién y con qué condiciones. Es la
referencia para diseñar, programar, probar y validar con la clienta. Todo lo que no está acá se considera
fuera de alcance hasta que se acuerde lo contrario.

### 1.2 Contexto

El programa UCC Sostenible planta células de bosque nativo en el Campus UCC y en colegios adheridos de la
provincia de Córdoba. Cada célula es un contenedor con cuatro plantas de distintas formas de vida. Hace falta
registrar mes a mes si cada planta sigue viva y cuánto creció, y mostrar esos resultados tanto al equipo como
a cualquier persona que pase por el campus. La plataforma nace de la convocatoria UCC Sostenible y se presenta
el día de la plantación.

### 1.3 Objetivo

El objetivo principal es la sensibilización y la concientización ambiental. No se busca que los lugares
compitan ni reemplazar las planillas de ensayos científicos (tesis, becas). Por eso la carga tiene que ser
simple, con pocos datos y una foto, y los resultados se muestran con pocas métricas que cualquiera pueda
entender. Una persona que escanee el QR de un lugar tiene que entender en segundos qué se plantó y cómo va.

### 1.4 Alcance

Incluye: página de presentación pública; pedido de acceso y gestión centralizada de usuarios, lugares,
isletas, planos y células; carga del registro inicial y mensual desde el celular; consulta de células, fichas
e historial de fotos; resultados con métricas y gráficos; tabla de datos exportable; mapa de lugares; página
pública con QR; recordatorios de carga y auditoría. Lo que queda fuera se detalla en la sección 12.

## 2. Glosario y código de identificación

| Concepto | Definición | Ejemplo |
|---|---|---|
| **Lugar** | Institución o predio adherido (universidad o colegio). Se identifica con una letra que asigna el administrador. | A = Campus UCC, B = Colegio de Alta Gracia |
| **Isleta** | Grupo de células dentro de un lugar, plantadas juntas en un sector. Un lugar puede tener varias. | Isleta 1 · Junto a Agronomía |
| **Célula de bosque** | Contenedor con 4 plantas. Es la unidad que se ubica, se fotografía y se registra. | Célula A-1-45 |
| **Individuo** | Cada una de las 4 plantas de la célula, identificada por su forma de vida. | Árbol de la célula A-1-45 |
| **Forma de vida** | Tipo de planta. Todas las células tienen las mismas cuatro. | Árbol, Arbusto, Gramínea, Rastrera |
| **Plano** | Imagen aérea (foto de dron) de una isleta con una grilla de filas y columnas donde se ubica cada célula. | Isleta 1: 6 filas × 10 columnas |
| **Registro** | Carga de una célula en un período: fecha, 1 foto, datos de los 4 individuos y observaciones. | Registro de noviembre 2026 |
| **Registro inicial** | Primer registro de una célula, hecho al plantarla. Usa las mismas variables que el mensual. | — |
| **Período** | Mes calendario al que corresponde un registro. | 2026-11 |
| **Reposición** | Individuo que murió y se reemplazó por uno nuevo de la misma forma de vida. Se carga con el botón "Cargar uno nuevo" y en la base sigue siendo el mismo individuo (RN-09). | Arbusto repuesto en el registro de enero |
| **Cargador** | Persona responsable de cargar los datos de un lugar. | Docente del colegio de Alta Gracia |

### Código de identificación

| Parte | Formato | Valores |
|---|---|---|
| Lugar | Letra | A, B, C… (única, la asigna el administrador) |
| Isleta | Número | 1, 2, 3… dentro del lugar |
| Célula | Número | 1 a 200 dentro de la isleta |
| Forma de vida | Dígito 1 a 4 | 1 Árbol, 2 Arbusto, 3 Gramínea, 4 Rastrera |

El código de un individuo es `Lugar-Isleta-Célula-FormaDeVida` (A-1-45-1 = Árbol de la célula 45, isleta 1,
Campus UCC). En pantalla se muestra el código de la célula (A-1-45) y el nombre de la forma de vida, nunca el
dígito final. El código no se guarda como texto: se calcula a partir de la jerarquía, así un cambio de nombre
no rompe nada.

## 3. Usuarios y roles

La administración es centralizada en UCC Sostenible: ninguna institución crea ni gestiona sus propios
usuarios. Quien necesita una cuenta **pide acceso** y queda pendiente hasta que un administrador la aprueba y
elige su rol. Todos los usuarios con sesión ven los datos de todos los lugares, porque la idea es aprender y
no competir. Los alumnos no tienen cuenta de carga: recorren la plantación, sacan fotos y se las pasan al
cargador.

| Rol | Quién es | Qué puede hacer | Cantidad esperada |
|---|---|---|---|
| **Administrador** | Equipo de UCC Sostenible. Al principio varias personas; al final queda una sola. | Todo: aprobar y gestionar usuarios, lugares, isletas, planos, células, registros de cualquier lugar, QR, exportaciones y auditoría. | 1 a 4 |
| **Cargador** | Una sola persona por lugar (docente o responsable). Pide acceso y el administrador la aprueba como cargadora de un lugar. | Ve todos los lugares. Da de alta células y carga y corrige registros solo en su lugar. Recibe recordatorios. | 1 por lugar |
| **Lector** | Alumnos, docentes u otras personas que piden acceso y el administrador aprueba como lectores. | Ve todos los lugares, fichas completas, planos, resultados, mapa y tabla de datos, y exporta a Excel. No carga ni edita nada. | Decenas |
| **Público** | Cualquiera que entra a la página o escanea el QR, sin cuenta. | Ve la presentación y los resultados y células de **todos los lugares activos**. | Sin límite |

Con todos los lugares públicos, lo que distingue al Lector de alguien sin sesión es la tabla de datos, la
exportación a Excel, la ficha completa, el plano de las isletas y el mapa. Los datos crudos siguen siendo
privados.

### Matriz de permisos

| Función | Admin | Cargador | Lector | Público |
|---|---|---|---|---|
| Iniciar sesión | Sí | Sí | Sí | No necesita |
| Ver inicio y lugares | Todos | Todos | Todos | — |
| Ver células, isletas y fichas | Todos | Todos | Todos | Galería y ficha simplificada de los lugares activos |
| Dar de alta células | Cualquier lugar | Su lugar | — | — |
| Cargar registros | Cualquier lugar | Su lugar | — | — |
| Editar registros | Cualquiera | Su lugar, solo el mes en curso (a confirmar) | — | — |
| Ver resultados | Todos | Todos | Todos | Todos los lugares activos |
| Ver tabla de datos | Sí | Sí | Sí | — |
| Exportar a Excel | Sí | Sí | Sí | — |
| Descargar fotos en ZIP | Sí | — | — | — |
| Ver mapa | Sí | Sí | Sí | — |
| Gestionar usuarios | Sí | — | — | — |
| Gestionar lugares, isletas y planos | Sí | — | — | — |
| Generar QR | Sí | — | — | — |
| Ver historial de cambios | Sí | Su lugar | — | — |
| Recibir recordatorios | Resumen (propuesta) | Su lugar (propuesta) | — | — |

## 4. Reglas de negocio

Los IDs no se renumeran: si una regla se borra, su ID queda libre y no se vuelve a usar.

| ID | Regla |
|---|---|
| RN-01 | Toda célula tiene exactamente 4 individuos, uno por forma de vida. Se crean automáticamente al dar de alta la célula y no se pueden agregar ni quitar. |
| RN-02 | La letra de un lugar es única en el sistema. El número de isleta es único dentro del lugar. El número de célula es único dentro de la isleta. Cada posición (fila, columna) del plano puede tener como máximo una célula. |
| RN-03 | La letra de un lugar y el número de una isleta o célula no se pueden cambiar una vez que tienen registros, porque cambiarían los códigos ya usados en el campo. |
| RN-04 | El período de un registro es el mes calendario de su fecha de medición. Puede haber como máximo un registro por célula por período. Si ya existe, se edita en lugar de crear otro. |
| RN-05 | El primer registro de una célula es el registro inicial. El inicial y los mensuales usan exactamente las mismas variables. |
| RN-06 | La fecha de medición no puede ser futura ni anterior a la fecha de plantación de la célula. |
| RN-07 | La foto de la célula es obligatoria en todo registro. |
| RN-08 | La supervivencia es obligatoria para los 4 individuos. Altura, cantidad de flores, presencia de frutos y nuevas plántulas son obligatorias para cada individuo vivo. Si un individuo está muerto, no se registra ninguna de ellas. |
| RN-09 | Un individuo que estaba muerto el mes anterior aparece precargado como Muerto, en gris y sin controles: no se le carga nada más. Si se repuso, el cargador toca "Cargar uno nuevo (reposición)", confirma, y el individuo se carga como vivo con sus datos. El botón solo aparece si el registro anterior lo tenía muerto. En la base sigue siendo el mismo individuo (RN-01). Cómo se mide el crecimiento de un individuo repuesto está *(a confirmar)*. |
| RN-10 | Un lugar tiene como máximo un cargador activo. Un cargador está asignado a un solo lugar. |
| RN-11 | El cargador puede editar los registros de su lugar del período en curso, las veces que haga falta. La edición de períodos anteriores está *(a confirmar)*; mientras tanto, solo el administrador. Toda edición queda auditada. |
| RN-12 | Los registros no se borran físicamente. El administrador puede anular un registro con un motivo; el registro anulado no cuenta en métricas pero queda en la auditoría. |
| RN-13 | Los usuarios no se borran: se deshabilitan. Un usuario deshabilitado no puede ingresar y sus registros conservan la autoría. |
| RN-14 | Una célula se puede dar de baja (perdida, removida) con motivo y fecha. Desde esa fecha no cuenta como pendiente ni en las métricas, pero su historial sigue visible. |
| RN-15 | Todo lugar activo es visible sin sesión. Para ocultar un lugar, el administrador lo deshabilita (LUG-03). |
| RN-16 | La carga de un período se considera vencida al terminar el mes calendario *(propuesta, a confirmar)*. Se puede cargar tarde, pero el registro queda marcado como fuera de término. |
| RN-19 | La cobertura no se carga en el campo: el equipo la calcula desde la foto con ImageJ y el administrador la puede cargar después *(a confirmar)*. |
| RN-20 | No se muestran rankings ni comparaciones del tipo "mejor o peor lugar". |

RN-17 (tratamientos) y RN-18 (datos de invernadero) se pasaron a "Fuera de alcance" (sección 12).

## 5. Estados

### Estado de una célula en el período actual

Solo lo ven el administrador y el cargador del lugar. El lector, el público y los cargadores de otros lugares
ven las células sin estado.

| Estado | Condición | En pantalla |
|---|---|---|
| Sin registro inicial | La célula se dio de alta pero todavía no tiene ningún registro. | Gris |
| Al día | Tiene registro del período actual. | Verde con tilde |
| Pendiente | No tiene registro del período actual. | Ámbar |
| Dada de baja | La célula se dio de baja (RN-14). | Gris tachado |

"Fuera de término" no es un estado de la célula: es una marca del registro que se cargó después de que venció
su mes (RN-16). Se ve en la ficha y en la exportación.

### Estado de un individuo

Vivo o Muerto, según el último registro. Si nunca se registró, se muestra "Sin datos". Un individuo muerto se
muestra en gris y sin controles de carga hasta que se lo reponga (RN-09).

### Estado de un usuario

| Estado | Condición |
|---|---|
| Pendiente | Pidió acceso y todavía no lo aprobó un administrador. No puede ingresar. |
| Activo | Aprobado. Puede ingresar con su rol. |
| Deshabilitado | No puede ingresar. Sus registros conservan la autoría (RN-13). |

## 6. Variables a registrar

Se registran pocas variables y siempre se eligen con botones o desplegables, no con texto libre, para evitar
errores de tipeo. Las cuatro formas de vida (Árbol, Arbusto, Gramínea y Rastrera) registran exactamente lo
mismo. Las variables viven en un catálogo de la base (RNF-MAN-02), así se pueden sumar otras sin reprogramar.

| Variable | Nivel | Tipo y rango | Obligatoria | Estado |
|---|---|---|---|---|
| Fecha de medición | Registro | Fecha. Hoy por defecto; no futura ni anterior a la plantación (RN-06). | Sí | Definida |
| Foto | Célula (1 por registro) | Imagen JPG, PNG o HEIC, tomada desde arriba con las 4 plantas en el cuadro. | Sí | Definida |
| Supervivencia | Individuo (×4) | Botones Vivo / Muerto. Al marcar Muerto se pide confirmación. Valor inicial: el del mes anterior. | Sí | Definida |
| Altura | Individuo (×4) | Entero en cm, de 1 a 999, en un desplegable que arranca en la altura del mes anterior. | Sí, si está vivo | Definida |
| Cantidad de flores | Individuo (×4) | Entero exacto de 0 a 100, en un desplegable. Valor inicial: 0. | Sí, si está vivo | Definida |
| Presencia de frutos | Individuo (×4) | Botones Sí / No. Valor inicial: No. | Sí, si está vivo | Definida |
| Nuevas plántulas | Individuo (×4) | Botones Sí / No. Es un campo simple: no hay un criterio de qué se cuenta como plántula nueva. Valor inicial: No. | Sí, si está vivo | Definida |
| Observaciones | Registro | Texto libre, hasta 500 caracteres. | No | Definida |
| Especie | Individuo (×4) | Texto elegido de una lista, en el alta de la célula. | No | *(a confirmar)* |
| Cobertura | Registro | Porcentaje de 0 a 100 con un decimal, cargado por el administrador (RN-19). | No | *(a confirmar)* |
| Diversidad | A definir | A definir. | — | *(a confirmar)* |

La altura muestra un aviso (no bloquea) si baja más de 20 % o sube más de 50 cm respecto del mes anterior.

## 7. Definición de métricas

Todas las métricas respetan los filtros activos (lugar, isleta, período y forma de vida) y no cuentan las
células dadas de baja (RN-14) ni los registros anulados (RN-12). "Último registro" es el último registro de
cada célula dentro del período filtrado.

### Métricas principales *(propuesta)*

Son las tres que se ven primero en Resultados. La clienta tiene que validarlas (sección 13).

| Métrica | Cálculo | Observaciones |
|---|---|---|
| Células plantadas | Cantidad de células activas. | — |
| Supervivencia | Individuos vivos en su último registro ÷ individuos con al menos un registro × 100. | Si es sobre los 4 individuos o solo sobre el árbol está *(a confirmar)*. |
| Crecimiento promedio | Promedio, entre los individuos vivos, de (altura del último registro − altura del registro inicial), en cm. | Con un individuo repuesto (RN-09) compararía la planta vieja con la nueva *(a confirmar)*. |

### El bosque se regenera

Tres métricas para la sensibilización ("este mes florecieron…").

| Métrica | Cálculo |
|---|---|
| Individuos en floración | Individuos vivos con al menos una flor en su último registro ÷ individuos vivos × 100. |
| Individuos con frutos | Individuos vivos con frutos en su último registro ÷ individuos vivos × 100. |
| Células con nuevas plántulas | Células activas con al menos un individuo con nuevas plántulas en su último registro ÷ células activas × 100. |

### Gráficos

| Métrica | Cálculo | Cómo se muestra |
|---|---|---|
| Supervivencia por forma de vida | Supervivencia calculada por separado para cada forma de vida. | Barras del mismo color, sin textos extra. |
| Supervivencia por mes | Supervivencia calculada en cada período. | Gráfico de evolución. |
| Altura promedio por mes | Promedio de altura de los individuos vivos, por período y forma de vida. | Gráfico de evolución. |

### Otras

| Métrica | Cálculo | Observaciones |
|---|---|---|
| Avance de carga del mes | Células con registro del período actual ÷ células activas × 100. | Solo la ve el cargador, de su lugar, en Inicio. |
| Cobertura promedio | Promedio de la cobertura del último registro de cada célula. | Solo si se confirma RN-19 *(a confirmar)*. |

## 8. Requerimientos funcionales

Los IDs no se renumeran: si un requerimiento se borra, su ID queda libre.

### 8.1 Autenticación y sesión

Roles: todos menos Público.

| ID | Requerimiento | Criterios de aceptación | Prio |
|---|---|---|---|
| AUT-01 | Iniciar sesión con email y contraseña. | Con datos válidos entra a Inicio según su rol. Con datos inválidos muestra "Email o contraseña incorrectos" sin decir cuál falló. | A |
| AUT-02 | Mostrar u ocultar la contraseña. | Un botón con ícono alterna la visibilidad. | A |
| AUT-03 | Mensaje para usuario pendiente o deshabilitado. | Si el usuario está pendiente, un aviso tranquilo (no un error en rojo) dice que su pedido espera la aprobación de un administrador. Si está deshabilitado, muestra que el acceso está pausado y el email de contacto de UCC Sostenible. | A |
| AUT-04 | Pedir acceso. | Desde el login, "Pedí acceso" abre un formulario con nombre, email, contraseña (mínimo 8 caracteres) e institución (opcional). El email no puede repetirse. La cuenta queda pendiente hasta que un administrador la aprueba (USR-02). Nunca se mandan contraseñas por chat. | A |
| AUT-05 | Recuperar la contraseña. | El administrador toca "Generar contraseña nueva" en el panel de la persona; la contraseña se muestra una sola vez, se la pasa por WhatsApp y se cierran todas las sesiones de esa persona. *(Propuesta para después: un enlace de un solo uso enviado por WhatsApp, que abre "Elegí tu contraseña nueva", o un mail automático desde "¿Olvidaste tu contraseña?". Las dos necesitan una tabla nueva; la del mail, además, una cuenta de correo para enviar.)* | A |
| AUT-06 | Sesión persistente. | En el celular la sesión se mantiene hasta cerrar sesión o 30 días sin uso. | A |
| AUT-07 | Cerrar sesión. | Disponible desde Cuenta. Vuelve a la página de presentación (`/`). | A |
| AUT-08 | Cambiar la contraseña propia. | Pide la contraseña actual y la nueva dos veces. *(Propuesta: subir a A, porque con AUT-05 el administrador conoce la contraseña que generó.)* | M |
| AUT-09 | Volver a la presentación desde el login. | Un botón "Volver a la presentación" lleva a `/` sin pedir datos. | A |
| AUT-10 | Protección contra intentos repetidos. | Tras 5 intentos fallidos en 15 minutos, bloquea ese email por 15 minutos. | M |

### 8.2 Administración de usuarios

Roles: Administrador.

| ID | Requerimiento | Criterios de aceptación | Prio |
|---|---|---|---|
| USR-01 | Listar usuarios. | Muestra a las personas en tres grupos: Esperando aprobación (primero), Con acceso y Sin acceso. De cada una se ve nombre, email, rol y lugar. Tiene buscador por nombre o email. | A |
| USR-02 | Aprobar un pedido de acceso. | El administrador elige si la persona es Cargador (y de qué lugar, obligatorio), Lector o Administrador. Al guardar, la persona queda activa y puede ingresar. | A |
| USR-03 | Un cargador por lugar. | Si el lugar ya tiene cargador activo, avisa y ofrece reemplazarlo; al aceptar, el anterior pasa a Lector (RN-10). | A |
| USR-04 | Editar usuario. | Se pueden cambiar el rol y el lugar. El email no se edita. Los permisos nuevos rigen en la siguiente acción del usuario. | A |
| USR-05 | Quitar y devolver el acceso. | Pide confirmación. Quien no tiene acceso no puede ingresar y se cierran sus sesiones. Sus registros conservan la autoría (RN-13). | A |
| USR-07 | Proteger al último administrador. | No se puede quitar el acceso ni cambiar de rol al último administrador activo. | A |
| USR-08 | Registrar la institución. | La institución que se pide (opcional) en AUT-04 se ve en el panel de la persona. | M |

USR-06 (reenviar invitación) se borró: ya no hay invitaciones, y la contraseña nueva está en AUT-05.

### 8.3 Lugares, isletas, planos y células

Roles: Administrador (el cargador puede dar de alta células en su lugar, ver 8.6).

| ID | Requerimiento | Criterios de aceptación | Prio |
|---|---|---|---|
| LUG-01 | Crear lugar. | Pide letra, nombre, tipo (universidad o colegio), localidad y ubicación tocando en el mapa. La letra es única. | A |
| LUG-02 | Editar lugar. | Se editan todos los datos menos la letra si ya tiene registros (RN-03). | A |
| LUG-03 | Deshabilitar lugar. | Deja de aparecer en listados, mapa, métricas y página pública; los datos se conservan. Es la única forma de ocultar un lugar al público (RN-15). | M |
| LUG-04 | Crear isleta. | Pide número (sugiere el siguiente libre), nombre descriptivo y ubicación. El número es único en el lugar. | A |
| LUG-05 | Cargar el plano de la isleta. | Acepta JPG o PNG hasta 10 MB, filas y columnas de 1 a 30, y muestra la grilla superpuesta sobre la imagen antes de guardar. | A |
| LUG-06 | Reemplazar el plano. | Se puede subir una imagen nueva sin perder las posiciones de las células, siempre que filas y columnas alcancen. | M |
| LUG-07 | Crear células en lote. | Pide número inicial y final; las ubica en la grilla de izquierda a derecha y de arriba abajo en celdas libres; muestra la vista previa antes de confirmar. | M |
| LUG-08 | Mover una célula en el plano. | Se elige una celda libre. Si la celda está ocupada, avisa y no guarda. | A |
| LUG-09 | Dar de baja una célula. | Pide motivo y fecha; aplica RN-14. | M |

### 8.4 Inicio

Roles: Administrador, Cargador, Lector. Cada rol ve solo lo que le sirve.

| ID | Requerimiento | Criterios de aceptación | Prio |
|---|---|---|---|
| INI-01 | Título. | El cargador ve el nombre de su lugar; el administrador y el lector, "Hola, {nombre}". | A |
| INI-02 | Avance de carga del mes. | Solo para el cargador, de su lugar: cuántas células faltan cargar, barra de avance y días que faltan para el vencimiento (RN-16). El administrador no lo ve, porque varios lugares con su avance se leen como un ranking (RN-20). | A |
| INI-03 | Botón Cargar. | Solo el cargador lo ve, en la barra de navegación. Lleva directo a la próxima célula pendiente de su lugar. Es el único camino para empezar la carga desde Inicio. | A |
| INI-04 | Tarjetas de lugares. | Una por lugar con letra, nombre y cantidad de células e isletas, sin estado del mes. El cargador ve solo la de su lugar; el administrador y el lector ven todas. | A |
| INI-06 | Acceso al mapa. | Botón que abre el mapa. | M |

INI-05 (últimas células registradas) e INI-07 (aviso de lector) se borraron.

### 8.5 Explorar células e isleta con plano

Roles: Administrador, Cargador, Lector. El público tiene su propia página (8.12).

| ID | Requerimiento | Criterios de aceptación | Prio |
|---|---|---|---|
| EXP-01 | Elegir lugar. | Por defecto, el lugar del cargador; para los demás, el primero de la lista. | A |
| EXP-02 | Filtrar y buscar. | Filtro por isleta y buscador que acepta el código completo (A-1-45) o solo el número (45). El filtro por estado del mes solo lo ven el administrador y el cargador del lugar (sección 5). | A |
| EXP-03 | Tarjeta de célula. | Muestra foto, código, isleta, fecha del último registro y estado de los 4 individuos. El estado del mes solo lo ven el administrador y el cargador del lugar. Toda la tarjeta lleva a la ficha. | A |
| EXP-04 | Acciones según permiso. | "Cargar registro del mes" solo aparece en el lugar propio del cargador o para el administrador. A los demás no se les muestra ningún aviso: simplemente no ven el botón. | A |
| EXP-05 | Estado vacío. | Si no hay resultados, mensaje y botón para limpiar filtros. | A |
| ISL-01 | Plano de la isleta. | Imagen con grilla, número en cada celda y posibilidad de acercar con dos dedos. | A |
| ISL-02 | Colores por estado. | Para el administrador y el cargador del lugar, cada celda se colorea según la sección 5, con contadores (cargadas, pendientes). Los demás ven el plano sin estados. | A |
| ISL-03 | Panel de célula. | Al tocar una celda se abre un panel con foto, último registro, 4 individuos y los botones "Cargar registro" (si tiene permiso y falta cargar) y "Ver ficha". Hay un solo botón principal: si no hay nada que cargar, lo es "Ver ficha". | A |
| ISL-05 | Resaltar búsqueda. | Al buscar un código, la celda se resalta y se centra en pantalla. | A |
| ISL-06 | Isleta sin plano. | Si todavía no hay plano, se muestra la lista con un aviso. | A |

ISL-04 (alternar entre plano y lista) se borró: la lista ya está en la pantalla Células.

### 8.6 Nueva célula y registro inicial

Roles: Administrador (cualquier lugar), Cargador (su lugar).

| ID | Requerimiento | Criterios de aceptación | Prio |
|---|---|---|---|
| ALT-01 | Elegir ubicación. | Se entra desde Cuenta, con el botón "Nueva célula", porque se usa una sola vez por célula. Pide lugar (fijo para el cargador), isleta, número (sugiere el siguiente libre) y celda en el plano (solo celdas libres). | A |
| ALT-02 | Validar unicidad. | Si el número o la celda ya están ocupados, avisa antes de continuar (RN-02). | A |
| ALT-03 | Mostrar el código. | El código generado (A-1-45) se muestra grande antes de confirmar. | A |
| ALT-04 | Fecha de plantación. | Hoy por defecto; no puede ser futura. | A |
| ALT-05 | Crear los 4 individuos. | Se crean automáticamente al confirmar (RN-01). | A |
| ALT-06 | Registro inicial. | Continúa con el mismo formulario de la carga mensual (8.7). Si se sale sin completarlo, la célula queda "Sin registro inicial". | A |
| ALT-07 | Especie de cada individuo. | Campo opcional si la clienta lo confirma *(a confirmar)*. | B |
| ALT-08 | Ubicación del celular. | Botón opcional que guarda latitud, longitud y la precisión informada por el GPS. | B |
| ALT-09 | Cancelar. | Si hay datos cargados, pide confirmación antes de descartarlos. | A |

### 8.7 Carga mensual

Roles: Administrador (cualquier lugar), Cargador (su lugar).

| ID | Requerimiento | Criterios de aceptación | Prio |
|---|---|---|---|
| CAR-01 | Entrar a la carga. | Desde el botón Cargar de la barra, desde el panel de la isleta o desde la ficha. Si no hay célula elegida, abre un panel para elegirla por plano o por código. | A |
| CAR-02 | Encabezado. | Muestra código, lugar, isleta, período y botón "Cambiar" célula. | A |
| CAR-03 | Fecha y período. | Fecha de hoy por defecto, editable. El período se deduce de la fecha (RN-04, RN-06). | A |
| CAR-04 | Foto. | Botones "Abrir cámara" y "Elegir de galería". Muestra al lado la foto del mes anterior como referencia de encuadre. Es obligatoria (RN-07). | A |
| CAR-05 | Compresión y subida. | La foto se reduce en el celular (lado mayor 1600 px, hasta 300 KB) y se sube con barra de progreso y botón para reintentar si falla. | A |
| CAR-06 | Bloques de individuos. | 4 bloques fijos, uno por forma de vida (Árbol, Arbusto, Gramínea, Rastrera), cada uno con Vivo/Muerto, altura en un desplegable de centímetros, cantidad de flores en un desplegable de números, y presencia de frutos y nuevas plántulas con Sí/No. | A |
| CAR-07 | Valor de referencia. | Debajo de la altura se muestra solo la del mes anterior ("En septiembre: 173 cm"), sin la diferencia. | A |
| CAR-08 | Altura precargada. | El desplegable de altura arranca posicionado en el valor del mes anterior. Si al guardar alguna altura quedó igual, pide confirmar "La altura quedó igual que el mes anterior, ¿es correcto?". | A |
| CAR-09 | Individuo muerto. | Al marcar Muerto se pide confirmación, se ocultan la altura y las demás variables, y el bloque queda en gris. Aplica RN-09 para los que ya estaban muertos. | A |
| CAR-10 | Validación de altura. | Rango 1 a 999. Aviso (no bloqueo) si baja más de 20 % o sube más de 50 cm respecto del mes anterior *(propuesta)*. | A |
| CAR-13 | Observaciones. | Texto libre opcional, hasta 500 caracteres, con contador. | A |
| CAR-14 | Registro existente. | Si ya hay registro del período, la pantalla abre en modo edición con el aviso correspondiente (RN-04). El administrador puede editar un mes anterior desde la ficha (RN-11); al guardar, vuelve a la ficha. | A |
| CAR-15 | Guardar. | Valida los obligatorios y marca los faltantes. Al guardar pasa sola a la próxima célula pendiente del lugar, con un aviso corto. Si no queda ninguna, muestra una pantalla de confirmación. | A |
| CAR-16 | No perder datos. | Si se corta la conexión o se cierra la app, lo cargado queda guardado como borrador en el celular y se ofrece retomarlo. Depende de si hay señal en los lotes *(a confirmar)*. | A |
| CAR-17 | Tiempo de carga. | Se mide cuánto tarda un registro completo en la prueba con un usuario real y se anotan los pasos lentos. No hay un tope fijo. | M |
| CAR-19 | Valores iniciales. | Para no sumar tiempo de carga, flores arranca en 0 y frutos y plántulas en No. | A |
| CAR-20 | Reposición. | Si el individuo figuraba muerto en el registro anterior, su bloque aparece en gris con el botón "Cargar uno nuevo (reposición)". Al tocarlo pide confirmación ("¿Se repuso este individuo?") y el bloque se habilita como vivo (RN-09). El botón no aparece en otros casos. | A |

CAR-11 (diámetro) y CAR-12 (polinizadores) se borraron porque están descartados. CAR-18 se borró porque repetía
CAR-06, CAR-09 y RN-08.

### 8.8 Ficha de la célula

Roles: Administrador, Cargador, Lector. El público ve una ficha simplificada (8.12).

| ID | Requerimiento | Criterios de aceptación | Prio |
|---|---|---|---|
| FIC-01 | Encabezado. | Arriba, la foto del último registro (se amplía al tocarla). Debajo, el código con el chip de estado, "Lugar · Isleta" (la isleta es un enlace al plano) y "Plantada el {fecha}". | A |
| FIC-02 | Individuos. | 4 tarjetas con altura actual y crecimiento desde el registro inicial. Un individuo muerto se muestra en gris con su chip. | A |
| FIC-03 | Gráfico de evolución. | Selector de variable (Altura, Cantidad de flores) y una línea por forma de vida. Si un individuo está muerto un mes, la línea se corta ahí. | A |
| FIC-04 | Registros mes por mes. | Lista vertical de los registros, del más nuevo al más viejo. Cada mes se abre al tocarlo (acordeón) y muestra la foto, las observaciones y quién cargó. No es un carrusel: deslizar de costado no se descubre solo. | A |
| FIC-05 | Editar un registro. | Botón "Editar" en cada mes para quien tenga permiso (RN-11): abre la carga de ese período. | M |
| FIC-06 | Historial de cambios. | Para admin y cargador del lugar: lista de modificaciones con fecha, usuario y valores anterior y nuevo. | M |
| FIC-07 | Fotos mes por mes. | Todas las fotos de la célula en fila, de la más vieja a la más nueva, para ver cómo creció. Al tocar una se ve más grande. Si no hay fotos, la sección no se muestra. | M |
| FIC-08 | Dar de baja o anular. | Solo admin: dar de baja la célula (RN-14) o anular un registro (RN-12). | M |

### 8.9 Resultados

Roles: Administrador, Cargador, Lector. El público ve los resultados de cada lugar activo en su página (8.12).

| ID | Requerimiento | Criterios de aceptación | Prio |
|---|---|---|---|
| RES-01 | Filtros. | Lugar (todos o uno), isleta (si hay un lugar elegido), período (mes actual, últimos 3, 6 o 12 meses, desde la plantación) y forma de vida (todas o una). Todo se actualiza al cambiar un filtro. | A |
| RES-02 | Métricas principales. | 3 tarjetas grandes: Células plantadas, Supervivencia y Crecimiento promedio (sección 7) *(propuesta)*. | A |
| RES-03 | Supervivencia por forma de vida. | Una barra por forma de vida con su porcentaje, todas del mismo color y sin textos extra. | A |
| RES-04 | Evolución de la altura. | Gráfico mensual de la altura promedio con una línea por forma de vida. | A |
| RES-05 | Evolución de la supervivencia. | Gráfico mensual de la supervivencia. Se ve un gráfico de evolución a la vez: un selector alterna entre Altura (RES-04) y Supervivencia. | A |
| RES-07 | Datos insuficientes. | Si todavía no hay registros suficientes, muestra un mensaje en lugar de gráficos vacíos. | A |
| RES-09 | El bosque se regenera. | 3 tarjetas: individuos en floración, individuos con frutos y células con nuevas plántulas (sección 7). | M |

RES-06 (polinizadores) y RES-08 (textos de sensibilización) se borraron.

### 8.10 Tabla de datos y exportación

Roles: Administrador, Cargador, Lector.

| ID | Requerimiento | Criterios de aceptación | Prio |
|---|---|---|---|
| TAB-01 | Vista tabla. | Una fila por individuo y registro, con las columnas de la sección 11.1. Paginada de a 50 filas y ordenable por columna. | A |
| TAB-02 | Vista matriz. | Células en filas, meses en columnas y el valor de la variable elegida en cada celda, con selector de variable y forma de vida. | B |
| TAB-03 | Filtros. | Los mismos que Resultados, más buscador por código. | A |
| TAB-04 | Uso en celular. | La tabla se desplaza horizontalmente sin desarmar la página, con la columna de código fija. | A |
| TAB-05 | Exportar. | Un botón que exporta a Excel (.xlsx) lo filtrado, con el formato de la sección 11.1. | A |
| TAB-06 | Descargar fotos. | Solo admin: ZIP con las fotos filtradas, nombradas como `código_período.jpg`. | M |

### 8.11 Mapa

Roles: Administrador, Cargador, Lector.

| ID | Requerimiento | Criterios de aceptación | Prio |
|---|---|---|---|
| MAP-01 | Mapa de lugares. | Mapa de la provincia de Córdoba con un marcador por lugar con su letra y nombre. | M |
| MAP-02 | Panel del lugar. | Al tocar un marcador: cantidad de células e isletas, cada una con botón "Ver células". No muestra supervivencia ni otras métricas, para no comparar lugares (RN-20). | M |
| MAP-03 | Isletas. | Al acercar se ven los marcadores de las isletas. | M |

MAP-04 (buscador) se borró: con pocos lugares no hace falta.

### 8.12 Página pública y códigos QR

Roles: Público. Los QR, solo el Administrador.

| ID | Requerimiento | Criterios de aceptación | Prio |
|---|---|---|---|
| PUB-01 | Acceso sin login. | Cada lugar activo tiene una dirección fija y corta, `/publico/{letra}` (por ejemplo `/publico/A`), que abre sus resultados sin pedir datos (RN-15). | A |
| PUB-02 | Contenido. | Explicación breve de qué es una célula de bosque, las métricas principales, "El bosque se regenera", supervivencia por forma de vida y evolución mensual (sección 7), solo de ese lugar. No compara con otros lugares (RN-20). | A |
| PUB-03 | Sin funciones internas. | No muestra menú de carga, tabla de datos ni nombres o emails de usuarios. | A |
| PUB-04 | Galería de células. | Grilla con fotos que abre una ficha simplificada: fotos mes por mes (FIC-07) y alturas. | M |
| PUB-05 | Vista previa al compartir. | Al compartir el enlace por WhatsApp se ve título, descripción e imagen. Son los mismos para todos los lugares. | M |
| PUB-06 | Participación. | Sección "¿Cómo participar?" con el contacto del voluntariado de UCC Sostenible. El contacto está *(a confirmar)*. | B |
| PUB-07 | Ingresar. | Botón discreto que lleva al login. | A |
| QR-01 | Generar QR. | Elegir el lugar y generar el QR que apunta a su página pública. Si el QR es por lugar o por isleta está *(a confirmar)*. | M |
| QR-02 | Cartel imprimible. | Vista previa con título, QR y texto. Se descarga en PNG o se imprime desde el navegador (que permite guardar como PDF). | M |

### 8.13 Notificaciones

Roles: Cargador.

Para el lanzamiento, el aviso de carga es el avance del mes en Inicio (INI-02): cuántas células faltan y
cuántos días quedan. Los avisos por email son una *(propuesta)* para más adelante. Necesitan un servicio de
envío de mails y una tarea programada que corra sola, porque el servidor gratuito de Render se apaga
cuando nadie lo usa.

| ID | Requerimiento | Criterios de aceptación | Prio |
|---|---|---|---|
| NOT-01 | Inicio de mes. | *(propuesta)* El día 1 se avisa al cargador por email cuántas células tiene pendientes. | B |
| NOT-02 | Antes del vencimiento. | *(propuesta)* 5 días antes del fin de mes se avisa por email qué células faltan. No se envía si está todo al día. | B |
| NOT-05 | Desactivar avisos. | *(propuesta)* El usuario puede desactivar los emails desde Cuenta. | B |

NOT-03 (campana) se borró: repetía lo que muestra INI-02. NOT-04 (resumen para el admin) se borró: el
avance por lugar se lee como un ranking (RN-20).

### 8.14 Auditoría

Roles: Administrador; Cargador sobre su lugar.

| ID | Requerimiento | Criterios de aceptación | Prio |
|---|---|---|---|
| AUD-01 | Autoría. | Cada registro guarda usuario y fecha de creación y de última modificación. | A |
| AUD-02 | Historial. | Cada modificación de un registro guarda usuario, fecha, campo, valor anterior y valor nuevo (tabla `cambios`). Es lo que exige RN-11. | A |
| AUD-03 | Acciones de administración. | Se registran altas, bajas y cambios de usuarios, lugares, isletas y células, en la misma tabla `cambios`. | M |

Dónde se consulta este historial está *(a confirmar)*. Podría ir en un informe en PDF, si la clienta lo pide
(sección 13).

## 9. Requerimientos no funcionales

| ID | Categoría | Requerimiento | Prio |
|---|---|---|---|
| RNF-USA-01 | Usabilidad | Diseñada primero para celular y usable en computadora. | A |
| RNF-USA-02 | Usabilidad | Pensada para usuarios no técnicos: pocos pasos, botones grandes y selección antes que texto libre. | A |
| RNF-USA-03 | Usabilidad | Zonas táctiles de al menos 48 × 48 px. | A |
| RNF-USA-04 | Usabilidad | Legible a pleno sol: contraste alto y texto base de al menos 16 px en campos de carga. | A |
| RNF-USA-05 | Usabilidad | Mensajes de error en español claro, indicando qué pasó y qué hacer. | A |
| RNF-USA-06 | Usabilidad | Vocabulario único en toda la app (sección 2). No se usan "árbol/ejemplar/especie" para la célula ni "lote/parcela/cuadrante" para la isleta. La tercera forma de vida se llama Gramínea, nunca Herbácea. | A |
| RNF-USA-07 | Usabilidad | Una sola navegación: barra inferior con Inicio · Células · Cargar · Resultados · Cuenta, en celular y en computadora. "Cargar" solo la ve el cargador. | A |
| RNF-REN-01 | Rendimiento | La página pública carga en menos de 3 segundos en 4G. | A |
| RNF-REN-02 | Rendimiento | Las pantallas internas responden en menos de 2 segundos con los datos esperados. | A |
| RNF-REN-03 | Rendimiento | Las imágenes de listados usan miniaturas; la foto completa se carga solo al ampliarla. | M |
| RNF-ESC-01 | Capacidad | Soporta al menos 60 células × 24 meses × 6 lugares: 8.640 registros y fotos y hasta 172.800 mediciones (4 individuos × 5 variables por registro) sin degradarse. | A |
| RNF-ESC-02 | Capacidad | Soporta hasta 20 lugares y 200 células por isleta sin cambios de diseño. | M |
| RNF-SEG-01 | Seguridad | Los permisos se validan en el servidor; ocultar botones no alcanza. | A |
| RNF-SEG-02 | Seguridad | Todo el tráfico va por HTTPS. | A |
| RNF-SEG-03 | Seguridad | Las contraseñas se guardan con hash; nunca en texto plano ni en logs. | A |
| RNF-SEG-04 | Seguridad | Las fotos se sirven solo por `GET /api/fotos/{id}`, que verifica permisos; nunca se expone la dirección directa de R2. Sin sesión solo se ven las fotos de lugares activos (RN-15). | A |
| RNF-SEG-05 | Seguridad | Las claves y credenciales del proyecto no se suben al repositorio. | A |
| RNF-DIS-01 | Disponibilidad | Backups automáticos de la base de datos al menos diarios, con retención de 30 días. Qué ofrece Neon en el plan gratuito está *(a confirmar)*. | A |
| RNF-DIS-02 | Disponibilidad | Backup de las fotos al menos semanal. Cómo hacerlo con R2 está *(a confirmar)*. | A |
| RNF-DIS-03 | Disponibilidad | Se prueba restaurar un backup antes del lanzamiento. | A |
| RNF-COM-01 | Compatibilidad | Funciona en Chrome para Android y Safari para iOS de los últimos 3 años, y en Chrome, Firefox y Edge de escritorio. | A |
| RNF-COM-02 | Compatibilidad | Se puede instalar en la pantalla de inicio del celular (aplicación web instalable). | B |
| RNF-ACC-01 | Accesibilidad | Contraste de texto según WCAG 2.1 AA; los estados usan color e ícono, nunca solo color. | A |
| RNF-ACC-02 | Accesibilidad | Imágenes con texto alternativo y formularios con etiquetas visibles. | M |
| RNF-MAN-01 | Mantenibilidad | Se pueden agregar lugares, isletas y células sin tocar código. | A |
| RNF-MAN-02 | Mantenibilidad | Las variables se definen en un catálogo: sumar una variable no requiere reprogramar formularios ni la tabla. | A |
| RNF-MAN-03 | Mantenibilidad | Código en repositorio con instrucciones para instalar, desplegar y restaurar backups. | A |
| RNF-MAN-04 | Mantenibilidad | Documento de traspaso con cuentas, costos y responsables para después de noviembre. | A |
| RNF-OFF-01 | Sin conexión | Si se confirma que no hay señal en los lotes: cargar registros sin conexión y sincronizarlos al recuperar señal, mostrando cuántos quedan pendientes. *(a confirmar)* | A confirmar |
| RNF-OFF-02 | Sin conexión | Aunque no se confirme, un corte de conexión no hace perder lo cargado (CAR-16). | A |

## 10. Privacidad y datos personales

La plataforma guarda datos personales de usuarios (nombre y email). Se aplica la Ley 25.326 de Protección
de Datos Personales. Estos requerimientos no los pidió la clienta, pero son necesarios para publicar la
plataforma.

| ID | Requerimiento | Prio |
|---|---|---|
| PRI-01 | Se guardan solo los datos personales necesarios: nombre, email, rol y lugar. | A |
| PRI-02 | La página pública no muestra nombres ni emails de usuarios. | A |
| PRI-03 | La instrucción de la foto pide encuadrar solo la célula desde arriba, sin personas. | A |
| PRI-05 | Al subir una foto se borran los datos ocultos del archivo (EXIF), incluida la ubicación GPS, antes de publicarla. Así no queda a la vista dónde se sacó, por ejemplo si se sube desde la galería una foto tomada en otro lugar. | A |
| PRI-06 | La página pública incluye un aviso breve de privacidad con el contacto de UCC Sostenible. El contacto está *(a confirmar)*. | M |

PRI-04 (ocultar una foto de la vista pública) se borró: con PRI-03 casi nunca haría falta, y pedía una
migración nueva.

## 11. Modelo de datos conceptual

Describe qué información guarda el sistema, no cómo se implementa. Todas las entidades guardan fecha de
creación y de modificación.

| Entidad | Atributos principales | Relaciones y reglas |
|---|---|---|
| Lugar | letra, nombre, tipo (universidad o colegio), localidad, latitud, longitud, activo | Tiene isletas. Letra única (RN-02). Todo lugar activo es público (RN-15). |
| Isleta | número, nombre, latitud, longitud, foto del plano, filas, columnas | Pertenece a un lugar. Número único en el lugar. |
| Célula | número, fila, columna, fecha de plantación, latitud y longitud opcionales, estado (activa o dada de baja), motivo y fecha de baja | Pertenece a una isleta. Número y posición únicos en la isleta. Tiene 4 individuos y muchos registros. |
| Forma de vida | dígito (1 a 4), nombre, ícono | Catálogo fijo: Árbol, Arbusto, Gramínea, Rastrera. |
| Individuo | forma de vida, especie (opcional, *a confirmar*) | Pertenece a una célula. Uno por forma de vida (RN-01). La reposición no crea otro individuo (RN-09). |
| Variable | código, nombre, nivel (registro, célula o individuo), tipo, unidad, rango, obligatoria, formas de vida a las que aplica, orden, activa | Catálogo configurable (RNF-MAN-02). |
| Registro | fecha de medición, período, es inicial, foto, observaciones, cobertura (*a confirmar*), fuera de término, anulado y motivo, creado por, modificado por | Pertenece a una célula. Uno por período (RN-04). |
| Medición | valor numérico o de texto | Pertenece a un registro, a una variable y, si corresponde, a un individuo. |
| Foto | ubicación en R2, quién la subió, fecha | La usan los registros (RN-07) y los planos de las isletas. Se sirve solo con permiso (RNF-SEG-04). |
| Usuario | nombre, email, rol, lugar, estado (pendiente, activo o deshabilitado), institución que pidió el acceso | Un cargador tiene un lugar (RN-10). |
| Cambio (auditoría) | entidad, id, campo, valor anterior, valor nuevo, usuario, fecha | Uno por cada campo modificado (AUD-02 y AUD-03). |

### 11.1 Formato de exportación

La exportación es un Excel (.xlsx) con una fila por individuo y registro, en este orden de columnas. El
nombre del archivo es `celulas_[lugar]_[desde]_[hasta].xlsx`. Si un individuo está muerto, las columnas de
altura, flores, frutos y plántulas quedan vacías (RN-08).

| Columna | Ejemplo |
|---|---|
| codigo_individuo | A-1-45-1 |
| lugar | Campus UCC |
| isleta | 1 |
| celula | 45 |
| forma_de_vida | Árbol |
| periodo | 2026-11 |
| fecha_medicion | 18/11/2026 |
| es_inicial | No |
| fuera_de_termino | No |
| estado | Vivo |
| altura_cm | 185 |
| cantidad_flores | 4 |
| presencia_frutos | Sí |
| nuevas_plantulas | No |
| cobertura_pct | 62,5 *(a confirmar, RN-19)* |
| observaciones | Hojas nuevas en la base |
| cargado_por | M. Pérez |

## 12. Supuestos, restricciones y fuera de alcance

### Supuestos

- El cargador tiene un celular con cámara y datos móviles o wifi, al menos al terminar la recorrida.
- La clienta entrega los planos de cada isleta antes de dar de alta sus células.
- Las células se plantan a 6 metros como mínimo entre sí.
- Cada lugar tiene al menos 15 células.

### Restricciones

- El lanzamiento coincide con la primera plantación, el 25 de noviembre de 2026.
- El equipo es de estudiantes que terminan de cursar la primera semana de noviembre, por lo que la
  plataforma tiene que quedar documentada y con un responsable definido.
- El presupuesto de infraestructura es mínimo y a definir con UCC.
- La infraestructura es gratuita: el servidor de Render se apaga cuando nadie lo usa, así que no puede correr
  tareas programadas (avisos por email, copias automáticas).

### Fuera de alcance

Datos de ensayos científicos complejos (planillas de tesis o becas); carga de datos históricos de
invernadero; registro de tratamientos; registro de diámetro del tronco y de polinizadores (descartados el
16/10); carga por parte de alumnos; autogestión de usuarios por institución; carteles o etiquetas NFC;
cálculo automático de cobertura desde la foto; aplicación nativa en tiendas; rankings entre lugares.

## 13. Pendientes y preguntas abiertas

Acá están todas las preguntas que siguen abiertas. Cada requerimiento marcado *(a confirmar)* depende de
una de ellas. Las preguntas ya respondidas se borraron, pero los números no se cambian: por eso faltan
algunos.

### Debe enviar la clienta

| # | Pendiente | Bloquea |
|---|---|---|
| 3 | Si se mide diversidad y cómo. | Variable Diversidad (sección 6) |
| 4 | Las 3 o 4 métricas del resumen. Mientras tanto se usan las de la sección 7 *(propuesta)*. | RES-02, PUB-02 |
| 5 | Letras de los lugares, isletas de cada lugar y sus planos. | Carga de datos reales |
| 6 | Usuarios iniciales: administrador y cargadores. | Lanzamiento |

### A confirmar con la clienta

| # | Pregunta | Afecta |
|---|---|---|
| 2 | ¿Cada individuo tiene una especie que se carga? | ALT-07, variable Especie |
| 5 | ¿Hay señal de internet en los lotes? | CAR-16, RNF-OFF-01 |
| 6 | ¿El QR abre el lugar completo o una isleta? | QR-01 |
| 7 | ¿La supervivencia principal es sobre los 4 individuos o solo sobre el árbol? | Sección 7 |
| 8 | ¿La cobertura calculada con ImageJ se carga en la plataforma? | RN-19, variable Cobertura, exportación (11.1) |
| 9 | ¿El cargador puede corregir registros de meses anteriores? | RN-11, matriz de permisos |
| 10 | ¿Se quieren avisos por email de la carga mensual? | NOT-01, NOT-02, NOT-05 |
| 11 | ¿Cuándo vence la carga de cada mes? | RN-16 |
| 12 | ¿El mapa es solo de Córdoba o admite lugares de otras provincias o países? | MAP-01 |
| 13 | ¿Quién queda como responsable técnico, quién paga el hosting y con qué dominio se publica? | RNF-MAN-04 |
| 19 | Para un individuo repuesto, ¿cómo se calcula el crecimiento? El crecimiento promedio compara la altura del último registro con la del registro inicial; con una reposición compararía la planta vieja con la nueva. *(propuesta)*: guardar una marca "repuesto" en el registro y medir el crecimiento desde la reposición. | Sección 7, RN-09 |
| 20 | ¿Cuál es el contacto del voluntariado y de UCC Sostenible para la página pública? | PUB-06, PRI-06 |
| 21 | ¿Quiere un informe (por ejemplo en PDF) con el historial de cambios? | Sección 8.14 |

### Debe averiguar el equipo

| Pendiente | Afecta |
|---|---|
| Qué copias de seguridad ofrece Neon en el plan gratuito. | RNF-DIS-01 |
| Cómo hacer la copia semanal de las fotos de R2. | RNF-DIS-02 |

## 14. Plazos e hitos

El lanzamiento es el día de la primera plantación. Ese día se dan de alta las células y se cargan sus
registros iniciales (sección 8.6), que son los primeros resultados que se muestran. Como hay un solo
registro por célula por período (RN-04), la primera carga mensual es la del período siguiente (2026-12).

| Hito | Fecha |
|---|---|
| Versión de prueba para validar con la clienta | *(a confirmar)* |
| Prueba en campo con un cargador real | *(a confirmar)*, antes de la plantación |
| Lanzamiento: primera plantación y registros iniciales | 25 de noviembre de 2026 |
| Primera carga mensual (período 2026-12) | Diciembre de 2026 |
| Traspaso a UCC Sostenible | *(a confirmar)* |
