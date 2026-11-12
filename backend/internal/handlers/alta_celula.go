package handlers

import (
	"encoding/json"
	"errors"
	"fmt"
	"log"
	"net/http"
	"time"

	"github.com/SostenibilidadUCC/CelulasDeBosque/backend/internal/auth"
	"github.com/SostenibilidadUCC/CelulasDeBosque/backend/internal/respuestas"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

// Alta de una célula desde la pantalla Nueva célula (T17, ALT-01 a ALT-05).
// La puede usar el admin en cualquier lugar y el cargador solo en el suyo.
// Crear la célula y sus 4 individuos lo hace crearCelula (crear_celula.go), la misma que usa el lote.

// Rango del número de célula dentro de la isleta (tabla de dominio de los requerimientos v6).
const (
	numeroCelulaMinimo = 1
	numeroCelulaMaximo = 200
)

// pedidoAltaCelula es el cuerpo de POST /api/celulas.
type pedidoAltaCelula struct {
	IsletaID        int64  `json:"isletaId"`
	Numero          int    `json:"numero"`
	Fila            int    `json:"fila"`
	Columna         int    `json:"columna"`
	FechaPlantacion string `json:"fechaPlantacion"` // "2026-11-25"; vacía o sin mandar: hoy en Córdoba (ALT-04)
}

// celulaCreada es la respuesta de POST /api/celulas.
type celulaCreada struct {
	ID              int64  `json:"id"`
	Codigo          string `json:"codigo"` // "A-1-61": se calcula, no se guarda
	IsletaID        int64  `json:"isletaId"`
	Numero          int    `json:"numero"`
	Fila            int    `json:"fila"`
	Columna         int    `json:"columna"`
	FechaPlantacion string `json:"fechaPlantacion"`
}

// AltaCelula atiende POST /api/celulas. Responde 201 con la célula creada.
// Errores: 400 datos inválidos, 403 sin permiso en el lugar, 404 la isleta no existe o su lugar
// está deshabilitado, 409 el número o la celda ya están ocupados (RN-02). Va envuelta en RequiereSesion.
func AltaCelula(pool *pgxpool.Pool) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		usuario := auth.UsuarioActual(r)
		ctx := r.Context()

		// ---------- 1. Leer y validar el pedido (lo que no depende de la base) ----------
		// MaxBytesReader corta cuerpos gigantes: este pedido entra holgado en 4 KB.
		r.Body = http.MaxBytesReader(w, r.Body, 4096)
		var pedido pedidoAltaCelula
		if err := json.NewDecoder(r.Body).Decode(&pedido); err != nil {
			respuestas.Error(w, http.StatusBadRequest, "Completá la isleta, el número y la celda del plano")
			return
		}
		if pedido.IsletaID < 1 {
			respuestas.Error(w, http.StatusBadRequest, "Elegí la isleta")
			return
		}
		if pedido.Numero < numeroCelulaMinimo || pedido.Numero > numeroCelulaMaximo {
			respuestas.Error(w, http.StatusBadRequest,
				fmt.Sprintf("El número de célula tiene que ser de %d a %d", numeroCelulaMinimo, numeroCelulaMaximo))
			return
		}

		// ALT-04: hoy por defecto; no puede ser futura. Se reutiliza la validación del lote
		// (admin_lote.go), que compara con "hoy" en hora de Córdoba y no en UTC.
		fecha := hoyEnCordoba(time.Now())
		if pedido.FechaPlantacion != "" {
			var mensaje string
			fecha, mensaje = validarFechaPlantacion(pedido.FechaPlantacion, time.Now())
			if mensaje != "" {
				respuestas.Error(w, http.StatusBadRequest, mensaje)
				return
			}
		}

		errorInterno := func(que string, err error) {
			log.Printf("alta de célula: %s (isleta %d, número %d): %v", que, pedido.IsletaID, pedido.Numero, err)
			respuestas.Error(w, http.StatusInternalServerError, "No se pudo crear la célula. Probá de nuevo en unos minutos.")
		}

		// ---------- 2. Transacción: isleta, permiso, grilla y alta ----------
		tx, err := pool.Begin(ctx)
		if err != nil {
			errorInterno("no se pudo empezar la transacción", err)
			return
		}
		// Si se sale antes del Commit (por un error o una validación), se deshace todo.
		// Después de un Commit, Rollback no hace nada.
		defer tx.Rollback(ctx)

		// La isleta con su lugar. FOR SHARE OF i bloquea la isleta solo contra cambios: así nadie
		// achica la grilla (admin_plano.go) mientras se crea la célula, pero otros pueden leerla.
		var (
			lugarID                       int64
			lugarActivo                   bool
			letra                         string
			numeroIsleta, filas, columnas int
		)
		err = tx.QueryRow(ctx, `
			SELECT l.id, l.activo, l.letra, i.numero, i.filas, i.columnas
			FROM isletas i JOIN lugares l ON l.id = i.lugar_id
			WHERE i.id = $1
			FOR SHARE OF i`, pedido.IsletaID).Scan(&lugarID, &lugarActivo, &letra, &numeroIsleta, &filas, &columnas)
		if errors.Is(err, pgx.ErrNoRows) {
			respuestas.Error(w, http.StatusNotFound, "La isleta no existe")
			return
		}
		if err != nil {
			errorInterno("no se pudo leer la isleta", err)
			return
		}
		// Un lugar deshabilitado no recibe células nuevas: para el resto de la app "no existe" (LUG-03).
		if !lugarActivo {
			respuestas.Error(w, http.StatusNotFound, "La isleta no existe")
			return
		}

		// El permiso va después de buscar la isleta porque hace falta saber de qué lugar es.
		if !auth.PuedeEditarLugar(usuario, lugarID) {
			respuestas.Error(w, http.StatusForbidden, "No tenés permiso para crear células en este lugar")
			return
		}

		// La celda tiene que estar dentro de la grilla del plano. No se pide la foto del plano:
		// una isleta sin foto puede recibir células, igual que en el lote.
		if pedido.Fila < 1 || pedido.Fila > filas {
			respuestas.Error(w, http.StatusBadRequest, fmt.Sprintf("La fila tiene que ser de 1 a %d", filas))
			return
		}
		if pedido.Columna < 1 || pedido.Columna > columnas {
			respuestas.Error(w, http.StatusBadRequest, fmt.Sprintf("La columna tiene que ser de 1 a %d", columnas))
			return
		}

		// RN-01 y RN-02: crearCelula inserta la célula y sus 4 individuos. Que el número y la celda
		// estén libres lo garantiza la base con UNIQUE; violaUnica dice cuál de las dos falló.
		id, err := crearCelula(ctx, tx, celulaNueva{
			IsletaID: pedido.IsletaID, Numero: pedido.Numero, Fila: pedido.Fila, Columna: pedido.Columna,
			FechaPlantacion: fecha, UsuarioID: usuario.ID,
		})
		if violaUnica(err, restriccionNumeroCelula) {
			respuestas.Error(w, http.StatusConflict, "Ya existe una célula con ese número en la isleta.")
			return
		}
		if violaUnica(err, restriccionPosicionCelula) {
			respuestas.Error(w, http.StatusConflict, "Esa celda del plano ya está ocupada.")
			return
		}
		if err != nil {
			errorInterno("no se pudo crear la célula", err)
			return
		}
		if err := tx.Commit(ctx); err != nil {
			errorInterno("no se pudo confirmar", err)
			return
		}

		// ---------- 3. Respuesta ----------
		respuestas.Creado(w, celulaCreada{
			ID:              id,
			Codigo:          codigoCelula(letra, numeroIsleta, pedido.Numero),
			IsletaID:        pedido.IsletaID,
			Numero:          pedido.Numero,
			Fila:            pedido.Fila,
			Columna:         pedido.Columna,
			FechaPlantacion: fecha.Format("2006-01-02"),
		})
	}
}
