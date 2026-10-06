import { useEffect, useState } from 'react'
import { pedir } from '../../api.js'
import Boton from '../../components/Boton.jsx'
import Tarjeta from '../../components/Tarjeta.jsx'
import Titulo from '../../components/Titulo.jsx'
import Icono from '../../components/Icono.jsx'
import CodigoCelula from '../../components/CodigoCelula.jsx'
import ChipEstado from '../../components/ChipEstado.jsx'
import ContadorMasMenos from '../../components/ContadorMasMenos.jsx'
import BotonesVivoMuerto from '../../components/BotonesVivoMuerto.jsx'
import SelectorNumero from '../../components/SelectorNumero.jsx'
import BotonesSiNo from '../../components/BotonesSiNo.jsx'
import Modal from '../../components/Modal.jsx'
import PanelInferior from '../../components/PanelInferior.jsx'
import Cargando from '../../components/Cargando.jsx'
import Vacio from '../../components/Vacio.jsx'
import MensajeError from '../../components/MensajeError.jsx'

// Página para ver y probar los componentes base. No es una pantalla de la app.
export default function Prueba() {
  const [vivo, setVivo] = useState(null)
  const [altura, setAltura] = useState(185)
  const [flores, setFlores] = useState(0)
  const [frutos, setFrutos] = useState(false)
  const [plantulas, setPlantulas] = useState(false)
  const [modal, setModal] = useState(false)
  const [panel, setPanel] = useState(false)
  const [guardando, setGuardando] = useState(false)

  // Prueba de conexión con el backend (T03): llama a /api/health al abrir la página.
  const [salud, setSalud] = useState({ cargando: true })
  const [intento, setIntento] = useState(0)

  useEffect(() => {
    pedir('/health')
      .then((datos) => setSalud({ datos }))
      .catch((error) => setSalud({ error: error.message }))
  }, [intento])

  function reintentarSalud() {
    setSalud({ cargando: true })
    setIntento(intento + 1)
  }

  function simularGuardado() {
    setGuardando(true)
    setTimeout(() => setGuardando(false), 2000)
  }

  return (
    <div className="space-y-8 py-4">
      <Titulo>Componentes base</Titulo>

      <section className="space-y-2">
        <h2 className="font-semibold">Conexión con el backend</h2>
        {salud.cargando && <Cargando filas={1} />}
        {salud.error && <MensajeError mensaje={salud.error} onReintentar={reintentarSalud} />}
        {salud.datos && (
          <Tarjeta>
            <p className="font-semibold">✓ El backend respondió:</p>
            <p className="font-mono">{JSON.stringify(salud.datos)}</p>
          </Tarjeta>
        )}
      </section>

      <section className="space-y-2">
        <Titulo nivel="md">Títulos</Titulo>
        <Titulo nivel="xl" como="p">Título xl</Titulo>
        <Titulo nivel="lg" como="p">Título lg</Titulo>
        <Titulo nivel="md" como="p">Título md</Titulo>
        <Titulo nivel="sm" como="p">Título sm</Titulo>
      </section>

      <section className="space-y-2">
        <Titulo nivel="md">Botones</Titulo>
        <Boton icono="save" cargando={guardando} onClick={simularGuardado}>
          Primario (tocá para ver "Guardando…")
        </Boton>
        <Boton variante="secundario" icono="photo_library">Secundario</Boton>
        <Boton variante="tonal">Tonal</Boton>
        <Boton variante="texto">Texto</Boton>
        <Boton variante="peligro">Peligro</Boton>
        <Boton disabled>Deshabilitado</Boton>
      </section>

      <section className="space-y-2">
        <Titulo nivel="md">Código y estados</Titulo>
        <CodigoCelula codigo="A-1-45" />
        <div className="flex flex-wrap gap-2">
          {['vivo', 'muerto', 'al-dia', 'pendiente', 'sin-registro', 'fuera-de-termino', 'baja'].map((e) => (
            <ChipEstado key={e} estado={e} />
          ))}
        </div>
      </section>

      <section className="space-y-2">
        <Titulo nivel="md">Bloque de individuo (carga mensual)</Titulo>
        <Tarjeta className="space-y-3">
          <h3 className="flex items-center gap-2 text-headline-sm font-semibold text-texto">
            <Icono nombre="park" className="text-arbol" />
            Árbol
          </h3>
          <BotonesVivoMuerto vivo={vivo} onChange={setVivo} />
          {vivo !== false && (
            <>
              <ContadorMasMenos etiqueta="Altura" unidad="cm" min={1} valor={altura} onChange={setAltura} ayuda="Octubre: 173 cm · +12" />
              <SelectorNumero etiqueta="Cantidad de flores" valor={flores} onChange={setFlores} ayuda="Octubre: 3 flores" />
              <BotonesSiNo etiqueta="Presencia de frutos" icono="nutrition" valor={frutos} onChange={setFrutos} />
              <BotonesSiNo etiqueta="Nuevas plántulas" icono="psychiatry" valor={plantulas} onChange={setPlantulas} />
            </>
          )}
        </Tarjeta>
      </section>

      <section className="space-y-2">
        <Titulo nivel="md">Modal y panel inferior</Titulo>
        <Boton variante="secundario" onClick={() => setModal(true)}>Abrir modal</Boton>
        <Boton variante="secundario" onClick={() => setPanel(true)}>Abrir panel inferior</Boton>
      </section>

      <section className="space-y-3">
        <Titulo nivel="md">Estados de pantalla</Titulo>
        <Cargando filas={2} />
        <Vacio icono="grid_view" titulo="Todavía no hay células en esta isleta" mensaje="Cuando se den de alta, van a aparecer acá." />
        <MensajeError mensaje="No hay conexión. Revisá tu señal y tocá Reintentar." onReintentar={() => {}} />
      </section>

      <Modal abierto={modal} titulo="¿Descartar los datos cargados?" onCerrar={() => setModal(false)}>
        <div className="space-y-2">
          <Boton onClick={() => setModal(false)}>Seguir cargando</Boton>
          <Boton variante="peligro" onClick={() => setModal(false)}>Descartar</Boton>
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