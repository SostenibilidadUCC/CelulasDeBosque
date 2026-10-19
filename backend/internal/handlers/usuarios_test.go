package handlers

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"strings"
	"testing"

	"github.com/SostenibilidadUCC/CelulasDeBosque/backend/internal/auth"
	"github.com/SostenibilidadUCC/CelulasDeBosque/backend/internal/db"
	"github.com/jackc/pgx/v5/pgxpool"
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
