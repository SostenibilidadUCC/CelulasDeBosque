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

// lugarDeIsleta es el lugar al que pertenece la isleta (para las migas de pan y el código).
type lugarDeIsleta struct {
	ID     int64  `json:"id"`
	Letra  string `json:"letra"`
	Nombre string `json:"nombre"`
}

// ultimoRegistro es el registro más reciente de una célula, para el panel que se abre al tocarla.
// Individuos es JSON armado directamente por PostgreSQL (json_agg), por eso es json.RawMessage:
// Go lo manda al front tal cual, sin volver a decodificarlo.
type ultimoRegistro struct {
	ID         int64           `json:"id"`
	Fecha      string          `json:"fecha"`      // "2026-11-18"
	FotoID     *int64          `json:"fotoId"`     // puntero: si llegara NULL, sale null en el JSON en vez de romper
	Individuos json.RawMessage `json:"individuos"` // [{ formaDeVida, nombre, icono, vivo, alturaCm }]
}

// celdaCelula es una célula ubicada en la grilla del plano.
type celdaCelula struct {
	ID      int64  `json:"id"`
	Numero  int    `json:"numero"`
	Codigo  string `json:"codigo"` // "A-1-45": se calcula, no se guarda
	Fila    int    `json:"fila"`
	Columna int    `json:"columna"`
	// Estado del mes: "al-dia", "pendiente", "sin-registro", "fuera-de-termino" o "baja".
	// TODO: calcularlo con EstadoCelula de Cande (T11). Hasta entonces solo se completa "baja"
	// (sale de la columna celulas.estado) y el resto llega null.
	Estado         *string         `json:"estado"`
	UltimoRegistro *ultimoRegistro `json:"ultimoRegistro"`
}

// respuestaIsleta es lo que devuelve GET /api/isletas/{id}.
type respuestaIsleta struct {
	ID          int64         `json:"id"`
	Numero      int           `json:"numero"`
	Nombre      *string       `json:"nombre"`
	Lugar       lugarDeIsleta `json:"lugar"`
	Filas       int           `json:"filas"`
	Columnas    int           `json:"columnas"`
	PlanoFotoID *int64        `json:"planoFotoId"` // null si todavía no se subió el plano (ISL-06)
	PuedeEditar bool          `json:"puedeEditar"` // si el usuario puede cargar registros en este lugar
	Celulas     []celdaCelula `json:"celulas"`
}

// codigoCelula arma el código visible de una célula: lugar-isleta-célula (A-1-45).
func codigoCelula(letra string, isleta, celula int) string {
	return fmt.Sprintf("%s-%d-%d", letra, isleta, celula)
}

