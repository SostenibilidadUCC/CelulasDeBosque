package handlers

import (
	"context"
	"errors"
	"fmt"
	"log"
	"net/http"
	"strings"
	"time"

	"github.com/SostenibilidadUCC/CelulasDeBosque/backend/internal/respuestas"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/xuri/excelize/v2"
)

// Tabla de datos y Excel (T21, TAB-01, 03 a 05). Una fila por individuo y registro, con los datos
// crudos de cada medición. Los filtros son los de Resultados (leerFiltros de metricas.go) más el
// buscador por código. No entran los registros anulados (RN-12) ni los de lugares deshabilitados.
// A diferencia de Resultados, las células dadas de baja SÍ entran, con lo medido hasta la fecha de baja:
// RN-14 dice que su historial sigue visible, y la tabla son los datos crudos, no una métrica.

// filasPorPagina es el tamaño de cada página de la tabla (TAB-01).
const filasPorPagina = 50

// maximoPaginas es la página más alta que se acepta en ?pagina= (500.000 filas: mucho más de lo
// que va a tener la base). Más arriba se responde 400 en lugar de un error de la base.
const maximoPaginas = 10000

// filaDatos es una fila de la tabla: un individuo en un registro. Los punteros salen null
// cuando no hay dato (por ejemplo, la altura de un individuo muerto, RN-08).
type filaDatos struct {
	CelulaID        int64    `json:"celulaId"`        // para ir a la ficha
	CodigoIndividuo string   `json:"codigoIndividuo"` // "A-1-45-1"
	Lugar           string   `json:"lugar"`
	Isleta          int      `json:"isleta"`
	Celula          int      `json:"celula"`
	FormaDeVida     int      `json:"formaDeVida"`
	NombreForma     string   `json:"nombreForma"`
	Periodo         string   `json:"periodo"`       // "2026-11"
	FechaMedicion   string   `json:"fechaMedicion"` // "2026-11-18"
	EsInicial       bool     `json:"esInicial"`
	FueraDeTermino  bool     `json:"fueraDeTermino"`
	Vivo            *bool    `json:"vivo"`
	AlturaCm        *float64 `json:"alturaCm"`
	Flores          *int     `json:"flores"`
	Frutos          *bool    `json:"frutos"`
	PlantulasNuevas *bool    `json:"plantulasNuevas"` // igual que en registros.go (CLAUDE.md, Variables por individuo)
	CoberturaPct    *float64 `json:"coberturaPct"` // vacía hasta que se responda la pregunta 8 (RN-19)
	Observaciones   *string  `json:"observaciones"`
	CargadoPor      string   `json:"cargadoPor"` // "M. Pérez"
}

// respuestaDatos es lo que devuelve GET /api/datos.
type respuestaDatos struct {
	Filas     []filaDatos `json:"filas"`
	Total     int         `json:"total"` // filas con estos filtros, en todas las páginas
	Pagina    int         `json:"pagina"`
	PorPagina int         `json:"porPagina"`
	// El catálogo de formas de vida, para el filtro (igual que en GET /api/metricas).
	FormasDeVida []formaDeVidaDeMetricas `json:"formasDeVida"`
}

// codigoBuscado es lo que se entendió del buscador. nil quiere decir "sin filtro".
type codigoBuscado struct {
	letra  *string
	isleta *int
	celula *int
	forma  *int
}

// interpretarCodigo entiende el buscador de la tabla (TAB-03). A diferencia del de Células, acá
// la tabla tiene todos los lugares, así que se acepta cualquier parte del código, de izquierda
// a derecha: "45" (la célula 45 de cualquier lugar), "A", "A-1", "A-1-45" o "A-1-45-1" (un individuo).
// Devuelve ok = false si el texto no se entiende: en ese caso la tabla sale vacía.
// Los guiones del final se ignoran: mientras alguien escribe "A-1-" (y frena un segundo, que es
// cuando el buscador busca), se entiende como "A-1" en lugar de vaciar la tabla.
func interpretarCodigo(q string) (b codigoBuscado, ok bool) {
	q = strings.TrimRight(strings.TrimSpace(q), "- ")
	if q == "" {
		return b, true
	}
	if n, esNumero := numeroPositivo(q); esNumero {
		return codigoBuscado{celula: &n}, true
	}

	partes := strings.Split(q, "-")
	if len(partes) > 4 {
		return b, false
	}
	letra := strings.ToUpper(strings.TrimSpace(partes[0]))
	if len(letra) != 1 || letra[0] < 'A' || letra[0] > 'Z' {
		return b, false
	}
	b.letra = &letra
	// Las demás partes son números: isleta, célula y forma de vida (1 a 4), en ese orden.
	destinos := []**int{&b.isleta, &b.celula, &b.forma}
	for i, parte := range partes[1:] {
		n, esNumero := numeroPositivo(strings.TrimSpace(parte))
		if !esNumero {
			return b, false
		}
		*destinos[i] = &n
	}
	if b.forma != nil && *b.forma > 4 {
		return b, false
	}
	return b, true
}

