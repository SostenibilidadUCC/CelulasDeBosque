package handlers

import (
	"errors"
	"log"
	"net/http"
	"strconv"
	"time"

	"github.com/SostenibilidadUCC/CelulasDeBosque/backend/internal/estados"
	"github.com/SostenibilidadUCC/CelulasDeBosque/backend/internal/respuestas"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

// celulaSiguiente es la célula a la que se pasa después de guardar un registro.
type celulaSiguiente struct {
	ID     int64  `json:"id"`
	Codigo string `json:"codigo"` // A-1-45, se calcula (no se guarda)
}

// respuestaSiguientePendiente es lo que devuelve GET /api/celulas/{id}/siguiente-pendiente.
// Celula es null si en la isleta no queda ninguna otra célula para cargar (no es un error).
type respuestaSiguientePendiente struct {
	Celula *celulaSiguiente `json:"celula"`
}

// candidata es una célula de la isleta que podría ser la siguiente.
type candidata struct {
	id     int64
	numero int
}

// elegirSiguiente recibe las candidatas ordenadas por número (sin la actual ni las dadas de baja)
// y el estado de cada una. Devuelve la primera pendiente con número mayor al de la actual; si no
// hay, la primera pendiente de toda la lista (la vuelta al principio). Si no queda ninguna, nil.
// "Pendiente" incluye las que no tienen registro inicial: a las dos les falta cargar algo.
func elegirSiguiente(candidatas []candidata, estadoDe map[int64]string, numeroActual int) *candidata {
	var primera *candidata
	for i := range candidatas {
		c := &candidatas[i]
		if estado := estadoDe[c.id]; estado != estados.Pendiente && estado != estados.SinRegistro {
			continue
		}
		if c.numero > numeroActual {
			return c // como están ordenadas, la primera mayor es la de menor número
		}
		if primera == nil {
			primera = c
		}
	}
	return primera
}

// SiguientePendiente atiende GET /api/celulas/{id}/siguiente-pendiente (T14): la próxima célula de
// la MISMA isleta que falta cargar este mes, para pasar a ella después de guardar.
// Va envuelta en RequiereSesion: cualquier rol con sesión puede verlo.
func SiguientePendiente(pool *pgxpool.Pool) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		id, err := strconv.ParseInt(r.PathValue("id"), 10, 64)
		if err != nil {
			respuestas.Error(w, http.StatusBadRequest, "El número de célula no es válido")
			return
		}
		const mensajeError = "No se pudo buscar la siguiente célula. Probá de nuevo."
		ctx := r.Context()

		// 1. La célula actual: su isleta, su número y los datos para armar el código.
		// Un lugar deshabilitado no se muestra (igual que la ficha y la carga).
		var (
			isletaID, numeroIsleta, numeroActual int64
			letra                                string
		)
		err = pool.QueryRow(ctx, `
			SELECT c.isleta_id, i.numero, c.numero, l.letra
			FROM celulas c
			JOIN isletas i ON i.id = c.isleta_id
			JOIN lugares l ON l.id = i.lugar_id
			WHERE c.id = $1 AND l.activo`, id).
			Scan(&isletaID, &numeroIsleta, &numeroActual, &letra)
		if errors.Is(err, pgx.ErrNoRows) {
			respuestas.Error(w, http.StatusNotFound, "No existe esa célula")
			return
		}
		if err != nil {
			log.Printf("siguiente-pendiente: no se pudo leer la célula %d: %v", id, err)
			respuestas.Error(w, http.StatusInternalServerError, mensajeError)
			return
		}

		// 2. Las otras células de la isleta que no están dadas de baja, ordenadas por número.
		filas, err := pool.Query(ctx, `
			SELECT id, numero
			FROM celulas
			WHERE isleta_id = $1 AND id <> $2 AND estado <> 'baja'
			ORDER BY numero`, isletaID, id)
		if err != nil {
			log.Printf("siguiente-pendiente: no se pudieron leer las células de la isleta %d: %v", isletaID, err)
			respuestas.Error(w, http.StatusInternalServerError, mensajeError)
			return
		}
		candidatas, err := pgx.CollectRows(filas, func(f pgx.CollectableRow) (candidata, error) {
			var c candidata
			err := f.Scan(&c.id, &c.numero)
			return c, err
		})
		if err != nil {
			log.Printf("siguiente-pendiente: no se pudieron leer las células de la isleta %d: %v", isletaID, err)
			respuestas.Error(w, http.StatusInternalServerError, mensajeError)
			return
		}

		// 3. El estado de cada una sale del paquete estados (nunca SQL propio de estados).
		ids := make([]int64, 0, len(candidatas))
		for _, c := range candidatas {
			ids = append(ids, c.id)
		}
		estadoDe, err := estados.DeCelulas(ctx, pool, ids, estados.PeriodoActual(time.Now()))
		if err != nil {
			log.Printf("siguiente-pendiente: no se pudieron calcular los estados de la isleta %d: %v", isletaID, err)
			respuestas.Error(w, http.StatusInternalServerError, mensajeError)
			return
		}

		// 4. La siguiente, o null si no queda ninguna.
		var respuesta respuestaSiguientePendiente
		if elegida := elegirSiguiente(candidatas, estadoDe, int(numeroActual)); elegida != nil {
			respuesta.Celula = &celulaSiguiente{
				ID:     elegida.id,
				Codigo: codigoCelula(letra, int(numeroIsleta), elegida.numero),
			}
		}
		respuestas.JSON(w, respuesta)
	}
}
