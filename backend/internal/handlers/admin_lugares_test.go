package handlers

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"os"
	"testing"

	"github.com/SostenibilidadUCC/CelulasDeBosque/backend/internal/auth"
	"github.com/SostenibilidadUCC/CelulasDeBosque/backend/internal/db"
	"github.com/jackc/pgx/v5/pgxpool"
)

// Letras que usan los tests de administración. El seed usa A, B y C: estas no chocan.
var letrasPrueba = []string{"X", "Y", "Z"}

// borrarLugaresPrueba borra los lugares de prueba con todo lo que cuelga de ellos
// (individuos, células e isletas), en ese orden por las claves foráneas.
func borrarLugaresPrueba(ctx context.Context, pool *pgxpool.Pool) {
	pool.Exec(ctx, `DELETE FROM individuos WHERE celula_id IN (
		SELECT c.id FROM celulas c JOIN isletas i ON i.id = c.isleta_id JOIN lugares l ON l.id = i.lugar_id
		WHERE l.letra = ANY($1))`, letrasPrueba)
	pool.Exec(ctx, `DELETE FROM celulas WHERE isleta_id IN (
		SELECT i.id FROM isletas i JOIN lugares l ON l.id = i.lugar_id WHERE l.letra = ANY($1))`, letrasPrueba)
	pool.Exec(ctx, `DELETE FROM isletas WHERE lugar_id IN (SELECT id FROM lugares WHERE letra = ANY($1))`, letrasPrueba)
	pool.Exec(ctx, `DELETE FROM lugares WHERE letra = ANY($1)`, letrasPrueba)
}

// entornoAdmin es el mux con login y las rutas de administración (como en main.go), con las
// sesiones de los tres roles del seed ya iniciadas.
type entornoAdmin struct {
	pool                    *pgxpool.Pool
	mux                     *http.ServeMux
	admin, cargador, lector *http.Cookie
}

// nuevoEntornoAdmin arma el entorno. Borra los lugares de prueba al empezar y al terminar.
// Se saltea si no está DATABASE_URL.
func nuevoEntornoAdmin(t *testing.T) *entornoAdmin {
	t.Helper()
	if os.Getenv("DATABASE_URL") == "" {
		t.Skip("falta DATABASE_URL: cargá el .env y corré el seed para probar con la base")
	}
	ctx := context.Background()
	pool, err := db.Conectar(ctx)
	if err != nil {
		t.Fatalf("no se pudo conectar a la base: %v", err)
	}
	borrarLugaresPrueba(ctx, pool)
	t.Cleanup(pool.Close) // se registra primero: los Cleanup corren al revés, así se cierra al final
	t.Cleanup(func() { borrarLugaresPrueba(ctx, pool) })

	a := auth.Nuevo(pool)
	mux := http.NewServeMux()
	mux.HandleFunc("POST /api/login", a.Login)
	mux.HandleFunc("GET /api/lugares", a.RequiereSesion(Lugares(pool)))
	mux.HandleFunc("GET /api/admin/lugares", a.RequiereSesion(ListarLugaresAdmin(pool)))
	mux.HandleFunc("POST /api/admin/lugares", a.RequiereSesion(CrearLugar(pool)))
	mux.HandleFunc("PUT /api/admin/lugares/{id}", a.RequiereSesion(EditarLugar(pool)))
	mux.HandleFunc("POST /api/admin/isletas", a.RequiereSesion(CrearIsleta(pool)))
	mux.HandleFunc("PUT /api/admin/isletas/{id}", a.RequiereSesion(EditarIsleta(pool)))
	mux.HandleFunc("POST /api/admin/isletas/{id}/plano", a.RequiereSesion(GuardarPlano(pool)))
	mux.HandleFunc("POST /api/admin/isletas/{id}/celulas-lote", a.RequiereSesion(CrearCelulasEnLote(pool)))

	e := &entornoAdmin{pool: pool, mux: mux}
	e.admin = e.iniciarSesion(t, "admin@celulas.test")
	e.cargador = e.iniciarSesion(t, "cargador@celulas.test")
	e.lector = e.iniciarSesion(t, "lector@celulas.test")
	return e
}

func (e *entornoAdmin) iniciarSesion(t *testing.T, email string) *http.Cookie {
	t.Helper()
	cuerpo, _ := json.Marshal(map[string]string{"email": email, "contrasena": contrasenaPrueba})
	respuesta := httptest.NewRecorder()
	e.mux.ServeHTTP(respuesta, httptest.NewRequest("POST", "/api/login", bytes.NewReader(cuerpo)))
	for _, c := range respuesta.Result().Cookies() {
		if c.Name == auth.NombreCookie {
			return c
		}
	}
	t.Fatalf("no se pudo iniciar sesión con %s (código %d): ¿corriste el seed?", email, respuesta.Code)
	return nil
}

