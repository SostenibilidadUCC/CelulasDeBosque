package handlers

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"log"
	"net/http"
	"strconv"
	"time"

	"github.com/SostenibilidadUCC/CelulasDeBosque/backend/internal/auth"
	"github.com/SostenibilidadUCC/CelulasDeBosque/backend/internal/estados"
	"github.com/SostenibilidadUCC/CelulasDeBosque/backend/internal/respuestas"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgxpool"
)

// formatoFecha es cómo viaja una fecha en el JSON: "2026-11-18".
const formatoFecha = "2006-01-02"

// mensajeErrorRegistro es lo que ve la persona cuando falla algo nuestro (500).
const mensajeErrorRegistro = "No se pudo guardar el registro. Probá de nuevo en unos minutos."

// pedidoIndividuo es uno de los 4 individuos del pedido.
// Los campos son punteros para distinguir "no vino" (nil) de "vino con 0 o false".
type pedidoIndividuo struct {
	FormaDeVida     int16 `json:"formaDeVida"` // 1 Árbol, 2 Arbusto, 3 Herbácea, 4 Rastrera
	Vivo            *bool `json:"vivo"`
	AlturaCm        *int  `json:"alturaCm"`
	Flores          *int  `json:"flores"`
	Frutos          *bool `json:"frutos"`
	PlantulasNuevas *bool `json:"plantulasNuevas"`
}

// pedidoRegistro es el cuerpo de POST /api/celulas/{id}/registros y de PUT /api/registros/{id}.
// Si el front manda campos que no conocemos (por ejemplo "polinizadores", a confirmar con la
// clienta), Go los ignora: no se guardan.
type pedidoRegistro struct {
	Fecha         string            `json:"fecha"` // "2026-11-18"
	FotoID        int64             `json:"fotoId"`
	Observaciones *string           `json:"observaciones"`
	Individuos    []pedidoIndividuo `json:"individuos"`
}

// celulaParaRegistro son los datos de la célula que hacen falta para cargarle un registro.
type celulaParaRegistro struct {
	lugarID         int64
	fechaPlantacion time.Time
	dadaDeBaja      bool
}

// catalogo es lo que se lee de la tabla variables: los ids (para no escribirlos fijos en el
// código) y los rangos de altura y flores.
type catalogo struct {
	ids    map[string]int64 // código de la variable -> id
	rangos rangosMedicion
}

// codigosVariables son las variables por individuo que guarda cada registro.
var codigosVariables = []string{"vivo", "altura_cm", "flores", "frutos", "plantulas_nuevas"}

// rangosMedicion son los límites de las variables numéricas, tal como están en el catálogo.
type rangosMedicion struct {
	AlturaMin, AlturaMax int
	FloresMin, FloresMax int
}

// hoyEnCordoba devuelve la fecha de hoy en hora de Córdoba (a las 00:00 UTC, para comparar
// solo días). El servidor corre en UTC: sin esto, a la noche "hoy" ya sería mañana.
func hoyEnCordoba(ahora time.Time) time.Time {
	local := ahora.In(estados.PeriodoActual(ahora).Location())
	return time.Date(local.Year(), local.Month(), local.Day(), 0, 0, 0, 0, time.UTC)
}

// primerDiaDelMes devuelve el día 1 del mes de la fecha: eso es el período (RN-04).
func primerDiaDelMes(fecha time.Time) time.Time {
	return time.Date(fecha.Year(), fecha.Month(), 1, 0, 0, 0, 0, time.UTC)
}

// leerPedidoRegistro lee y decodifica el JSON del pedido. Si no se puede, ya responde 400.
func leerPedidoRegistro(w http.ResponseWriter, r *http.Request) (pedidoRegistro, bool) {
	// Un registro real pesa pocos bytes: se corta en 64 KB.
	r.Body = http.MaxBytesReader(w, r.Body, 64*1024)
	var pedido pedidoRegistro
	if err := json.NewDecoder(r.Body).Decode(&pedido); err != nil {
		respuestas.Error(w, http.StatusBadRequest, "Los datos del registro no son válidos")
		return pedido, false
	}
	return pedido, true
}

// consultador lo cumplen tanto el pool como una transacción: así la misma función sirve para los dos.
type consultador interface {
	Query(ctx context.Context, sql string, args ...any) (pgx.Rows, error)
}

