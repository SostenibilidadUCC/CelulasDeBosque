-- Datos de prueba (ticket T06). SOLO PARA DESARROLLO: nunca correr en producción.
-- Borra todos los datos (menos los catálogos de formas de vida y variables) y los vuelve a crear.
-- Se puede correr las veces que quieras: siempre deja la base igual.
--
-- Cómo correrlo (desde la raíz del repo, con Docker prendido y las migraciones aplicadas):
--   docker exec -i celulas-db psql -U celulas < backend/seed/seed.sql
--
-- Usuarios de prueba (contraseña de todos: bosque1234):
--   admin@celulas.test          Administrador
--   cargador@celulas.test       Cargador del Campus UCC (lugar A)
--   lector@celulas.test         Lector
--   deshabilitado@celulas.test  Lector deshabilitado (para probar AUT-03)
--
-- Las fechas son relativas al día en que se corre el seed: las células se plantaron hace 3 meses
-- y tienen registros de los 3 meses anteriores; el mes actual está cargado solo en 2 de cada 3
-- células. Así el plano siempre muestra células "al día" y "pendientes", corras el seed cuando lo corras.
--
-- Casos especiales para probar estados (sección 5 del documento v4):
--   A-2-18, A-2-19 y A-2-20  sin registro inicial
--   C-1-10                   dada de baja
--   A-1-7                    registro del mes pasado cargado fuera de término
--   Algunos individuos mueren en el segundo o tercer mes y siguen muertos (RN-09).
--
-- Fotos: la tabla fotos guarda solo la ruta (seed/celula-01.jpg…, seed/plano-A-1.jpg…).
-- Los archivos se suben a R2 cuando esté listo el T07; hasta entonces las fotos no se ven.

\set ON_ERROR_STOP on

BEGIN;

-- pgcrypto trae crypt() y gen_salt(), para guardar las contraseñas con bcrypt,
-- el mismo formato que usa Go (golang.org/x/crypto/bcrypt) en el login.
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Vacía las tablas y reinicia los contadores de id. formas_de_vida y variables no se tocan:
-- las cargan las migraciones.
TRUNCATE cambios, sesiones, mediciones, registros, individuos, celulas, isletas, fotos, usuarios, lugares
    RESTART IDENTITY CASCADE;

-- 1. Lugares (coordenadas aproximadas).
INSERT INTO lugares (letra, nombre, tipo, localidad, latitud, longitud, es_publico) VALUES
    ('A', 'Campus UCC',             'universidad', 'Córdoba',      -31.486700, -64.244000, true),
    ('B', 'Colegio de Alta Gracia', 'colegio',     'Alta Gracia',  -31.652900, -64.428300, false),
    ('C', 'Despeñaderos',           'colegio',     'Despeñaderos', -31.816700, -64.283300, false);

-- 2. Usuarios: uno por rol y uno deshabilitado.
INSERT INTO usuarios (nombre, email, password_hash, rol, estado, lugar_id, institucion) VALUES
    ('Admin de Prueba',       'admin@celulas.test',         crypt('bosque1234', gen_salt('bf', 10)), 'admin',    'activo',        NULL,                                     'UCC Sostenible'),
    ('Cargador del Campus',   'cargador@celulas.test',      crypt('bosque1234', gen_salt('bf', 10)), 'cargador', 'activo',        (SELECT id FROM lugares WHERE letra = 'A'), 'Campus UCC'),
    ('Lector de Prueba',      'lector@celulas.test',        crypt('bosque1234', gen_salt('bf', 10)), 'lector',   'activo',        NULL,                                     'Colegio de Alta Gracia'),
    ('Usuario Deshabilitado', 'deshabilitado@celulas.test', crypt('bosque1234', gen_salt('bf', 10)), 'lector',   'deshabilitado', NULL,                                     NULL);

-- 3. Fotos: 5 planos (uno por isleta) y 10 fotos de células que se reparten entre los registros.
INSERT INTO fotos (ruta_r2, subida_por)
SELECT ruta, (SELECT id FROM usuarios WHERE email = 'admin@celulas.test')
FROM (
    SELECT 'seed/plano-' || p.isleta || '.jpg' AS ruta
    FROM (VALUES ('A-1'), ('A-2'), ('B-1'), ('B-2'), ('C-1')) AS p (isleta)
    UNION ALL
    SELECT 'seed/celula-' || lpad(n::text, 2, '0') || '.jpg'
    FROM generate_series(1, 10) AS n
) AS rutas;

