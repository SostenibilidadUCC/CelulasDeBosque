package handlers

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"log"
	"net/http"
	"strconv"
	"unicode/utf8"

	"github.com/SostenibilidadUCC/CelulasDeBosque/backend/internal/auth"
	"github.com/SostenibilidadUCC/CelulasDeBosque/backend/internal/respuestas"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

// Administración de isletas (T20, LUG-04). Solo el administrador.
// Las filas y columnas se eligen al crear la isleta; después se cambian junto con el plano
// (POST /api/admin/isletas/{id}/plano), que revisa que las células sigan entrando en la grilla.

// Límites de la grilla del plano (LUG-05) y del número de isleta.
const (
	maximoFilasColumnas = 30
	maximoNumeroIsleta  = 999
)

// leerIsletaAdmin lee una isleta con los mismos datos que trae GET /api/admin/lugares.
func leerIsletaAdmin(ctx context.Context, pool *pgxpool.Pool, id int64) (isletaAdmin, error) {
	var i isletaAdmin
	err := pool.QueryRow(ctx, `
		SELECT i.id, i.numero, i.nombre, i.filas, i.columnas, i.plano_foto_id,
		       (SELECT count(*) FROM celulas c WHERE c.isleta_id = i.id),
		       EXISTS (SELECT 1 FROM registros r JOIN celulas c ON c.id = r.celula_id WHERE c.isleta_id = i.id)
		FROM isletas i WHERE i.id = $1`, id).
		Scan(&i.ID, &i.Numero, &i.Nombre, &i.Filas, &i.Columnas, &i.PlanoFotoID, &i.CantidadCelulas, &i.TieneRegistros)
	return i, err
}

// responderIsleta lee la isleta recién guardada y la responde con el código indicado.
func responderIsleta(w http.ResponseWriter, r *http.Request, pool *pgxpool.Pool, id int64, codigo int) {
	isleta, err := leerIsletaAdmin(r.Context(), pool, id)
	if err != nil {
		log.Printf("admin isletas: no se pudo leer la isleta %d después de guardarla: %v", id, err)
		respuestas.Error(w, http.StatusInternalServerError, mensajeErrorLugares)
		return
	}
	if codigo == http.StatusCreated {
		respuestas.Creado(w, isleta)
		return
	}
	respuestas.JSON(w, isleta)
}

// validarNumeroYNombre revisa lo que comparten crear y editar una isleta.
func validarNumeroYNombre(numero int, nombre *string) string {
	if numero < 1 || numero > maximoNumeroIsleta {
		return fmt.Sprintf("El número de isleta tiene que ser de 1 a %d", maximoNumeroIsleta)
	}
	if nombre != nil && utf8.RuneCountInString(*nombre) > 100 {
		return "El nombre de la isleta es demasiado largo"
	}
	return ""
}

// validarGrilla revisa que las filas y columnas estén entre 1 y 30 (LUG-05).
func validarGrilla(filas, columnas int) string {
	if filas < 1 || filas > maximoFilasColumnas || columnas < 1 || columnas > maximoFilasColumnas {
		return fmt.Sprintf("Las filas y las columnas tienen que ser de 1 a %d", maximoFilasColumnas)
	}
	return ""
}

// mensajeIsletaRepetida es el 409 de RN-02 (número de isleta único por lugar).
func mensajeIsletaRepetida(numero int) string {
	return fmt.Sprintf("Ya existe la isleta %d en este lugar", numero)
}

// pedidoCrearIsleta es el cuerpo de POST /api/admin/isletas.
type pedidoCrearIsleta struct {
	LugarID  int64   `json:"lugarId"`
	Numero   int     `json:"numero"`
	Nombre   *string `json:"nombre"` // opcional
	Filas    int     `json:"filas"`
	Columnas int     `json:"columnas"`
}