// cargarCatalogo lee las variables por individuo y sus rangos.
func cargarCatalogo(ctx context.Context, q consultador) (catalogo, error) {
	cat := catalogo{ids: map[string]int64{}}
	// minimo y maximo son "numeric" en la base; ::float8 los pasa a decimal para que Go los lea fácil.
	filas, err := q.Query(ctx,
		`SELECT codigo, id, minimo::float8, maximo::float8 FROM variables WHERE codigo = ANY($1)`,
		codigosVariables)
	if err != nil {
		return cat, err
	}
	defer filas.Close()
	limites := map[string][2]*float64{}
	for filas.Next() {
		var (
			codigo         string
			id             int64
			minimo, maximo *float64
		)
		if err := filas.Scan(&codigo, &id, &minimo, &maximo); err != nil {
			return cat, err
		}
		cat.ids[codigo] = id
		limites[codigo] = [2]*float64{minimo, maximo}
	}
	if err := filas.Err(); err != nil {
		return cat, err
	}
	for _, codigo := range codigosVariables {
		if _, ok := cat.ids[codigo]; !ok {
			return cat, fmt.Errorf("falta la variable %q en el catálogo", codigo)
		}
	}
	altura, flores := limites["altura_cm"], limites["flores"]
	if altura[0] == nil || altura[1] == nil || flores[0] == nil || flores[1] == nil {
		return cat, errors.New("la altura y las flores necesitan mínimo y máximo en el catálogo")
	}
	cat.rangos = rangosMedicion{
		AlturaMin: int(*altura[0]), AlturaMax: int(*altura[1]),
		FloresMin: int(*flores[0]), FloresMax: int(*flores[1]),
	}
	return cat, nil
}

// cargarIndividuos devuelve los ids de los 4 individuos de la célula, por forma de vida.
func cargarIndividuos(ctx context.Context, q consultador, celulaID int64) (map[int16]int64, error) {
	filas, err := q.Query(ctx, `SELECT forma_de_vida_id, id FROM individuos WHERE celula_id = $1`, celulaID)
	if err != nil {
		return nil, err
	}
	defer filas.Close()
	ids := map[int16]int64{}
	for filas.Next() {
		var forma int16
		var id int64
		if err := filas.Scan(&forma, &id); err != nil {
			return nil, err
		}
		ids[forma] = id
	}
	return ids, filas.Err()
}

// guardarMediciones escribe las mediciones de los individuos dentro de la transacción recibida.
// Los booleanos (vivo, frutos, plántulas) se guardan como 1 o 0. Un individuo muerto solo
// guarda "vivo" (RN-08). Se mandan todos los INSERT juntos (un "batch") en un solo viaje a la base.
func guardarMediciones(ctx context.Context, tx pgx.Tx, registroID int64, individuoIDs map[int16]int64, cat catalogo, individuos []pedidoIndividuo) error {
	lote := &pgx.Batch{}
	agregar := func(codigo string, individuoID int64, valor int) {
		lote.Queue(`INSERT INTO mediciones (registro_id, variable_id, individuo_id, valor_numerico)
		            VALUES ($1, $2, $3, $4)`, registroID, cat.ids[codigo], individuoID, valor)
	}
	unoOCero := func(b bool) int {
		if b {
			return 1
		}
		return 0
	}

	for _, ind := range individuos {
		id, ok := individuoIDs[ind.FormaDeVida]
		if !ok || ind.Vivo == nil {
			continue // la validación ya lo rechaza antes de llegar acá
		}
		agregar("vivo", id, unoOCero(*ind.Vivo))
		if !*ind.Vivo {
			continue
		}
		if ind.AlturaCm != nil {
			agregar("altura_cm", id, *ind.AlturaCm)
		}
		if ind.Flores != nil {
			agregar("flores", id, *ind.Flores)
		}
		if ind.Frutos != nil {
			agregar("frutos", id, unoOCero(*ind.Frutos))
		}
		if ind.PlantulasNuevas != nil {
			agregar("plantulas_nuevas", id, unoOCero(*ind.PlantulasNuevas))
		}
	}

	resultados := tx.SendBatch(ctx, lote)
	for i := 0; i < lote.Len(); i++ {
		if _, err := resultados.Exec(); err != nil {
			resultados.Close()
			return err
		}
	}
	return resultados.Close()
}

