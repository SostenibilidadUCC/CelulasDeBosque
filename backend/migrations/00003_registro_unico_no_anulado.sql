-- RN-04 + RN-12: un solo registro NO anulado por célula por período.
-- El UNIQUE (celula_id, periodo) de 00001 también contaba los anulados: si se anulaba el
-- registro de un mes, ya no se podía cargar el correcto. Un índice único parcial
-- (UNIQUE ... WHERE) aplica la regla solo a las filas que cumplen la condición.

-- +goose Up
ALTER TABLE registros DROP CONSTRAINT registros_celula_id_periodo_key;
CREATE UNIQUE INDEX registros_uno_por_periodo
    ON registros (celula_id, periodo)
    WHERE NOT anulado;

-- +goose Down
-- Falla si alguna célula tiene un registro anulado y otro válido del mismo período:
-- volver a la regla vieja rompería esos datos, así que es correcto que falle.
DROP INDEX registros_uno_por_periodo;
ALTER TABLE registros ADD CONSTRAINT registros_celula_id_periodo_key UNIQUE (celula_id, periodo);
