package handlers

import (
	"net/http"
	"os"
	"path"
	"path/filepath"
)

// Frontend entrega los archivos del build de React (frontend/dist).
// Si el archivo pedido no existe y la ruta no tiene extensión, devuelve index.html
// para que React Router se encargue de la ruta (por ejemplo /celulas/45 o /publico/A).
// Si tiene extensión (/assets/falta.js), responde 404.
func Frontend(carpeta string) http.HandlerFunc {
	archivos := http.FileServer(http.Dir(carpeta))
	indice := filepath.Join(carpeta, "index.html")

	return func(w http.ResponseWriter, r *http.Request) {
		// path.Clean saca los ".." para que nadie pueda pedir archivos fuera de la carpeta.
		ruta := filepath.Join(carpeta, filepath.FromSlash(path.Clean("/"+r.URL.Path)))

		info, err := os.Stat(ruta)
		if err == nil && !info.IsDir() {
			archivos.ServeHTTP(w, r)
			return
		}

		// Si pidieron un archivo (.js, .png, .css…) que no existe, es un 404 de verdad.
		// Solo las rutas sin extensión (/celulas, /isletas/3) son pantallas de React.
		if err != nil && path.Ext(r.URL.Path) != "" {
			http.NotFound(w, r)
			return
		}
		http.ServeFile(w, r, indice)
	}
}
