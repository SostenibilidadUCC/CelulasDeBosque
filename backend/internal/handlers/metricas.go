package handlers

import (
	"context"
	"log"
	"math"
	"net/http"
	"strconv"
	"time"

	"github.com/SostenibilidadUCC/CelulasDeBosque/backend/internal/estados"
	"github.com/SostenibilidadUCC/CelulasDeBosque/backend/internal/respuestas"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

// ---------- PARTE A: tipos ----------

// FiltrosMetricas son los filtros de GET /api/metricas (RES-01). Un puntero nil quiere decir
// "sin ese filtro". Es pública (con mayúscula) porque la va a usar la página pública (T22).
type FiltrosMetricas struct {
	LugarID  *int64
	IsletaID *int64
	Desde    *time.Time // primer día del mes; nil = desde la plantación
	Hasta    time.Time  // primer día del mes; por defecto, el mes actual
	Forma    *int       // forma de vida, 1 a 4
}

// formaDeVidaDeMetricas es una forma de vida del catálogo, para que el front muestre los nombres
// en los filtros y en las leyendas sin escribirlos a mano.
type formaDeVidaDeMetricas struct {
	FormaDeVida int    `json:"formaDeVida"`
	Nombre      string `json:"nombre"`
	Icono       string `json:"icono"`
}

// supervivenciaDeForma es una barra del gráfico de supervivencia por forma de vida (RES-03).
type supervivenciaDeForma struct {
	FormaDeVida int      `json:"formaDeVida"`
	Nombre      string   `json:"nombre"`
	Icono       string   `json:"icono"`
	Individuos  int      `json:"individuos"` // con al menos un registro
	Tasa        *float64 `json:"tasa"`       // % de vivos en su último registro
}

// mesDeEvolucion es un punto de los gráficos de evolución (RES-04 y RES-05).
type mesDeEvolucion struct {
	Periodo        string          `json:"periodo"`        // "2026-10"
	Supervivencia  *float64        `json:"supervivencia"`  // % de vivos en los registros de ese mes
	AlturaPromedio map[int]float64 `json:"alturaPromedio"` // por forma de vida: {"1": 85.5, "2": 60.1}
}

// Metricas es lo que devuelve GET /api/metricas. Las fórmulas son las de la sección 7 del v5.
// Los porcentajes y promedios son punteros: si no hay datos para calcularlos, salen null
// (así el front muestra "sin datos" en vez de un 0 que no es cierto).
type Metricas struct {
	CelulasPlantadas      int                     `json:"celulasPlantadas"`
	IndividuosConRegistro int                     `json:"individuosConRegistro"`
	TasaSupervivencia     *float64                `json:"tasaSupervivencia"`
	CrecimientoPromedioCm *float64                `json:"crecimientoPromedioCm"`
	IndividuosEnFloracion *float64                `json:"individuosEnFloracion"`
	IndividuosConFrutos   *float64                `json:"individuosConFrutos"`
	CelulasConPlantulas   *float64                `json:"celulasConPlantulas"`
	SupervivenciaPorForma []supervivenciaDeForma  `json:"supervivenciaPorForma"`
	Evolucion             []mesDeEvolucion        `json:"evolucion"`
	FormasDeVida          []formaDeVidaDeMetricas `json:"formasDeVida"` // siempre las 4, de 1 a 4
}

// ---------- PARTE B: ayudas ----------

// redondear deja un número con un decimal: 88.888 → 88.9.
func redondear(x float64) float64 {
	return math.Round(x*10) / 10
}

// porcentaje devuelve parte ÷ total × 100 con un decimal, o nil si total es 0 (no se divide por cero).
func porcentaje(parte, total int) *float64 {
	if total == 0 {
		return nil
	}
	p := redondear(float64(parte) * 100 / float64(total))
	return &p
}

// leerFiltros arma los filtros desde la URL: ?lugar=1&isleta=2&desde=2026-08&hasta=2026-10&forma=1.
// Todos son opcionales. Si alguno está mal, devuelve el mensaje de error para el usuario.
// ahora se recibe como parámetro (y no se usa time.Now() adentro) para poder testearla.
func leerFiltros(r *http.Request, ahora time.Time) (FiltrosMetricas, string) {
	q := r.URL.Query()
	f := FiltrosMetricas{Hasta: estados.PeriodoActual(ahora)}

	// numero lee un parámetro entero opcional. Devuelve nil si no vino.
	numero := func(nombre string) (*int64, bool) {
		texto := q.Get(nombre)
		if texto == "" {
			return nil, true
		}
		n, err := strconv.ParseInt(texto, 10, 64)
		return &n, err == nil && n > 0
	}
	// mes lee un parámetro "2026-10" opcional y devuelve el primer día de ese mes.
	mes := func(nombre string) (*time.Time, bool) {
		texto := q.Get(nombre)
		if texto == "" {
			return nil, true
		}
		t, err := time.Parse("2006-01", texto)
		return &t, err == nil
	}

	var ok bool
	if f.LugarID, ok = numero("lugar"); !ok {
		return f, "El lugar no es válido"
	}
	if f.IsletaID, ok = numero("isleta"); !ok {
		return f, "La isleta no es válida"
	}
	forma, ok := numero("forma")
	if !ok || (forma != nil && *forma > 4) {
		return f, "La forma de vida no es válida"
	}
	if forma != nil {
		n := int(*forma)
		f.Forma = &n
	}
	if f.Desde, ok = mes("desde"); !ok {
		return f, "El período desde no es válido (tiene que ser como 2026-10)"
	}
	hasta, ok := mes("hasta")
	if !ok {
		return f, "El período hasta no es válido (tiene que ser como 2026-10)"
	}
	if hasta != nil {
		f.Hasta = *hasta
	}
	if f.Desde != nil && f.Desde.After(f.Hasta) {
		return f, "El período desde no puede ser posterior al período hasta"
	}
	return f, ""
}

// ---------- PARTE C: las consultas ----------

// cteBase es el comienzo que comparten las tres consultas de individuos. WITH arma "tablas
// temporales" con nombre, que se pueden usar en el SELECT de abajo como si fueran tablas:
//   - registros_filtrados: los registros que cumplen los filtros. Sin anulados (RN-12), sin
//     células dadas de baja y sin lugares deshabilitados (sección 7).
//     "$1::bigint IS NULL OR l.id = $1" quiere decir: si no vino el filtro, pasan todos.
//   - valores: una fila por individuo en cada registro, con sus mediciones como columnas
//     (el mismo FILTER de ficha.go). Acá se aplica el filtro de forma de vida.
//   - ultimos: el último registro de cada célula dentro del período filtrado.
//     DISTINCT ON (celula_id) se queda con la primera fila de cada célula según el ORDER BY:
//     como ordena por período de mayor a menor, la primera es la más reciente.
//
// Se arma pegando textos fijos (constantes), nunca datos del usuario: los datos van como $1…$5.
const cteBase = `
	WITH registros_filtrados AS (
		SELECT r.id, r.celula_id, r.periodo
		FROM registros r
		JOIN celulas c ON c.id = r.celula_id
		JOIN isletas i ON i.id = c.isleta_id
		JOIN lugares l ON l.id = i.lugar_id
		WHERE NOT r.anulado AND c.estado = 'activa' AND l.activo
		  AND ($1::bigint IS NULL OR l.id = $1)
		  AND ($2::bigint IS NULL OR i.id = $2)
		  AND ($3::date IS NULL OR r.periodo >= $3)
		  AND r.periodo <= $4::date
	),
	valores AS (
		SELECT rf.id AS registro_id, rf.celula_id, rf.periodo,
		       ind.id AS individuo_id, ind.forma_de_vida_id AS forma,
		       m.vivo, m.altura_cm, m.flores, m.frutos, m.plantulas
		FROM registros_filtrados rf
		JOIN individuos ind ON ind.celula_id = rf.celula_id
		CROSS JOIN LATERAL (
			SELECT max(md.valor_numerico) FILTER (WHERE v.codigo = 'vivo') = 1             AS vivo,
			       max(md.valor_numerico) FILTER (WHERE v.codigo = 'altura_cm')            AS altura_cm,
			       max(md.valor_numerico) FILTER (WHERE v.codigo = 'flores')               AS flores,
			       max(md.valor_numerico) FILTER (WHERE v.codigo = 'frutos') = 1           AS frutos,
			       max(md.valor_numerico) FILTER (WHERE v.codigo = 'plantulas_nuevas') = 1 AS plantulas
			FROM mediciones md
			JOIN variables v ON v.id = md.variable_id
			WHERE md.registro_id = rf.id AND md.individuo_id = ind.id
		) m
		WHERE ($5::smallint IS NULL OR ind.forma_de_vida_id = $5)
	),
	ultimos AS (
		SELECT DISTINCT ON (celula_id) id
		FROM registros_filtrados
		ORDER BY celula_id, periodo DESC
	)`

// consultaResumen calcula las métricas principales con el último registro de cada célula.
// "count(*) FILTER (WHERE ...)" cuenta solo las filas que cumplen la condición.
// El LATERAL "ini" busca la altura del individuo en el registro inicial de su célula, para el
// crecimiento (último - inicial). Si no la encuentra, la resta da NULL y avg la ignora.
const consultaResumen = cteBase + `
	SELECT count(*),
	       count(*) FILTER (WHERE v.vivo),
	       (avg(v.altura_cm - ini.altura_cm) FILTER (WHERE v.vivo))::float8,
	       count(*) FILTER (WHERE v.vivo AND v.flores >= 1),
	       count(*) FILTER (WHERE v.vivo AND v.frutos),
	       count(DISTINCT v.celula_id) FILTER (WHERE v.vivo AND v.plantulas)
	FROM valores v
	JOIN ultimos u ON u.id = v.registro_id
	LEFT JOIN LATERAL (
		SELECT md.valor_numerico AS altura_cm
		FROM registros ri
		JOIN mediciones md ON md.registro_id = ri.id
		JOIN variables va ON va.id = md.variable_id
		WHERE ri.celula_id = v.celula_id AND ri.es_inicial AND NOT ri.anulado
		  AND md.individuo_id = v.individuo_id AND va.codigo = 'altura_cm'
	) ini ON true`

// consultaPorForma es la misma supervivencia, pero separada por forma de vida (RES-03).
const consultaPorForma = cteBase + `
	SELECT f.id, f.nombre, f.icono, count(*), count(*) FILTER (WHERE v.vivo)
	FROM valores v
	JOIN ultimos u ON u.id = v.registro_id
	JOIN formas_de_vida f ON f.id = v.forma
	GROUP BY f.id
	ORDER BY f.id`

// consultaEvolucion junta cada mes y cada forma de vida, con TODOS los registros del período
// (no solo el último): de acá salen la supervivencia por mes y la altura promedio por mes.
const consultaEvolucion = cteBase + `
	SELECT to_char(v.periodo, 'YYYY-MM'), v.forma, count(*), count(*) FILTER (WHERE v.vivo),
	       (avg(v.altura_cm) FILTER (WHERE v.vivo))::float8
	FROM valores v
	GROUP BY v.periodo, v.forma
	ORDER BY v.periodo, v.forma`

// consultaCelulasPlantadas cuenta las células activas del lugar o la isleta. No usa el período
// ni la forma de vida: son células, y el número no tiene que bajar al elegir "mes actual".
const consultaCelulasPlantadas = `
	SELECT count(*)
	FROM celulas c
	JOIN isletas i ON i.id = c.isleta_id
	JOIN lugares l ON l.id = i.lugar_id
	WHERE c.estado = 'activa' AND l.activo
	  AND ($1::bigint IS NULL OR l.id = $1)
	  AND ($2::bigint IS NULL OR i.id = $2)`

// ---------- PARTE D: el cálculo ----------

// CalcularMetricas hace las cuatro consultas y arma el resultado. Está separada del handler
// para que la página pública (T22) la use con sus propios filtros.
func CalcularMetricas(ctx context.Context, pool *pgxpool.Pool, f FiltrosMetricas) (Metricas, error) {
	var m Metricas
	// Los mismos 5 parámetros para las tres consultas de individuos.
	parametros := []any{f.LugarID, f.IsletaID, f.Desde, f.Hasta, f.Forma}

	// 1. Células plantadas.
	if err := pool.QueryRow(ctx, consultaCelulasPlantadas, f.LugarID, f.IsletaID).Scan(&m.CelulasPlantadas); err != nil {
		return m, err
	}

	// 2. Métricas principales.
	var vivos, enFloracion, conFrutos, celulasConPlantulas int
	var crecimiento *float64
	err := pool.QueryRow(ctx, consultaResumen, parametros...).
		Scan(&m.IndividuosConRegistro, &vivos, &crecimiento, &enFloracion, &conFrutos, &celulasConPlantulas)
	if err != nil {
		return m, err
	}
	m.TasaSupervivencia = porcentaje(vivos, m.IndividuosConRegistro)
	if crecimiento != nil {
		c := redondear(*crecimiento)
		m.CrecimientoPromedioCm = &c
	}
	m.IndividuosEnFloracion = porcentaje(enFloracion, vivos)
	m.IndividuosConFrutos = porcentaje(conFrutos, vivos)
	m.CelulasConPlantulas = porcentaje(celulasConPlantulas, m.CelulasPlantadas)

	// 3. Supervivencia por forma de vida.
	filas, err := pool.Query(ctx, consultaPorForma, parametros...)
	if err != nil {
		return m, err
	}
	defer filas.Close()
	m.SupervivenciaPorForma = []supervivenciaDeForma{}
	for filas.Next() {
		var s supervivenciaDeForma
		var vivosForma int
		if err := filas.Scan(&s.FormaDeVida, &s.Nombre, &s.Icono, &s.Individuos, &vivosForma); err != nil {
			return m, err
		}
		s.Tasa = porcentaje(vivosForma, s.Individuos)
		m.SupervivenciaPorForma = append(m.SupervivenciaPorForma, s)
	}
	if err := filas.Err(); err != nil {
		return m, err
	}

	// 4. Evolución por mes. Llega una fila por mes y forma de vida, y acá se juntan por mes:
	// la supervivencia del mes suma todas las formas; la altura queda separada por forma.
	filas, err = pool.Query(ctx, consultaEvolucion, parametros...)
	if err != nil {
		return m, err
	}
	defer filas.Close()
	m.Evolucion = []mesDeEvolucion{}
	var individuosMes, vivosMes int
	for filas.Next() {
		var (
			periodo            string
			forma, total, vivo int
			altura             *float64
		)
		if err := filas.Scan(&periodo, &forma, &total, &vivo, &altura); err != nil {
			return m, err
		}
		// Si cambió el mes, se empieza un punto nuevo.
		if len(m.Evolucion) == 0 || m.Evolucion[len(m.Evolucion)-1].Periodo != periodo {
			m.Evolucion = append(m.Evolucion, mesDeEvolucion{Periodo: periodo, AlturaPromedio: map[int]float64{}})
			individuosMes, vivosMes = 0, 0
		}
		mes := &m.Evolucion[len(m.Evolucion)-1]
		individuosMes += total
		vivosMes += vivo
		mes.Supervivencia = porcentaje(vivosMes, individuosMes)
		if altura != nil { // si todos los de esa forma están muertos, no hay altura ese mes
			mes.AlturaPromedio[forma] = redondear(*altura)
		}
	}
	if err := filas.Err(); err != nil {
		return m, err
	}

	// 5. El catálogo de formas de vida, en orden de 1 a 4.
	filas, err = pool.Query(ctx, `SELECT id, nombre, icono FROM formas_de_vida ORDER BY id`)
	if err != nil {
		return m, err
	}
	m.FormasDeVida, err = pgx.CollectRows(filas, func(f pgx.CollectableRow) (formaDeVidaDeMetricas, error) {
		var forma formaDeVidaDeMetricas
		err := f.Scan(&forma.FormaDeVida, &forma.Nombre, &forma.Icono)
		return forma, err
	})
	return m, err
}

// ---------- PARTE E: el handler ----------

// ObtenerMetricas atiende GET /api/metricas (T18, RES-01 a 05 y 07). Va envuelta en RequiereSesion:
// cualquier rol con sesión ve las métricas de todos los lugares.
func ObtenerMetricas(pool *pgxpool.Pool) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		filtros, mensaje := leerFiltros(r, time.Now())
		if mensaje != "" {
			respuestas.Error(w, http.StatusBadRequest, mensaje)
			return
		}

		metricas, err := CalcularMetricas(r.Context(), pool, filtros)
		if err != nil {
			log.Printf("metricas: no se pudieron calcular: %v", err)
			respuestas.Error(w, http.StatusInternalServerError, "No se pudieron calcular los resultados. Probá de nuevo.")
			return
		}
		respuestas.JSON(w, metricas)
	}
}