// Isleta atiende GET /api/isletas/{id} (T12): la isleta con su grilla y cada célula
// con su posición y su último registro. Va envuelta en RequiereSesion.
func Isleta(pool *pgxpool.Pool) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		id, err := strconv.ParseInt(r.PathValue("id"), 10, 64)
		if err != nil {
			respuestas.Error(w, http.StatusBadRequest, "El número de isleta no es válido")
			return
		}

		// 1. La isleta y su lugar. Un lugar deshabilitado no se muestra (LUG-03).
		var isleta respuestaIsleta
		err = pool.QueryRow(r.Context(), `
			SELECT i.id, i.numero, i.nombre, i.filas, i.columnas, i.plano_foto_id,
			       l.id, l.letra, l.nombre
			FROM isletas i
			JOIN lugares l ON l.id = i.lugar_id
			WHERE i.id = $1 AND l.activo`, id).
			Scan(&isleta.ID, &isleta.Numero, &isleta.Nombre, &isleta.Filas, &isleta.Columnas, &isleta.PlanoFotoID,
				&isleta.Lugar.ID, &isleta.Lugar.Letra, &isleta.Lugar.Nombre)
		if errors.Is(err, pgx.ErrNoRows) {
			respuestas.Error(w, http.StatusNotFound, "No existe esa isleta")
			return
		}
		if err != nil {
			log.Printf("isletas: no se pudo leer la isleta %d: %v", id, err)
			respuestas.Error(w, http.StatusInternalServerError, "No se pudo cargar la isleta. Probá de nuevo.")
			return
		}

		isleta.PuedeEditar = auth.PuedeEditarLugar(auth.UsuarioActual(r), isleta.Lugar.ID)

		// 2. Las células con su último registro.
		// LEFT JOIN LATERAL es como un "para cada célula, buscá…": acá busca su registro más
		// reciente que no esté anulado, y para ese registro arma la lista de los 4 individuos.
		// Es LEFT para que también vengan las células que todavía no tienen registros.
		filas, err := pool.Query(r.Context(), `
			SELECT c.id, c.numero, c.fila, c.columna, c.estado = 'baja',
			       ur.id, to_char(ur.fecha_medicion, 'YYYY-MM-DD'), ur.foto_id, ind.lista
			FROM celulas c
			LEFT JOIN LATERAL (
				SELECT r.id, r.fecha_medicion, r.foto_id
				FROM registros r
				WHERE r.celula_id = c.id AND NOT r.anulado
				ORDER BY r.periodo DESC
				LIMIT 1
			) ur ON true
			LEFT JOIN LATERAL (
				SELECT json_agg(json_build_object(
				           'formaDeVida', f.id,
				           'nombre',      f.nombre,
				           'icono',       f.icono,
				           'vivo',        vivo.valor_numerico = 1,
				           'alturaCm',    altura.valor_numerico
				       ) ORDER BY f.id) AS lista
				FROM individuos i
				JOIN formas_de_vida f ON f.id = i.forma_de_vida_id
				LEFT JOIN mediciones vivo ON vivo.registro_id = ur.id AND vivo.individuo_id = i.id
				     AND vivo.variable_id = (SELECT id FROM variables WHERE codigo = 'vivo')
				LEFT JOIN mediciones altura ON altura.registro_id = ur.id AND altura.individuo_id = i.id
				     AND altura.variable_id = (SELECT id FROM variables WHERE codigo = 'altura_cm')
				WHERE i.celula_id = c.id
			) ind ON ur.id IS NOT NULL
			WHERE c.isleta_id = $1
			ORDER BY c.numero`, id)
		if err != nil {
			log.Printf("isletas: no se pudieron leer las células de la isleta %d: %v", id, err)
			respuestas.Error(w, http.StatusInternalServerError, "No se pudo cargar la isleta. Probá de nuevo.")
			return
		}
		defer filas.Close()

		// Se arranca con una lista vacía (y no nil) para que el JSON sea [] y no null.
		isleta.Celulas = []celdaCelula{}
		for filas.Next() {
			var (
				c          celdaCelula
				dadaDeBaja bool
				registroID *int64
				fecha      *string
				fotoID     *int64
				individuos []byte
			)
			if err := filas.Scan(&c.ID, &c.Numero, &c.Fila, &c.Columna, &dadaDeBaja,
				&registroID, &fecha, &fotoID, &individuos); err != nil {
				log.Printf("isletas: no se pudo leer una célula: %v", err)
				respuestas.Error(w, http.StatusInternalServerError, "No se pudo cargar la isleta. Probá de nuevo.")
				return
			}
			c.Codigo = codigoCelula(isleta.Lugar.Letra, isleta.Numero, c.Numero)
			if dadaDeBaja {
				baja := "baja"
				c.Estado = &baja
			}
			if registroID != nil {
				c.UltimoRegistro = &ultimoRegistro{ID: *registroID, Fecha: *fecha, FotoID: fotoID, Individuos: individuos}
			}
			isleta.Celulas = append(isleta.Celulas, c)
		}
		if err := filas.Err(); err != nil {
			log.Printf("isletas: error al recorrer las células de la isleta %d: %v", id, err)
			respuestas.Error(w, http.StatusInternalServerError, "No se pudo cargar la isleta. Probá de nuevo.")
			return
		}

		respuestas.JSON(w, isleta)
	}
}