// lugarGuardado es lo que importa de un lugar en la base, para comprobar que se guardó.
type lugarGuardado struct {
	letra, nombre, tipo string
	localidad           *string
	activo              bool
}

func (e *entornoAdmin) lugarEnBase(t *testing.T, id int64) lugarGuardado {
	t.Helper()
	var l lugarGuardado
	err := e.pool.QueryRow(context.Background(),
		`SELECT letra, nombre, tipo, localidad, activo FROM lugares WHERE id = $1`, id).
		Scan(&l.letra, &l.nombre, &l.tipo, &l.localidad, &l.activo)
	if err != nil {
		t.Fatalf("no se pudo leer el lugar %d: %v", id, err)
	}
	return l
}

func (e *entornoAdmin) idDeLetra(t *testing.T, letra string) int64 {
	t.Helper()
	var id int64
	if err := e.pool.QueryRow(context.Background(), `SELECT id FROM lugares WHERE letra = $1`, letra).Scan(&id); err != nil {
		t.Fatalf("no existe el lugar %s: %v", letra, err)
	}
	return id
}

// TestAdminLugares prueba crear, editar, deshabilitar y listar lugares (LUG-01 a 03, RN-02, RN-03).
func TestAdminLugares(t *testing.T) {
	e := nuevoEntornoAdmin(t)
	ruta := func(id int64) string { return fmt.Sprintf("/api/admin/lugares/%d", id) }
	nuevo := map[string]any{"letra": "z", "nombre": "Colegio de Prueba", "tipo": "colegio", "localidad": "Jesús María"}

	t.Run("sin sesión da 401", func(t *testing.T) {
		if codigo, _ := pedir(e.mux, nil, "GET", "/api/admin/lugares", nil); codigo != http.StatusUnauthorized {
			t.Errorf("GET: código = %d, se esperaba 401", codigo)
		}
		if codigo, _ := pedir(e.mux, nil, "POST", "/api/admin/lugares", nuevo); codigo != http.StatusUnauthorized {
			t.Errorf("POST: código = %d, se esperaba 401", codigo)
		}
	})

	t.Run("cargador y lector reciben 403 y no cambia nada", func(t *testing.T) {
		idA := e.idDeLetra(t, "A")
		for nombre, cookie := range map[string]*http.Cookie{"cargador": e.cargador, "lector": e.lector} {
			if codigo, _ := pedir(e.mux, cookie, "GET", "/api/admin/lugares", nil); codigo != http.StatusForbidden {
				t.Errorf("%s GET: código = %d, se esperaba 403", nombre, codigo)
			}
			if codigo, _ := pedir(e.mux, cookie, "POST", "/api/admin/lugares", nuevo); codigo != http.StatusForbidden {
				t.Errorf("%s POST: código = %d, se esperaba 403", nombre, codigo)
			}
			cambio := map[string]any{"letra": "A", "nombre": "Otro nombre", "tipo": "universidad"}
			if codigo, _ := pedir(e.mux, cookie, "PUT", ruta(idA), cambio); codigo != http.StatusForbidden {
				t.Errorf("%s PUT: código = %d, se esperaba 403", nombre, codigo)
			}
		}
		var cuantos int
		e.pool.QueryRow(context.Background(), `SELECT count(*) FROM lugares WHERE letra = 'Z'`).Scan(&cuantos)
		if cuantos != 0 {
			t.Errorf("se creó el lugar Z sin ser admin")
		}
		if l := e.lugarEnBase(t, idA); l.nombre == "Otro nombre" {
			t.Errorf("se editó el lugar A sin ser admin")
		}
	})

	var idZ int64
	t.Run("el admin crea un lugar: la letra se guarda en mayúscula y queda activo", func(t *testing.T) {
		codigo, datos := pedir(e.mux, e.admin, "POST", "/api/admin/lugares", nuevo)
		if codigo != http.StatusCreated {
			t.Fatalf("código = %d, se esperaba 201. Cuerpo: %v", codigo, datos)
		}
		if datos["letra"] != "Z" || datos["nombre"] != "Colegio de Prueba" || datos["activo"] != true || datos["tieneRegistros"] != false {
			t.Errorf("respuesta inesperada: %v", datos)
		}
		idZ = int64(datos["id"].(float64))
		l := e.lugarEnBase(t, idZ)
		if l.letra != "Z" || l.tipo != "colegio" || l.localidad == nil || *l.localidad != "Jesús María" || !l.activo {
			t.Errorf("en la base quedó %+v", l)
		}
	})

	t.Run("la localidad vacía se guarda como NULL", func(t *testing.T) {
		codigo, datos := pedir(e.mux, e.admin, "POST", "/api/admin/lugares",
			map[string]any{"letra": "Y", "nombre": "Escuela sin localidad", "tipo": "colegio", "localidad": "  "})
		if codigo != http.StatusCreated {
			t.Fatalf("código = %d, se esperaba 201. Cuerpo: %v", codigo, datos)
		}
		if l := e.lugarEnBase(t, int64(datos["id"].(float64))); l.localidad != nil {
			t.Errorf("localidad = %q, se esperaba NULL", *l.localidad)
		}
	})

	t.Run("una letra repetida da 409 (RN-02)", func(t *testing.T) {
		codigo, datos := pedir(e.mux, e.admin, "POST", "/api/admin/lugares",
			map[string]any{"letra": "A", "nombre": "Otro Campus", "tipo": "universidad"})
		if codigo != http.StatusConflict || datos["error"] != "Ya existe un lugar con la letra A" {
			t.Errorf("código = %d, cuerpo = %v; se esperaba 409 con el mensaje de letra repetida", codigo, datos)
		}
	})

	t.Run("datos inválidos dan 400", func(t *testing.T) {
		casos := map[string]map[string]any{
			"letra de dos caracteres": {"letra": "XY", "nombre": "Algo", "tipo": "colegio"},
			"letra con tilde":         {"letra": "Á", "nombre": "Algo", "tipo": "colegio"},
			"letra vacía":             {"letra": "", "nombre": "Algo", "tipo": "colegio"},
			"nombre vacío":            {"letra": "X", "nombre": "  ", "tipo": "colegio"},
			"tipo desconocido":        {"letra": "X", "nombre": "Algo", "tipo": "instituto"},
		}
		for nombre, cuerpo := range casos {
			if codigo, datos := pedir(e.mux, e.admin, "POST", "/api/admin/lugares", cuerpo); codigo != http.StatusBadRequest || datos["error"] == nil {
				t.Errorf("%s: código = %d, cuerpo = %v; se esperaba 400 con mensaje", nombre, codigo, datos)
			}
		}
	})

	t.Run("el admin edita y deshabilita un lugar, que deja de aparecer en el listado (LUG-02, LUG-03)", func(t *testing.T) {
		cambio := map[string]any{"letra": "Z", "nombre": "Colegio Renombrado", "tipo": "colegio", "localidad": "Colonia Caroya", "activo": false}
		codigo, datos := pedir(e.mux, e.admin, "PUT", ruta(idZ), cambio)
		if codigo != http.StatusOK {
			t.Fatalf("código = %d, se esperaba 200. Cuerpo: %v", codigo, datos)
		}
		if datos["nombre"] != "Colegio Renombrado" || datos["activo"] != false {
			t.Errorf("respuesta inesperada: %v", datos)
		}
		l := e.lugarEnBase(t, idZ)
		if l.nombre != "Colegio Renombrado" || l.localidad == nil || *l.localidad != "Colonia Caroya" || l.activo {
			t.Errorf("en la base quedó %+v", l)
		}
		// El listado que ven todos los roles ya no lo muestra.
		respuesta := httptest.NewRecorder()
		pedido := httptest.NewRequest("GET", "/api/lugares", nil)
		pedido.AddCookie(e.lector)
		e.mux.ServeHTTP(respuesta, pedido)
		var lista respuestaLugares
		json.Unmarshal(respuesta.Body.Bytes(), &lista)
		for _, lugar := range lista.Lugares {
			if lugar.Letra == "Z" {
				t.Errorf("GET /api/lugares sigue mostrando el lugar deshabilitado")
			}
		}
	})

	t.Run("sin 'activo' en el pedido, el lugar conserva su estado", func(t *testing.T) {
		codigo, _ := pedir(e.mux, e.admin, "PUT", ruta(idZ),
			map[string]any{"letra": "Z", "nombre": "Colegio Renombrado", "tipo": "colegio"})
		if codigo != http.StatusOK {
			t.Fatalf("código = %d, se esperaba 200", codigo)
		}
		if l := e.lugarEnBase(t, idZ); l.activo {
			t.Errorf("el lugar se volvió a habilitar sin pedirlo")
		}
	})

	t.Run("la letra se cambia si el lugar no tiene registros", func(t *testing.T) {
		codigo, datos := pedir(e.mux, e.admin, "PUT", ruta(idZ),
			map[string]any{"letra": "X", "nombre": "Colegio Renombrado", "tipo": "colegio", "activo": true})
		if codigo != http.StatusOK || datos["letra"] != "X" {
			t.Fatalf("código = %d, cuerpo = %v; se esperaba 200 con la letra X", codigo, datos)
		}
		if l := e.lugarEnBase(t, idZ); l.letra != "X" || !l.activo {
			t.Errorf("en la base quedó %+v", l)
		}
	})

	t.Run("la letra no se cambia si el lugar tiene registros (RN-03), pero el resto sí", func(t *testing.T) {
		idA := e.idDeLetra(t, "A")
		antes := e.lugarEnBase(t, idA)
		codigo, datos := pedir(e.mux, e.admin, "PUT", ruta(idA),
			map[string]any{"letra": "Y", "nombre": antes.nombre, "tipo": antes.tipo})
		if codigo != http.StatusBadRequest || datos["error"] != "La letra no se puede cambiar porque el lugar ya tiene registros" {
			t.Errorf("código = %d, cuerpo = %v; se esperaba 400 por RN-03", codigo, datos)
		}
		if l := e.lugarEnBase(t, idA); l.letra != "A" {
			t.Fatalf("la letra del lugar A cambió a %s", l.letra)
		}
		// Con la misma letra, el nombre sí se edita. Se restaura al terminar.
		t.Cleanup(func() {
			e.pool.Exec(context.Background(), `UPDATE lugares SET nombre = $1 WHERE id = $2`, antes.nombre, idA)
		})
		codigo, _ = pedir(e.mux, e.admin, "PUT", ruta(idA),
			map[string]any{"letra": "A", "nombre": "Campus UCC (editado)", "tipo": antes.tipo, "localidad": antes.localidad})
		if codigo != http.StatusOK {
			t.Errorf("editar el nombre de A: código = %d, se esperaba 200", codigo)
		}
		if l := e.lugarEnBase(t, idA); l.nombre != "Campus UCC (editado)" {
			t.Errorf("el nombre de A no se editó: %s", l.nombre)
		}
	})

	t.Run("cambiar a una letra que ya usa otro lugar da 409", func(t *testing.T) {
		codigo, datos := pedir(e.mux, e.admin, "PUT", ruta(idZ),
			map[string]any{"letra": "B", "nombre": "Colegio Renombrado", "tipo": "colegio"})
		if codigo != http.StatusConflict || datos["error"] != "Ya existe un lugar con la letra B" {
			t.Errorf("código = %d, cuerpo = %v; se esperaba 409", codigo, datos)
		}
	})

	t.Run("editar un lugar que no existe da 404", func(t *testing.T) {
		codigo, _ := pedir(e.mux, e.admin, "PUT", ruta(999999),
			map[string]any{"letra": "Q", "nombre": "Nadie", "tipo": "colegio"})
		if codigo != http.StatusNotFound {
			t.Errorf("código = %d, se esperaba 404", codigo)
		}
	})

	t.Run("el listado del admin incluye los deshabilitados y dice cuáles tienen registros", func(t *testing.T) {
		e.pool.Exec(context.Background(), `UPDATE lugares SET activo = false WHERE id = $1`, idZ)
		codigo, datos := pedir(e.mux, e.admin, "GET", "/api/admin/lugares", nil)
		if codigo != http.StatusOK {
			t.Fatalf("código = %d, se esperaba 200", codigo)
		}
		lugares, _ := datos["lugares"].([]any)
		if len(lugares) == 0 {
			t.Fatalf("el listado vino vacío: %v", datos)
		}
		if primero := lugares[0].(map[string]any)["letra"]; primero != "A" {
			t.Errorf("los lugares no vienen ordenados por letra: el primero es %v", primero)
		}
		porLetra := map[string]map[string]any{}
		for _, l := range lugares {
			lugar := l.(map[string]any)
			porLetra[lugar["letra"].(string)] = lugar
		}
		a := porLetra["A"]
		if a == nil || a["tieneRegistros"] != true || a["siguienteIsleta"] != float64(3) {
			t.Errorf("lugar A = %v; se esperaba tieneRegistros true y siguienteIsleta 3", a)
		}
		if isletas, _ := a["isletas"].([]any); len(isletas) != 2 {
			t.Errorf("el lugar A tiene %d isletas en el listado, se esperaban 2", len(isletas))
		}
		x := porLetra["X"]
		if x == nil || x["activo"] != false || x["tieneRegistros"] != false || x["siguienteIsleta"] != float64(1) {
			t.Errorf("lugar X = %v; se esperaba deshabilitado, sin registros y siguienteIsleta 1", x)
		}
	})
}
