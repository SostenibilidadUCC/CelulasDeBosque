package almacen

import (
	"bytes"
	"context"
	"errors"
	"fmt"
	"io"
	"os"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/config"
	"github.com/aws/aws-sdk-go-v2/credentials"
	"github.com/aws/aws-sdk-go-v2/service/s3"
	"github.com/aws/aws-sdk-go-v2/service/s3/types"
)

// ErrSinConfigurar se devuelve cuando faltan las variables de entorno de R2.
var ErrSinConfigurar = errors.New("faltan variables de R2 (R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET)")

// R2 guarda los archivos en Cloudflare R2. R2 habla el mismo idioma que Amazon S3,
// por eso se usa el SDK de AWS apuntando a la dirección de Cloudflare.
type R2 struct {
	cliente *s3.Client
	bucket  string
}

// NuevoR2 arma el cliente con las variables de entorno. Si falta alguna devuelve ErrSinConfigurar.
func NuevoR2(ctx context.Context) (*R2, error) {
	cuenta := os.Getenv("R2_ACCOUNT_ID")
	clave := os.Getenv("R2_ACCESS_KEY_ID")
	secreto := os.Getenv("R2_SECRET_ACCESS_KEY")
	bucket := os.Getenv("R2_BUCKET")
	if cuenta == "" || clave == "" || secreto == "" || bucket == "" {
		return nil, ErrSinConfigurar
	}

	// R2 usa la región "auto". Las credenciales se pasan directo, sin buscar en ~/.aws.
	cfg, err := config.LoadDefaultConfig(ctx,
		config.WithRegion("auto"),
		config.WithCredentialsProvider(credentials.NewStaticCredentialsProvider(clave, secreto, "")),
	)
	if err != nil {
		return nil, fmt.Errorf("no se pudo armar la configuración de R2: %w", err)
	}
	cliente := s3.NewFromConfig(cfg, func(o *s3.Options) {
		o.BaseEndpoint = aws.String("https://" + cuenta + ".r2.cloudflarestorage.com")
		// Las versiones nuevas del SDK agregan checksums que R2 no siempre acepta:
		// se piden solo cuando la operación los exige.
		o.RequestChecksumCalculation = aws.RequestChecksumCalculationWhenRequired
		o.ResponseChecksumValidation = aws.ResponseChecksumValidationWhenRequired
	})
	return &R2{cliente: cliente, bucket: bucket}, nil
}

// Guardar sube el archivo al bucket.
func (r *R2) Guardar(ctx context.Context, clave string, contenido []byte, tipo string) error {
	_, err := r.cliente.PutObject(ctx, &s3.PutObjectInput{
		Bucket:      aws.String(r.bucket),
		Key:         aws.String(clave),
		Body:        bytes.NewReader(contenido),
		ContentType: aws.String(tipo),
	})
	return err
}

// Leer baja el archivo completo a memoria (las fotos pesan unos cientos de KB).
func (r *R2) Leer(ctx context.Context, clave string) ([]byte, error) {
	salida, err := r.cliente.GetObject(ctx, &s3.GetObjectInput{
		Bucket: aws.String(r.bucket),
		Key:    aws.String(clave),
	})
	if err != nil {
		var noExiste *types.NoSuchKey
		if errors.As(err, &noExiste) {
			return nil, ErrNoExiste
		}
		return nil, err
	}
	defer salida.Body.Close()
	return io.ReadAll(salida.Body)
}