-- 4. Isletas, cada una con su plano. A-1 tiene 70 lugares en la grilla y 60 células,
--    así quedan celdas libres para probar el alta de una célula nueva (T17, A-1-61).
INSERT INTO isletas (lugar_id, numero, nombre, latitud, longitud, plano_foto_id, filas, columnas)
SELECT l.id, v.numero, v.nombre, l.latitud + v.desvio, l.longitud + v.desvio, f.id, v.filas, v.columnas
FROM (VALUES
    ('A', 1, 'Junto a Agronomía', 7, 10,  0.0010),
    ('A', 2, 'Ingeniería',        4,  6, -0.0010),
    ('B', 1, 'Patio principal',   4,  5,  0.0005),
    ('B', 2, 'Huerta',            4,  5, -0.0005),
    ('C', 1, 'Entrada',           3,  5,  0.0005)
) AS v (letra, numero, nombre, filas, columnas, desvio)
JOIN lugares l ON l.letra = v.letra
JOIN fotos f ON f.ruta_r2 = 'seed/plano-' || v.letra || '-' || v.numero || '.jpg';

-- 5. Células: 60 + 20 + 15 + 15 + 10 = 120. Se ubican en la grilla de izquierda a derecha
--    y de arriba abajo: la célula n va en la fila (n-1)/columnas + 1 y la columna (n-1)%columnas + 1.
--    Todas se plantaron el día 10 de hace 3 meses.
INSERT INTO celulas (isleta_id, numero, fila, columna, fecha_plantacion, creado_por, modificado_por)
SELECT i.id,
       n,
       (n - 1) / i.columnas + 1,
       (n - 1) % i.columnas + 1,
       (date_trunc('month', current_date) - interval '3 months')::date + 9,
       admin.id,
       admin.id
FROM (VALUES ('A', 1, 60), ('A', 2, 20), ('B', 1, 15), ('B', 2, 15), ('C', 1, 10)) AS v (letra, isleta, cantidad)
JOIN lugares l ON l.letra = v.letra
JOIN isletas i ON i.lugar_id = l.id AND i.numero = v.isleta
CROSS JOIN generate_series(1, v.cantidad) AS n
CROSS JOIN (SELECT id FROM usuarios WHERE email = 'admin@celulas.test') AS admin;

-- C-1-10 dada de baja el mes pasado (RN-14).
UPDATE celulas c
SET estado      = 'baja',
    motivo_baja = 'El contenedor se rompió en una tormenta',
    fecha_baja  = (date_trunc('month', current_date) - interval '1 month')::date + 19
FROM isletas i
JOIN lugares l ON l.id = i.lugar_id
WHERE c.isleta_id = i.id AND l.letra = 'C' AND i.numero = 1 AND c.numero = 10;

-- 6. Individuos: los 4 de cada célula, uno por forma de vida (RN-01).
INSERT INTO individuos (celula_id, forma_de_vida_id)
SELECT c.id, f.id
FROM celulas c
CROSS JOIN formas_de_vida f;

-- 7. Registros. k = cuántos meses atrás: 3 (inicial, el día de la plantación), 2, 1 y 0 (mes actual).
--    - A-2-18, A-2-19 y A-2-20 no tienen ningún registro (sin registro inicial).
--    - El mes actual se cargó solo en las células cuyo número no es múltiplo de 3, y nunca en la dada de baja.
--    - Las células del Campus las cargó el cargador; las de los colegios, el admin.
INSERT INTO registros (celula_id, fecha_medicion, periodo, es_inicial, foto_id, observaciones,
                       fuera_de_termino, creado_por, modificado_por)
SELECT c.id,
       r.fecha,
       date_trunc('month', r.fecha)::date,
       r.k = 3,
       fotos_celulas.ids[1 + (c.id + r.k) % 10],
       CASE
           WHEN r.k = 1 AND c.numero % 11 = 0 THEN 'Rebrote en la base del arbusto'
           WHEN r.k = 2 AND c.numero % 13 = 0 THEN 'Se vieron abejas en la herbácea'
       END,
       (l.letra = 'A' AND i.numero = 1 AND c.numero = 7 AND r.k = 1),
       u.id,
       u.id
