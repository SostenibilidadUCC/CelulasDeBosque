package handlers

import (
	"encoding/json"
	"errors"
	"fmt"
	"log"
	"net/http"
	"slices"
	"strconv"
	"strings"
	"time"

	"github.com/SostenibilidadUCC/CelulasDeBosque/backend/internal/auth"
	"github.com/SostenibilidadUCC/CelulasDeBosque/backend/internal/respuestas"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

// Crear células en lote (T20, LUG-07). Solo el administrador. Sirve para el día de la plantación:
// se dan de alta, por ejemplo, de la 1 a la 40 de una vez, en las celdas libres del plano.

// maximoCelulasLote es la grilla más grande posible (30 × 30): un lote no puede ser mayor.
const maximoCelulasLote = maximoFilasColumnas * maximoFilasColumnas

// pedidoLote es el cuerpo de POST /api/admin/isletas/{id}/celulas-lote.
type pedidoLote struct {
	Desde           int    `json:"desde"`
	Hasta           int    `json:"hasta"`
	FechaPlantacion string `json:"fechaPlantacion"` // "2026-11-25"
}

// celulaDeLote es una célula del lote con la celda que le toca.
type celulaDeLote struct {
	Numero  int    `json:"numero"`
	Fila    int    `json:"fila"`
	Columna int    `json:"columna"`
	Codigo  string `json:"codigo"` // "A-1-45"
}

// celda es una posición del plano.
type celda struct{ fila, columna int }

// ubicarLote reparte los números desde..hasta en las celdas libres de la grilla, recorriéndola
// de izquierda a derecha y de arriba abajo (LUG-07). ocupadas son las celdas que ya tienen célula.
// Devuelve nil si no entran todas.
func ubicarLote(desde, hasta, filas, columnas int, ocupadas map[celda]bool) []celdaConNumero {
	var resultado []celdaConNumero
	numero := desde
	for fila := 1; fila <= filas && numero <= hasta; fila++ {
		for columna := 1; columna <= columnas && numero <= hasta; columna++ {
			if ocupadas[celda{fila, columna}] {
				continue
			}
			resultado = append(resultado, celdaConNumero{numero, celda{fila, columna}})
			numero++
		}
	}
	if numero <= hasta {
		return nil
	}
	return resultado
}

// celdaConNumero es un número de célula con la celda que le tocó.
type celdaConNumero struct {
	numero int
	celda
}

// listarNumeros arma "3, 5, 8" con hasta 10 números; si hay más, termina en "…".
func listarNumeros(numeros []int) string {
	partes := make([]string, 0, 11)
	for i, n := range numeros {
		if i == 10 {
			partes = append(partes, "…")
			break
		}
		partes = append(partes, strconv.Itoa(n))
	}
	return strings.Join(partes, ", ")
}

// validarFechaPlantacion lee la fecha del lote ("2026-11-25") y revisa que no sea futura (ALT-04).
// Con RN-06, una célula plantada en el futuro no podría tener registro inicial, porque la fecha de
// medición no puede ser anterior a la plantación ni futura. "Hoy" es en hora de Córdoba.
// Devuelve el mensaje para el usuario si algo está mal.
func validarFechaPlantacion(texto string, ahora time.Time) (time.Time, string) {
	fecha, err := time.Parse("2006-01-02", texto)
	if err != nil {
		return time.Time{}, "Elegí la fecha de plantación"
	}
	if fecha.After(hoyEnCordoba(ahora)) {
		return time.Time{}, "La fecha de plantación no puede ser futura"
	}
	return fecha, ""
}

// CrearCelulasEnLote atiende POST /api/admin/isletas/{id}/celulas-lote (LUG-07).
// Con ?vistaPrevia=true solo calcula dónde iría cada célula y no guarda nada (200); sin eso,
// las crea con sus 4 individuos, todas o ninguna (201). En los dos casos responde
// {"celulas": [{numero, fila, columna, codigo}]}. Va envuelta en RequiereSesion.
func CrearCelulasEnLote(pool *pgxpool.Pool) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		usuario := auth.UsuarioActual(r)
		if !auth.EsAdmin(usuario) {
			respuestas.Error(w, http.StatusForbidden, mensajeSoloAdminLugares)
			return
		}
		id, err := strconv.ParseInt(r.PathValue("id"), 10, 64)
		if err != nil {
			respuestas.Error(w, http.StatusBadRequest, "La isleta no es válida")
			return
		}
		vistaPrevia := r.URL.Query().Get("vistaPrevia") == "true"

		r.Body = http.MaxBytesReader(w, r.Body, 4096)
		var pedido pedidoLote
		if err := json.NewDecoder(r.Body).Decode(&pedido); err != nil {
			respuestas.Error(w, http.StatusBadRequest, "Completá los números y la fecha de plantación")
			return
		}
		if pedido.Desde < 1 || pedido.Hasta < pedido.Desde {
			respuestas.Error(w, http.StatusBadRequest, "El número final tiene que ser mayor o igual al inicial, y los dos mayores que 0")
			return
		}
		cantidad := pedido.Hasta - pedido.Desde + 1
		if cantidad > maximoCelulasLote {
			respuestas.Error(w, http.StatusBadRequest, fmt.Sprintf("Se pueden crear hasta %d células de una vez", maximoCelulasLote))
			return
		}
		fecha, mensaje := validarFechaPlantacion(pedido.FechaPlantacion, time.Now())
		if mensaje != "" {
			respuestas.Error(w, http.StatusBadRequest, mensaje)
			return
		}

		errorInterno := func(que string, err error) {
			log.Printf("admin lote: %s (isleta %d): %v", que, id, err)
			respuestas.Error(w, http.StatusInternalServerError, mensajeErrorLugares)
		}

		// Todo va en una transacción: o se crean todas las células o ninguna. FOR UPDATE OF i bloquea
		// la isleta, así nadie cambia la grilla ni crea otras células mientras se calcula el lote.
		tx, err := pool.Begin(r.Context())
		if err != nil {
			errorInterno("no se pudo empezar la transacción", err)
			return
		}
		defer tx.Rollback(r.Context()) // en la vista previa nunca se hace Commit: no se guarda nada

		var (
			letra                         string
			numeroIsleta, filas, columnas int
		)
		err = tx.QueryRow(r.Context(), `
			SELECT l.letra, i.numero, i.filas, i.columnas
			FROM isletas i JOIN lugares l ON l.id = i.lugar_id
			WHERE i.id = $1 FOR UPDATE OF i`, id).Scan(&letra, &numeroIsleta, &filas, &columnas)
		if errors.Is(err, pgx.ErrNoRows) {
			respuestas.Error(w, http.StatusNotFound, "La isleta no existe")
			return
		}
		if err != nil {
			errorInterno("no se pudo leer la isleta", err)
			return
		}

		// Las células que ya tiene la isleta (también las dadas de baja: su número y su celda
		// siguen ocupados, RN-02).
		filasCelulas, err := tx.Query(r.Context(), `SELECT numero, fila, columna FROM celulas WHERE isleta_id = $1`, id)
		if err != nil {
			errorInterno("no se pudieron leer las células", err)
			return
		}
		ocupadas := map[celda]bool{}
		var repetidos []int
		for filasCelulas.Next() {
			var numero int
			var c celda
			if err := filasCelulas.Scan(&numero, &c.fila, &c.columna); err != nil {
				filasCelulas.Close()
				errorInterno("no se pudo leer una célula", err)
				return
			}
			ocupadas[c] = true
			if numero >= pedido.Desde && numero <= pedido.Hasta {
				repetidos = append(repetidos, numero)
			}
		}
		filasCelulas.Close()
		if err := filasCelulas.Err(); err != nil {
			errorInterno("error al recorrer las células", err)
			return
		}
		if len(repetidos) > 0 {
			slices.Sort(repetidos) // vienen en el orden de la base: se ordenan para el mensaje
			respuestas.Error(w, http.StatusConflict, "Ya existen en esta isleta las células "+listarNumeros(repetidos))
			return
		}

		ubicadas := ubicarLote(pedido.Desde, pedido.Hasta, filas, columnas, ocupadas)
		if ubicadas == nil {
			libres := filas*columnas - len(ocupadas)
			respuestas.Error(w, http.StatusBadRequest,
				fmt.Sprintf("No entran: son %d células y quedan %d celdas libres en el plano", cantidad, libres))
			return
		}

		celulas := make([]celulaDeLote, 0, len(ubicadas))
		for _, u := range ubicadas {
			celulas = append(celulas, celulaDeLote{
				Numero: u.numero, Fila: u.fila, Columna: u.columna,
				Codigo: codigoCelula(letra, numeroIsleta, u.numero),
			})
		}
		if vistaPrevia {
			respuestas.JSON(w, map[string]any{"celulas": celulas})
			return
		}

		for _, u := range ubicadas {
			_, err := crearCelula(r.Context(), tx, celulaNueva{
				IsletaID: id, Numero: u.numero, Fila: u.fila, Columna: u.columna,
				FechaPlantacion: fecha, UsuarioID: usuario.ID,
			})
			if err != nil {
				errorInterno(fmt.Sprintf("no se pudo crear la célula %d", u.numero), err)
				return
			}
		}
		if err := tx.Commit(r.Context()); err != nil {
			errorInterno("no se pudo confirmar", err)
			return
		}
		respuestas.Creado(w, map[string]any{"celulas": celulas})
	}
}
