package handlers

import (
	"encoding/json"
	"errors"
	"fmt"
	"log"
	"net/http"
	"strconv"

	"github.com/SostenibilidadUCC/CelulasDeBosque/backend/internal/auth"
	"github.com/SostenibilidadUCC/CelulasDeBosque/backend/internal/respuestas"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

// Plano de la isleta (T20, LUG-05 y LUG-06). Solo el administrador.
// La imagen se sube antes con POST /api/fotos (que ya borra los metadatos y la guarda en R2):
// acá solo se elige esa foto como plano y se fijan las filas y columnas de la grilla.

// pedidoPlano es el cuerpo de POST /api/admin/isletas/{id}/plano.
// FotoID es opcional: si no viene, se conserva la imagen actual y se cambia solo la grilla.
type pedidoPlano struct {
	FotoID   *int64 `json:"fotoId"`
	Filas    int    `json:"filas"`
	Columnas int    `json:"columnas"`
}

// GuardarPlano atiende POST /api/admin/isletas/{id}/plano: carga o reemplaza el plano.
// Las células no se mueven: si alguna quedaría fuera de la nueva grilla, no se guarda (LUG-06).
// Responde la isleta actualizada. Va envuelta en RequiereSesion.
func GuardarPlano(pool *pgxpool.Pool) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if !auth.EsAdmin(auth.UsuarioActual(r)) {
			respuestas.Error(w, http.StatusForbidden, mensajeSoloAdminLugares)
			return
		}
		id, err := strconv.ParseInt(r.PathValue("id"), 10, 64)
		if err != nil {
			respuestas.Error(w, http.StatusBadRequest, "La isleta no es válida")
			return
		}
		r.Body = http.MaxBytesReader(w, r.Body, 4096)
		var pedido pedidoPlano
		if err := json.NewDecoder(r.Body).Decode(&pedido); err != nil {
			respuestas.Error(w, http.StatusBadRequest, "Completá los datos del plano")
			return
		}
		if mensaje := validarGrilla(pedido.Filas, pedido.Columnas); mensaje != "" {
			respuestas.Error(w, http.StatusBadRequest, mensaje)
			return
		}

		errorInterno := func(que string, err error) {
			log.Printf("admin plano: %s (isleta %d): %v", que, id, err)
			respuestas.Error(w, http.StatusInternalServerError, mensajeErrorLugares)
		}

		// FOR UPDATE bloquea la isleta hasta el Commit: mientras tanto nadie puede crear células
		// en ella (la creación en lote bloquea la misma fila), así la revisión de abajo vale.
		tx, err := pool.Begin(r.Context())
		if err != nil {
			errorInterno("no se pudo empezar la transacción", err)
			return
		}
		defer tx.Rollback(r.Context())

		var existe bool
		err = tx.QueryRow(r.Context(), `SELECT true FROM isletas WHERE id = $1 FOR UPDATE`, id).Scan(&existe)
		if errors.Is(err, pgx.ErrNoRows) {
			respuestas.Error(w, http.StatusNotFound, "La isleta no existe")
			return
		}
		if err != nil {
			errorInterno("no se pudo leer", err)
			return
		}

		if pedido.FotoID != nil {
			var hayFoto bool
			err := tx.QueryRow(r.Context(), `SELECT EXISTS (SELECT 1 FROM fotos WHERE id = $1)`, *pedido.FotoID).Scan(&hayFoto)
			if err != nil {
				errorInterno("no se pudo buscar la foto", err)
				return
			}
			if !hayFoto {
				respuestas.Error(w, http.StatusBadRequest, "La imagen del plano no se encontró. Subila de nuevo.")
				return
			}
		}

		// La fila y la columna más altas que ya usan las células (también las dadas de baja,
		// que siguen ocupando su celda). Sin células, las dos dan 0 y cualquier grilla sirve.
		var filaMaxima, columnaMaxima int
		err = tx.QueryRow(r.Context(),
			`SELECT COALESCE(max(fila), 0), COALESCE(max(columna), 0) FROM celulas WHERE isleta_id = $1`, id).
			Scan(&filaMaxima, &columnaMaxima)
		if err != nil {
			errorInterno("no se pudieron leer las posiciones", err)
			return
		}
		if filaMaxima > pedido.Filas || columnaMaxima > pedido.Columnas {
			respuestas.Error(w, http.StatusBadRequest,
				fmt.Sprintf("La grilla es chica: hay células hasta la fila %d y la columna %d", filaMaxima, columnaMaxima))
			return
		}

		// COALESCE($1, plano_foto_id): sin fotoId ($1 NULL) queda la imagen que tenía.
		_, err = tx.Exec(r.Context(), `
			UPDATE isletas
			SET plano_foto_id = COALESCE($1, plano_foto_id), filas = $2, columnas = $3, modificado_en = now()
			WHERE id = $4`, pedido.FotoID, pedido.Filas, pedido.Columnas, id)
		if err != nil {
			errorInterno("no se pudo actualizar", err)
			return
		}
		if err := tx.Commit(r.Context()); err != nil {
			errorInterno("no se pudo confirmar", err)
			return
		}
		responderIsleta(w, r, pool, id, http.StatusOK)
	}
}
