-- Catálogo de variables por individuo, según la lista de la clienta del 2/10 (Requerimientos v4, sección 6).
-- Las 4 formas de vida registran lo mismo, por eso forma_de_vida_id queda NULL.
-- "obligatoria" se refiere a RN-08: vivo siempre; el resto, solo si el individuo está vivo (lo valida Go).
-- Valores a confirmar con la clienta: rango de altura, rango de flores y criterio de plántulas.
-- Si cambian, se hace una migración nueva; esta no se modifica una vez que está en main.

-- +goose Up
INSERT INTO variables (codigo, nombre, nivel, tipo, unidad, minimo, maximo, obligatoria, orden) VALUES
    ('vivo',             'Supervivencia',       'individuo', 'booleano', NULL, NULL, NULL, true, 1),
    ('altura_cm',        'Altura',              'individuo', 'entero',   'cm', 1,    999,  true, 2),
    ('flores',           'Cantidad de flores',  'individuo', 'entero',   NULL, 0,    100,  true, 3),
    ('frutos',           'Presencia de frutos', 'individuo', 'booleano', NULL, NULL, NULL, true, 4),
    ('plantulas_nuevas', 'Nuevas plántulas',    'individuo', 'booleano', NULL, NULL, NULL, true, 5);

-- +goose Down
DELETE FROM variables
WHERE codigo IN ('vivo', 'altura_cm', 'flores', 'frutos', 'plantulas_nuevas');