FROM celulas c
JOIN isletas i ON i.id = c.isleta_id
JOIN lugares l ON l.id = i.lugar_id
CROSS JOIN generate_series(0, 3) AS g (k)
CROSS JOIN LATERAL (
    SELECT g.k AS k,
           (date_trunc('month', current_date) - make_interval(months => g.k))::date
               + CASE g.k WHEN 3 THEN 9 WHEN 2 THEN 11 WHEN 1 THEN 13 ELSE 0 END AS fecha
) AS r
CROSS JOIN (SELECT array_agg(id ORDER BY ruta_r2) AS ids FROM fotos WHERE ruta_r2 LIKE 'seed/celula-%') AS fotos_celulas
JOIN usuarios u ON u.email = CASE WHEN l.letra = 'A' THEN 'cargador@celulas.test' ELSE 'admin@celulas.test' END
WHERE NOT (l.letra = 'A' AND i.numero = 2 AND c.numero >= 18)
  AND NOT (r.k = 0 AND (c.numero % 3 = 0 OR c.estado = 'baja'));

-- 8. Mediciones: por cada registro y cada individuo.
--    t = meses desde la plantación (0 = registro inicial … 3 = mes actual).
--    Los valores salen de cuentas fijas con el id de la célula (no de random()), así el seed
--    da siempre los mismos datos y se puede calcular a mano para los tests de T18.
--    - Algunos individuos mueren en t = 2 o t = 3 y siguen muertos.
--    - Si el individuo está muerto, solo se guarda "vivo = 0" (RN-08).
--    - La altura crece cada mes; las flores, frutos y plántulas aparecen más en los últimos meses.
INSERT INTO mediciones (registro_id, variable_id, individuo_id, valor_numerico)
SELECT d.registro_id,
       v.id,
       d.individuo_id,
       CASE v.codigo
           WHEN 'vivo'             THEN CASE WHEN d.vivo THEN 1 ELSE 0 END
           WHEN 'altura_cm'        THEN d.altura
           WHEN 'flores'           THEN d.flores
           WHEN 'frutos'           THEN CASE WHEN d.frutos THEN 1 ELSE 0 END
           WHEN 'plantulas_nuevas' THEN CASE WHEN d.plantulas THEN 1 ELSE 0 END
       END
FROM (
    SELECT r.id AS registro_id,
           ind.id AS individuo_id,
           (m.muere_en IS NULL OR m.t < m.muere_en) AS vivo,
           CASE f WHEN 1 THEN 60 WHEN 2 THEN 40 WHEN 3 THEN 20 ELSE 8 END
               + (c.id * 13 + f * 5) % 15
               + m.t * CASE f WHEN 1 THEN 9 WHEN 2 THEN 6 WHEN 3 THEN 4 ELSE 2 END
               + (c.id + m.t) % 3 AS altura,
           CASE
               WHEN f = 1 THEN CASE WHEN m.t >= 2 AND c.id % 5 = 0 THEN 2 ELSE 0 END
               ELSE (c.id * 3 + f * 7 + m.t * 5) % (4 + m.t * 4)
           END AS flores,
           (m.t >= 2 AND (c.id + f) % 4 = 0) AS frutos,
           (m.t >= 2 AND (c.id + f * 2) % 7 = 0) AS plantulas
    FROM registros r
    JOIN celulas c ON c.id = r.celula_id
    JOIN individuos ind ON ind.celula_id = c.id
    CROSS JOIN LATERAL (SELECT ind.forma_de_vida_id::int AS f) AS forma
    CROSS JOIN LATERAL (
        SELECT ((extract(year FROM r.periodo) * 12 + extract(month FROM r.periodo))
              - (extract(year FROM c.fecha_plantacion) * 12 + extract(month FROM c.fecha_plantacion)))::int AS t,
               CASE (c.id * 7 + forma.f * 3) % 23 WHEN 0 THEN 2 WHEN 1 THEN 3 END AS muere_en
    ) AS m
) AS d
JOIN variables v ON v.codigo IN ('vivo', 'altura_cm', 'flores', 'frutos', 'plantulas_nuevas')
WHERE v.codigo = 'vivo' OR d.vivo;

COMMIT;

-- Resumen para chequear que todo se cargó.
SELECT 'lugares' AS tabla, count(*) AS filas FROM lugares
UNION ALL SELECT 'usuarios', count(*) FROM usuarios
UNION ALL SELECT 'fotos', count(*) FROM fotos
UNION ALL SELECT 'isletas', count(*) FROM isletas
UNION ALL SELECT 'celulas', count(*) FROM celulas
UNION ALL SELECT 'individuos', count(*) FROM individuos
UNION ALL SELECT 'registros', count(*) FROM registros
UNION ALL SELECT 'mediciones', count(*) FROM mediciones;