// errorInternoRegistro registra el detalle en el log y le responde a la persona un 500 genérico.
func errorInternoRegistro(w http.ResponseWriter, que string, err error) {
	log.Printf("registros: %s: %v", que, err)
	respuestas.Error(w, http.StatusInternalServerError, mensajeErrorRegistro)
}

// registroValidado es el pedido ya revisado, listo para guardar.
type registroValidado struct {
	pedido pedidoRegistro
	fecha  time.Time
	cat    catalogo
}

// prepararPedido lee el cuerpo y aplica todas las validaciones (crear y editar usan la misma).
// Si algo está mal, ya responde (400 o 500) y devuelve ok = false.
func prepararPedido(w http.ResponseWriter, r *http.Request, pool *pgxpool.Pool, plantacion time.Time) (registroValidado, bool) {
	var datos registroValidado
	pedido, ok := leerPedidoRegistro(w, r)
	if !ok {
		return datos, false
	}

	// Los rangos de altura y flores salen del catálogo, no están escritos fijos en el código.
	cat, err := cargarCatalogo(r.Context(), pool)
	if err != nil {
		errorInternoRegistro(w, "no se pudo leer el catálogo de variables", err)
		return datos, false
	}

	fecha, mensaje := validarRegistro(pedido, hoyEnCordoba(time.Now()), plantacion, cat.rangos)
	if mensaje != "" {
		respuestas.Error(w, http.StatusBadRequest, mensaje)
		return datos, false
	}

	// RN-07: además de venir, la foto tiene que existir.
	var existeFoto bool
	err = pool.QueryRow(r.Context(), `SELECT EXISTS (SELECT 1 FROM fotos WHERE id = $1)`, pedido.FotoID).Scan(&existeFoto)
	if err != nil {
		errorInternoRegistro(w, "no se pudo buscar la foto", err)
		return datos, false
	}
	if !existeFoto {
		respuestas.Error(w, http.StatusBadRequest, "La foto no existe. Subila de nuevo")
		return datos, false
	}

	return registroValidado{pedido: pedido, fecha: fecha, cat: cat}, true
}

// esRegistroDuplicado dice si el error de la base es la violación del índice único
// "un registro no anulado por célula por período" (RN-04).
func esRegistroDuplicado(err error) bool {
	var errPg *pgconn.PgError
	// 23505 es el código de PostgreSQL para "unique_violation".
	return errors.As(err, &errPg) && errPg.Code == "23505" && errPg.ConstraintName == "registros_uno_por_periodo"
}

