# Células de Bosque UCC

Plataforma del programa **UCC Sostenible** (Universidad Católica de Córdoba) para registrar mes a mes el crecimiento y la supervivencia de las células de bosque, y mostrar los resultados con un QR.

- Requerimientos: `docs/Requerimientos_Celulas_de_Bosque_v6.md`
- Plan de trabajo y tickets: `docs/Plan_de_Trabajo_Equipo_v5.md`
- Reglas para trabajar en el repo: `CLAUDE.md`

## Requisitos

Instalá esto una sola vez (ticket T01):

| Herramienta | Versión | Para qué |
|---|---|---|
| Git | cualquiera | control de versiones |
| Go | 1.25 o más | backend |
| Node.js | LTS | frontend |
| Docker Desktop | cualquiera | base de datos local |

Después instalá **goose**, que corre las migraciones. Los `-tags` dejan afuera los drivers de otras bases, así compila en segundos y no en varios minutos:

```bash
go install -tags='no_clickhouse no_libsql no_mssql no_mysql no_sqlite3 no_vertica no_ydb' github.com/pressly/goose/v3/cmd/goose@latest
goose --version
```

> Si dice "goose: command not found", agregá la carpeta `$(go env GOPATH)/bin` al PATH.
> Si Go avisa "switching to go1.x", no pasa nada: descarga solo la versión que goose necesita.

## Levantar el proyecto

Todos los comandos se corren desde la raíz del repo, en Git Bash.

### 1. Variables de entorno

```bash
cp .env.example .env
set -a; source .env; set +a   # carga DATABASE_URL en la terminal actual
```

El `.env` nunca se sube al repo (está en `.gitignore`). Hay que repetir el `source` cada vez que abrís una terminal nueva.

### 2. Base de datos

Abrí Docker Desktop y esperá a que diga "Engine running". Después:

```bash
docker compose up -d
```

Levanta PostgreSQL 16 en `localhost:5433`. Los datos se guardan en el volumen `datos-postgres`, así que no se pierden al apagar la compu.

### 3. Migraciones

```bash
cd backend
goose -dir migrations postgres "$DATABASE_URL" up
goose -dir migrations postgres "$DATABASE_URL" status   # muestra qué migraciones se aplicaron
cd ..
```

Para ver las tablas:

```bash
docker exec -it celulas-db psql -U celulas -c '\dt'
```

### 4. Datos de prueba

Con las migraciones aplicadas (el seed borra los datos y los vuelve a crear):

```bash
docker exec -i celulas-db psql -U celulas < backend/seed/seed.sql
```

### 5. Backend

Con la base prendida y las variables de entorno cargadas:

```bash
cd backend && go run .        # queda en http://localhost:8080
```

### 6. Frontend

```bash
cd frontend
npm install
npm run dev                   # queda en http://localhost:5173
```

## Comandos útiles

| Qué | Comando |
|---|---|
| Apagar la base | `docker compose down` |
| Borrar la base y empezar de cero | `docker compose down -v` (borra el volumen) y repetir los pasos 2 a 4 |
| Deshacer la última migración | `goose -dir migrations postgres "$DATABASE_URL" down` |
| Deshacer todas | `goose -dir migrations postgres "$DATABASE_URL" down-to 0` |
| Crear una migración nueva | `goose -dir migrations -s create <nombre> sql` (avisá antes en el grupo; el `-s` mantiene la numeración 00001, 00002…) |

## Base de datos

| Migración | Qué hace |
|---|---|
| `00001_tablas.sql` | Crea las 12 tablas y carga las 4 formas de vida. |
| `00002_variables.sql` | Carga el catálogo de variables por individuo: vivo, altura, flores, frutos y plántulas nuevas. |
| `00003_registro_unico_no_anulado.sql` | Cambia la regla de un registro por célula por período: ahora solo cuentan los registros no anulados. |

Las reglas de negocio importantes se garantizan en la base, no solo en Go:

| Regla | Cómo |
|---|---|
| RN-01: un individuo por forma de vida por célula | `UNIQUE (celula_id, forma_de_vida_id)` |
| RN-02: letra de lugar única; número de isleta único por lugar; número y posición de célula únicos por isleta | `UNIQUE` |
| RN-04: un registro por célula por período | `UNIQUE (celula_id, periodo) WHERE NOT anulado` (índice único parcial, 00003) |
| El período es el día 1 del mes de la medición | `CHECK (periodo = date_trunc('month', fecha_medicion))` |
| RN-07: foto obligatoria | `foto_id NOT NULL` |
| RN-10: un cargador activo por lugar | índice único parcial en `usuarios` |
| RN-12: un registro anulado tiene motivo | `CHECK` |

> **Ojo al escribir el seed:** si insertás filas con el `id` puesto a mano, PostgreSQL no avanza el contador y el próximo insert sin `id` falla con "duplicate key ... _pkey". Al final del seed, corregí el contador de cada tabla:
>
> ```sql
> SELECT setval(pg_get_serial_sequence('lugares', 'id'), (SELECT max(id) FROM lugares));
> ```

## Publicar

La app está en **Render** (servidor Go, plan gratuito) con la base en **Neon** (PostgreSQL, plan gratuito).

- **Cada merge a `main` se publica solo.** Render arma la imagen con el `Dockerfile` de la raíz: compila el frontend, compila Go y, al arrancar, corre las migraciones pendientes antes de prender el servidor. Si una migración falla, el servidor no arranca y queda la versión anterior.
- **Variables en Render:** `DATABASE_URL` (la conexión directa de Neon, sin pooling). `PORT` la pone Render.
- **Health check:** `/api/health`.
- **El `seed.sql` nunca se corre en producción:** tiene usuarios con contraseñas conocidas.
- **Plan gratuito:** Render apaga el servidor después de 15 minutos sin visitas y tarda alrededor de un minuto en volver. Neon suspende la base a los 5 minutos sin uso y vuelve rápido.

