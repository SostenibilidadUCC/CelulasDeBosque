package handlers

import (
	"bytes"
	"crypto/rand"
	"encoding/hex"
	"errors"
	"image"
	"image/jpeg"
	_ "image/png" // registra el decodificador de PNG para que image.Decode lo entienda
	"io"
	"log"
	"net/http"
	"strconv"

	"github.com/SostenibilidadUCC/CelulasDeBosque/backend/internal/almacen"
	"github.com/SostenibilidadUCC/CelulasDeBosque/backend/internal/auth"
	"github.com/SostenibilidadUCC/CelulasDeBosque/backend/internal/respuestas"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

const (
	// maxBytesFoto es lo máximo que se acepta por pedido. El front ya achica la foto
	// (lado mayor 1600 px), así que una foto real pesa menos de 1 MB.
	maxBytesFoto = 10 << 20 // 10 MB

	// maxPixelesFoto evita las "bombas de descompresión": un archivo chiquito que al abrirlo
	// ocupa gigas de memoria. El front ya manda fotos de 1600 px de lado mayor (unos 2 millones
	// de píxeles), así que 16 millones sobra. Al abrirla, una foto ocupa unos 4 bytes por píxel:
	// 16 millones son unos 64 MB, contra unos 200 MB con el límite anterior de 50 millones.
	maxPixelesFoto = 16_000_000

	// calidadJPEG es la calidad al volver a guardar la foto (de 1 a 100).
	calidadJPEG = 85

	mensajeErrorFoto = "No se pudo procesar la foto. Probá de nuevo en unos minutos."
)

// errImagenInvalida quiere decir que el archivo no es una imagen que podamos usar.
var errImagenInvalida = errors.New("el archivo no es una imagen válida")

// limpiarImagen decodifica la imagen y la vuelve a guardar como JPEG.
//
// Esto es lo que borra la ubicación GPS (PRI-05): los datos EXIF (GPS, modelo del celular, fecha)
// viajan como "metadatos" dentro del archivo, aparte de los píxeles. image.Decode lee solo los
// píxeles y jpeg.Encode escribe un archivo nuevo con solo esos píxeles, así que NADA de los
// metadatos pasa al archivo nuevo. Se usa solo la librería estándar de Go.
//
// Aviso: al no copiar el EXIF tampoco se copia la orientación. Eso no es problema porque
// browser-image-compression, que usa el front, ya endereza la foto antes de subirla.
func limpiarImagen(origen io.Reader) ([]byte, error) {
	datos, err := io.ReadAll(origen)
	if err != nil {
		return nil, err
	}

	// DecodeConfig lee solo el encabezado: da el tamaño sin cargar toda la imagen en memoria.
	config, _, err := image.DecodeConfig(bytes.NewReader(datos))
	if err != nil || config.Width*config.Height > maxPixelesFoto {
		return nil, errImagenInvalida
	}
	imagen, _, err := image.Decode(bytes.NewReader(datos))
	if err != nil {
		return nil, errImagenInvalida
	}

	var salida bytes.Buffer
	if err := jpeg.Encode(&salida, imagen, &jpeg.Options{Quality: calidadJPEG}); err != nil {
		return nil, err
	}
	return salida.Bytes(), nil
}

// claveAleatoria arma el nombre del archivo en R2: "fotos/" + 16 bytes al azar en hexadecimal.
// Al azar, para que no se pueda adivinar la dirección de una foto ajena.
func claveAleatoria() (string, error) {
	bytesAzar := make([]byte, 16)
	if _, err := rand.Read(bytesAzar); err != nil {
		return "", err
	}
	return "fotos/" + hex.EncodeToString(bytesAzar) + ".jpg", nil
}

// puedeSubirFotos dice si el usuario puede subir fotos: el admin y los cargadores.
// El lector y el visitante (nil) no.
func puedeSubirFotos(u *auth.Usuario) bool {
	return auth.EsAdmin(u) || (u != nil && u.Rol == auth.RolCargador)
}

// SubirFoto atiende POST /api/fotos (T13). Recibe un formulario multipart con el archivo en el
// campo "foto", le borra los metadatos, lo sube a R2 y guarda la ruta en la tabla fotos.
// Responde {"id": <id de la foto>}. Va envuelta en RequiereSesion; pueden subir el admin y los cargadores.
func SubirFoto(pool *pgxpool.Pool, alm almacen.Almacen) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		usuario := auth.UsuarioActual(r)
		if !puedeSubirFotos(usuario) {
			respuestas.Error(w, http.StatusForbidden, "No tenés permiso para subir fotos")
			return
		}
		if alm == nil { // faltan las credenciales de R2 (ya se avisó en el log al arrancar)
			log.Print("fotos: R2 no está configurado, no se puede subir la foto")
			respuestas.Error(w, http.StatusInternalServerError, mensajeErrorFoto)
			return
		}

		// Se corta el pedido en 10 MB: más allá de eso, la lectura falla.
		r.Body = http.MaxBytesReader(w, r.Body, maxBytesFoto)
		archivo, _, err := r.FormFile("foto")
		if err != nil {
			var demasiado *http.MaxBytesError
			if errors.As(err, &demasiado) {
				respuestas.Error(w, http.StatusBadRequest, "La foto pesa demasiado (máximo 10 MB)")
				return
			}
			respuestas.Error(w, http.StatusBadRequest, "Falta la foto")
			return
		}
		defer archivo.Close()
		defer r.MultipartForm.RemoveAll() // borra los archivos temporales que Go haya creado

		contenido, err := limpiarImagen(archivo)
		if errors.Is(err, errImagenInvalida) {
			respuestas.Error(w, http.StatusBadRequest, "El archivo no es una foto válida (usá JPG o PNG)")
			return
		}
		if err != nil {
			log.Printf("fotos: no se pudo limpiar la imagen: %v", err)
			respuestas.Error(w, http.StatusInternalServerError, mensajeErrorFoto)
			return
		}

		clave, err := claveAleatoria()
		if err != nil {
			log.Printf("fotos: no se pudo generar la clave: %v", err)
			respuestas.Error(w, http.StatusInternalServerError, mensajeErrorFoto)
			return
		}
		// Primero se sube el archivo y después se guarda la fila: así nunca queda una fila
		// que apunta a un archivo que no existe.
		if err := alm.Guardar(r.Context(), clave, contenido, "image/jpeg"); err != nil {
			log.Printf("fotos: no se pudo subir a R2: %v", err)
			respuestas.Error(w, http.StatusInternalServerError, mensajeErrorFoto)
			return
		}

		var id int64
		err = pool.QueryRow(r.Context(),
			`INSERT INTO fotos (ruta_r2, subida_por) VALUES ($1, $2) RETURNING id`,
			clave, usuario.ID).Scan(&id)
		if err != nil {
			log.Printf("fotos: no se pudo guardar la foto en la base (archivo huérfano %s): %v", clave, err)
			respuestas.Error(w, http.StatusInternalServerError, mensajeErrorFoto)
			return
		}

		respuestas.JSON(w, map[string]int64{"id": id})
	}
}

