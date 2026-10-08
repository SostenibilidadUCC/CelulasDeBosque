import { useState } from 'react'
import Boton from '../../components/Boton.jsx'
import CampoTexto from '../../components/CampoTexto.jsx'

// EXP-02: buscador por código (A-1-45) o número (45). Busca al tocar "Buscar" o la tecla
// Buscar del teclado del celular, no en cada letra, para no hacer un pedido por tecla.
// "inicial" es la búsqueda que está en la URL. Celulas.jsx le pone key={inicial}: si la URL
// cambia (por ejemplo, con el botón Atrás), React crea el buscador de nuevo con el texto nuevo.
export default function Buscador({ inicial, onBuscar }) {
  const [texto, setTexto] = useState(inicial)

  function alEnviar(evento) {
    evento.preventDefault() // sin esto, el formulario recargaría la página
    onBuscar(texto.trim())
  }

  return (
    <form role="search" onSubmit={alEnviar} className="flex items-end gap-2">
      <div className="min-w-0 flex-1">
        <CampoTexto
          etiqueta="Buscar célula"
          type="search"
          enterKeyHint="search"
          autoCapitalize="characters"
          placeholder="A-1-45 o 45"
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
        />
      </div>
      <div className="w-28 shrink-0">
        <Boton type="submit" variante="secundario" icono="search">
          Buscar
        </Boton>
      </div>
    </form>
  )
}
