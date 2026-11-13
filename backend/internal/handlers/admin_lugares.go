package handlers

import (
	"context"
	"encoding/json"
	"errors"
	"log"
	"net/http"
	"strconv"
	"strings"
	"unicode/utf8"

	"github.com/SostenibilidadUCC/CelulasDeBosque/backend/internal/auth"
	"github.com/SostenibilidadUCC/CelulasDeBosque/backend/internal/respuestas"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgxpool"
)

// Administración de lugares (T20, LUG-01 a 03). Solo el administrador.
// A diferencia de GET /api/lugares (que ven todos los roles), acá aparecen también los lugares
// deshabilitados, para poder volver a habilitarlos.

// Mensajes que comparte la administración de lugares e isletas.
const (
	mensajeSoloAdminLugares = "Solo el administrador puede gestionar lugares e isletas"
	mensajeErrorLugares     = "No se pudo completar la operación. Probá de nuevo en unos minutos."
)

// tiposDeLugar son los valores que acepta la columna lugares.tipo.
var tiposDeLugar = []string{"universidad", "colegio"}

// isletaAdmin es una isleta tal como la ve el admin dentro de su lugar.
type isletaAdmin struct {
	ID              int64   `json:"id"`
	Numero          int     `json:"numero"`
	Nombre          *string `json:"nombre"` // opcional
	Filas           int     `json:"filas"`
	Columnas        int     `json:"columnas"`
	PlanoFotoID     *int64  `json:"planoFotoId"`     // null si todavía no se subió el plano
	CantidadCelulas int     `json:"cantidadCelulas"` // todas, también las dadas de baja: ocupan su celda
	TieneRegistros  bool    `json:"tieneRegistros"`  // si es true, el número no se puede cambiar (RN-03)
}

// lugarAdmin es un lugar tal como lo ve el admin (GET /api/admin/lugares).
type lugarAdmin struct {
	ID              int64         `json:"id"`
	Letra           string        `json:"letra"`
	Nombre          string        `json:"nombre"`
	Tipo            string        `json:"tipo"`
	Localidad       *string       `json:"localidad"` // opcional
	Activo          bool          `json:"activo"`
	TieneRegistros  bool          `json:"tieneRegistros"`  // si es true, la letra no se puede cambiar (RN-03)
	SiguienteIsleta int           `json:"siguienteIsleta"` // número que se sugiere para la próxima isleta (LUG-04)
	Isletas         []isletaAdmin `json:"isletas"`
}

// leerLugaresAdmin lee los lugares con sus isletas, ordenados por letra.
// Con soloID nil trae todos; si no, solo ese (la lista queda vacía si no existe).
// "Tiene registros" cuenta también los anulados: su código ya se usó en el campo.
func leerLugaresAdmin(ctx context.Context, pool *pgxpool.Pool, soloID *int64) ([]lugarAdmin, error) {
	filas, err := pool.Query(ctx, `
		SELECT l.id, l.letra, l.nombre, l.tipo, l.localidad, l.activo,
		       EXISTS (SELECT 1 FROM registros r
		               JOIN celulas c ON c.id = r.celula_id
		               JOIN isletas i ON i.id = c.isleta_id
		               WHERE i.lugar_id = l.id),
		       COALESCE((SELECT max(i.numero) FROM isletas i WHERE i.lugar_id = l.id), 0) + 1
		FROM lugares l
		WHERE $1::bigint IS NULL OR l.id = $1
		ORDER BY l.letra`, soloID)
	if err != nil {
		return nil, err
	}
	// pgx.CollectRows recorre todas las filas, las convierte con la función y cierra el cursor.
	lugares, err := pgx.CollectRows(filas, func(fila pgx.CollectableRow) (lugarAdmin, error) {
		l := lugarAdmin{Isletas: []isletaAdmin{}} // lista vacía (y no nil) para que el JSON sea []
		err := fila.Scan(&l.ID, &l.Letra, &l.Nombre, &l.Tipo, &l.Localidad, &l.Activo, &l.TieneRegistros, &l.SiguienteIsleta)
		return l, err
	})
	if err != nil {
		return nil, err
	}

	// posicion guarda en qué lugar de la lista quedó cada lugar, para sumarle sus isletas.
	posicion := map[int64]int{}
	for i, l := range lugares {
		posicion[l.ID] = i
	}
	filas, err = pool.Query(ctx, `
		SELECT i.id, i.lugar_id, i.numero, i.nombre, i.filas, i.columnas, i.plano_foto_id,
		       (SELECT count(*) FROM celulas c WHERE c.isleta_id = i.id),
		       EXISTS (SELECT 1 FROM registros r JOIN celulas c ON c.id = r.celula_id WHERE c.isleta_id = i.id)
		FROM isletas i
		WHERE $1::bigint IS NULL OR i.lugar_id = $1
		ORDER BY i.lugar_id, i.numero`, soloID)
	if err != nil {
		return nil, err
	}
	defer filas.Close()
	for filas.Next() {
		var (
			isleta  isletaAdmin
			lugarID int64
		)
		if err := filas.Scan(&isleta.ID, &lugarID, &isleta.Numero, &isleta.Nombre, &isleta.Filas, &isleta.Columnas,
			&isleta.PlanoFotoID, &isleta.CantidadCelulas, &isleta.TieneRegistros); err != nil {
			return nil, err
		}
		p := posicion[lugarID]
		lugares[p].Isletas = append(lugares[p].Isletas, isleta)
	}
	return lugares, filas.Err()
}