// CrearRegistro atiende POST /api/celulas/{id}/registros (T13): guarda el registro del mes con
// sus mediciones. Va envuelta en RequiereSesion. Responde {"id": <id del registro>}.
func CrearRegistro(pool *pgxpool.Pool) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		ctx := r.Context()

		errorInterno := func(que string, err error) { errorInternoRegistro(w, que, err) }

		celulaID, err := strconv.ParseInt(r.PathValue("id"), 10, 64)
		if err != nil {
			respuestas.Error(w, http.StatusBadRequest, "La célula no es válida")
			return
		}

		// 1. La célula tiene que existir, y el usuario tiene que poder cargar en su lugar.
		var celula celulaParaRegistro
		err = pool.QueryRow(ctx, `
			SELECT i.lugar_id, c.fecha_plantacion, c.estado = 'baja'
			FROM celulas c
			JOIN isletas i ON i.id = c.isleta_id
			WHERE c.id = $1`, celulaID).Scan(&celula.lugarID, &celula.fechaPlantacion, &celula.dadaDeBaja)
		if errors.Is(err, pgx.ErrNoRows) {
			respuestas.Error(w, http.StatusNotFound, "No existe esa célula")
			return
		}
		if err != nil {
			errorInterno("no se pudo leer la célula", err)
			return
		}
		usuario := auth.UsuarioActual(r)
		if !auth.PuedeEditarLugar(usuario, celula.lugarID) {
			respuestas.Error(w, http.StatusForbidden, "No tenés permiso para cargar registros en este lugar")
			return
		}

		// Una célula dada de baja ya no recibe registros (RN-14).
		if celula.dadaDeBaja {
			respuestas.Error(w, http.StatusBadRequest, "La célula está dada de baja y no admite registros")
			return
		}

		// 2. El cuerpo del pedido, ya revisado (fecha, foto, individuos, rangos).
		datos, ok := prepararPedido(w, r, pool, celula.fechaPlantacion)
		if !ok {
			return
		}
		pedido, fecha, cat := datos.pedido, datos.fecha, datos.cat

		// 3. Los ids de los 4 individuos de la célula.
		individuoIDs, err := cargarIndividuos(ctx, pool, celulaID)
		if err != nil {
			errorInterno("no se pudieron leer los individuos", err)
			return
		}

		// 4. Registro + mediciones en UNA transacción: o se guarda todo o no se guarda nada.
		periodo := primerDiaDelMes(fecha)
		// Cargar un mes que ya terminó es válido, pero queda marcado (RN-18).
		fueraDeTermino := periodo.Before(primerDiaDelMes(hoyEnCordoba(time.Now())))

		tx, err := pool.Begin(ctx)
		if err != nil {
			errorInterno("no se pudo abrir la transacción", err)
			return
		}
		defer tx.Rollback(ctx) // si ya se hizo Commit, esto no hace nada

		var registroID int64
		err = tx.QueryRow(ctx, `
			INSERT INTO registros (celula_id, fecha_medicion, periodo, foto_id, observaciones,
			                       fuera_de_termino, creado_por, modificado_por)
			VALUES ($1, $2, $3, $4, $5, $6, $7, $7)
			RETURNING id`,
			celulaID, fecha, periodo, pedido.FotoID, observacionesLimpias(pedido.Observaciones), fueraDeTermino, usuario.ID).
			Scan(&registroID)
		if esRegistroDuplicado(err) {
			existente := registroExistente(ctx, pool, celulaID, periodo)
			respuestas.ErrorConDatos(w, http.StatusConflict,
				"Esta célula ya tiene un registro de ese mes",
				map[string]any{"registroId": existente})
			return
		}
		if err != nil {
			errorInterno("no se pudo insertar el registro", err)
			return
		}
		if err := guardarMediciones(ctx, tx, registroID, individuoIDs, cat, pedido.Individuos); err != nil {
			errorInterno("no se pudieron guardar las mediciones", err)
			return
		}
		if err := tx.Commit(ctx); err != nil {
			errorInterno("no se pudo confirmar la transacción", err)
			return
		}

		respuestas.JSON(w, map[string]int64{"id": registroID})
	}
}

// registroExistente devuelve el id del registro no anulado de esa célula y período
// (para que el front abra la edición cuando recibe un 409). Si no se puede leer, devuelve nil
// y el 409 sale igual, solo que sin el id.
func registroExistente(ctx context.Context, pool *pgxpool.Pool, celulaID int64, periodo time.Time) *int64 {
	var id int64
	err := pool.QueryRow(ctx,
		`SELECT id FROM registros WHERE celula_id = $1 AND periodo = $2 AND NOT anulado`,
		celulaID, periodo).Scan(&id)
	if err != nil {
		log.Printf("registros: no se pudo buscar el registro existente: %v", err)
		return nil
	}
	return &id
}

