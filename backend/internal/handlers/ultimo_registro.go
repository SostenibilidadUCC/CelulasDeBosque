package handlers

import (
	"context"
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

// ---------- PARTE A: tipos (el formato del JSON) ----------

// celulaDeCarga son los datos de la célula que muestra la pantalla de carga mensual.
type celulaDeCarga struct {
	ID              int64  `json:"id"`
	Codigo          string `json:"codigo"` // A-1-45, se calcula (no se guarda)
	LugarID         int64  `json:"lugarId"`
	Lugar           string `json:"lugar"`
	Isleta          int    `json:"isleta"`
	FechaPlantacion string `json:"fechaPlantacion"` // "2026-10-20"
	DadaDeBaja      bool   `json:"dadaDeBaja"`
}

// individuoDeCarga es uno de los 4 individuos de un registro.
// Los campos son punteros con "omitempty": si el puntero es nil, el campo NO sale en el JSON.
// Un puntero a 0 o a false no es nil, así que flores: 0 y frutos: false sí salen.
// Vivo no tiene omitempty: si falta la medición sale "vivo": null (no se inventa un false).
type individuoDeCarga struct {
	FormaDeVida     int   `json:"formaDeVida"`
	Vivo            *bool `json:"vivo"`
	AlturaCm        *int  `json:"alturaCm,omitempty"`
	Flores          *int  `json:"flores,omitempty"`
	Frutos          *bool `json:"frutos,omitempty"`
	PlantulasNuevas *bool `json:"plantulasNuevas,omitempty"`
}

// registroDeCarga es un registro con sus 4 individuos, ordenados por forma de vida.
type registroDeCarga struct {
	ID            int64              `json:"id"`
	Fecha         string             `json:"fecha"`   // "2026-10-18"
	Periodo       string             `json:"periodo"` // "2026-10"
	FotoID        *int64             `json:"fotoId"`
	Observaciones *string            `json:"observaciones"`
	Individuos    []individuoDeCarga `json:"individuos"`
}

// respuestaUltimoRegistro es lo que devuelve GET /api/celulas/{id}/ultimo-registro.
// Actual y Anterior son punteros: si no hay registro, salen como null.
type respuestaUltimoRegistro struct {
	Celula        celulaDeCarga    `json:"celula"`
	PeriodoActual string           `json:"periodoActual"` // "2026-11"
	Actual        *registroDeCarga `json:"actual"`
	Anterior      *registroDeCarga `json:"anterior"`
}

// ---------- PARTE B: consultas ----------

// consultaRegistroActual busca el registro no anulado (RN-12) del período en curso.
// Hay como máximo uno (RN-04). $2 es el período como texto ("2026-11-01"), igual que en estados.
const consultaRegistroActual = `
	SELECT id, to_char(fecha_medicion, 'YYYY-MM-DD'), to_char(periodo, 'YYYY-MM'), foto_id, observaciones
	FROM registros
	WHERE celula_id = $1 AND periodo = $2::date AND NOT anulado`

// consultaRegistroAnterior busca el último registro no anulado de un período anterior:
// el de fecha más reciente. Si dos tuvieran la misma fecha, gana el de id más alto.
const consultaRegistroAnterior = `
	SELECT id, to_char(fecha_medicion, 'YYYY-MM-DD'), to_char(periodo, 'YYYY-MM'), foto_id, observaciones
	FROM registros
	WHERE celula_id = $1 AND periodo < $2::date AND NOT anulado
	ORDER BY fecha_medicion DESC, id DESC
	LIMIT 1`

// consultaIndividuosDeRegistro trae los 4 individuos de la célula con sus mediciones en el registro.
// Se parte de la tabla individuos, así siempre salen los 4 aunque falte alguna medición.
// El LATERAL junta las mediciones de cada individuo en una sola fila, igual que en ficha.go:
// "max(...) FILTER (WHERE v.codigo = 'altura_cm')" es "el valor de la medición de altura", o NULL si no está.
// Los booleanos se guardan como 1 o 0, por eso se comparan con "= 1".
const consultaIndividuosDeRegistro = `
	SELECT i.forma_de_vida_id, m.vivo, m.altura_cm, m.flores, m.frutos, m.plantulas_nuevas
	FROM individuos i
	CROSS JOIN LATERAL (
		SELECT max(md.valor_numerico) FILTER (WHERE v.codigo = 'vivo') = 1             AS vivo,
		       max(md.valor_numerico) FILTER (WHERE v.codigo = 'altura_cm')::int       AS altura_cm,
		       max(md.valor_numerico) FILTER (WHERE v.codigo = 'flores')::int          AS flores,
		       max(md.valor_numerico) FILTER (WHERE v.codigo = 'frutos') = 1           AS frutos,
		       max(md.valor_numerico) FILTER (WHERE v.codigo = 'plantulas_nuevas') = 1 AS plantulas_nuevas
		FROM mediciones md
		JOIN variables v ON v.id = md.variable_id
		WHERE md.registro_id = $2 AND md.individuo_id = i.id
	) m
	WHERE i.celula_id = $1
	ORDER BY i.forma_de_vida_id`

// buscarRegistro corre una de las dos consultas de arriba y le agrega los individuos.
// Si no hay registro, devuelve nil sin error (en el JSON sale null).
func buscarRegistro(ctx context.Context, pool *pgxpool.Pool, consulta string, celulaID int64, periodo string) (*registroDeCarga, error) {
	var reg registroDeCarga
	err := pool.QueryRow(ctx, consulta, celulaID, periodo).
		Scan(&reg.ID, &reg.Fecha, &reg.Periodo, &reg.FotoID, &reg.Observaciones)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}

	filas, err := pool.Query(ctx, consultaIndividuosDeRegistro, celulaID, reg.ID)
	if err != nil {
		return nil, err
	}
	reg.Individuos, err = pgx.CollectRows(filas, func(f pgx.CollectableRow) (individuoDeCarga, error) {
		var ind individuoDeCarga
		err := f.Scan(&ind.FormaDeVida, &ind.Vivo, &ind.AlturaCm, &ind.Flores, &ind.Frutos, &ind.PlantulasNuevas)
		// Un individuo muerto solo trae formaDeVida y vivo: false (RN-08).
		// En la base ya no tiene esos datos; esto lo asegura igual por si quedó algo viejo.
		if ind.Vivo != nil && !*ind.Vivo {
			ind.AlturaCm, ind.Flores, ind.Frutos, ind.PlantulasNuevas = nil, nil, nil, nil
		}
		return ind, err
	})
	if err != nil {
		return nil, err
	}
	return &reg, nil
}