// violaUnica dice si el error de la base es la violación de esa restricción UNIQUE.
// 23505 es el código de PostgreSQL para "unique_violation".
func violaUnica(err error, restriccion string) bool {
	var errPg *pgconn.PgError
	return errors.As(err, &errPg) && errPg.Code == "23505" && errPg.ConstraintName == restriccion
}

// textoOpcional recorta el texto y devuelve nil si quedó vacío (en la base se guarda NULL).
func textoOpcional(texto *string) *string {
	if texto == nil {
		return nil
	}
	recortado := strings.TrimSpace(*texto)
	if recortado == "" {
		return nil
	}
	return &recortado
}

// pedidoLugar es el cuerpo de POST /api/admin/lugares y de PUT /api/admin/lugares/{id}.
// Activo solo se usa al editar; si no viene, el lugar conserva su estado.
// No hay campo "público": todo lugar activo es público (RN-15).
type pedidoLugar struct {
	Letra     string  `json:"letra"`
	Nombre    string  `json:"nombre"`
	Tipo      string  `json:"tipo"`
	Localidad *string `json:"localidad"`
	Activo    *bool   `json:"activo"`
}

// leerPedidoLugar decodifica y valida el cuerpo. La letra queda en mayúscula y los textos recortados.
// Si algo está mal, devuelve el mensaje para el usuario.
func leerPedidoLugar(w http.ResponseWriter, r *http.Request) (pedidoLugar, string) {
	r.Body = http.MaxBytesReader(w, r.Body, 4096) // un lugar pesa pocos bytes
	var p pedidoLugar
	if err := json.NewDecoder(r.Body).Decode(&p); err != nil {
		return p, "Completá los datos del lugar"
	}
	p.Letra = strings.ToUpper(strings.TrimSpace(p.Letra))
	p.Nombre = strings.TrimSpace(p.Nombre)
	p.Localidad = textoOpcional(p.Localidad)

	// len cuenta bytes: "Á" ocupa 2, así que también queda afuera. Igual que el CHECK de la base: A a Z.
	if len(p.Letra) != 1 || p.Letra[0] < 'A' || p.Letra[0] > 'Z' {
		return p, "La letra tiene que ser una sola letra, de la A a la Z"
	}
	if p.Nombre == "" {
		return p, "Completá el nombre del lugar"
	}
	if utf8.RuneCountInString(p.Nombre) > 100 || (p.Localidad != nil && utf8.RuneCountInString(*p.Localidad) > 100) {
		return p, "El nombre o la localidad son demasiado largos"
	}
	if p.Tipo != tiposDeLugar[0] && p.Tipo != tiposDeLugar[1] {
		return p, "Elegí si el lugar es una universidad o un colegio"
	}
	return p, ""
}

// responderLugar lee el lugar recién guardado y lo responde con el código indicado.
func responderLugar(w http.ResponseWriter, r *http.Request, pool *pgxpool.Pool, id int64, codigo int) {
	lugares, err := leerLugaresAdmin(r.Context(), pool, &id)
	if err != nil || len(lugares) == 0 {
		log.Printf("admin lugares: no se pudo leer el lugar %d después de guardarlo: %v", id, err)
		respuestas.Error(w, http.StatusInternalServerError, mensajeErrorLugares)
		return
	}
	if codigo == http.StatusCreated {
		respuestas.Creado(w, lugares[0])
		return
	}
	respuestas.JSON(w, lugares[0])
}

// ListarLugaresAdmin atiende GET /api/admin/lugares: todos los lugares, también los deshabilitados,
// con sus isletas. Responde {"lugares": [...]}. Va envuelta en RequiereSesion.
func ListarLugaresAdmin(pool *pgxpool.Pool) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if !auth.EsAdmin(auth.UsuarioActual(r)) {
			respuestas.Error(w, http.StatusForbidden, mensajeSoloAdminLugares)
			return
		}
		lugares, err := leerLugaresAdmin(r.Context(), pool, nil)
		if err != nil {
			log.Printf("admin lugares: no se pudieron leer: %v", err)
			respuestas.Error(w, http.StatusInternalServerError, "No se pudieron cargar los lugares. Probá de nuevo.")
			return
		}
		respuestas.JSON(w, map[string]any{"lugares": lugares})
	}
}

