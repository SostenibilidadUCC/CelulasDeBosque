package handlers

import (
	"fmt"
	"strings"
	"time"
	"unicode/utf8"
)

// nombresFormaDeVida son los nombres de la tabla formas_de_vida (catálogo fijo de 4 filas).
// Se usan solo para armar mensajes de error que entienda la persona.
var nombresFormaDeVida = map[int16]string{1: "Árbol", 2: "Arbusto", 3: "Herbácea", 4: "Rastrera"}

// maxObservaciones es el largo máximo de las observaciones (igual al CHECK de la tabla registros).
const maxObservaciones = 500

// observacionesLimpias saca los espacios de los costados. Si queda vacío, devuelve nil (NULL en la base).
func observacionesLimpias(obs *string) *string {
	if obs == nil {
		return nil
	}
	limpio := strings.TrimSpace(*obs)
	if limpio == "" {
		return nil
	}
	return &limpio
}

// validarRegistro revisa un pedido completo (CAR-04, CAR-06, CAR-18, RN-06 a RN-08).
// No toca la base: recibe lo que necesita (hoy, la fecha de plantación y los rangos del catálogo),
// así se puede probar con tests simples.
// Devuelve la fecha ya convertida, y un mensaje de error en español ("" si todo está bien).
// La existencia de la foto se revisa aparte, porque necesita la base.
func validarRegistro(p pedidoRegistro, hoy, plantacion time.Time, rangos rangosMedicion) (time.Time, string) {
	fecha, err := time.Parse(formatoFecha, p.Fecha)
	if err != nil {
		return fecha, "La fecha no es válida"
	}
	// RN-06: ni futura ni anterior a la plantación.
	if fecha.After(hoy) {
		return fecha, "La fecha de medición no puede ser futura"
	}
	if fecha.Before(plantacion) {
		return fecha, fmt.Sprintf("La fecha de medición no puede ser anterior a la plantación (%s)", plantacion.Format("02/01/2006"))
	}

	// RN-07: la foto es obligatoria.
	if p.FotoID <= 0 {
		return fecha, "La foto es obligatoria"
	}

	if p.Observaciones != nil && utf8.RuneCountInString(strings.TrimSpace(*p.Observaciones)) > maxObservaciones {
		return fecha, fmt.Sprintf("Las observaciones pueden tener hasta %d caracteres", maxObservaciones)
	}

	// RN-01: exactamente 4 individuos, uno por forma de vida.
	if len(p.Individuos) != len(nombresFormaDeVida) {
		return fecha, "El registro tiene que incluir los 4 individuos de la célula"
	}
	vistas := map[int16]bool{}
	for _, ind := range p.Individuos {
		nombre, existe := nombresFormaDeVida[ind.FormaDeVida]
		if !existe {
			return fecha, fmt.Sprintf("La forma de vida %d no es válida", ind.FormaDeVida)
		}
		if vistas[ind.FormaDeVida] {
			return fecha, fmt.Sprintf("%s aparece repetido en el registro", nombre)
		}
		vistas[ind.FormaDeVida] = true

		if mensaje := validarIndividuo(ind, nombre, rangos); mensaje != "" {
			return fecha, mensaje
		}
	}
	return fecha, ""
}

// validarIndividuo aplica RN-08: vivo/muerto es obligatorio; si está vivo, también lo son
// la altura, las flores, los frutos y las nuevas plántulas. Si está muerto, esos datos
// se ignoran (no se guardan), aunque el front los mande.
func validarIndividuo(ind pedidoIndividuo, nombre string, rangos rangosMedicion) string {
	if ind.Vivo == nil {
		return nombre + ": indicá si está vivo o muerto"
	}
	if !*ind.Vivo {
		return ""
	}
	if ind.AlturaCm == nil || *ind.AlturaCm < rangos.AlturaMin || *ind.AlturaCm > rangos.AlturaMax {
		return fmt.Sprintf("%s: la altura tiene que estar entre %d y %d cm", nombre, rangos.AlturaMin, rangos.AlturaMax)
	}
	if ind.Flores == nil || *ind.Flores < rangos.FloresMin || *ind.Flores > rangos.FloresMax {
		return fmt.Sprintf("%s: la cantidad de flores tiene que estar entre %d y %d", nombre, rangos.FloresMin, rangos.FloresMax)
	}
	if ind.Frutos == nil {
		return nombre + ": indicá si tiene frutos"
	}
	if ind.PlantulasNuevas == nil {
		return nombre + ": indicá si hay nuevas plántulas"
	}
	return ""
}