// ---------- PARTE C: el handler ----------

// UltimoRegistro atiende GET /api/celulas/{id}/ultimo-registro (T14): la célula, el registro del
// período en curso (para editarlo) y el último registro anterior (para precargar la carga mensual).
// Va envuelta en RequiereSesion: cualquier rol con sesión puede verlo.
func UltimoRegistro(pool *pgxpool.Pool) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		id, err := strconv.ParseInt(r.PathValue("id"), 10, 64)
		if err != nil {
			respuestas.Error(w, http.StatusBadRequest, "El número de célula no es válido")
			return
		}
		const mensajeError = "No se pudieron cargar los datos de la célula. Probá de nuevo."
		ctx := r.Context()

		// 1. La célula con su isleta y su lugar. Un lugar deshabilitado no se muestra (igual que la ficha).
		// Una célula dada de baja sí se devuelve, con dadaDeBaja: true.
		var (
			respuesta    respuestaUltimoRegistro
			letra        string
			numeroIsleta int
			numeroCelula int
		)
		c := &respuesta.Celula
		err = pool.QueryRow(ctx, `
			SELECT c.id, c.numero, i.numero, l.id, l.letra, l.nombre,
			       to_char(c.fecha_plantacion, 'YYYY-MM-DD'), c.estado = 'baja'
			FROM celulas c
			JOIN isletas i ON i.id = c.isleta_id
			JOIN lugares l ON l.id = i.lugar_id
			WHERE c.id = $1 AND l.activo`, id).
			Scan(&c.ID, &numeroCelula, &numeroIsleta, &c.LugarID, &letra, &c.Lugar, &c.FechaPlantacion, &c.DadaDeBaja)
		if errors.Is(err, pgx.ErrNoRows) {
			respuestas.Error(w, http.StatusNotFound, "No existe esa célula")
			return
		}
		if err != nil {
			log.Printf("ultimo-registro: no se pudo leer la célula %d: %v", id, err)
			respuestas.Error(w, http.StatusInternalServerError, mensajeError)
			return
		}
		c.Codigo = codigoCelula(letra, numeroIsleta, numeroCelula)
		c.Isleta = numeroIsleta

		// 2. El período en curso, en hora de Córdoba.
		periodo := estados.PeriodoActual(time.Now())
		respuesta.PeriodoActual = periodo.Format("2006-01")
		periodoTexto := periodo.Format("2006-01-02") // así lo recibe el SQL ($2::date)

		// 3. El registro de este mes y el último de un mes anterior.
		respuesta.Actual, err = buscarRegistro(ctx, pool, consultaRegistroActual, id, periodoTexto)
		if err != nil {
			log.Printf("ultimo-registro: no se pudo leer el registro actual de la célula %d: %v", id, err)
			respuestas.Error(w, http.StatusInternalServerError, mensajeError)
			return
		}
		respuesta.Anterior, err = buscarRegistro(ctx, pool, consultaRegistroAnterior, id, periodoTexto)
		if err != nil {
			log.Printf("ultimo-registro: no se pudo leer el registro anterior de la célula %d: %v", id, err)
			respuestas.Error(w, http.StatusInternalServerError, mensajeError)
			return
		}

		respuestas.JSON(w, respuesta)
	}
}