// columnasOrden son las columnas por las que se puede ordenar la tabla (TAB-01), con su expresión SQL.
// Es una lista cerrada: lo que llega en ?orden= se busca acá y nunca se pega en el SQL tal cual.
var columnasOrden = map[string][]string{
	"codigo":     {"l.letra", "i.numero", "c.numero", "f.id"},
	"lugar":      {"l.nombre"},
	"forma":      {"f.id"},
	"periodo":    {"r.periodo"},
	"fecha":      {"r.fecha_medicion"},
	"estado":     {"m.vivo"},
	"altura":     {"m.altura_cm"},
	"flores":     {"m.flores"},
	"frutos":     {"m.frutos"},
	"plantulas":  {"m.plantulas"},
	"cargadoPor": {"u.nombre"},
}

// ordenSQL arma el ORDER BY a partir de ?orden=altura&dir=desc. Por defecto, lo más reciente primero.
// Al final siempre se desempata por código y período, así el orden de las páginas no cambia
// entre un pedido y otro. NULLS LAST: las celdas vacías van al final en los dos sentidos.
func ordenSQL(orden, dir string) (string, bool) {
	if orden == "" {
		orden, dir = "periodo", "desc"
	}
	columnas, existe := columnasOrden[orden]
	if !existe || (dir != "" && dir != "asc" && dir != "desc") {
		return "", false
	}
	sentido := " ASC NULLS LAST"
	if dir == "desc" {
		sentido = " DESC NULLS LAST"
	}
	partes := make([]string, 0, len(columnas)+5)
	for _, columna := range columnas {
		partes = append(partes, columna+sentido)
	}
	partes = append(partes, "l.letra", "i.numero", "c.numero", "r.periodo", "f.id")
	return strings.Join(partes, ", "), true
}

// consultaDatos es la consulta de la tabla y del Excel. Las mediciones de cada individuo se pasan
// a columnas con el mismo FILTER de ficha.go y metricas.go. count(*) OVER () cuenta todas las
// filas que cumplen los filtros, sin importar el LIMIT: es el total para la paginación.
// "%s" es el ORDER BY, que sale de columnasOrden (nunca de lo que escribe el usuario).
// Con $10 en NULL, "LIMIT NULL" no limita: así la usa el Excel, que lleva todas las filas.
const consultaDatos = `
	SELECT c.id, l.letra, l.nombre, i.numero, c.numero, f.id, f.nombre,
	       to_char(r.periodo, 'YYYY-MM'), to_char(r.fecha_medicion, 'YYYY-MM-DD'),
	       r.es_inicial, r.fuera_de_termino,
	       m.vivo, m.altura_cm::float8, m.flores::int, m.frutos, m.plantulas,
	       r.cobertura::float8, r.observaciones, u.nombre,
	       count(*) OVER ()
	FROM registros r
	JOIN celulas c ON c.id = r.celula_id
	JOIN isletas i ON i.id = c.isleta_id
	JOIN lugares l ON l.id = i.lugar_id
	JOIN individuos ind ON ind.celula_id = c.id
	JOIN formas_de_vida f ON f.id = ind.forma_de_vida_id
	JOIN usuarios u ON u.id = r.creado_por
	CROSS JOIN LATERAL (
		SELECT max(md.valor_numerico) FILTER (WHERE v.codigo = 'vivo') = 1             AS vivo,
		       max(md.valor_numerico) FILTER (WHERE v.codigo = 'altura_cm')            AS altura_cm,
		       max(md.valor_numerico) FILTER (WHERE v.codigo = 'flores')               AS flores,
		       max(md.valor_numerico) FILTER (WHERE v.codigo = 'frutos') = 1           AS frutos,
		       max(md.valor_numerico) FILTER (WHERE v.codigo = 'plantulas_nuevas') = 1 AS plantulas
		FROM mediciones md
		JOIN variables v ON v.id = md.variable_id
		WHERE md.registro_id = r.id AND md.individuo_id = ind.id
	) m
	WHERE NOT r.anulado AND l.activo
	  AND (c.estado = 'activa' OR r.fecha_medicion <= c.fecha_baja) -- RN-14: el historial de una dada de baja se ve
	  AND ($1::bigint IS NULL OR l.id = $1)
	  AND ($2::bigint IS NULL OR i.id = $2)
	  AND ($3::date IS NULL OR r.periodo >= $3)
	  AND r.periodo <= $4::date
	  AND ($5::smallint IS NULL OR f.id = $5)
	  AND ($6::text IS NULL OR l.letra = $6)
	  AND ($7::int IS NULL OR i.numero = $7)
	  AND ($8::int IS NULL OR c.numero = $8)
	  AND ($9::smallint IS NULL OR f.id = $9)
	ORDER BY %s
	LIMIT $10 OFFSET $11`

