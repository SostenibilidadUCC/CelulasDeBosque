package handlers

import (
	"encoding/json"
	"errors"
	"log"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/SostenibilidadUCC/CelulasDeBosque/backend/internal/auth"
	"github.com/SostenibilidadUCC/CelulasDeBosque/backend/internal/estados"
	"github.com/SostenibilidadUCC/CelulasDeBosque/backend/internal/respuestas"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

// lugarDeCelulas es el lugar elegido en la pantalla Células.
type lugarDeCelulas struct {
	ID     int64  `json:"id"`
	Letra  string `json:"letra"`
	Nombre string `json:"nombre"`
}

// isletaDeTarjeta es la isleta a la que pertenece una célula de la lista.
type isletaDeTarjeta struct {
	ID     int64 `json:"id"`
	Numero int   `json:"numero"`
}

// registroDeTarjeta es el último registro no anulado de una célula (solo lo que muestra la tarjeta).
type registroDeTarjeta struct {
	Fecha  string `json:"fecha"`  // "2026-11-18"
	FotoID *int64 `json:"fotoId"` // puntero: si llegara NULL, sale null en vez de romper
}

// tarjetaCelula es una célula de la lista de Células (EXP-03).
type tarjetaCelula struct {
	ID             int64              `json:"id"`
	Numero         int                `json:"numero"`
	Codigo         string             `json:"codigo"` // "A-1-45": se calcula, no se guarda
	Isleta         isletaDeTarjeta    `json:"isleta"`
	Estado         string             `json:"estado"`         // estado del mes, del paquete estados
	UltimoRegistro *registroDeTarjeta `json:"ultimoRegistro"` // null si no tiene registros
	// Siempre los 4 individuos: [{ formaDeVida, nombre, icono, vivo }].
	// vivo es null si la célula todavía no tiene registros.
	// Es JSON armado por PostgreSQL (json_agg): Go lo manda tal cual, sin decodificarlo.
	Individuos json.RawMessage `json:"individuos"`
}

// respuestaCelulasDeLugar es lo que devuelve GET /api/lugares/{id}/celulas.
type respuestaCelulasDeLugar struct {
	Lugar       lugarDeCelulas  `json:"lugar"`
	PuedeEditar bool            `json:"puedeEditar"` // si el usuario puede cargar registros en este lugar
	Celulas     []tarjetaCelula `json:"celulas"`
}

// estadosValidos son los valores que acepta el filtro ?estado=.
var estadosValidos = map[string]bool{
	estados.AlDia:          true,
	estados.Pendiente:      true,
	estados.SinRegistro:    true,
	estados.FueraDeTermino: true,
	estados.Baja:           true,
}

// busqueda es lo que se entendió del texto del buscador. nil quiere decir "sin filtro".
type busqueda struct {
	isleta *int // número de isleta (no id)
	numero *int // número de célula
}

// interpretarBusqueda entiende el texto del buscador (EXP-02) para el lugar de la letra dada:
//   - ""        → sin filtro;
//   - "45"      → la célula 45 de cualquier isleta del lugar;
//   - "A-1-45"  → la célula 45 de la isleta 1 (sin importar mayúsculas ni espacios alrededor).
//
// Devuelve ok = false si el texto no se entiende o si la letra no es la del lugar:
// en ese caso la lista sale vacía.
func interpretarBusqueda(q, letraLugar string) (b busqueda, ok bool) {
	q = strings.TrimSpace(q)
	if q == "" {
		return busqueda{}, true
	}

	// Solo el número: "45".
	if numero, esNumero := numeroPositivo(q); esNumero {
		return busqueda{numero: &numero}, true
	}

	// El código completo: "A-1-45". strings.Split lo corta en ["A", "1", "45"].
	partes := strings.Split(q, "-")
	if len(partes) != 3 {
		return busqueda{}, false
	}
	// EqualFold compara sin importar mayúsculas: "a" y "A" son iguales.
	if !strings.EqualFold(strings.TrimSpace(partes[0]), letraLugar) {
		return busqueda{}, false
	}
	isleta, ok1 := numeroPositivo(strings.TrimSpace(partes[1]))
	numero, ok2 := numeroPositivo(strings.TrimSpace(partes[2]))
	if !ok1 || !ok2 {
		return busqueda{}, false
	}
	return busqueda{isleta: &isleta, numero: &numero}, true
}

// numeroPositivo convierte "45" en 45. Solo acepta dígitos (nada de "+5", "-5" ni "4,5")
// y números mayores que cero.
func numeroPositivo(texto string) (int, bool) {
	if texto == "" {
		return 0, false
	}
	for _, letra := range texto {
		if letra < '0' || letra > '9' {
			return 0, false
		}
	}
	n, err := strconv.Atoi(texto)
	if err != nil || n < 1 { // err si el número es gigante
		return 0, false
	}
	return n, true
}

// CelulasDeLugar atiende GET /api/lugares/{id}/celulas (T11): las células de un lugar con su
// estado del mes, su último registro y sus 4 individuos. Filtros opcionales:
// ?isleta=<id de isleta>&estado=<uno de los 5>&q=<código o número>. Va envuelta en RequiereSesion.
func CelulasDeLugar(pool *pgxpool.Pool) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		ctx := r.Context()

		errorInterno := func(que string, err error) {
			log.Printf("celulas: %s: %v", que, err)
			respuestas.Error(w, http.StatusInternalServerError, "No se pudieron cargar las células. Probá de nuevo.")
		}

		// 1. Validar lo que llega, antes de tocar la base.
		lugarID, err := strconv.ParseInt(r.PathValue("id"), 10, 64)
		if err != nil {
			respuestas.Error(w, http.StatusBadRequest, "El lugar no es válido")
			return
		}

		filtros := r.URL.Query() // los parámetros después del "?"

		var isletaID *int64 // nil = todas las isletas
		if texto := filtros.Get("isleta"); texto != "" {
			id, err := strconv.ParseInt(texto, 10, 64)
			if err != nil {
				respuestas.Error(w, http.StatusBadRequest, "La isleta no es válida")
				return
			}
			isletaID = &id
		}

		estadoBuscado := filtros.Get("estado") // "" = todos los estados
		if estadoBuscado != "" && !estadosValidos[estadoBuscado] {
			respuestas.Error(w, http.StatusBadRequest, "El estado no es válido")
			return
		}

		// 2. El lugar, que tiene que existir y estar activo (LUG-03).
		var respuesta respuestaCelulasDeLugar
		err = pool.QueryRow(ctx, `
			SELECT id, letra, nombre
			FROM lugares
			WHERE id = $1 AND activo`, lugarID).
			Scan(&respuesta.Lugar.ID, &respuesta.Lugar.Letra, &respuesta.Lugar.Nombre)
		if errors.Is(err, pgx.ErrNoRows) {
			respuestas.Error(w, http.StatusNotFound, "No existe ese lugar")
			return
		}
		if err != nil {
			errorInterno("no se pudo leer el lugar", err)
			return
		}

		respuesta.PuedeEditar = auth.PuedeEditarLugar(auth.UsuarioActual(r), respuesta.Lugar.ID)
		respuesta.Celulas = []tarjetaCelula{} // lista vacía (y no nil) para que el JSON sea [] y no null

		// 3. El buscador. Si no se entiende, la respuesta es la lista vacía (no es un error).
		b, ok := interpretarBusqueda(filtros.Get("q"), respuesta.Lugar.Letra)
		if !ok {
			respuestas.JSON(w, respuesta)
			return
		}

		// 4. Las células con su último registro y sus 4 individuos.
		// Los filtros van siempre como parámetros. "($2::bigint IS NULL OR i.id = $2)" quiere decir:
		// si no mandaron filtro (llega NULL), la condición deja pasar todo; si mandaron, filtra.
		// Así la consulta es una sola y nunca se arma pegando texto.
		// LEFT JOIN LATERAL es como un "para cada célula, buscá…" (mismo estilo que isletas.go):
		//   - ur: su registro más reciente que no esté anulado (RN-12);
		//   - ind: sus 4 individuos con "vivo" de ese registro. Es ON true para que vengan los 4
		//     aunque no haya registro; en ese caso no hay medición y vivo queda null.
		filas, err := pool.Query(ctx, `
			SELECT c.id, c.numero, i.id, i.numero,
			       to_char(ur.fecha_medicion, 'YYYY-MM-DD'), ur.foto_id, ind.lista
			FROM celulas c
			JOIN isletas i ON i.id = c.isleta_id
			LEFT JOIN LATERAL (
				SELECT r.id, r.fecha_medicion, r.foto_id
				FROM registros r
				WHERE r.celula_id = c.id AND NOT r.anulado
				ORDER BY r.periodo DESC
				LIMIT 1
			) ur ON true
			LEFT JOIN LATERAL (
				SELECT COALESCE(json_agg(json_build_object(
				           'formaDeVida', f.id,
				           'nombre',      f.nombre,
				           'icono',       f.icono,
				           'vivo',        vivo.valor_numerico = 1
				       ) ORDER BY f.id), '[]'::json) AS lista
				FROM individuos ind
				JOIN formas_de_vida f ON f.id = ind.forma_de_vida_id
				LEFT JOIN mediciones vivo ON vivo.registro_id = ur.id AND vivo.individuo_id = ind.id
				     AND vivo.variable_id = (SELECT id FROM variables WHERE codigo = 'vivo')
				WHERE ind.celula_id = c.id
			) ind ON true
			WHERE i.lugar_id = $1
			  AND ($2::bigint IS NULL OR i.id = $2)
			  AND ($3::int IS NULL OR i.numero = $3)
			  AND ($4::int IS NULL OR c.numero = $4)
			ORDER BY i.numero, c.numero`,
			lugarID, isletaID, b.isleta, b.numero)
		if err != nil {
			errorInterno("no se pudieron leer las células", err)
			return
		}
		var ids []int64
		for filas.Next() {
			var (
				c          tarjetaCelula
				fecha      *string
				fotoID     *int64
				individuos []byte
			)
			if err := filas.Scan(&c.ID, &c.Numero, &c.Isleta.ID, &c.Isleta.Numero,
				&fecha, &fotoID, &individuos); err != nil {
				filas.Close()
				errorInterno("no se pudo leer una célula", err)
				return
			}
			c.Codigo = codigoCelula(respuesta.Lugar.Letra, c.Isleta.Numero, c.Numero) // de isletas.go
			c.Individuos = individuos
			if fecha != nil {
				c.UltimoRegistro = &registroDeTarjeta{Fecha: *fecha, FotoID: fotoID}
			}
			ids = append(ids, c.ID)
			respuesta.Celulas = append(respuesta.Celulas, c)
		}
		filas.Close()
		if err := filas.Err(); err != nil {
			errorInterno("error al recorrer las células", err)
			return
		}

		// 5. El estado del mes de cada célula sale del paquete estados (nunca SQL propio de estados).
		estadoDe, err := estados.DeCelulas(ctx, pool, ids, estados.PeriodoActual(time.Now()))
		if err != nil {
			errorInterno("no se pudieron calcular los estados", err)
			return
		}

		// 6. Completar el estado y, si pidieron uno, quedarse solo con esas células.
		filtradas := []tarjetaCelula{}
		for _, c := range respuesta.Celulas {
			c.Estado = estadoDe[c.ID]
			if estadoBuscado == "" || c.Estado == estadoBuscado {
				filtradas = append(filtradas, c)
			}
		}
		respuesta.Celulas = filtradas

		respuestas.JSON(w, respuesta)
	}
}
