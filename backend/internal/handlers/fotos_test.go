package handlers

import (
	"bytes"
	"context"
	"fmt"
	"image"
	"image/color"
	"image/jpeg"
	"image/png"
	"net/http"
	"net/http/httptest"
	"os"
	"strings"
	"testing"

	"github.com/SostenibilidadUCC/CelulasDeBosque/backend/internal/almacen"
	"github.com/SostenibilidadUCC/CelulasDeBosque/backend/internal/auth"
	"github.com/SostenibilidadUCC/CelulasDeBosque/backend/internal/db"
)

// almacenEnMemoria es un Almacen falso para los tests: guarda los archivos en un mapa.
type almacenEnMemoria struct {
	archivos map[string][]byte
}

func nuevoAlmacenEnMemoria() *almacenEnMemoria {
	return &almacenEnMemoria{archivos: map[string][]byte{}}
}

func (a *almacenEnMemoria) Guardar(_ context.Context, clave string, contenido []byte, _ string) error {
	a.archivos[clave] = contenido
	return nil
}

func (a *almacenEnMemoria) Leer(_ context.Context, clave string) ([]byte, error) {
	contenido, ok := a.archivos[clave]
	if !ok {
		return nil, almacen.ErrNoExiste
	}
	return contenido, nil
}

// jpegConGPS arma un JPEG chico al que se le pega un bloque EXIF falso con texto de GPS,
// igual que lo haría un celular (el bloque APP1 va justo después del inicio del archivo).
func jpegConGPS(t *testing.T) []byte {
	t.Helper()
	var base bytes.Buffer
	imagen := image.NewRGBA(image.Rect(0, 0, 8, 8))
	imagen.Set(1, 1, color.RGBA{R: 200, G: 30, B: 30, A: 255})
	if err := jpeg.Encode(&base, imagen, nil); err != nil {
		t.Fatal(err)
	}

	exif := []byte("Exif\x00\x00GPSLatitude=-31.4867;GPSLongitude=-64.2440")
	largo := len(exif) + 2 // el largo de un bloque JPEG incluye sus 2 bytes de largo
	var conExif bytes.Buffer
	conExif.Write(base.Bytes()[:2])                                  // 0xFFD8: inicio del JPEG
	conExif.Write([]byte{0xFF, 0xE1, byte(largo >> 8), byte(largo)}) // 0xFFE1: bloque APP1 (EXIF)
	conExif.Write(exif)
	conExif.Write(base.Bytes()[2:])
	return conExif.Bytes()
}

func TestLimpiarImagenBorraElGPS(t *testing.T) {
	original := jpegConGPS(t)
	if !bytes.Contains(original, []byte("GPSLatitude")) {
		t.Fatal("el JPEG de prueba tendría que traer el GPS")
	}

	limpia, err := limpiarImagen(bytes.NewReader(original))
	if err != nil {
		t.Fatalf("limpiarImagen falló: %v", err)
	}
	if bytes.Contains(limpia, []byte("GPS")) || bytes.Contains(limpia, []byte("Exif")) {
		t.Error("la imagen limpia todavía tiene metadatos")
	}
	if _, formato, err := image.Decode(bytes.NewReader(limpia)); err != nil || formato != "jpeg" {
		t.Errorf("la salida tendría que ser un JPEG válido, llegó formato %q con error %v", formato, err)
	}
}

func TestLimpiarImagenAceptaPNG(t *testing.T) {
	var origen bytes.Buffer
	if err := png.Encode(&origen, image.NewRGBA(image.Rect(0, 0, 4, 4))); err != nil {
		t.Fatal(err)
	}
	limpia, err := limpiarImagen(&origen)
	if err != nil {
		t.Fatalf("un PNG tendría que aceptarse: %v", err)
	}
	if _, formato, _ := image.Decode(bytes.NewReader(limpia)); formato != "jpeg" {
		t.Errorf("la salida tendría que ser JPEG, llegó %q", formato)
	}
}

func TestLimpiarImagenRechazaLoQueNoEsImagen(t *testing.T) {
	casos := map[string]string{
		"texto":   "esto no es una foto",
		"vacío":   "",
		"un PDF":  "%PDF-1.4 ...",
		"un HTML": "<html><script>alert(1)</script></html>",
	}
	for nombre, contenido := range casos {
		t.Run(nombre, func(t *testing.T) {
			if _, err := limpiarImagen(strings.NewReader(contenido)); err != errImagenInvalida {
				t.Errorf("error = %v, se esperaba errImagenInvalida", err)
			}
		})
	}
}

func TestPuedeSubirFotos(t *testing.T) {
	casos := []struct {
		nombre   string
		usuario  *auth.Usuario
		esperado bool
	}{
		{"admin", &auth.Usuario{Rol: auth.RolAdmin}, true},
		{"cargador", &auth.Usuario{Rol: auth.RolCargador}, true},
		{"lector", &auth.Usuario{Rol: auth.RolLector}, false},
		{"sin sesión", nil, false},
	}
	for _, caso := range casos {
		t.Run(caso.nombre, func(t *testing.T) {
			if obtenido := puedeSubirFotos(caso.usuario); obtenido != caso.esperado {
				t.Errorf("esperaba %v, llegó %v", caso.esperado, obtenido)
			}
		})
	}
}