// abreviarNombre deja el nombre como en la sección 11.1: "Magdalena Gómez" → "M. Gómez".
// Con una sola palabra la deja igual.
func abreviarNombre(nombre string) string {
	palabras := strings.Fields(nombre)
	if len(palabras) < 2 {
		return nombre
	}
	inicial := []rune(palabras[0])[0] // runa y no byte: así anda con "Ángela"
	return fmt.Sprintf("%c. %s", inicial, palabras[len(palabras)-1])
}

// buscarDatos corre la consulta. limite nil = todas las filas (para el Excel).
func buscarDatos(ctx context.Context, pool *pgxpool.Pool, f FiltrosMetricas, b codigoBuscado,
	orden string, limite *int, desplazamiento int) ([]filaDatos, int, error) {

	filas, err := pool.Query(ctx, fmt.Sprintf(consultaDatos, orden),
		f.LugarID, f.IsletaID, f.Desde, f.Hasta, f.Forma,
		b.letra, b.isleta, b.celula, b.forma,
		limite, desplazamiento)
	if err != nil {
		return nil, 0, err
	}
	total := 0
	resultado, err := pgx.CollectRows(filas, func(fila pgx.CollectableRow) (filaDatos, error) {
		var d filaDatos
		var letra string
		err := fila.Scan(&d.CelulaID, &letra, &d.Lugar, &d.Isleta, &d.Celula, &d.FormaDeVida, &d.NombreForma,
			&d.Periodo, &d.FechaMedicion, &d.EsInicial, &d.FueraDeTermino,
			&d.Vivo, &d.AlturaCm, &d.Flores, &d.Frutos, &d.PlantulasNuevas,
			&d.CoberturaPct, &d.Observaciones, &d.CargadoPor, &total)
		d.CodigoIndividuo = fmt.Sprintf("%s-%d-%d-%d", letra, d.Isleta, d.Celula, d.FormaDeVida)
		d.CargadoPor = abreviarNombre(d.CargadoPor)
		return d, err
	})
	return resultado, total, err
}

// leerPedidoDatos junta lo que comparten la tabla y el Excel: los filtros de Resultados,
// el buscador y el orden. Si algo está mal, devuelve el mensaje para el usuario.
// codigoOk = false quiere decir que el buscador no se entendió: la respuesta va vacía.
func leerPedidoDatos(r *http.Request) (f FiltrosMetricas, b codigoBuscado, orden string, codigoOk bool, mensaje string) {
	f, mensaje = leerFiltros(r, time.Now())
	if mensaje != "" {
		return
	}
	q := r.URL.Query()
	var ok bool
	if orden, ok = ordenSQL(q.Get("orden"), q.Get("dir")); !ok {
		mensaje = "El orden no es válido"
		return
	}
	b, codigoOk = interpretarCodigo(q.Get("q"))
	return
}

