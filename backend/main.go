// Servidor de Células de Bosque UCC.
// Acá se arranca el servidor y se registran TODAS las rutas.
package main

import (
	"encoding/json"
	"log"
	"net/http"
	"os"
)

func main() {
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
	log.Fatal(http.ListenAndServe(":"+puerto, mux))
}

// health responde {"ok": true} para saber si el servidor está prendido.
func health(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]bool{"ok": true})
}
