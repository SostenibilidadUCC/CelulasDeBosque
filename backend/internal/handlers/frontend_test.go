package handlers

import (
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func TestFrontend(t *testing.T) {
	// t.TempDir crea una carpeta que se borra sola al terminar el test.
	carpeta := t.TempDir()
	os.WriteFile(filepath.Join(carpeta, "index.html"), []byte("soy index"), 0o644)
	os.Mkdir(filepath.Join(carpeta, "assets"), 0o755)
	os.WriteFile(filepath.Join(carpeta, "assets", "app.js"), []byte("soy app.js"), 0o644)

	// Cada caso: la ruta que pide el navegador, el código y el contenido que esperamos.
	casos := []struct {
		ruta     string
		codigo   int
		esperado string
	}{
		{"/", 200, "soy index"},
		{"/assets/app.js", 200, "soy app.js"},
		// Rutas de React Router, sin extensión: fallback a index.html.
		{"/celulas", 200, "soy index"},
		{"/isletas/3", 200, "soy index"},
		// Archivos con extensión que no existen: 404, nunca index.html.
		{"/assets/falta.js", 404, "404 page not found"},
		{"/logo.png", 404, "404 page not found"},
		{"/estilos.css", 404, "404 page not found"},
	}

	for _, caso := range casos {
		w := httptest.NewRecorder()
		r := httptest.NewRequest("GET", caso.ruta, nil)

		Frontend(carpeta)(w, r)

		if w.Code != caso.codigo {
			t.Errorf("%s: esperaba código %d, llegó %d", caso.ruta, caso.codigo, w.Code)
		}
		if !strings.Contains(w.Body.String(), caso.esperado) {
			t.Errorf("%s: esperaba %q, llegó %q", caso.ruta, caso.esperado, w.Body.String())
		}
	}
}

func TestFrontendNoSaleDeLaCarpeta(t *testing.T) {
	// Un archivo al lado de la carpeta del build, que nunca se tiene que entregar.
	base := t.TempDir()
	carpeta := filepath.Join(base, "dist")
	os.Mkdir(carpeta, 0o755)
	os.WriteFile(filepath.Join(carpeta, "index.html"), []byte("soy index"), 0o644)
	os.WriteFile(filepath.Join(base, "secreto.txt"), []byte("soy secreto"), 0o644)

	w := httptest.NewRecorder()
	r := httptest.NewRequest("GET", "/../secreto.txt", nil)

	Frontend(carpeta)(w, r)

	if strings.Contains(w.Body.String(), "soy secreto") {
		t.Errorf("entregó un archivo de afuera de la carpeta del build")
	}
}
