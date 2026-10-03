// Servidor de Células de Bosque UCC.
// Acá se arranca el servidor y se registran TODAS las rutas.
package main

import (
	"context"
	"log"
	"net/http"
	"os"

	"github.com/SostenibilidadUCC/CelulasDeBosque/backend/internal/db"
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
