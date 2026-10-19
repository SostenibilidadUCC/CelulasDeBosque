package handlers

import (
	"strings"
	"testing"
	"time"
)

// Rangos del catálogo (migración 00002), para no necesitar la base en estos tests.
var rangosDePrueba = rangosMedicion{AlturaMin: 1, AlturaMax: 999, FloresMin: 0, FloresMax: 100}

func fechaDePrueba(texto string) time.Time {
	f, err := time.Parse(formatoFecha, texto)
	if err != nil {
		panic(err)
	}
	return f
}

func ptrBool(b bool) *bool { return &b }
func ptrInt(n int) *int    { return &n }

// vivoCompleto es un individuo vivo con todos sus datos.
func vivoCompleto(forma int16) pedidoIndividuo {
	return pedidoIndividuo{FormaDeVida: forma, Vivo: ptrBool(true), AlturaCm: ptrInt(50),
		Flores: ptrInt(3), Frutos: ptrBool(false), PlantulasNuevas: ptrBool(true)}
}

// pedidoValido arma un pedido correcto; cada test cambia solo lo que quiere probar.
func pedidoValido() pedidoRegistro {
	return pedidoRegistro{
		Fecha:  "2026-11-18",
		FotoID: 812,
		Individuos: []pedidoIndividuo{
			vivoCompleto(1),
			vivoCompleto(2),
			{FormaDeVida: 3, Vivo: ptrBool(false)},
			vivoCompleto(4),
		},
	}
}

func TestValidarRegistro(t *testing.T) {
	hoy := fechaDePrueba("2026-11-20")
	plantacion := fechaDePrueba("2026-11-10")

	casos := []struct {
		nombre string
		editar func(p *pedidoRegistro)
		error  string // texto que tiene que contener el mensaje; "" si el pedido es válido
	}{
		{"pedido válido", func(p *pedidoRegistro) {}, ""},
		{"fecha mal escrita", func(p *pedidoRegistro) { p.Fecha = "18/11/2026" }, "fecha no es válida"},
		{"fecha futura", func(p *pedidoRegistro) { p.Fecha = "2026-11-21" }, "futura"},
		{"fecha de hoy", func(p *pedidoRegistro) { p.Fecha = "2026-11-20" }, ""},
		{"fecha anterior a la plantación", func(p *pedidoRegistro) { p.Fecha = "2026-11-09" }, "anterior a la plantación"},
		{"fecha igual a la plantación", func(p *pedidoRegistro) { p.Fecha = "2026-11-10" }, ""},
		{"sin foto", func(p *pedidoRegistro) { p.FotoID = 0 }, "foto es obligatoria"},
		{"observaciones muy largas", func(p *pedidoRegistro) {
			largo := strings.Repeat("a", 501)
			p.Observaciones = &largo
		}, "500 caracteres"},
		{"solo 3 individuos", func(p *pedidoRegistro) { p.Individuos = p.Individuos[:3] }, "4 individuos"},
		{"forma de vida repetida", func(p *pedidoRegistro) { p.Individuos[1].FormaDeVida = 1 }, "repetido"},
		{"forma de vida inexistente", func(p *pedidoRegistro) { p.Individuos[1].FormaDeVida = 7 }, "no es válida"},
		{"sin vivo", func(p *pedidoRegistro) { p.Individuos[0].Vivo = nil }, "vivo o muerto"},
		{"vivo sin altura", func(p *pedidoRegistro) { p.Individuos[0].AlturaCm = nil }, "altura"},
		{"altura 0", func(p *pedidoRegistro) { p.Individuos[0].AlturaCm = ptrInt(0) }, "altura"},
		{"altura 1000", func(p *pedidoRegistro) { p.Individuos[0].AlturaCm = ptrInt(1000) }, "altura"},
		{"altura 999", func(p *pedidoRegistro) { p.Individuos[0].AlturaCm = ptrInt(999) }, ""},
		{"vivo sin flores", func(p *pedidoRegistro) { p.Individuos[0].Flores = nil }, "flores"},
		{"flores negativas", func(p *pedidoRegistro) { p.Individuos[0].Flores = ptrInt(-1) }, "flores"},
		{"flores 101", func(p *pedidoRegistro) { p.Individuos[0].Flores = ptrInt(101) }, "flores"},
		{"flores 0", func(p *pedidoRegistro) { p.Individuos[0].Flores = ptrInt(0) }, ""},
		{"vivo sin frutos", func(p *pedidoRegistro) { p.Individuos[0].Frutos = nil }, "frutos"},
		{"vivo sin plántulas", func(p *pedidoRegistro) { p.Individuos[0].PlantulasNuevas = nil }, "plántulas"},
		{"muerto con datos de más se ignora", func(p *pedidoRegistro) {
			p.Individuos[2].AlturaCm = ptrInt(5000)
		}, ""},
	}

	for _, caso := range casos {
		t.Run(caso.nombre, func(t *testing.T) {
			p := pedidoValido()
			caso.editar(&p)
			_, mensaje := validarRegistro(p, hoy, plantacion, rangosDePrueba)
			if caso.error == "" && mensaje != "" {
				t.Errorf("se esperaba un pedido válido, llegó el error %q", mensaje)
			}
			if caso.error != "" && !strings.Contains(mensaje, caso.error) {
				t.Errorf("el error %q tendría que contener %q", mensaje, caso.error)
			}
		})
	}
}

func TestHoyEnCordoba(t *testing.T) {
	// 1/11 a las 01:30 UTC es todavía 31/10 en Córdoba (UTC-3).
	ahora := time.Date(2026, 11, 1, 1, 30, 0, 0, time.UTC)
	if hoy := hoyEnCordoba(ahora); hoy.Format(formatoFecha) != "2026-10-31" {
		t.Errorf("hoy = %s, se esperaba 2026-10-31", hoy.Format(formatoFecha))
	}
}

func TestObservacionesLimpias(t *testing.T) {
	espacios, texto := "   ", "  hola  "
	if observacionesLimpias(nil) != nil {
		t.Error("nil tiene que seguir siendo nil")
	}
	if observacionesLimpias(&espacios) != nil {
		t.Error("solo espacios tiene que quedar en nil")
	}
	if obtenido := observacionesLimpias(&texto); obtenido == nil || *obtenido != "hola" {
		t.Errorf("se esperaba \"hola\", llegó %v", obtenido)
	}
}
