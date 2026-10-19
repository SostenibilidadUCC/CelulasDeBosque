package handlers

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"os"
	"strings"
	"testing"

	"github.com/SostenibilidadUCC/CelulasDeBosque/backend/internal/auth"
	"github.com/SostenibilidadUCC/CelulasDeBosque/backend/internal/db"
	"github.com/jackc/pgx/v5/pgxpool"
	"golang.org/x/crypto/bcrypt"
)

// Los usuarios que crean los tests tienen un email que termina así, para poder borrarlos juntos.
const sufijoEmailPrueba = "@t16.test"

// conectarParaUsuarios abre la base local o saltea el test si no hay DATABASE_URL.
// Al empezar y al terminar borra los usuarios de prueba (sus sesiones primero, por la clave foránea).
func conectarParaUsuarios(t *testing.T) *pgxpool.Pool {
	t.Helper()
	if os.Getenv("DATABASE_URL") == "" {
		t.Skip("falta DATABASE_URL: cargá el .env y corré el seed para probar con la base")
	}
	ctx := context.Background()
	pool, err := db.Conectar(ctx)
	if err != nil {
		t.Fatalf("no se pudo conectar a la base: %v", err)
	}
	limpiar := func() {
		patron := "%" + sufijoEmailPrueba
		pool.Exec(ctx, `DELETE FROM sesiones WHERE usuario_id IN (SELECT id FROM usuarios WHERE email LIKE $1)`, patron)
		pool.Exec(ctx, `DELETE FROM usuarios WHERE email LIKE $1`, patron)
	}
	limpiar()
	t.Cleanup(pool.Close) // se registra primero: los Cleanup corren al revés, así se cierra al final
	t.Cleanup(limpiar)
	return pool
}

// pedir hace un pedido JSON al mux y devuelve el código y el cuerpo ya decodificado.
// Si cookie es nil, el pedido va sin sesión.
func pedir(mux *http.ServeMux, cookie *http.Cookie, metodo, ruta string, cuerpo any) (int, map[string]any) {
	bytesCuerpo, _ := json.Marshal(cuerpo)
	pedido := httptest.NewRequest(metodo, ruta, bytes.NewReader(bytesCuerpo))
	if cookie != nil {
		pedido.AddCookie(cookie)
	}
	respuesta := httptest.NewRecorder()
	mux.ServeHTTP(respuesta, pedido)
	var datos map[string]any
	json.Unmarshal(respuesta.Body.Bytes(), &datos)
	return respuesta.Code, datos
}