Para probar la imagen en tu compu antes de subirla:

```bash
docker build -t celulas-de-bosque .
docker run --rm -p 8080:8080 -e PORT=8080 -e DATABASE_URL="postgres://...@host.docker.internal:5433/..." celulas-de-bosque
```

## Copias de seguridad

Neon gratis guarda solo **6 horas** de historial para volver la base a un momento anterior, y los requerimientos
piden 30 días (RNF-DIS-01). Por eso hay dos copias propias, que corren como GitHub Actions programadas (Render no
puede: se apaga cuando nadie lo usa). Las dos guardan todo en el bucket de R2 `celulas-bosque-backups`:

| Copia | Archivo | Cuándo | Qué guarda | Cuánto dura |
|---|---|---|---|---|
| Base | `.github/workflows/backup-base.yml` | Todos los días a las 3:00 (hora de Córdoba) | `base/celulas-AAAA-MM-DD-pgNN.dump` | 30 días (la borra una regla del bucket) |
| Fotos | `.github/workflows/backup-fotos.yml` | Los domingos a las 4:00 | `fotos/`, una copia de cada foto | Para siempre (nunca se borra nada) |

`pgNN` es la versión de PostgreSQL de Neon con la que se hizo la copia (por ejemplo `pg17`): para restaurarla hace
falta esa versión o una más nueva.

- **Correrlas a mano:** pestaña **Actions** del repo → elegir la copia → **Run workflow**.
- **Si una falla,** GitHub le manda un mail a la última persona que cambió ese archivo. Se ve el detalle en la
  pestaña Actions.
- **Ojo:** el repo es público, y GitHub **apaga las tareas programadas después de 60 días sin cambios en el repo**.
  Si pasa, aparece un aviso en la pestaña Actions: se vuelven a prender con **Enable workflow** en cada una.

### Configurarlas (una sola vez)

1. **En Cloudflare R2:** crear el bucket `celulas-bosque-backups`. En su configuración, agregar una regla de
   ciclo de vida (*Object lifecycle rules*) que borre los objetos con prefijo `base/` después de 30 días.
   **No** ponerle regla a `fotos/`.
2. **En R2, una clave (API token)** con permiso *Object Read & Write* sobre los dos buckets: el de fotos (para leer)
   y el de backups (para escribir).
3. **En GitHub:** Settings → Secrets and variables → Actions → *New repository secret*, uno por cada uno:

   | Secret | Valor |
   |---|---|
   | `NEON_DATABASE_URL` | La conexión directa de Neon (sin pooling), la misma que `DATABASE_URL` en Render |
   | `R2_ACCOUNT_ID` | El id de la cuenta de Cloudflare |
   | `R2_ACCESS_KEY_ID` y `R2_SECRET_ACCESS_KEY` | La clave del paso 2 |
   | `R2_BUCKET_FOTOS` | `celulas-bosque-fotos` |
   | `R2_BUCKET_BACKUPS` | `celulas-bosque-backups` |

4. Correr las dos a mano una vez (Run workflow) y fijarse en R2 que aparezcan `base/` y `fotos/`.

### Restaurar una copia de la base

**Nunca restaures sobre la base de Neon de producción** sin haberlo probado antes en Docker. Para probar una copia
(RNF-DIS-03), se restaura en un PostgreSQL aparte, que no toca ni Neon ni tu base de desarrollo:

1. Bajá la copia desde Cloudflare: R2 → `celulas-bosque-backups` → `base/` → el archivo del día → *Download*.
2. Prendé un PostgreSQL vacío de la versión de la copia (el número `pgNN` del nombre), en el puerto 5434:

   ```bash
   docker run -d --name celulas-restaurada -e POSTGRES_USER=celulas -e POSTGRES_PASSWORD=celulas -e POSTGRES_DB=celulas -p 5434:5432 postgres:17
   ```

3. Restaurá la copia, en **Git Bash** (el `<` no anda en PowerShell). Cambiá el nombre por el del archivo que bajaste:

   ```bash
   docker exec -i celulas-restaurada pg_restore -U celulas -d celulas --no-owner --no-privileges < celulas-2026-11-20-pg17.dump
   ```

4. Fijate que estén los datos:

   ```bash
   docker exec celulas-restaurada psql -U celulas -c "SELECT (SELECT count(*) FROM celulas) AS celulas, (SELECT count(*) FROM registros) AS registros, (SELECT count(*) FROM usuarios) AS usuarios"
   ```

   Para ver la app con esa base, prendé el backend con
   `DATABASE_URL=postgres://celulas:celulas@localhost:5434/celulas?sslmode=disable`.

5. Al terminar, borrá el contenedor: `docker rm -f celulas-restaurada`.

**Si hay que recuperar producción:** lo más seguro es crear una base nueva y vacía en Neon, restaurar ahí la copia
y, cuando se vea bien, poner su conexión en `DATABASE_URL` de Render. Así la base vieja queda intacta por si hace
falta mirar algo. Para restaurar en Neon (en Git Bash, con la conexión directa de la base nueva entre comillas):

```bash
docker run --rm -i postgres:17-alpine pg_restore --no-owner --no-privileges -d "postgres://...neon.tech/...?sslmode=require" < celulas-2026-11-20-pg17.dump
```

Las fotos no hace falta restaurarlas una por una: la carpeta `fotos/` tiene la misma estructura que el bucket de
fotos, así que se pueden volver a copiar al bucket original con `aws s3 sync` (al revés que en `backup-fotos.yml`).
