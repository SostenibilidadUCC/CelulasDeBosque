// Paquete db: la conexión a PostgreSQL.
package db

import (
	"context"
	"errors"
	"fmt"
	"os"

	"github.com/jackc/pgx/v5/pgxpool"
)

// Conectar crea el pool de conexiones a la base usando la variable DATABASE_URL
// y hace un Ping para comprobar que la base responde.
// El pool se crea una sola vez al arrancar y lo comparten todos los handlers.
func Conectar(ctx context.Context) (*pgxpool.Pool, error) {
	direccion := os.Getenv("DATABASE_URL")
	if direccion == "" {
		return nil, errors.New(`falta la variable DATABASE_URL. Desde la raíz del proyecto, en Git Bash, corré: set -a; source .env; set +a`)
	}

	pool, err := pgxpool.New(ctx, direccion)
	if err != nil {
		return nil, fmt.Errorf("DATABASE_URL no tiene un formato válido: %w", err)
	}

	// pgxpool.New no se conecta todavía; el Ping es el que prueba la conexión de verdad.
	if err := pool.Ping(ctx); err != nil {
		pool.Close()
		return nil, fmt.Errorf("no se pudo conectar a PostgreSQL (¿está prendido Docker? probá con: docker compose up -d. Si dice \"password authentication failed\", puede haber otro PostgreSQL instalado usando el puerto 5433): %w", err)
	}

	return pool, nil
}
