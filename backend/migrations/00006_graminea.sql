-- T28: la tercera forma de vida se llama Gramínea, nunca Herbácea (RNF-USA-06).
-- Solo cambia el nombre: el id 3 (el dígito del código del individuo) y el ícono no cambian.

-- +goose Up
UPDATE formas_de_vida SET nombre = 'Gramínea', modificado_en = now() WHERE id = 3;

-- +goose Down
-- Vuelve al nombre que puso la migración 00001.
UPDATE formas_de_vida SET nombre = 'Herbácea', modificado_en = now() WHERE id = 3;
