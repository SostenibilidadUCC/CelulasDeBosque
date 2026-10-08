// Paquete estados: el estado de cada célula en el mes (sección 5 del documento v4).
//
// La consulta de estados se escribe UNA sola vez, acá adentro. Los handlers no escriben
// su propio SQL de estados: llaman a DeCelulas. Así, si cambia una regla (por ejemplo,
// cuándo vence la carga), se cambia en un solo lugar.
//
// Ejemplo de uso en un handler (por ejemplo, el plano de la isleta):
//
//	// 1. Juntar los ids de las células que ya se leyeron de la base.
//	ids := make([]int64, 0, len(celulas))
//	for _, c := range celulas {
//		ids = append(ids, c.ID)
//	}
//
//	// 2. Pedir los estados de todas juntas, con el período actual en hora de Córdoba.
//	estadoDe, err := estados.DeCelulas(r.Context(), pool, ids, estados.PeriodoActual(time.Now()))
//	if err != nil {
//		log.Printf("isletas: no se pudieron calcular los estados: %v", err)
//		respuestas.Error(w, http.StatusInternalServerError, "No se pudo cargar la isleta. Probá de nuevo.")
//		return
//	}
//
//	// 3. Completar el estado de cada célula.
//	for i := range celulas {
//		estado := estadoDe[celulas[i].ID]
//		celulas[i].Estado = &estado
//	}
package estados

import (
	"context"
	"fmt"
	"time"

	// El "_" importa el paquete solo por su efecto: mete dentro del programa los datos de
	// todas las zonas horarias. Sin esto, time.LoadLocation los busca en el sistema
	// operativo, y si el servidor (por ejemplo, el de Railway) no los tiene, falla.
	_ "time/tzdata"

	"github.com/jackc/pgx/v5/pgxpool"
)

// Estados de una célula en el mes. Los nombres tienen que coincidir con los que usan
// ChipEstado y Plano en el frontend.
const (
	AlDia          = "al-dia"
	Pendiente      = "pendiente"
	SinRegistro    = "sin-registro"
	FueraDeTermino = "fuera-de-termino"
	Baja           = "baja"
)

// cordoba es la zona horaria del programa. Se carga una sola vez al arrancar.
// time.FixedZone sería más simple, pero LoadLocation respeta si algún día Argentina
// vuelve a cambiar la hora.
var cordoba = cargarCordoba()

func cargarCordoba() *time.Location {
	zona, err := time.LoadLocation("America/Argentina/Cordoba")
	if err != nil {
		// No debería pasar nunca: los datos vienen dentro del programa gracias a time/tzdata.
		panic(fmt.Sprintf("estados: no se pudo cargar la zona horaria de Córdoba: %v", err))
	}
	return zona
}

// DatosCelula son los datos de una célula que hacen falta para saber su estado en el mes.
//
// IMPORTANTE: TieneRegistros y TieneRegistroDelPeriodo cuentan solo registros NO anulados.
// Un registro anulado no cuenta para nada (RN-12).
type DatosCelula struct {
	DadaDeBaja              bool // celulas.estado = 'baja' (RN-14)
	TieneRegistros          bool // tiene al menos un registro no anulado, de cualquier período
	TieneRegistroDelPeriodo bool // tiene un registro no anulado del período actual
	FueraDeTermino          bool // el registro DEL PERÍODO ACTUAL se cargó tarde (no uno de meses anteriores)
}

// EstadoCelula devuelve el estado de la célula en el mes. El orden de los if es la prioridad:
// baja > sin-registro > fuera-de-termino o al-dia > pendiente.
func EstadoCelula(d DatosCelula) string {
	if d.DadaDeBaja {
		return Baja
	}
	if !d.TieneRegistros {
		return SinRegistro
	}
	if d.TieneRegistroDelPeriodo {
		if d.FueraDeTermino {
			return FueraDeTermino
		}
		return AlDia
	}
	return Pendiente
}

// PeriodoActual devuelve el primer día del mes actual en hora de Córdoba, sin importar
// la zona horaria del servidor. Ejemplo: el 31/10 a las 23:30 en Córdoba (que en UTC ya
// es 1/11) devuelve el 1/10.
func PeriodoActual(ahora time.Time) time.Time {
	local := ahora.In(cordoba)
	return time.Date(local.Year(), local.Month(), 1, 0, 0, 0, 0, cordoba)
}

// DiasHastaVencimiento devuelve cuántos días faltan para que venza la carga del mes,
// en hora de Córdoba (INI-02). El último día del mes devuelve 0.
//
// El vencimiento a fin de mes es la propuesta de RN-16, todavía a confirmar con la
// clienta (pregunta 11). Si cambia, se cambia solo acá.
func DiasHastaVencimiento(ahora time.Time) int {
	local := ahora.In(cordoba)
	// El "día 0" del mes siguiente es, para Go, el último día de este mes.
	ultimoDia := time.Date(local.Year(), local.Month()+1, 0, 0, 0, 0, 0, cordoba)
	return ultimoDia.Day() - local.Day()
}

// consultaEstados trae los cuatro datos de DatosCelula para varias células a la vez.
//   - $1 es la lista de ids. "c.id = ANY($1)" quiere decir "c.id está en la lista".
//   - $2 es el período como texto ("2026-10-01"). El ::date lo convierte a fecha en
//     PostgreSQL; pasarlo como texto evita que se corra de día por la zona horaria.
//   - El LEFT JOIN busca el registro del período; es LEFT para que también vengan las
//     células que no lo tienen (en ese caso rp.id es NULL). Hay como máximo uno (RN-04).
//   - Los anulados se excluyen en los dos lugares donde se buscan registros (RN-12).
const consultaEstados = `
	SELECT c.id,
	       c.estado = 'baja',
	       EXISTS (SELECT 1 FROM registros r WHERE r.celula_id = c.id AND NOT r.anulado),
	       rp.id IS NOT NULL,
	       COALESCE(rp.fuera_de_termino, false)
	FROM celulas c
	LEFT JOIN registros rp ON rp.celula_id = c.id AND rp.periodo = $2::date AND NOT rp.anulado
	WHERE c.id = ANY($1)`

// DeCelulas devuelve el estado de cada célula en el período, en un map de id de célula a estado.
// Hace una sola consulta para todas las células. Si un id no existe en la base, no aparece en el map.
func DeCelulas(ctx context.Context, pool *pgxpool.Pool, celulaIDs []int64, periodo time.Time) (map[int64]string, error) {
	estadoDe := make(map[int64]string, len(celulaIDs))
	if len(celulaIDs) == 0 {
		// Nada que buscar: no hace falta molestar a la base.
		return estadoDe, nil
	}

	filas, err := pool.Query(ctx, consultaEstados, celulaIDs, periodo.Format("2006-01-02"))
	if err != nil {
		return nil, fmt.Errorf("estados: no se pudo consultar: %w", err)
	}
	defer filas.Close()

	for filas.Next() {
		var (
			id    int64
			datos DatosCelula
		)
		if err := filas.Scan(&id, &datos.DadaDeBaja, &datos.TieneRegistros,
			&datos.TieneRegistroDelPeriodo, &datos.FueraDeTermino); err != nil {
			return nil, fmt.Errorf("estados: no se pudo leer una fila: %w", err)
		}
		estadoDe[id] = EstadoCelula(datos)
	}
	if err := filas.Err(); err != nil {
		return nil, fmt.Errorf("estados: error al recorrer las filas: %w", err)
	}
	return estadoDe, nil
}
