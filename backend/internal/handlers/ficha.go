package handlers

import (
	"encoding/json"
	"errors"
	"log"
	"net/http"
	"strconv"
	"time"

	"github.com/SostenibilidadUCC/CelulasDeBosque/backend/internal/auth"
	"github.com/SostenibilidadUCC/CelulasDeBosque/backend/internal/estados"
	"github.com/SostenibilidadUCC/CelulasDeBosque/backend/internal/respuestas"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

// ---------- PARTE A: tipos (el formato del JSON) ----------

// lugarDeFicha e isletaDeFicha son para las migas de pan: Campus UCC › Isleta 1 › A-1-45.
type lugarDeFicha struct {
	ID     int64  `json:"id"`
	Letra  string `json:"letra"`
	Nombre string `json:"nombre"`
}

type isletaDeFicha struct {
	ID     int64 `json:"id"`
	Numero int   `json:"numero"`
}

// individuoDeFicha es una de las 4 plantas de la célula (RN-01).
type individuoDeFicha struct {
	ID          int64  `json:"id"`
	FormaDeVida int    `json:"formaDeVida"` // 1 Árbol, 2 Arbusto, 3 Herbácea, 4 Rastrera
	Nombre      string `json:"nombre"`
	Icono       string `json:"icono"`
}

// registroDeFicha es un registro mensual con los valores de sus 4 individuos.
// Individuos es JSON armado por PostgreSQL (json_agg), igual que en isletas.go.
type registroDeFicha struct {
	ID            int64           `json:"id"`
	Fecha         string          `json:"fecha"`   // "2026-11-18"
	Periodo       string          `json:"periodo"` // "2026-11"
	EsInicial     bool            `json:"esInicial"`
	FotoID        *int64          `json:"fotoId"`
	Observaciones *string         `json:"observaciones"`
	CargadoPor    string          `json:"cargadoPor"`    // FIC-04: quién cargó
	ModificadoPor *string         `json:"modificadoPor"` // FIC-05: null si nunca se modificó
	PuedeEditar   bool            `json:"puedeEditar"`
	Individuos    json.RawMessage `json:"individuos"` // [{ formaDeVida, vivo, alturaCm, flores, frutos, plantulasNuevas }]
}

// respuestaFicha es lo que devuelve GET /api/celulas/{id}.
type respuestaFicha struct {
	ID              int64              `json:"id"`
	Numero          int                `json:"numero"`
	Codigo          string             `json:"codigo"`
	FechaPlantacion string             `json:"fechaPlantacion"`
	Estado          string             `json:"estado"` // estado del mes, de estados.DeCelulas (T11)
	Lugar           lugarDeFicha       `json:"lugar"`
	Isleta          isletaDeFicha      `json:"isleta"`
	Individuos      []individuoDeFicha `json:"individuos"`
	Registros       []registroDeFicha  `json:"registros"` // del más viejo al más nuevo
}

// ---------- PARTE B: quién ve el botón "Editar" ----------

// puedeEditarRegistro dice si el usuario ve el botón "Editar" en un mes de la ficha.
// Por ahora (pregunta 9 de Requerimientos v4, RN-11) el admin edita cualquier mes y el cargador
// solo el mes actual de su lugar. Esto solo oculta el botón: el que valida es PUT /api/registros (T13).
func puedeEditarRegistro(u *auth.Usuario, lugarID int64, periodo, periodoActual string) bool {
	if auth.EsAdmin(u) {
		return true
	}
	return auth.PuedeEditarLugar(u, lugarID) && periodo == periodoActual
}

// ---------- PARTE C: empieza el handler (pasos 1 y 2) ----------

// Ficha atiende GET /api/celulas/{id} (T15, FIC-01 a 05): la célula con sus 4 individuos
// y todos sus registros no anulados. Va envuelta en RequiereSesion.
func Ficha(pool *pgxpool.Pool) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		id, err := strconv.ParseInt(r.PathValue("id"), 10, 64)
		if err != nil {
			respuestas.Error(w, http.StatusBadRequest, "El número de célula no es válido")
			return
		}
		const mensajeError = "No se pudo cargar la ficha. Probá de nuevo."

		// 1. La célula con su isleta y su lugar. Un lugar deshabilitado no se muestra (LUG-03).
		var ficha respuestaFicha
		err = pool.QueryRow(r.Context(), `
			SELECT c.id, c.numero, to_char(c.fecha_plantacion, 'YYYY-MM-DD'),
			       i.id, i.numero, l.id, l.letra, l.nombre
			FROM celulas c
			JOIN isletas i ON i.id = c.isleta_id
			JOIN lugares l ON l.id = i.lugar_id
			WHERE c.id = $1 AND l.activo`, id).
			Scan(&ficha.ID, &ficha.Numero, &ficha.FechaPlantacion,
				&ficha.Isleta.ID, &ficha.Isleta.Numero, &ficha.Lugar.ID, &ficha.Lugar.Letra, &ficha.Lugar.Nombre)
		if errors.Is(err, pgx.ErrNoRows) {
			respuestas.Error(w, http.StatusNotFound, "No existe esa célula")
			return
		}
		if err != nil {
			log.Printf("ficha: no se pudo leer la célula %d: %v", id, err)
			respuestas.Error(w, http.StatusInternalServerError, mensajeError)
			return
		}
		ficha.Codigo = codigoCelula(ficha.Lugar.Letra, ficha.Isleta.Numero, ficha.Numero)

		// 2. Estado del mes, con las mismas reglas que el plano y la lista de Células.
		periodo := estados.PeriodoActual(time.Now())
		estadoDe, err := estados.DeCelulas(r.Context(), pool, []int64{id}, periodo)
		if err != nil {
			log.Printf("ficha: no se pudo calcular el estado de la célula %d: %v", id, err)
			respuestas.Error(w, http.StatusInternalServerError, mensajeError)
			return
		}
		ficha.Estado = estadoDe[id]

		// ---------- PARTE D: paso 3, los individuos ----------

		// 3. Los 4 individuos, en el orden de las formas de vida.
		filas, err := pool.Query(r.Context(), `
			SELECT i.id, f.id, f.nombre, f.icono
			FROM individuos i
			JOIN formas_de_vida f ON f.id = i.forma_de_vida_id
			WHERE i.celula_id = $1
			ORDER BY f.id`, id)
		if err != nil {
			log.Printf("ficha: no se pudieron leer los individuos de la célula %d: %v", id, err)
			respuestas.Error(w, http.StatusInternalServerError, mensajeError)
			return
		}
		// pgx.CollectRows recorre todas las filas y las convierte con la función que le pasamos.
		ficha.Individuos, err = pgx.CollectRows(filas, func(f pgx.CollectableRow) (individuoDeFicha, error) {
			var ind individuoDeFicha
			err := f.Scan(&ind.ID, &ind.FormaDeVida, &ind.Nombre, &ind.Icono)
			return ind, err
		})
		if err != nil {
			log.Printf("ficha: no se pudieron leer los individuos de la célula %d: %v", id, err)
			respuestas.Error(w, http.StatusInternalServerError, mensajeError)
			return
		}

		// ---------- PARTE E: paso 4, los registros, y fin del handler ----------

		// 4. Los registros no anulados (RN-12), del más viejo al más nuevo.
		// Para cada individuo, el LATERAL junta sus mediciones en una sola fila:
		// "max(...) FILTER (WHERE v.codigo = 'altura_cm')" quiere decir "el valor de la medición
		// de altura". Si no existe (individuo muerto, RN-08), da NULL y en el JSON sale null.
		// Los booleanos se guardan como 1 o 0, por eso se comparan con "= 1".
		filas, err = pool.Query(r.Context(), `
			SELECT r.id, to_char(r.fecha_medicion, 'YYYY-MM-DD'), to_char(r.periodo, 'YYYY-MM'),
			       r.es_inicial, r.foto_id, r.observaciones, uc.nombre,
			       CASE WHEN r.modificado_en > r.creado_en THEN um.nombre END,
			       ind.lista
			FROM registros r
			JOIN usuarios uc ON uc.id = r.creado_por
			JOIN usuarios um ON um.id = r.modificado_por
			CROSS JOIN LATERAL (
				SELECT json_agg(json_build_object(
				           'formaDeVida',     i.forma_de_vida_id,
				           'vivo',            m.vivo,
				           'alturaCm',        m.altura_cm,
				           'flores',          m.flores,
				           'frutos',          m.frutos,
				           'plantulasNuevas', m.plantulas_nuevas
				       ) ORDER BY i.forma_de_vida_id) AS lista
				FROM individuos i
				CROSS JOIN LATERAL (
					SELECT max(md.valor_numerico) FILTER (WHERE v.codigo = 'vivo') = 1             AS vivo,
					       max(md.valor_numerico) FILTER (WHERE v.codigo = 'altura_cm')::int       AS altura_cm,
					       max(md.valor_numerico) FILTER (WHERE v.codigo = 'flores')::int          AS flores,
					       max(md.valor_numerico) FILTER (WHERE v.codigo = 'frutos') = 1           AS frutos,
					       max(md.valor_numerico) FILTER (WHERE v.codigo = 'plantulas_nuevas') = 1 AS plantulas_nuevas
					FROM mediciones md
					JOIN variables v ON v.id = md.variable_id
					WHERE md.registro_id = r.id AND md.individuo_id = i.id
				) m
				WHERE i.celula_id = r.celula_id
			) ind
			WHERE r.celula_id = $1 AND NOT r.anulado
			ORDER BY r.periodo, r.id`, id)
		if err != nil {
			log.Printf("ficha: no se pudieron leer los registros de la célula %d: %v", id, err)
			respuestas.Error(w, http.StatusInternalServerError, mensajeError)
			return
		}

		usuario := auth.UsuarioActual(r)
		periodoActual := periodo.Format("2006-01")
		ficha.Registros, err = pgx.CollectRows(filas, func(f pgx.CollectableRow) (registroDeFicha, error) {
			var reg registroDeFicha
			var individuos []byte
			err := f.Scan(&reg.ID, &reg.Fecha, &reg.Periodo, &reg.EsInicial, &reg.FotoID,
				&reg.Observaciones, &reg.CargadoPor, &reg.ModificadoPor, &individuos)
			reg.Individuos = individuos
			reg.PuedeEditar = puedeEditarRegistro(usuario, ficha.Lugar.ID, reg.Periodo, periodoActual)
			return reg, err
		})
		if err != nil {
			log.Printf("ficha: no se pudieron leer los registros de la célula %d: %v", id, err)
			respuestas.Error(w, http.StatusInternalServerError, mensajeError)
			return
		}

		respuestas.JSON(w, ficha)
	}
}