// Datos atiende GET /api/datos (TAB-01 y 03): la tabla paginada, de a 50 filas.
// ?pagina=2 pide la segunda página. Lo ven todos los roles con sesión. Va envuelta en RequiereSesion.
func Datos(pool *pgxpool.Pool) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		filtros, b, orden, codigoOk, mensaje := leerPedidoDatos(r)
		if mensaje != "" {
			respuestas.Error(w, http.StatusBadRequest, mensaje)
			return
		}
		pagina := 1
		if texto := r.URL.Query().Get("pagina"); texto != "" {
			// Con un número gigante, (pagina - 1) × 50 se pasa del máximo de un entero y la base da error.
			n, esNumero := numeroPositivo(texto)
			if !esNumero || n > maximoPaginas {
				respuestas.Error(w, http.StatusBadRequest, "La página no es válida")
				return
			}
			pagina = n
		}

		errorInterno := func(que string, err error) {
			log.Printf("datos: %s: %v", que, err)
			respuestas.Error(w, http.StatusInternalServerError, "No se pudieron cargar los datos. Probá de nuevo.")
		}

		respuesta := respuestaDatos{Filas: []filaDatos{}, Pagina: pagina, PorPagina: filasPorPagina}
		var err error
		if respuesta.FormasDeVida, err = leerFormasDeVida(r.Context(), pool); err != nil {
			errorInterno("no se pudieron leer las formas de vida", err)
			return
		}
		if !codigoOk { // si el buscador no se entendió, la tabla va vacía
			respuestas.JSON(w, respuesta)
			return
		}

		// leerPagina pide una página. El total viene en cada fila (count(*) OVER ()).
		leerPagina := func(n, limite int) ([]filaDatos, int, error) {
			return buscarDatos(r.Context(), pool, filtros, b, orden, &limite, (n-1)*filasPorPagina)
		}
		respuesta.Filas, respuesta.Total, err = leerPagina(pagina, filasPorPagina)
		if err != nil {
			errorInterno("no se pudieron leer", err)
			return
		}
		// Si la página quedó vacía pero no es la primera (por ejemplo, se anularon registros mientras
		// alguien miraba la última), no se sabe el total: se cuenta con una fila de la primera página
		// y se responde la última página que existe, así la tabla no aparece vacía sin forma de volver.
		if len(respuesta.Filas) == 0 && pagina > 1 {
			if _, respuesta.Total, err = leerPagina(1, 1); err != nil {
				errorInterno("no se pudo contar", err)
				return
			}
			if respuesta.Total > 0 {
				respuesta.Pagina = (respuesta.Total-1)/filasPorPagina + 1
				if respuesta.Filas, respuesta.Total, err = leerPagina(respuesta.Pagina, filasPorPagina); err != nil {
					errorInterno("no se pudieron leer", err)
					return
				}
			}
		}
		respuestas.JSON(w, respuesta)
	}
}

// columnasExcel son los títulos de las columnas, en el orden de la sección 11.1 de la v6.
var columnasExcel = []string{
	"codigo_individuo", "lugar", "isleta", "celula", "forma_de_vida", "periodo", "fecha_medicion",
	"es_inicial", "fuera_de_termino", "estado", "altura_cm", "cantidad_flores", "presencia_frutos",
	"nuevas_plantulas", "cobertura_pct", "observaciones", "cargado_por",
}

// siNo pasa un booleano a "Sí"/"No". nil queda vacío (RN-08: el individuo muerto no tiene datos).
func siNo(valor *bool) any {
	if valor == nil {
		return nil
	}
	if *valor {
		return "Sí"
	}
	return "No"
}

// valorDe saca el valor de un puntero, o nil (celda vacía) si no hay dato.
func valorDe[T any](p *T) any {
	if p == nil {
		return nil
	}
	return *p
}

// filaExcel arma una fila de la planilla. Los números van como números (no como texto):
// así Excel los muestra con la coma decimal de la compu y se puede sumar o promediar.
func filaExcel(d filaDatos) []any {
	estado := any(nil)
	if d.Vivo != nil {
		estado = map[bool]string{true: "Vivo", false: "Muerto"}[*d.Vivo]
	}
	// "2026-11-18" → "18/11/2026" (formato de fechas en tablas, frontend/CLAUDE.md).
	fecha := d.FechaMedicion
	if t, err := time.Parse("2006-01-02", d.FechaMedicion); err == nil {
		fecha = t.Format("02/01/2006")
	}
	inicial, fueraDeTermino := d.EsInicial, d.FueraDeTermino
	return []any{
		d.CodigoIndividuo, d.Lugar, d.Isleta, d.Celula, d.NombreForma, d.Periodo, fecha,
		siNo(&inicial), siNo(&fueraDeTermino), estado,
		valorDe(d.AlturaCm), valorDe(d.Flores), siNo(d.Frutos), siNo(d.PlantulasNuevas),
		valorDe(d.CoberturaPct), valorDe(d.Observaciones), d.CargadoPor,
	}
}