// CrearLugar atiende POST /api/admin/lugares (LUG-01). Responde 201 con el lugar creado,
// o 409 si la letra ya existe (RN-02). Va envuelta en RequiereSesion.
func CrearLugar(pool *pgxpool.Pool) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if !auth.EsAdmin(auth.UsuarioActual(r)) {
			respuestas.Error(w, http.StatusForbidden, mensajeSoloAdminLugares)
			return
		}
		pedido, mensaje := leerPedidoLugar(w, r)
		if mensaje != "" {
			respuestas.Error(w, http.StatusBadRequest, mensaje)
			return
		}

		var id int64
		err := pool.QueryRow(r.Context(), `
			INSERT INTO lugares (letra, nombre, tipo, localidad) VALUES ($1, $2, $3, $4) RETURNING id`,
			pedido.Letra, pedido.Nombre, pedido.Tipo, pedido.Localidad).Scan(&id)
		// La letra única la garantiza la base (RN-02): si dos admins crean la misma letra a la vez,
		// el segundo recibe este 409 en lugar de un error.
		if violaUnica(err, "lugares_letra_key") {
			respuestas.Error(w, http.StatusConflict, "Ya existe un lugar con la letra "+pedido.Letra)
			return
		}
		if err != nil {
			log.Printf("admin lugares: no se pudo crear: %v", err)
			respuestas.Error(w, http.StatusInternalServerError, mensajeErrorLugares)
			return
		}
		responderLugar(w, r, pool, id, http.StatusCreated)
	}
}

// EditarLugar atiende PUT /api/admin/lugares/{id} (LUG-02 y LUG-03): edita todos los datos y,
// con "activo": false, lo deshabilita. La letra no cambia si el lugar ya tiene registros (RN-03).
// Va envuelta en RequiereSesion.
func EditarLugar(pool *pgxpool.Pool) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if !auth.EsAdmin(auth.UsuarioActual(r)) {
			respuestas.Error(w, http.StatusForbidden, mensajeSoloAdminLugares)
			return
		}
		id, err := strconv.ParseInt(r.PathValue("id"), 10, 64)
		if err != nil {
			respuestas.Error(w, http.StatusBadRequest, "El lugar no es válido")
			return
		}
		pedido, mensaje := leerPedidoLugar(w, r)
		if mensaje != "" {
			respuestas.Error(w, http.StatusBadRequest, mensaje)
			return
		}

		errorInterno := func(que string, err error) {
			log.Printf("admin lugares: %s (lugar %d): %v", que, id, err)
			respuestas.Error(w, http.StatusInternalServerError, mensajeErrorLugares)
		}

		// Se lee la letra actual y se actualiza dentro de una transacción. FOR UPDATE bloquea la fila
		// del lugar hasta el Commit, así dos ediciones al mismo tiempo no se pisan.
		tx, err := pool.Begin(r.Context())
		if err != nil {
			errorInterno("no se pudo empezar la transacción", err)
			return
		}
		defer tx.Rollback(r.Context()) // si ya se hizo Commit, no hace nada

		var (
			letraActual    string
			tieneRegistros bool
		)
		err = tx.QueryRow(r.Context(), `
			SELECT l.letra,
			       EXISTS (SELECT 1 FROM registros rg
			               JOIN celulas c ON c.id = rg.celula_id
			               JOIN isletas i ON i.id = c.isleta_id
			               WHERE i.lugar_id = l.id)
			FROM lugares l WHERE l.id = $1 FOR UPDATE`, id).Scan(&letraActual, &tieneRegistros)
		if errors.Is(err, pgx.ErrNoRows) {
			respuestas.Error(w, http.StatusNotFound, "El lugar no existe")
			return
		}
		if err != nil {
			errorInterno("no se pudo leer", err)
			return
		}
		if pedido.Letra != letraActual && tieneRegistros {
			respuestas.Error(w, http.StatusBadRequest, "La letra no se puede cambiar porque el lugar ya tiene registros")
			return
		}

		// COALESCE($5, activo): si no vino "activo" ($5 es NULL), queda el valor que tenía.
		_, err = tx.Exec(r.Context(), `
			UPDATE lugares
			SET letra = $1, nombre = $2, tipo = $3, localidad = $4,
			    activo = COALESCE($5, activo), modificado_en = now()
			WHERE id = $6`,
			pedido.Letra, pedido.Nombre, pedido.Tipo, pedido.Localidad, pedido.Activo, id)
		if violaUnica(err, "lugares_letra_key") {
			respuestas.Error(w, http.StatusConflict, "Ya existe un lugar con la letra "+pedido.Letra)
			return
		}
		if err != nil {
			errorInterno("no se pudo actualizar", err)
			return
		}
		if err := tx.Commit(r.Context()); err != nil {
			errorInterno("no se pudo confirmar", err)
			return
		}
		responderLugar(w, r, pool, id, http.StatusOK)
	}
}
