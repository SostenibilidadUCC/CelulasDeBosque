package auth

import "testing"

func TestPuedeEditarLugar(t *testing.T) {
	campus := &Lugar{ID: 1, Letra: "A", Nombre: "Campus UCC"}

	// Cada caso: quién es el usuario, qué lugar quiere editar y qué esperamos.
	casos := []struct {
		nombre   string
		usuario  *Usuario
		lugarID  int64
		esperado bool
	}{
		{"admin con cualquier lugar", &Usuario{Rol: RolAdmin}, 99, true},
		{"cargador con su lugar", &Usuario{Rol: RolCargador, Lugar: campus}, 1, true},
		{"cargador con otro lugar", &Usuario{Rol: RolCargador, Lugar: campus}, 2, false},
		{"cargador sin lugar", &Usuario{Rol: RolCargador, Lugar: nil}, 1, false},
		{"lector", &Usuario{Rol: RolLector}, 1, false},
		{"lector aunque tenga lugar", &Usuario{Rol: RolLector, Lugar: campus}, 1, false},
		{"sin sesión (nil)", nil, 1, false},
	}

	for _, caso := range casos {
		t.Run(caso.nombre, func(t *testing.T) {
			if obtenido := PuedeEditarLugar(caso.usuario, caso.lugarID); obtenido != caso.esperado {
				t.Errorf("esperaba %v, llegó %v", caso.esperado, obtenido)
			}
		})
	}
}

func TestEsAdmin(t *testing.T) {
	casos := []struct {
		nombre   string
		usuario  *Usuario
		esperado bool
	}{
		{"admin", &Usuario{Rol: RolAdmin}, true},
		{"cargador", &Usuario{Rol: RolCargador}, false},
		{"lector", &Usuario{Rol: RolLector}, false},
		{"sin sesión (nil)", nil, false},
	}

	for _, caso := range casos {
		t.Run(caso.nombre, func(t *testing.T) {
			if obtenido := EsAdmin(caso.usuario); obtenido != caso.esperado {
				t.Errorf("esperaba %v, llegó %v", caso.esperado, obtenido)
			}
		})
	}
}