// CrearIsleta atiende POST /api/admin/isletas (LUG-04). Responde 201 con la isleta creada,
// 404 si el lugar no existe o 409 si el número ya está usado en el lugar (RN-02).
// Va envuelta en RequiereSesion.
func CrearIsleta(pool *pgxpool.Pool) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if !auth.EsAdmin(auth.UsuarioActual(r)) {
			respuestas.Error(w, http.StatusForbidden, mensajeSoloAdminLugares)
			return
		}
		r.Body = http.MaxBytesReader(w, r.Body, 4096)
		var pedido pedidoCrearIsleta
		if err := json.NewDecoder(r.Body).Decode(&pedido); err != nil {
			respuestas.Error(w, http.StatusBadRequest, "Completá los datos de la isleta")
			return
		}
		pedido.Nombre = textoOpcional(pedido.Nombre)
		mensaje := validarNumeroYNombre(pedido.Numero, pedido.Nombre)
		if mensaje == "" {
			mensaje = validarGrilla(pedido.Filas, pedido.Columnas)
		}
		if mensaje != "" {
			respuestas.Error(w, http.StatusBadRequest, mensaje)
			return
		}

		// INSERT ... SELECT: si el lugar no existe, el SELECT no da filas, no se inserta nada
		// y Scan devuelve pgx.ErrNoRows. Así se evita leer el lugar en una consulta aparte.
		var id int64
		err := pool.QueryRow(r.Context(), `
			INSERT INTO isletas (lugar_id, numero, nombre, filas, columnas)
			SELECT l.id, $2, $3, $4, $5 FROM lugares l WHERE l.id = $1
			RETURNING id`,
			pedido.LugarID, pedido.Numero, pedido.Nombre, pedido.Filas, pedido.Columnas).Scan(&id)
		if errors.Is(err, pgx.ErrNoRows) {
			respuestas.Error(w, http.StatusNotFound, "El lugar no existe")
			return
		}
		if violaUnica(err, "isletas_lugar_id_numero_key") {
			respuestas.Error(w, http.StatusConflict, mensajeIsletaRepetida(pedido.Numero))
			return
		}
		if err != nil {
			log.Printf("admin isletas: no se pudo crear: %v", err)
			respuestas.Error(w, http.StatusInternalServerError, mensajeErrorLugares)
			return
		}
		responderIsleta(w, r, pool, id, http.StatusCreated)
	}
}

// pedidoEditarIsleta es el cuerpo de PUT /api/admin/isletas/{id}.
type pedidoEditarIsleta struct {
	Numero int     `json:"numero"`
	Nombre *string `json:"nombre"` // opcional
}

// EditarIsleta atiende PUT /api/admin/isletas/{id}: cambia el número y el nombre.
// El número no cambia si la isleta ya tiene registros (RN-03). Va envuelta en RequiereSesion.
func EditarIsleta(pool *pgxpool.Pool) http.HandlerFunc {
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
		var pedido pedidoEditarIsleta
		if err := json.NewDecoder(r.Body).Decode(&pedido); err != nil {
			respuestas.Error(w, http.StatusBadRequest, "Completá los datos de la isleta")
			return
		}
		pedido.Nombre = textoOpcional(pedido.Nombre)
		if mensaje := validarNumeroYNombre(pedido.Numero, pedido.Nombre); mensaje != "" {
			respuestas.Error(w, http.StatusBadRequest, mensaje)
			return
		}

		errorInterno := func(que string, err error) {
			log.Printf("admin isletas: %s (isleta %d): %v", que, id, err)
			respuestas.Error(w, http.StatusInternalServerError, mensajeErrorLugares)
		}

		// Igual que en EditarLugar: se lee y se actualiza en una transacción, con la fila bloqueada.
		tx, err := pool.Begin(r.Context())
		if err != nil {
			errorInterno("no se pudo empezar la transacción", err)
			return
		}
		defer tx.Rollback(r.Context())

		var (
			numeroActual   int
			tieneRegistros bool
		)
		err = tx.QueryRow(r.Context(), `
			SELECT i.numero,
			       EXISTS (SELECT 1 FROM registros rg JOIN celulas c ON c.id = rg.celula_id WHERE c.isleta_id = i.id)
			FROM isletas i WHERE i.id = $1 FOR UPDATE`, id).Scan(&numeroActual, &tieneRegistros)
		if errors.Is(err, pgx.ErrNoRows) {
			respuestas.Error(w, http.StatusNotFound, "La isleta no existe")
			return
		}
		if err != nil {
			errorInterno("no se pudo leer", err)
			return
		}
		if pedido.Numero != numeroActual && tieneRegistros {
			respuestas.Error(w, http.StatusBadRequest, "El número no se puede cambiar porque la isleta ya tiene registros")
			return
		}

		_, err = tx.Exec(r.Context(),
			`UPDATE isletas SET numero = $1, nombre = $2, modificado_en = now() WHERE id = $3`,
			pedido.Numero, pedido.Nombre, id)
		if violaUnica(err, "isletas_lugar_id_numero_key") {
			respuestas.Error(w, http.StatusConflict, mensajeIsletaRepetida(pedido.Numero))
			return
		}
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
