-- T16: cualquier persona puede pedir acceso y queda "pendiente" hasta que un admin la aprueba.
-- Pendiente es un ESTADO (no un rol): el usuario todavía no tiene permisos de ningún tipo.
-- Se agrega al CHECK de usuarios.estado. 'invitado' se mantiene.
-- Postgres nombra los CHECK en línea como <tabla>_<columna>_check, así que acá es usuarios_estado_check.

-- +goose Up
ALTER TABLE usuarios DROP CONSTRAINT usuarios_estado_check;
ALTER TABLE usuarios ADD CONSTRAINT usuarios_estado_check
    CHECK (estado IN ('invitado', 'pendiente', 'activo', 'deshabilitado'));

-- +goose Down
-- Falla si hay usuarios pendientes: volver al CHECK viejo dejaría filas inválidas.
-- Aprobalos o pasalos a otro estado antes de revertir.
ALTER TABLE usuarios DROP CONSTRAINT usuarios_estado_check;
ALTER TABLE usuarios ADD CONSTRAINT usuarios_estado_check
    CHECK (estado IN ('invitado', 'activo', 'deshabilitado'));