func TestSolicitarAcceso(t *testing.T) {
	pool := conectarParaUsuarios(t)
	ctx := context.Background()
	a := auth.Nuevo(pool)
	mux := http.NewServeMux()
	mux.HandleFunc("POST /api/login", a.Login)
	mux.HandleFunc("POST /api/solicitar-acceso", SolicitarAcceso(pool))

	valido := func() map[string]any {
		return map[string]any{
			"nombre": "  Ana Pérez ", "email": "ana" + sufijoEmailPrueba,
			"contrasena": "clave-larga-1", "institucion": "  Colegio X ",
		}
	}

	t.Run("crea la cuenta pendiente con rol lector y sin lugar", func(t *testing.T) {
		codigo, datos := pedir(mux, nil, "POST", "/api/solicitar-acceso", valido())
		if codigo != http.StatusCreated {
			t.Fatalf("código = %d, se esperaba 201. Cuerpo: %v", codigo, datos)
		}
		if _, hay := datos["passwordHash"]; hay || datos["estado"] != "pendiente" {
			t.Errorf("respuesta inesperada: %v", datos)
		}
		var nombre, rol, estado string
		var institucion *string
		var lugar *int64
		var hash *string
		err := pool.QueryRow(ctx, `SELECT nombre, rol, estado, lugar_id, institucion, password_hash FROM usuarios WHERE email = $1`,
			"ana"+sufijoEmailPrueba).Scan(&nombre, &rol, &estado, &lugar, &institucion, &hash)
		if err != nil {
			t.Fatalf("no se encontró la cuenta creada: %v", err)
		}
		if nombre != "Ana Pérez" || rol != "lector" || estado != "pendiente" || lugar != nil ||
			institucion == nil || *institucion != "Colegio X" {
			t.Errorf("datos guardados incorrectos: %q %q %q %v %v", nombre, rol, estado, lugar, institucion)
		}
		if hash == nil || !strings.HasPrefix(*hash, "$2") {
			t.Errorf("la contraseña tiene que guardarse con bcrypt")
		}
	})

	t.Run("el email repetido da 409 aunque cambien las mayúsculas", func(t *testing.T) {
		otro := valido()
		otro["email"] = "ANA" + strings.ToUpper(sufijoEmailPrueba)
		if codigo, _ := pedir(mux, nil, "POST", "/api/solicitar-acceso", otro); codigo != http.StatusConflict {
			t.Errorf("código = %d, se esperaba 409", codigo)
		}
	})

	t.Run("la institución vacía se guarda como NULL", func(t *testing.T) {
		sinInstitucion := valido()
		sinInstitucion["email"] = "sininstitucion" + sufijoEmailPrueba
		sinInstitucion["institucion"] = "   "
		if codigo, _ := pedir(mux, nil, "POST", "/api/solicitar-acceso", sinInstitucion); codigo != http.StatusCreated {
			t.Fatalf("código = %d, se esperaba 201", codigo)
		}
		var institucion *string
		pool.QueryRow(ctx, `SELECT institucion FROM usuarios WHERE email = $1`, "sininstitucion"+sufijoEmailPrueba).Scan(&institucion)
		if institucion != nil {
			t.Errorf("institución = %q, se esperaba NULL", *institucion)
		}
	})

	invalidos := []struct {
		nombre string
		campo  string
		valor  string
	}{
		{"nombre vacío", "nombre", "   "},
		{"email vacío", "email", ""},
		{"email sin arroba", "email", "ana.t16.test"},
		{"email con nombre adelante", "email", "Ana <ana2" + sufijoEmailPrueba + ">"},
		{"contraseña corta", "contrasena", "corta"},
		{"contraseña de más de 72 bytes", "contrasena", strings.Repeat("a", 73)},
	}
	for _, caso := range invalidos {
		t.Run(caso.nombre+" da 400", func(t *testing.T) {
			malo := valido()
			malo["email"] = "valido" + sufijoEmailPrueba
			malo[caso.campo] = caso.valor
			if codigo, _ := pedir(mux, nil, "POST", "/api/solicitar-acceso", malo); codigo != http.StatusBadRequest {
				t.Errorf("código = %d, se esperaba 400", codigo)
			}
		})
	}
	t.Run("los pedidos inválidos no crean cuentas", func(t *testing.T) {
		var n int
		pool.QueryRow(ctx, `SELECT count(*) FROM usuarios WHERE email = $1`, "valido"+sufijoEmailPrueba).Scan(&n)
		if n != 0 {
			t.Errorf("había %d cuentas, se esperaba ninguna", n)
		}
	})

	t.Run("la cuenta pendiente no puede iniciar sesión", func(t *testing.T) {
		codigo, datos := pedir(mux, nil, "POST", "/api/login", map[string]string{"email": "ana" + sufijoEmailPrueba, "contrasena": "clave-larga-1"})
		if codigo != http.StatusForbidden || datos["error"] != auth.MensajePendiente {
			t.Errorf("respuesta = %d %v, se esperaba 403 con el aviso de pendiente", codigo, datos)
		}
	})
}

// contrasenaPrueba es la contraseña de todos los usuarios que crean los tests (y la del seed).
const contrasenaPrueba = "bosque1234"

// emailDe arma el email de un usuario de prueba a partir de su nombre: "Ana Pérez" -> "ana.pérez@t16.test".
func emailDe(nombre string) string {
	return strings.ReplaceAll(strings.ToLower(nombre), " ", ".") + sufijoEmailPrueba
}