// VerFoto atiende GET /api/fotos/{id} (T13). Devuelve los bytes de la imagen.
// NO va envuelta en RequiereSesion: usuarioDe devuelve el usuario si hay sesión, o nil.
//   - Con sesión, cualquier rol ve cualquier foto (todos ven todos los lugares).
//   - Sin sesión, solo se ve si la foto es de un registro de un lugar público (RN-15, PUB-04).
//
// Nunca se muestra la dirección de R2: el servidor baja el archivo y lo reenvía.
func VerFoto(pool *pgxpool.Pool, alm almacen.Almacen, usuarioDe func(*http.Request) *auth.Usuario) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		// Todo lo que no se puede mostrar responde 404, nunca 403: un 403 le confirmaría a un
		// visitante que esa foto existe pero es privada.
		noExiste := func() { respuestas.Error(w, http.StatusNotFound, "No existe esa foto") }

		id, err := strconv.ParseInt(r.PathValue("id"), 10, 64)
		if err != nil {
			noExiste()
			return
		}
		if alm == nil {
			log.Print("fotos: R2 no está configurado, no se puede leer la foto")
			respuestas.Error(w, http.StatusInternalServerError, mensajeErrorFoto)
			return
		}

		var ruta string
		if usuarioDe(r) != nil {
			err = pool.QueryRow(r.Context(), `SELECT ruta_r2 FROM fotos WHERE id = $1`, id).Scan(&ruta)
		} else {
			// Sin sesión: la foto tiene que ser de un registro (no anulado) de un lugar público y activo.
			err = pool.QueryRow(r.Context(), `
				SELECT f.ruta_r2
				FROM fotos f
				WHERE f.id = $1
				  AND EXISTS (
				      SELECT 1
				      FROM registros r
				      JOIN celulas c ON c.id = r.celula_id
				      JOIN isletas i ON i.id = c.isleta_id
				      JOIN lugares l ON l.id = i.lugar_id
				      WHERE r.foto_id = f.id AND NOT r.anulado AND l.es_publico AND l.activo
				  )`, id).Scan(&ruta)
		}
		if errors.Is(err, pgx.ErrNoRows) {
			noExiste()
			return
		}
		if err != nil {
			log.Printf("fotos: no se pudo buscar la foto %d: %v", id, err)
			respuestas.Error(w, http.StatusInternalServerError, mensajeErrorFoto)
			return
		}

		contenido, err := alm.Leer(r.Context(), ruta)
		if errors.Is(err, almacen.ErrNoExiste) {
			noExiste() // la fila existe pero el archivo no (por ejemplo las fotos del seed)
			return
		}
		if err != nil {
			log.Printf("fotos: no se pudo leer %s de R2: %v", ruta, err)
			respuestas.Error(w, http.StatusInternalServerError, mensajeErrorFoto)
			return
		}

		w.Header().Set("Content-Type", "image/jpeg")
		w.Header().Set("X-Content-Type-Options", "nosniff")
		// "private": solo el navegador de la persona la guarda, no una caché compartida.
		w.Header().Set("Cache-Control", "private, max-age=86400")
		w.Write(contenido)
	}
}
