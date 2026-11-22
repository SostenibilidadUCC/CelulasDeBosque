// Chequeos de rol que usan varias pantallas, escritos en un solo lugar.
// Son solo experiencia de uso (mostrar u ocultar botones): el permiso real lo valida siempre el backend.

// ALT-01: dar de alta células pueden el administrador y el cargador. El lector no.
export function puedeCrearCelulas(usuario) {
  return usuario?.rol === 'admin' || usuario?.rol === 'cargador'
}
