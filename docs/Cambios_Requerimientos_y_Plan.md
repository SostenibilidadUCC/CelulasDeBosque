# Cambios a los Requerimientos (v5) y al Plan de Trabajo (v4)

Registro de los cambios decididos después de escribir los PDF. Cuando se haga una versión nueva de los
documentos, hay que pasar estos cambios y marcarlos como aplicados.

> **Aplicado (9/11/2026):** estos cambios ya están en `Requerimientos_Celulas_de_Bosque_v6.md` y en
> `Plan_de_Trabajo_Equipo_v5.md`. Este archivo queda como historia de las decisiones.

Estados: **Decidido** (ya acordado, falta aplicarlo), **Hecho** (ya está en el código), **Pendiente** (falta decidir).

---

## 1. Todos los lugares son públicos

**Estado:** Hecho en la base y el backend (migración `00005_lugares_sin_es_publico.sql`, 2/11/2026). Falta pasarlo a los PDF y hacer T20 y T22 con la regla nueva.

Antes: un lugar solo era visible sin sesión si el administrador lo marcaba como público; al inicio, solo el Campus UCC.
Ahora: todo lugar activo es visible sin sesión. Para ocultar un lugar se lo deshabilita (LUG-03).

Afecta a los Requerimientos:

| Dónde | Cambio |
|---|---|
| Tabla de roles, rol Público | Ve resultados y células de **todos los lugares activos**. |
| Regla de negocio "Un lugar solo es visible para el público si el administrador lo marca como público" (RN-15 en `CLAUDE.md`) | Se elimina. |
| LUG-01 Crear lugar | Se saca "y si es público (por defecto no)". |
| PUB-03 Sin funciones internas | Se saca "ni lugares no públicos". |
| Requerimientos no funcionales: "Las fotos de lugares no públicos solo son accesibles con sesión" | Se elimina. Las fotos de registros no anulados de lugares activos son públicas. |
| Modelo de datos, entidad Lugar | Se saca el atributo `es_público` (si se borra la columna). |

Afecta al Plan:

| Ticket | Cambio |
|---|---|
| T20 · Lugares, isletas, planos (Persona A) | El formulario de lugar no pide "público". |
| T22 · Página pública y QR (Persona C) | `GET /api/publico/{letra}` responde para cualquier lugar activo. Evaluar un endpoint que liste los lugares para elegir uno, sin mostrar avances uno al lado del otro (sin rankings). |
| Migración 00005 | Hecho: borra la columna `es_publico`. Es 00005 porque la 00004 es de T16 (estado pendiente de usuarios, PR #21): ese PR tiene que entrar a `main` antes que este. |

Código cambiado: `backend/internal/handlers/fotos.go` (se sacó el filtro `l.es_publico`), `fotos_test.go`, `backend/seed/seed.sql`, `CLAUDE.md` (RN-15 y rol Público).

### Rol Lector (consecuencia del punto 1)

**Estado:** Decidido (2/11/2026). Se mantiene el rol Lector.

Con todos los lugares públicos, lo que distingue al Lector de alguien sin sesión es: la tabla de datos,
la exportación a Excel/CSV, la ficha completa, el plano de las isletas y el mapa. Los datos crudos
(tabla y Excel) siguen siendo privados.

## 2. Se saca la mención a menores en las fotos

**Estado:** Decidido (2/11/2026).

| Dónde | Cambio |
|---|---|
| Sección 10, Privacidad: "fotos tomadas en colegios, donde puede haber menores" | Se saca la mención a menores. |
| PRI-05 (encuadrar solo la célula desde arriba, sin personas) | Hecho: queda "Sacá la foto de la célula desde arriba." (sin "sin personas"), en `components/Foto.jsx`. |
| PRI-06 (ocultar una foto de la vista pública si aparece una persona) | **Pendiente:** se recomendó eliminarlo (todavía no está hecho en el código). |
| `CLAUDE.md`, Seguridad y privacidad: "Puede haber menores en las fotos de colegios" | Hecho: se sacó. |

## 3. Página de presentación pública

**Estado:** Hecho en la rama `ui-base-y-presentacion`. Es un requerimiento nuevo: no está en los PDF.

- Ruta `/`: presentación para cualquier persona, con o sin sesión. Explica qué es una célula de bosque y cómo se
  sigue su crecimiento, con fotos de la plantación (galería de https://ucc.edu.ar/celulas-de-bosques).
- Botón "Ingresar" (o "Ir a mi inicio" si ya hay sesión). El inicio de cada rol pasó de `/` a `/inicio`.
- Al cerrar sesión se vuelve a `/`.
- AUT-09 (botón "Ver resultados del Campus UCC" en el login): se reemplaza por "Volver a la presentación".
- PUB-02 (explicación de qué es una célula en la página pública): **Pendiente:** ya está en la presentación; decidir si la página pública la repite.
- **Pendiente:** el botón "Ver cómo crecen" lleva a `/publico/A`, que todavía no existe (T22). Ocultarlo hasta que exista, o dejarlo.

## 4. Inicio según el rol

**Estado:** Hecho en la rama `ui-base-y-presentacion`. Objetivo: menos información y menos idas y vueltas.

| Requerimiento | Cambio |
|---|---|
| INI-02 Avance de carga del mes | Solo para el **cargador**, de su lugar. El admin no lo ve (varios lugares con su avance se leen como un ranking). |
| INI-03 Accesos rápidos | Se reemplazan por el botón "Cargar" de la barra, que lleva directo a la próxima célula pendiente. Solo lo ve el cargador. |
| INI-04 Tarjetas de lugares | Sin "estado del mes" (evita comparar lugares). El cargador ve solo la tarjeta de su lugar; admin y lector ven todos. |
| INI-07 Aviso de lector | Se elimina. |

## 5. Usuarios (T16): pedir acceso en lugar de invitaciones

**Estado:** Hecho en T16 (PR #21).

| Requerimiento | Cambio |
|---|---|
| USR-02 Crear usuario, USR-06 Reenviar invitación, AUT-04 Primer ingreso por enlace | Se reemplazan: la persona pide acceso (nombre, email, contraseña, institución opcional) y queda **pendiente** hasta que un administrador la aprueba y elige qué puede hacer. |
| T16 "Está listo cuando" (el admin crea un cargador y le pasa el enlace) | Pasa a: la persona pide acceso, el admin la aprueba como cargador de un lugar y la persona entra. |
| AUT-05 Recuperar contraseña | **Simplificado:** el administrador toca "Generar contraseña nueva" en el panel de la persona, se la pasa por WhatsApp y se cierran las sesiones de esa persona. |

**Pendiente (para modificar después):**

- AUT-08 Cambiar la contraseña: hace falta, porque el admin conoce la contraseña que generó.
- Recuperación mejor: enlace de un solo uso por WhatsApp (necesita una tabla nueva y la pantalla "Elegí tu contraseña nueva") o mail automático "¿Olvidaste tu contraseña?" (lo mismo más una cuenta de correo para enviar).
- Decidir si se ingresa con Google: haría innecesarias las contraseñas; el panel de aprobación del admin se mantiene.

## 6. Reglas de diseño del equipo (`frontend/CLAUDE.md`)

**Estado:** Hecho. Falta actualizar `frontend/CLAUDE.md`.

- Títulos con la fuente Fraunces; el resto sigue en Inter.
- De Magic UI, además de `blur-fade` y `number-ticker`: `dot-pattern`, `shine-border` y `magic-card`, solo con efectos suaves.
- De shadcn: `accordion`, envuelto en `components/Acordeon.jsx`.
