// Paquete respuestas: la única forma de responderle al frontend.
// Todas las respuestas son JSON, y los errores tienen siempre la forma {"error": "mensaje"}.
package respuestas

import (
	"encoding/json"
	"log"
	"net/http"
)

// JSON responde con estado 200 y los datos codificados como JSON.
func JSON(w http.ResponseWriter, datos any) {
	escribir(w, http.StatusOK, datos)
}

// Error responde {"error": mensaje} con el código de estado indicado (400, 404, 500…).
// El mensaje se muestra al usuario, así que va en español y sin detalles técnicos.
func Error(w http.ResponseWriter, codigo int, mensaje string) {
	escribir(w, codigo, map[string]string{"error": mensaje})
}

// escribir hace el trabajo común de JSON y Error.
// El orden importa: primero los headers, después el código y al final el cuerpo.
func escribir(w http.ResponseWriter, codigo int, datos any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(codigo)
	if err := json.NewEncoder(w).Encode(datos); err != nil {
		// El código ya se mandó, así que solo podemos dejarlo en el log.
		log.Printf("respuestas: no se pudo codificar el JSON: %v", err)
	}
}