// nombreArchivoExcel arma "celulas_[lugar]_[desde]_[hasta].xlsx" (sección 11.1): el lugar es su
// letra, o "todos". Sin "desde" (desde la plantación), se usa el primer período que tienen los datos.
func nombreArchivoExcel(f FiltrosMetricas, letraLugar string, filas []filaDatos) string {
	if letraLugar == "" {
		letraLugar = "todos"
	}
	hasta := f.Hasta.Format("2006-01")
	desde := hasta
	if f.Desde != nil {
		desde = f.Desde.Format("2006-01")
	} else {
		for _, d := range filas {
			if d.Periodo < desde { // "2026-08" < "2026-11": los períodos se comparan bien como texto
				desde = d.Periodo
			}
		}
	}
	return fmt.Sprintf("celulas_%s_%s_%s.xlsx", letraLugar, desde, hasta)
}

// DatosExcel atiende GET /api/datos/excel (TAB-05): las mismas filas de la tabla, sin paginar,
// en un Excel con el formato de la sección 11.1. Va envuelta en RequiereSesion.
func DatosExcel(pool *pgxpool.Pool) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		filtros, b, orden, codigoOk, mensaje := leerPedidoDatos(r)
		if mensaje != "" {
			respuestas.Error(w, http.StatusBadRequest, mensaje)
			return
		}
		errorInterno := func(que string, err error) {
			log.Printf("datos excel: %s: %v", que, err)
			respuestas.Error(w, http.StatusInternalServerError, "No se pudo armar el Excel. Probá de nuevo.")
		}

		filas := []filaDatos{}
		if codigoOk {
			var err error
			if filas, _, err = buscarDatos(r.Context(), pool, filtros, b, orden, nil, 0); err != nil {
				errorInterno("no se pudieron leer los datos", err)
				return
			}
		}
		// La letra del lugar filtrado, para el nombre del archivo.
		letraLugar := ""
		if filtros.LugarID != nil {
			err := pool.QueryRow(r.Context(), `SELECT letra FROM lugares WHERE id = $1`, *filtros.LugarID).Scan(&letraLugar)
			if err != nil && !errors.Is(err, pgx.ErrNoRows) {
				errorInterno("no se pudo leer el lugar", err)
				return
			}
		}

		libro := excelize.NewFile()
		defer libro.Close()
		const hoja = "Sheet1" // la hoja que trae un libro nuevo; se renombra abajo
		escritor, err := libro.NewStreamWriter(hoja)
		if err != nil {
			errorInterno("no se pudo crear la hoja", err)
			return
		}
		// Títulos en negrita y la primera fila fija al bajar.
		negrita, err := libro.NewStyle(&excelize.Style{Font: &excelize.Font{Bold: true}})
		if err != nil {
			errorInterno("no se pudo crear el estilo", err)
			return
		}
		if err := escritor.SetPanes(&excelize.Panes{Freeze: true, YSplit: 1, TopLeftCell: "A2", ActivePane: "bottomLeft"}); err != nil {
			errorInterno("no se pudo fijar la primera fila", err)
			return
		}
		titulos := make([]any, len(columnasExcel))
		for i, titulo := range columnasExcel {
			titulos[i] = excelize.Cell{StyleID: negrita, Value: titulo}
		}
		if err := escritor.SetRow("A1", titulos); err != nil {
			errorInterno("no se pudieron escribir los títulos", err)
			return
		}
		for i, d := range filas {
			celda, _ := excelize.CoordinatesToCellName(1, i+2) // fila 2 en adelante: la 1 son los títulos
			if err := escritor.SetRow(celda, filaExcel(d)); err != nil {
				errorInterno("no se pudo escribir una fila", err)
				return
			}
		}
		if err := escritor.Flush(); err != nil {
			errorInterno("no se pudo cerrar la hoja", err)
			return
		}
		if err := libro.SetSheetName(hoja, "Datos"); err != nil {
			errorInterno("no se pudo nombrar la hoja", err)
			return
		}

		w.Header().Set("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
		w.Header().Set("Content-Disposition", `attachment; filename="`+nombreArchivoExcel(filtros, letraLugar, filas)+`"`)
		if err := libro.Write(w); err != nil {
			// Ya se mandaron los encabezados: no se puede responder un error, solo anotarlo.
			log.Printf("datos excel: no se pudo enviar el archivo: %v", err)
		}
	}
}