// crearUsuarioPrueba inserta un usuario con contraseña y devuelve su id.
// lugarID es nil salvo para los cargadores.
func crearUsuarioPrueba(t *testing.T, pool *pgxpool.Pool, nombre, rol, estado string, lugarID *int64) int64 {
	t.Helper()
	hash, err := bcrypt.GenerateFromPassword([]byte(contrasenaPrueba), bcrypt.MinCost)
	if err != nil {
		t.Fatalf("no se pudo generar el hash: %v", err)
	}
	var id int64
	err = pool.QueryRow(context.Background(), `
		INSERT INTO usuarios (nombre, email, password_hash, rol, estado, lugar_id)
		VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
		nombre, emailDe(nombre), string(hash), rol, estado, lugarID).Scan(&id)
	if err != nil {
		t.Fatalf("no se pudo crear el usuario de prueba %q: %v", nombre, err)
	}
	return id
}

// TestUsuariosAdmin prueba el panel de usuarios (listar, aprobar, editar y deshabilitar)
// con la base local y los usuarios del seed. Inicia sesión de verdad y pasa por RequiereSesion.
// Lo que cambia en usuarios del seed se restaura al terminar.
func TestUsuariosAdmin(t *testing.T) {
	pool := conectarParaUsuarios(t)
	ctx := context.Background()
	a := auth.Nuevo(pool)
	mux := http.NewServeMux()
	mux.HandleFunc("POST /api/login", a.Login)
	mux.HandleFunc("GET /api/usuarios", a.RequiereSesion(ListarUsuarios(pool)))
	mux.HandleFunc("PUT /api/usuarios/{id}", a.RequiereSesion(EditarUsuario(pool)))

	var lugarA, lugarB, cargadorSeed int64
	err := pool.QueryRow(ctx, `SELECT id FROM lugares WHERE letra = 'A'`).Scan(&lugarA)
	if err == nil {
		err = pool.QueryRow(ctx, `SELECT id FROM lugares WHERE letra = 'B'`).Scan(&lugarB)
	}
	if err == nil {
		err = pool.QueryRow(ctx, `SELECT id FROM usuarios WHERE email = 'cargador@celulas.test'`).Scan(&cargadorSeed)
	}
	if err != nil {
		t.Fatalf("faltan datos del seed (¿corriste el seed?): %v", err)
	}

	// Por si un test anterior se cortó a la mitad: el cargador del seed vuelve a ser cargador de A.
	pool.Exec(ctx, `UPDATE usuarios SET rol = 'cargador', lugar_id = $1 WHERE id = $2`, lugarA, cargadorSeed)

	// Se registra después de conectarParaUsuarios, así corre antes que su limpieza: primero se
	// borran los usuarios de prueba y recién entonces se restaura el cargador del seed
	// (si no, el índice único de RN-10 impediría volver a dejarlo como cargador de A).
	t.Cleanup(func() {
		patron := "%" + sufijoEmailPrueba
		pool.Exec(ctx, `DELETE FROM sesiones WHERE usuario_id IN (SELECT id FROM usuarios WHERE email LIKE $1)`, patron)
		pool.Exec(ctx, `DELETE FROM usuarios WHERE email LIKE $1`, patron)
		pool.Exec(ctx, `UPDATE usuarios SET rol = 'cargador', lugar_id = $1 WHERE id = $2`, lugarA, cargadorSeed)
	})

	iniciarSesion := func(email string) *http.Cookie {
		cuerpo, _ := json.Marshal(map[string]string{"email": email, "contrasena": contrasenaPrueba})
		respuesta := httptest.NewRecorder()
		mux.ServeHTTP(respuesta, httptest.NewRequest("POST", "/api/login", bytes.NewReader(cuerpo)))
		for _, c := range respuesta.Result().Cookies() {
			if c.Name == auth.NombreCookie {
				return c
			}
		}
		t.Fatalf("no se pudo iniciar sesión con %s (código %d)", email, respuesta.Code)
		return nil
	}
	admin := iniciarSesion("admin@celulas.test")
	cargador := iniciarSesion("cargador@celulas.test")
	lector := iniciarSesion("lector@celulas.test")

	ruta := func(id int64) string { return fmt.Sprintf("/api/usuarios/%d", id) }
	estadoDe := func(id int64) (rol, estado string, lugar *int64) {
		pool.QueryRow(ctx, `SELECT rol, estado, lugar_id FROM usuarios WHERE id = $1`, id).Scan(&rol, &estado, &lugar)
		return
	}

	t.Run("sin sesión da 401", func(t *testing.T) {
		if codigo, _ := pedir(mux, nil, "GET", "/api/usuarios", nil); codigo != http.StatusUnauthorized {
			t.Errorf("GET: código = %d, se esperaba 401", codigo)
		}
		if codigo, _ := pedir(mux, nil, "PUT", ruta(cargadorSeed), map[string]any{"rol": "lector", "estado": "activo"}); codigo != http.StatusUnauthorized {
			t.Errorf("PUT: código = %d, se esperaba 401", codigo)
		}
	})

	t.Run("cargador y lector reciben 403 y no cambian nada", func(t *testing.T) {
		for nombre, cookie := range map[string]*http.Cookie{"cargador": cargador, "lector": lector} {
			if codigo, _ := pedir(mux, cookie, "GET", "/api/usuarios", nil); codigo != http.StatusForbidden {
				t.Errorf("%s GET: código = %d, se esperaba 403", nombre, codigo)
			}
			cuerpo := map[string]any{"rol": "admin", "estado": "activo"}
			if codigo, _ := pedir(mux, cookie, "PUT", ruta(cargadorSeed), cuerpo); codigo != http.StatusForbidden {
				t.Errorf("%s PUT: código = %d, se esperaba 403", nombre, codigo)
			}
		}
		if rol, _, _ := estadoDe(cargadorSeed); rol != "cargador" {
			t.Errorf("el rol del cargador cambió a %q", rol)
		}
	})

	t.Run("el listado trae los pendientes primero y nunca el hash", func(t *testing.T) {
		crearUsuarioPrueba(t, pool, "Zeta Pendiente", "lector", "pendiente", nil)
		codigo, datos := pedir(mux, admin, "GET", "/api/usuarios", nil)
		if codigo != http.StatusOK {
			t.Fatalf("código = %d, se esperaba 200", codigo)
		}
		lista, _ := datos["usuarios"].([]any)
		if len(lista) == 0 {
			t.Fatal("el listado vino vacío")
		}
		primero, _ := lista[0].(map[string]any)
		if primero["estado"] != "pendiente" {
			t.Errorf("el primero tiene estado %v, se esperaba pendiente", primero["estado"])
		}
		for _, clave := range []string{"passwordHash", "password_hash", "contrasena"} {
			if _, hay := primero[clave]; hay {
				t.Errorf("el listado no puede traer %q", clave)
			}
		}
	})

	t.Run("los filtros de estado, rol, lugar y búsqueda funcionan", func(t *testing.T) {
		contar := func(consulta string) (int, []any) {
			codigo, datos := pedir(mux, admin, "GET", "/api/usuarios?"+consulta, nil)
			if codigo != http.StatusOK {
				t.Fatalf("?%s: código = %d, se esperaba 200", consulta, codigo)
			}
			lista, _ := datos["usuarios"].([]any)
			return len(lista), lista
		}
		if n, lista := contar("estado=pendiente&q=zeta"); n != 1 {
			t.Errorf("estado=pendiente&q=zeta devolvió %d, se esperaba 1: %v", n, lista)
		}
		if n, _ := contar("q=ZETA%20PEND"); n != 1 {
			t.Errorf("la búsqueda por nombre no ignora mayúsculas (devolvió %d)", n)
		}
		if n, _ := contar("q=" + emailDe("Zeta Pendiente")); n != 1 {
			t.Errorf("la búsqueda por email devolvió %d, se esperaba 1", n)
		}
		if n, _ := contar("q=%25"); n != 0 {
			t.Errorf("el comodín %% tiene que buscarse como texto (devolvió %d)", n)
		}
		if n, lista := contar(fmt.Sprintf("rol=cargador&lugarId=%d&estado=activo", lugarA)); n != 1 {
			t.Errorf("el cargador activo del lugar A devolvió %d, se esperaba 1: %v", n, lista)
		}
		if codigo, _ := pedir(mux, admin, "GET", "/api/usuarios?rol=jefe", nil); codigo != http.StatusBadRequest {
			t.Errorf("rol inválido: código = %d, se esperaba 400", codigo)
		}
	})

	t.Run("aprobar un pendiente como lector lo deja entrar", func(t *testing.T) {
		id := crearUsuarioPrueba(t, pool, "Lucia Aprobada", "lector", "pendiente", nil)
		// Con la cuenta pendiente no entra (login responde 403).
		cuerpo, _ := json.Marshal(map[string]string{"email": emailDe("Lucia Aprobada"), "contrasena": contrasenaPrueba})
		pedidoLogin := httptest.NewRecorder()
		mux.ServeHTTP(pedidoLogin, httptest.NewRequest("POST", "/api/login", bytes.NewReader(cuerpo)))
		if pedidoLogin.Code != http.StatusForbidden {
			t.Fatalf("pendiente: login = %d, se esperaba 403", pedidoLogin.Code)
		}

		codigo, datos := pedir(mux, admin, "PUT", ruta(id), map[string]any{"rol": "lector", "estado": "activo"})
		if codigo != http.StatusOK || datos["estado"] != "activo" || datos["rol"] != "lector" {
			t.Fatalf("respuesta = %d %v, se esperaba 200 activo/lector", codigo, datos)
		}
		pedidoLogin = httptest.NewRecorder()
		mux.ServeHTTP(pedidoLogin, httptest.NewRequest("POST", "/api/login", bytes.NewReader(cuerpo)))
		if pedidoLogin.Code != http.StatusOK {
			t.Errorf("aprobado: login = %d, se esperaba 200", pedidoLogin.Code)
		}
	})

	t.Run("aprobar como cargador guarda el lugar, y el nombre se puede editar", func(t *testing.T) {
		id := crearUsuarioPrueba(t, pool, "Carlos Nuevo", "lector", "pendiente", nil)
		cuerpo := map[string]any{"nombre": "  Carlos Cargador ", "rol": "cargador", "lugarId": lugarB, "estado": "activo"}
		codigo, datos := pedir(mux, admin, "PUT", ruta(id), cuerpo)
		if codigo != http.StatusOK {
			t.Fatalf("código = %d, se esperaba 200. Cuerpo: %v", codigo, datos)
		}
		lugar, _ := datos["lugar"].(map[string]any)
		if datos["nombre"] != "Carlos Cargador" || lugar["letra"] != "B" {
			t.Errorf("respuesta inesperada: %v", datos)
		}
		// El email no cambia.
		var email string
		pool.QueryRow(ctx, `SELECT email FROM usuarios WHERE id = $1`, id).Scan(&email)
		if email != emailDe("Carlos Nuevo") {
			t.Errorf("el email cambió a %q", email)
		}
	})

	t.Run("pedidos inválidos dan 400 y un usuario inexistente da 404", func(t *testing.T) {
		id := crearUsuarioPrueba(t, pool, "Valeria Validaciones", "lector", "pendiente", nil)
		casos := []struct {
			nombre string
			cuerpo map[string]any
		}{
			{"rol inválido", map[string]any{"rol": "jefe", "estado": "activo"}},
			{"volver a pendiente", map[string]any{"rol": "lector", "estado": "pendiente"}},
			{"cargador sin lugar", map[string]any{"rol": "cargador", "estado": "activo"}},
			{"lugar que no existe", map[string]any{"rol": "cargador", "lugarId": 999999, "estado": "activo"}},
			{"nombre vacío", map[string]any{"nombre": "  ", "rol": "lector", "estado": "activo"}},
		}
		for _, caso := range casos {
			if codigo, _ := pedir(mux, admin, "PUT", ruta(id), caso.cuerpo); codigo != http.StatusBadRequest {
				t.Errorf("%s: código = %d, se esperaba 400", caso.nombre, codigo)
			}
		}
		if _, estado, _ := estadoDe(id); estado != "pendiente" {
			t.Errorf("un pedido inválido cambió el estado a %q", estado)
		}
		if codigo, _ := pedir(mux, admin, "PUT", ruta(999999), map[string]any{"rol": "lector", "estado": "activo"}); codigo != http.StatusNotFound {
			t.Errorf("usuario inexistente: código = %d, se esperaba 404", codigo)
		}
	})

	t.Run("deshabilitar cierra las sesiones y habilitar lo deja entrar de nuevo", func(t *testing.T) {
		id := crearUsuarioPrueba(t, pool, "Dario Deshabilitado", "lector", "activo", nil)
		iniciarSesion(emailDe("Dario Deshabilitado"))
		var sesiones int
		pool.QueryRow(ctx, `SELECT count(*) FROM sesiones WHERE usuario_id = $1`, id).Scan(&sesiones)
		if sesiones != 1 {
			t.Fatalf("había %d sesiones, se esperaba 1", sesiones)
		}

		if codigo, _ := pedir(mux, admin, "PUT", ruta(id), map[string]any{"rol": "lector", "estado": "deshabilitado"}); codigo != http.StatusOK {
			t.Fatalf("deshabilitar: código = %d, se esperaba 200", codigo)
		}
		pool.QueryRow(ctx, `SELECT count(*) FROM sesiones WHERE usuario_id = $1`, id).Scan(&sesiones)
		if sesiones != 0 {
			t.Errorf("quedaron %d sesiones, se esperaba ninguna", sesiones)
		}
		if codigo, _ := pedir(mux, admin, "PUT", ruta(id), map[string]any{"rol": "lector", "estado": "activo"}); codigo != http.StatusOK {
			t.Fatalf("habilitar: código = %d, se esperaba 200", codigo)
		}
		iniciarSesion(emailDe("Dario Deshabilitado")) // falla el test si no puede entrar
	})

	t.Run("no se puede reemplazar al cargador sin confirmar, y con reemplazarCargador pasa a lector", func(t *testing.T) {
		id := crearUsuarioPrueba(t, pool, "Rosa Reemplazo", "lector", "pendiente", nil)
		cuerpo := map[string]any{"rol": "cargador", "lugarId": lugarA, "estado": "activo"}

		codigo, datos := pedir(mux, admin, "PUT", ruta(id), cuerpo)
		actual, _ := datos["cargadorActual"].(map[string]any)
		if codigo != http.StatusConflict || actual["id"] != float64(cargadorSeed) || actual["nombre"] == "" {
			t.Fatalf("sin confirmar: %d %v, se esperaba 409 con cargadorActual", codigo, datos)
		}
		if _, estado, _ := estadoDe(id); estado != "pendiente" {
			t.Errorf("el 409 no tendría que haber cambiado nada, pero el estado es %q", estado)
		}
		if rol, _, _ := estadoDe(cargadorSeed); rol != "cargador" {
			t.Errorf("el cargador actual cambió a %q sin confirmar", rol)
		}

		cuerpo["reemplazarCargador"] = true
		if codigo, datos := pedir(mux, admin, "PUT", ruta(id), cuerpo); codigo != http.StatusOK {
			t.Fatalf("confirmado: %d %v, se esperaba 200", codigo, datos)
		}
		if rol, estado, lugar := estadoDe(id); rol != "cargador" || estado != "activo" || lugar == nil || *lugar != lugarA {
			t.Errorf("el nuevo quedó %q/%q/%v", rol, estado, lugar)
		}
		// El anterior sigue activo, pero como lector y sin lugar.
		if rol, estado, lugar := estadoDe(cargadorSeed); rol != "lector" || estado != "activo" || lugar != nil {
			t.Errorf("el anterior quedó %q/%q/%v, se esperaba lector/activo/sin lugar", rol, estado, lugar)
		}
	})

	t.Run("el último administrador activo no se puede deshabilitar ni cambiar de rol", func(t *testing.T) {
		var admins int
		pool.QueryRow(ctx, `SELECT count(*) FROM usuarios WHERE rol = 'admin' AND estado = 'activo' AND email NOT LIKE $1`,
			"%"+sufijoEmailPrueba).Scan(&admins)
		if admins != 1 {
			t.Skipf("la base tiene %d administradores activos y el test necesita exactamente 1 (el del seed)", admins)
		}
		var adminSeed int64
		pool.QueryRow(ctx, `SELECT id FROM usuarios WHERE email = 'admin@celulas.test'`).Scan(&adminSeed)

		// Con un solo administrador, ni deshabilitarlo ni pasarlo a lector.
		for _, cuerpo := range []map[string]any{
			{"rol": "admin", "estado": "deshabilitado"},
			{"rol": "lector", "estado": "activo"},
		} {
			if codigo, _ := pedir(mux, admin, "PUT", ruta(adminSeed), cuerpo); codigo != http.StatusConflict {
				t.Errorf("%v: código = %d, se esperaba 409", cuerpo, codigo)
			}
		}
		if rol, estado, _ := estadoDe(adminSeed); rol != "admin" || estado != "activo" {
			t.Fatalf("el administrador del seed quedó %q/%q", rol, estado)
		}

		// Con un segundo administrador activo, el segundo sí se puede deshabilitar...
		segundo := crearUsuarioPrueba(t, pool, "Segundo Admin", "admin", "activo", nil)
		if codigo, _ := pedir(mux, admin, "PUT", ruta(segundo), map[string]any{"rol": "admin", "estado": "deshabilitado"}); codigo != http.StatusOK {
			t.Errorf("deshabilitar al segundo: código = %d, se esperaba 200", codigo)
		}
		// ...y volvió a quedar uno solo, así que el del seed sigue protegido.
		if codigo, _ := pedir(mux, admin, "PUT", ruta(adminSeed), map[string]any{"rol": "admin", "estado": "deshabilitado"}); codigo != http.StatusConflict {
			t.Errorf("deshabilitar al último: código = %d, se esperaba 409", codigo)
		}
	})
}
