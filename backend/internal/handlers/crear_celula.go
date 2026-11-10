package handlers

import (
	"context"
	"time"

	"github.com/jackc/pgx/v5"
)

// Crear una célula (RN-01 y RN-02). Es la única forma de crear células: la usan la creación
// en lote del admin (T20, LUG-07) y la pantalla Nueva célula (T17). Así las reglas están en un
// solo lugar.

// celulaNueva son los datos de una célula a crear.
type celulaNueva struct {
	IsletaID        int64
	Numero          int
	Fila, Columna   int
	FechaPlantacion time.Time
	UsuarioID       int64 // quién la crea: se guarda en creado_por y modificado_por
}

// Restricciones UNIQUE de la tabla celulas (RN-02). Quien llama a crearCelula las usa con
// violaUnica para responder un 409 con un mensaje claro.
const (
	restriccionNumeroCelula   = "celulas_isleta_id_numero_key"
	restriccionPosicionCelula = "celulas_isleta_id_fila_columna_key"
)

// crearCelula guarda la célula y sus 4 individuos, uno por forma de vida (RN-01).
// Va dentro de una transacción (tx) que abre quien la llama: si algo falla, no queda una célula
// sin individuos. El número y la posición libres los garantiza la base con UNIQUE (RN-02): si
// están ocupados, devuelve el error de la base y violaUnica dice cuál de las dos restricciones fue.
// Devuelve el id de la célula.
func crearCelula(ctx context.Context, tx pgx.Tx, c celulaNueva) (int64, error) {
	var id int64
	err := tx.QueryRow(ctx, `
		INSERT INTO celulas (isleta_id, numero, fila, columna, fecha_plantacion, creado_por, modificado_por)
		VALUES ($1, $2, $3, $4, $5, $6, $6)
		RETURNING id`,
		c.IsletaID, c.Numero, c.Fila, c.Columna, c.FechaPlantacion, c.UsuarioID).Scan(&id)
	if err != nil {
		return 0, err
	}
	// Un individuo por cada forma de vida del catálogo (Árbol, Arbusto, Gramínea, Rastrera).
	_, err = tx.Exec(ctx,
		`INSERT INTO individuos (celula_id, forma_de_vida_id) SELECT $1, id FROM formas_de_vida ORDER BY id`, id)
	if err != nil {
		return 0, err
	}
	return id, nil
}
