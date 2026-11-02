-- Todos los lugares son públicos (decisión con la clienta, 2/11/2026; ver docs/Cambios_Requerimientos_y_Plan.md).
-- Se elimina es_publico (RN-15): para ocultar un lugar se lo deshabilita con "activo" (LUG-03).

-- +goose Up
ALTER TABLE lugares DROP COLUMN es_publico;

-- +goose Down
-- Vuelve a crear la columna con su valor por defecto de antes (false) y marca como público
-- solo el Campus UCC, como estaba al inicio. Si había otros lugares públicos, se pierde ese dato.
ALTER TABLE lugares ADD COLUMN es_publico boolean NOT NULL DEFAULT false; -- RN-15
UPDATE lugares SET es_publico = true WHERE letra = 'A';
