// Paquete almacen: dónde se guardan los archivos de las fotos.
// Los handlers hablan con la interfaz Almacen, no con Cloudflare R2 directamente:
// así los tests usan un almacén falso en memoria, sin internet ni credenciales.
package almacen

import (
	"context"
	"errors"
)

// ErrNoExiste se devuelve cuando se pide un archivo que no está guardado.
var ErrNoExiste = errors.New("el archivo no existe en el almacén")

// Almacen guarda y lee archivos por una "clave" (la ruta dentro del bucket, por ejemplo "fotos/ab12.jpg").
type Almacen interface {
	// Guardar sube el contenido con esa clave. Si ya existía, lo reemplaza.
	Guardar(ctx context.Context, clave string, contenido []byte, tipo string) error
	// Leer devuelve el contenido, o ErrNoExiste si no hay nada con esa clave.
	Leer(ctx context.Context, clave string) ([]byte, error)
}
