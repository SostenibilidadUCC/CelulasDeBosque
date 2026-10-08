# Células de Bosque UCC

Plataforma del programa **UCC Sostenible** (Universidad Católica de Córdoba) para registrar mes a mes el crecimiento y la supervivencia de las células de bosque, y mostrar los resultados con un QR.

- Requerimientos: `docs/Requerimientos_Celulas_de_Bosque_v4.pdf`
- Plan de trabajo y tickets: `docs/Plan_de_Trabajo_Equipo_v3.pdf`
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

Cuando exista `backend/seed/seed.sql` (ticket T06):

```bash
docker exec -i celulas-db psql -U celulas < backend/seed/seed.sql
```

### 5. Backend

Cuando exista `backend/main.go` (ticket T03):

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
