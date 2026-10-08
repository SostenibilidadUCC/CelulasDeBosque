package handlers

import (
	"log"
	"net/http"
	"time"

	"github.com/SostenibilidadUCC/CelulasDeBosque/backend/internal/estados"
	"github.com/SostenibilidadUCC/CelulasDeBosque/backend/internal/respuestas"
	"github.com/jackc/pgx/v5/pgxpool"
)

// isletaDeLugar es una isleta dentro de la tarjeta de su lugar (para los filtros y "Ver plano").
type isletaDeLugar struct {
	ID     int64   `json:"id"`
	Numero int     `json:"numero"`
	Nombre *string `json:"nombre"` // puntero: el nombre es opcional y sale null si no tiene
}

// avanceDelMes es el avance de carga del mes (sección 7 del documento v4):
// células con registro del período actual sobre células activas.
type avanceDelMes struct {
	Cargadas int `json:"cargadas"`
	Total    int `json:"total"`
}

// resumenLugar es un lugar con sus cantidades, para Inicio (INI-04) y el selector de Células (EXP-01).
type resumenLugar struct {
	ID              int64           `json:"id"`
	Letra           string          `json:"letra"`
	Nombre          string          `json:"nombre"`
	Tipo            string          `json:"tipo"`            // "universidad" o "colegio"
	Localidad       *string         `json:"localidad"`       // opcional
	CantidadCelulas int             `json:"cantidadCelulas"` // solo activas (sin las dadas de baja)
	CantidadIsletas int             `json:"cantidadIsletas"`
	Isletas         []isletaDeLugar `json:"isletas"`
	Avance          avanceDelMes    `json:"avance"`
}

// respuestaLugares es lo que devuelve GET /api/lugares.
type respuestaLugares struct {
	Periodo              string         `json:"periodo"`              // "2026-10"
	DiasHastaVencimiento int            `json:"diasHastaVencimiento"` // INI-02
	Lugares              []resumenLugar `json:"lugares"`
}

// Lugares atiende GET /api/lugares (T11): los lugares activos con sus isletas, cantidades
// y avance del mes. Lo ven todos los roles. Va envuelta en RequiereSesion.
func Lugares(pool *pgxpool.Pool) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		ctx := r.Context()

		// errorInterno loguea el detalle y le muestra al usuario un mensaje genérico.
		// Es una función guardada en una variable ("closure") para no repetir estas dos líneas.
		errorInterno := func(que string, err error) {
			log.Printf("lugares: %s: %v", que, err)
			respuestas.Error(w, http.StatusInternalServerError, "No se pudieron cargar los lugares. Probá de nuevo.")
		}

		// Se toma la hora una sola vez, así el período y los días salen del mismo instante.
		ahora := time.Now()
		periodo := estados.PeriodoActual(ahora)
		respuesta := respuestaLugares{
			Periodo:              periodo.Format("2006-01"),
			DiasHastaVencimiento: estados.DiasHastaVencimiento(ahora),
			Lugares:              []resumenLugar{}, // lista vacía (y no nil) para que el JSON sea [] y no null
		}

		// posicion guarda en qué lugar de la lista quedó cada lugar, para encontrarlo por id
		// cuando lleguen sus isletas y sus células.
		posicion := map[int64]int{}

		// 1. Los lugares activos con sus cantidades. Un lugar deshabilitado no se muestra (LUG-03).
		// Las subconsultas entre paréntesis cuentan, para cada lugar, sus células activas y sus isletas.
		filas, err := pool.Query(ctx, `
			SELECT l.id, l.letra, l.nombre, l.tipo, l.localidad,
			       (SELECT count(*)
			        FROM celulas c
			        JOIN isletas i ON i.id = c.isleta_id
			        WHERE i.lugar_id = l.id AND c.estado = 'activa'),
			       (SELECT count(*) FROM isletas i WHERE i.lugar_id = l.id)
			FROM lugares l
			WHERE l.activo
			ORDER BY l.letra`)
		if err != nil {
			errorInterno("no se pudieron leer los lugares", err)
			return
		}
		for filas.Next() {
			lugar := resumenLugar{Isletas: []isletaDeLugar{}}
			if err := filas.Scan(&lugar.ID, &lugar.Letra, &lugar.Nombre, &lugar.Tipo, &lugar.Localidad,
				&lugar.CantidadCelulas, &lugar.CantidadIsletas); err != nil {
				filas.Close()
				errorInterno("no se pudo leer un lugar", err)
				return
			}
			lugar.Avance.Total = lugar.CantidadCelulas
			posicion[lugar.ID] = len(respuesta.Lugares)
			respuesta.Lugares = append(respuesta.Lugares, lugar)
		}
		filas.Close()
		if err := filas.Err(); err != nil {
			errorInterno("error al recorrer los lugares", err)
			return
		}

		// 2. Las isletas de los lugares activos, ordenadas por número.
		filas, err = pool.Query(ctx, `
			SELECT i.id, i.lugar_id, i.numero, i.nombre
			FROM isletas i
			JOIN lugares l ON l.id = i.lugar_id
			WHERE l.activo
			ORDER BY i.lugar_id, i.numero`)
		if err != nil {
			errorInterno("no se pudieron leer las isletas", err)
			return
		}
		for filas.Next() {
			var (
				isleta  isletaDeLugar
				lugarID int64
			)
			if err := filas.Scan(&isleta.ID, &lugarID, &isleta.Numero, &isleta.Nombre); err != nil {
				filas.Close()
				errorInterno("no se pudo leer una isleta", err)
				return
			}
			p := posicion[lugarID]
			respuesta.Lugares[p].Isletas = append(respuesta.Lugares[p].Isletas, isleta)
		}
		filas.Close()
		if err := filas.Err(); err != nil {
			errorInterno("error al recorrer las isletas", err)
			return
		}

		// 3. Las células activas de cada lugar, para calcular el avance del mes.
		filas, err = pool.Query(ctx, `
			SELECT c.id, i.lugar_id
			FROM celulas c
			JOIN isletas i ON i.id = c.isleta_id
			JOIN lugares l ON l.id = i.lugar_id
			WHERE l.activo AND c.estado = 'activa'`)
		if err != nil {
			errorInterno("no se pudieron leer las células", err)
			return
		}
		var ids []int64
		lugarDeCelula := map[int64]int64{} // id de célula → id de lugar
		for filas.Next() {
			var celulaID, lugarID int64
			if err := filas.Scan(&celulaID, &lugarID); err != nil {
				filas.Close()
				errorInterno("no se pudo leer una célula", err)
				return
			}
			ids = append(ids, celulaID)
			lugarDeCelula[celulaID] = lugarID
		}
		filas.Close()
		if err := filas.Err(); err != nil {
			errorInterno("error al recorrer las células", err)
			return
		}

		// 4. El estado de cada célula sale del paquete estados (nunca SQL propio de estados).
		// "Cargada" es la que tiene registro del período, a tiempo o fuera de término.
		estadoDe, err := estados.DeCelulas(ctx, pool, ids, periodo)
		if err != nil {
			errorInterno("no se pudieron calcular los estados", err)
			return
		}
		for celulaID, estado := range estadoDe {
			if estado == estados.AlDia || estado == estados.FueraDeTermino {
				p := posicion[lugarDeCelula[celulaID]]
				respuesta.Lugares[p].Avance.Cargadas++
			}
		}

		respuestas.JSON(w, respuesta)
	}
}