// Sin usuario el handler responde 403 antes de tocar la base o R2 (por eso el pool puede ser nil).
func TestSubirFotoSinPermiso(t *testing.T) {
	respuesta := httptest.NewRecorder()
	SubirFoto(nil, nuevoAlmacenEnMemoria())(respuesta, httptest.NewRequest("POST", "/api/fotos", nil))
	if respuesta.Code != http.StatusForbidden {
		t.Errorf("código = %d, se esperaba 403", respuesta.Code)
	}
}

// Si R2 no está configurado (almacén nil) el servidor responde 500 con un mensaje genérico.
func TestFotosSinR2Configurado(t *testing.T) {
	admin := func(*http.Request) *auth.Usuario { return &auth.Usuario{Rol: auth.RolAdmin} }
	mux := http.NewServeMux()
	mux.HandleFunc("GET /api/fotos/{id}", VerFoto(nil, nil, admin))

	respuesta := httptest.NewRecorder()
	mux.ServeHTTP(respuesta, httptest.NewRequest("GET", "/api/fotos/1", nil))
	if respuesta.Code != http.StatusInternalServerError {
		t.Errorf("código = %d, se esperaba 500", respuesta.Code)
	}
	if strings.Contains(respuesta.Body.String(), "R2") {
		t.Errorf("el mensaje al usuario no debería mencionar R2: %s", respuesta.Body.String())
	}
}

func TestVerFotoConIdInvalido(t *testing.T) {
	mux := http.NewServeMux()
	mux.HandleFunc("GET /api/fotos/{id}", VerFoto(nil, nuevoAlmacenEnMemoria(), func(*http.Request) *auth.Usuario { return nil }))

	respuesta := httptest.NewRecorder()
	mux.ServeHTTP(respuesta, httptest.NewRequest("GET", "/api/fotos/abc", nil))
	if respuesta.Code != http.StatusNotFound {
		t.Errorf("código = %d, se esperaba 404", respuesta.Code)
	}
}

// TestVerFoto usa la base local con los datos del seed. Se saltea si no está DATABASE_URL.
// Las fotos del seed no tienen archivo en R2: el test las carga en un almacén falso.
func TestVerFoto(t *testing.T) {
	if os.Getenv("DATABASE_URL") == "" {
		t.Skip("falta DATABASE_URL: cargá el .env y corré el seed para probar con la base")
	}
	ctx := context.Background()
	pool, err := db.Conectar(ctx)
	if err != nil {
		t.Fatalf("no se pudo conectar a la base: %v", err)
	}
	defer pool.Close()

	// Una foto de un registro del lugar A (público) y una del lugar B (privado).
	fotoDeLugar := func(letra string) (int64, string) {
		var id int64
		var ruta string
		err := pool.QueryRow(ctx, `
			SELECT f.id, f.ruta_r2
			FROM registros r
			JOIN fotos f ON f.id = r.foto_id
			JOIN celulas c ON c.id = r.celula_id
			JOIN isletas i ON i.id = c.isleta_id
			JOIN lugares l ON l.id = i.lugar_id
			WHERE l.letra = $1 AND NOT r.anulado
			LIMIT 1`, letra).Scan(&id, &ruta)
		if err != nil {
			t.Fatalf("no se encontró una foto del lugar %s (¿corriste el seed?): %v", letra, err)
		}
		return id, ruta
	}
	idPublica, rutaPublica := fotoDeLugar("A")
	idPrivada, rutaPrivada := fotoDeLugar("B")

	almacenFalso := nuevoAlmacenEnMemoria()
	almacenFalso.archivos[rutaPublica] = []byte("foto-publica")
	almacenFalso.archivos[rutaPrivada] = []byte("foto-privada")

	visitante := func(*http.Request) *auth.Usuario { return nil }
	lector := func(*http.Request) *auth.Usuario { return &auth.Usuario{Rol: auth.RolLector} }

	pedir := func(usuarioDe func(*http.Request) *auth.Usuario, id int64) *httptest.ResponseRecorder {
		mux := http.NewServeMux()
		mux.HandleFunc("GET /api/fotos/{id}", VerFoto(pool, almacenFalso, usuarioDe))
		respuesta := httptest.NewRecorder()
		mux.ServeHTTP(respuesta, httptest.NewRequest("GET", fmt.Sprintf("/api/fotos/%d", id), nil))
		return respuesta
	}

	t.Run("visitante ve la foto de un lugar público", func(t *testing.T) {
		if r := pedir(visitante, idPublica); r.Code != http.StatusOK || r.Body.String() != "foto-publica" {
			t.Errorf("código %d y cuerpo %q, se esperaba 200 con la foto", r.Code, r.Body.String())
		}
	})
	t.Run("visitante no ve la foto de un lugar privado (404, no 403)", func(t *testing.T) {
		if r := pedir(visitante, idPrivada); r.Code != http.StatusNotFound {
			t.Errorf("código = %d, se esperaba 404", r.Code)
		}
	})
	t.Run("con sesión se ve la foto de cualquier lugar", func(t *testing.T) {
		if r := pedir(lector, idPrivada); r.Code != http.StatusOK || r.Body.String() != "foto-privada" {
			t.Errorf("código %d y cuerpo %q, se esperaba 200 con la foto", r.Code, r.Body.String())
		}
	})
	t.Run("foto que no existe da 404", func(t *testing.T) {
		if r := pedir(lector, 999999); r.Code != http.StatusNotFound {
			t.Errorf("código = %d, se esperaba 404", r.Code)
		}
	})
}
