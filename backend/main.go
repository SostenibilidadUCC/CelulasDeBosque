// Servidor de Células de Bosque UCC.
// Acá se arranca el servidor y se registran TODAS las rutas.
package main

import (
	"context"
	"log"
	"net/http"
	"os"

	"github.com/SostenibilidadUCC/CelulasDeBosque/backend/internal/auth"
	"github.com/SostenibilidadUCC/CelulasDeBosque/backend/internal/db"
	"github.com/SostenibilidadUCC/CelulasDeBosque/backend/internal/handlers"
	"github.com/SostenibilidadUCC/CelulasDeBosque/backend/internal/respuestas"
)

func main() {
	// Conexión a la base: se crea una sola vez y la comparten todos los handlers.
	pool, err := db.Conectar(context.Background())
	if err != nil {
		log.Fatal(err)
	}
	defer pool.Close()
	log.Println("Conectado a PostgreSQL")

	// El "mux" es el que mira la ruta de cada pedido y decide qué función lo atiende.
	mux := http.NewServeMux()

	mux.HandleFunc("GET /api/health", health)

	// T10: sesión. Las demás rutas internas se protegen con a.RequiereSesion(...).
	a := auth.Nuevo(pool)
	mux.HandleFunc("POST /api/login", a.Login)
	mux.HandleFunc("POST /api/logout", a.RequiereSesion(a.Logout))
	mux.HandleFunc("GET /api/yo", a.RequiereSesion(a.Yo))

	mux.HandleFunc("GET /api/isletas/{id}", a.RequiereSesion(handlers.Isleta(pool)))

	// T11: inicio y explorar células
	mux.HandleFunc("GET /api/lugares", a.RequiereSesion(handlers.Lugares(pool)))

	// Cualquier /api/... que no coincida con otra ruta es un 404 en JSON.
	// El orden de registro no importa: el mux siempre elige la ruta más específica.
	mux.HandleFunc("/api/", apiNoExiste)

	// Todo lo que no empieza con /api es el frontend de React.
	carpetaFrontend := os.Getenv("FRONTEND_DIR")
	if carpetaFrontend == "" {
		carpetaFrontend = "../frontend/dist"
	}
	if _, err := os.Stat(carpetaFrontend); err != nil {
		log.Printf("Aviso: no existe %s. Para ver el frontend desde Go, corré: cd frontend && npm run build", carpetaFrontend)
	}
	mux.Handle("/", handlers.Frontend(carpetaFrontend))

	// Railway define PORT solo; en desarrollo usamos 8080.
	puerto := os.Getenv("PORT")
	if puerto == "" {
		puerto = "8080"
	}

	log.Printf("Servidor escuchando en http://localhost:%s", puerto)
	// ListenAndServe se queda corriendo para siempre; solo vuelve si hay un error.
	// No usamos log.Fatal acá para que el defer de arriba llegue a cerrar el pool.
	err = http.ListenAndServe(":"+puerto, mux)
	log.Printf("El servidor se detuvo: %v", err)
}

// health responde {"ok": true} para saber si el servidor está prendido.
func health(w http.ResponseWriter, r *http.Request) {
	respuestas.JSON(w, map[string]bool{"ok": true})
}

// apiNoExiste responde 404 en JSON. Una ruta de la API nunca devuelve index.html.
func apiNoExiste(w http.ResponseWriter, r *http.Request) {
	respuestas.Error(w, http.StatusNotFound, "No existe esa ruta de la API")
}
