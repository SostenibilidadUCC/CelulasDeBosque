# Imagen de producción (Render). Se arma en tres etapas: las dos primeras compilan
# y se descartan; la imagen final solo lleva lo necesario para correr.

# 1. Build del frontend de React.
FROM node:22-alpine AS frontend
WORKDIR /app/frontend
# Primero solo package*.json: si no cambiaron, Docker reutiliza el npm ci de la vez anterior.
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

# 2. Compilación del servidor Go y de goose (para correr las migraciones).
FROM golang:1.26-alpine AS backend
WORKDIR /app/backend
COPY backend/go.mod backend/go.sum ./
RUN go mod download
COPY backend/ ./
# CGO_ENABLED=0 arma un binario que no depende de librerías de C del sistema.
RUN CGO_ENABLED=0 go build -o /servidor . \
 && CGO_ENABLED=0 GOBIN=/ go install github.com/pressly/goose/v3/cmd/goose@v3.28.0

# 3. Imagen final.
FROM alpine:3.22
# ca-certificates: para conectarse a Neon por TLS. Las zonas horarias ya vienen dentro del binario (time/tzdata).
RUN apk add --no-cache ca-certificates
WORKDIR /app
COPY --from=backend /servidor /goose ./
COPY backend/migrations ./migrations
COPY --from=frontend /app/frontend/dist ./dist
ENV FRONTEND_DIR=/app/dist

# Al arrancar: primero las migraciones y después el servidor.
# Si una migración falla, el servidor no arranca y Render mantiene la versión anterior.
CMD ["sh", "-c", "./goose -dir migrations postgres \"$DATABASE_URL\" up && exec ./servidor"]