// EditarRegistro atiende PUT /api/registros/{id} (T13): corrige un registro y reemplaza sus mediciones.
// Valida lo mismo que al crear. Va envuelta en RequiereSesion. Responde {"id": <id del registro>}.
//
// Permisos: el admin edita cualquier registro; el cargador solo los de su lugar y solo del mes
// actual. Que el cargador pueda editar meses anteriores es la decisión pendiente 6 con la clienta.
func EditarRegistro(pool *pgxpool.Pool) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		ctx := r.Context()

		errorInterno := func(que string, err error) { errorInternoRegistro(w, que, err) }

		registroID, err := strconv.ParseInt(r.PathValue("id"), 10, 64)
		if err != nil {
			respuestas.Error(w, http.StatusBadRequest, "El registro no es válido")
			return
		}

		// 1. El registro, con el lugar y la plantación de su célula.
		var (
			celulaID, lugarID int64
			periodo           time.Time
			plantacion        time.Time
			anulado           bool
			fueraDeTermino    bool
		)
		err = pool.QueryRow(ctx, `
			SELECT r.celula_id, i.lugar_id, r.periodo, r.anulado, r.fuera_de_termino, c.fecha_plantacion
			FROM registros r
			JOIN celulas c ON c.id = r.celula_id
			JOIN isletas i ON i.id = c.isleta_id
			WHERE r.id = $1`, registroID).
			Scan(&celulaID, &lugarID, &periodo, &anulado, &fueraDeTermino, &plantacion)
		if errors.Is(err, pgx.ErrNoRows) {
			respuestas.Error(w, http.StatusNotFound, "No existe ese registro")
			return
		}
		if err != nil {
			errorInterno("no se pudo leer el registro", err)
			return
		}

		// 2. Permisos (siempre en el backend). Se revisan antes de mirar el cuerpo del pedido.
		usuario := auth.UsuarioActual(r)
		if !auth.PuedeEditarLugar(usuario, lugarID) {
			respuestas.Error(w, http.StatusForbidden, "No tenés permiso para editar registros de este lugar")
			return
		}
		periodoActual := primerDiaDelMes(hoyEnCordoba(time.Now()))
		if !auth.EsAdmin(usuario) && !periodo.Equal(periodoActual) {
			respuestas.Error(w, http.StatusForbidden, "Solo el administrador puede editar registros de meses anteriores")
			return
		}
		// Un registro anulado se dejó así a propósito (RN-12): no se edita.
		// Es 400 y no 404 porque el registro existe; lo que falla es el pedido.
		if anulado {
			respuestas.Error(w, http.StatusBadRequest, "El registro está anulado y no se puede editar")
			return
		}

		// 3. El cuerpo del pedido, con las mismas validaciones que al crear.
		datos, ok := prepararPedido(w, r, pool, plantacion)
		if !ok {
			return
		}
		pedido, fecha, cat := datos.pedido, datos.fecha, datos.cat

		nuevoPeriodo := primerDiaDelMes(fecha)
		// El cargador no puede "mover" su registro a un mes anterior cambiando la fecha.
		if !auth.EsAdmin(usuario) && !nuevoPeriodo.Equal(periodoActual) {
			respuestas.Error(w, http.StatusBadRequest, "La fecha tiene que ser de este mes")
			return
		}
		// Si no cambió de mes, se conserva la marca original de fuera de término.
		if !nuevoPeriodo.Equal(periodo) {
			fueraDeTermino = nuevoPeriodo.Before(periodoActual)
		}

		individuoIDs, err := cargarIndividuos(ctx, pool, celulaID)
		if err != nil {
			errorInterno("no se pudieron leer los individuos", err)
			return
		}

		// 4. Actualizar el registro y reemplazar sus mediciones, todo en una transacción.
		// Se borran y se vuelven a insertar: así, si un individuo pasó de vivo a muerto,
		// no quedan datos viejos (RN-08).
		tx, err := pool.Begin(ctx)
		if err != nil {
			errorInterno("no se pudo abrir la transacción", err)
			return
		}
		defer tx.Rollback(ctx)

		_, err = tx.Exec(ctx, `
			UPDATE registros
			SET fecha_medicion = $2, periodo = $3, foto_id = $4, observaciones = $5,
			    fuera_de_termino = $6, modificado_por = $7, modificado_en = now()
			WHERE id = $1`,
			registroID, fecha, nuevoPeriodo, pedido.FotoID, observacionesLimpias(pedido.Observaciones), fueraDeTermino, usuario.ID)
		if esRegistroDuplicado(err) {
			// Solo pasa si cambió la fecha a un mes que la célula ya tiene cargado.
			existente := registroExistente(ctx, pool, celulaID, nuevoPeriodo)
			respuestas.ErrorConDatos(w, http.StatusConflict,
				"Esta célula ya tiene un registro de ese mes",
				map[string]any{"registroId": existente})
			return
		}
		if err != nil {
			errorInterno("no se pudo actualizar el registro", err)
			return
		}
		if _, err := tx.Exec(ctx, `DELETE FROM mediciones WHERE registro_id = $1`, registroID); err != nil {
			errorInterno("no se pudieron borrar las mediciones anteriores", err)
			return
		}
		if err := guardarMediciones(ctx, tx, registroID, individuoIDs, cat, pedido.Individuos); err != nil {
			errorInterno("no se pudieron guardar las mediciones", err)
			return
		}
		if err := tx.Commit(ctx); err != nil {
			errorInterno("no se pudo confirmar la transacción", err)
			return
		}

		respuestas.JSON(w, map[string]int64{"id": registroID})
	}
}
