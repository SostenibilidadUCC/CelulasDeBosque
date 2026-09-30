import { useState } from 'react'
import Boton from '../../components/Boton.jsx'
import Tarjeta from '../../components/Tarjeta.jsx'
import ChipEstado from '../../components/ChipEstado.jsx'
import ContadorMasMenos from '../../components/ContadorMasMenos.jsx'
import BotonesVivoMuerto from '../../components/BotonesVivoMuerto.jsx'
import Modal from '../../components/Modal.jsx'
import PanelInferior from '../../components/PanelInferior.jsx'
import Cargando from '../../components/Cargando.jsx'
import Vacio from '../../components/Vacio.jsx'
import MensajeError from '../../components/MensajeError.jsx'

// Página para ver y probar todos los componentes base. No es una pantalla de la app.
export default function Prueba() {
  const [altura, setAltura] = useState(173)
  const [vivo, setVivo] = useState(null)
  const [modal, setModal] = useState(false)
  const [panel, setPanel] = useState(false)

  return (
    <div className="space-y-8 py-4">
      <h1 className="text-2xl font-bold text-primario">Componentes base</h1>

      <section className="space-y-2">
        <h2 className="font-semibold">Botones</h2>
        <Boton>Primario</Boton>
        <Boton variante="secundario">Secundario</Boton>
        <Boton variante="tonal">Tonal</Boton>
        <Boton variante="peligro">Peligro</Boton>
        <Boton disabled>Deshabilitado</Boton>
      </section>

      <section className="space-y-2">
        <h2 className="font-semibold">Código y estados</h2>
        <span className="codigo">A-1-45</span>
        <div className="flex flex-wrap gap-2">
          {['al-dia', 'pendiente', 'sin-registro', 'fuera-de-termino', 'baja', 'vivo', 'muerto'].map((e) => (
            <ChipEstado key={e} estado={e} />
          ))}
        </div>
      </section>

      <Tarjeta className="space-y-4">
        <h2 className="font-semibold text-primario">🌳 Árbol</h2>
        <BotonesVivoMuerto vivo={vivo} onChange={setVivo} />
        {vivo !== false && (
          <ContadorMasMenos etiqueta="Altura" unidad="cm" min={1} valor={altura} onChange={setAltura} />
        )}
      </Tarjeta>

      <section className="space-y-2">
        <h2 className="font-semibold">Modal y panel inferior</h2>
        <Boton variante="secundario" onClick={() => setModal(true)}>Abrir modal</Boton>
        <Boton variante="secundario" onClick={() => setPanel(true)}>Abrir panel inferior</Boton>
      </section>

      <section className="space-y-2">
        <h2 className="font-semibold">Estados de carga</h2>
        <Cargando filas={2} />
        <Vacio mensaje="Todavía no hay células en esta isleta" />
        <MensajeError mensaje="No hay conexión. Revisá tu señal y probá de nuevo." onReintentar={() => {}} />
      </section>

      <Modal abierto={modal} titulo="¿Descartar este registro?" onCerrar={() => setModal(false)}>
        <div className="space-y-2">
          <Boton variante="peligro" onClick={() => setModal(false)}>Descartar</Boton>
          <Boton variante="secundario" onClick={() => setModal(false)}>Seguir cargando</Boton>
        </div>
      </Modal>

      <PanelInferior abierto={panel} titulo="Célula A-1-45" onCerrar={() => setPanel(false)}>
        <div className="space-y-3">
          <ChipEstado estado="al-dia" />
          <Boton>Cargar registro</Boton>
          <Boton variante="secundario">Ver ficha</Boton>
        </div>
      </PanelInferior>
    </div>
  )
}