import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { obtenerCelula } from '../../api.js'
import Boton from '../../components/Boton.jsx'
import Cargando from '../../components/Cargando.jsx'
import ChipEstado from '../../components/ChipEstado.jsx'
import CodigoCelula from '../../components/CodigoCelula.jsx'
import MensajeError from '../../components/MensajeError.jsx'
import Modal from '../../components/Modal.jsx'
import Titulo from '../../components/Titulo.jsx'
import Vacio from '../../components/Vacio.jsx'
import FotoRegistro from './FotoRegistro.jsx'
import GraficoEvolucion from './GraficoEvolucion.jsx'
import LineaDeTiempo from './LineaDeTiempo.jsx'
import TarjetaIndividuo from './TarjetaIndividuo.jsx'
import { fechaCorta } from './formato.js'

// Ficha de la célula (T15, FIC-01 a 05): su historia completa.
export default function Ficha() {
  const { id } = useParams()
  const navigate = useNavigate()

  const [carga, setCarga] = useState({ cargando: true })
  const [intento, setIntento] = useState(0)
  const [fotoAmpliada, setFotoAmpliada] = useState(null) // el registro cuya foto se ve grande

  useEffect(() => {
    let cancelado = false
    obtenerCelula(id)
      .then((datos) => {
        if (!cancelado) setCarga({ datos })
      })
      .catch((error) => {
        if (!cancelado) setCarga({ error })
      })
    return () => {
      cancelado = true
    }
  }, [id, intento])

  function reintentar() {
    setCarga({ cargando: true })
    setIntento((n) => n + 1)
  }

  if (carga.cargando) {
    return (
      <div className="py-4">
        <Cargando filas={4} />
      </div>
    )
  }

  if (carga.error?.estado === 404) {
    return (
      <Vacio icono="search_off" titulo="No existe esa célula" mensaje="Revisá el enlace o volvé al inicio.">
        <Boton variante="secundario" onClick={() => navigate('/')}>
          Volver al inicio
        </Boton>
      </Vacio>
    )
  }

  if (carga.error) {
    return (
      <div className="py-4">
        <MensajeError mensaje={carga.error.message} onReintentar={reintentar} />
      </div>
    )
  }

  const celula = carga.datos
  const { registros } = celula
  const cantidadRegistros = registros.length === 1 ? '1 registro' : `${registros.length} registros`

  return (
    <div className="flex flex-col gap-6 py-4">
      {/* FIC-01: encabezado */}
      <header className="flex flex-col gap-2">
        <nav aria-label="Migas de pan" className="text-body-md text-texto-2">
          {celula.lugar.nombre} ›{' '}
          <Link to={`/isletas/${celula.isleta.id}`} className="text-bosque underline-offset-2 hover:underline">
            Isleta {celula.isleta.numero}
          </Link>{' '}
          › {celula.codigo}
        </nav>
        <div className="flex flex-wrap items-center gap-2">
          <Titulo nivel="lg">Célula</Titulo>
          <CodigoCelula codigo={celula.codigo} className="text-label-lg" />
          <ChipEstado estado={celula.estado} />
        </div>
        <p className="text-body-md text-texto-2 tabular-nums">
          Plantada el {fechaCorta(celula.fechaPlantacion)} · {cantidadRegistros}
        </p>
      </header>

      {registros.length === 0 ? (
        <Vacio
          icono="hourglass_empty"
          titulo="Todavía no hay registros"
          mensaje="Cuando se cargue el registro inicial, acá vas a ver la evolución de la célula."
        />
      ) : (
        <>
          {/* FIC-02: individuos */}
          <section className="flex flex-col gap-3">
            <Titulo nivel="md">Individuos</Titulo>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              {celula.individuos.map((ind) => (
                <TarjetaIndividuo key={ind.id} individuo={ind} registros={registros} />
              ))}
            </div>
          </section>

          {/* FIC-03: gráfico */}
          <section className="flex flex-col gap-3">
            <Titulo nivel="md">Evolución</Titulo>
            <GraficoEvolucion individuos={celula.individuos} registros={registros} />
          </section>

          {/* FIC-04 y FIC-05: registros con foto */}
          <section className="flex flex-col gap-3">
            <Titulo nivel="md">Registros</Titulo>
            <LineaDeTiempo
              celulaId={celula.id}
              individuos={celula.individuos}
              registros={registros}
              onAmpliar={setFotoAmpliada}
            />
          </section>
        </>
      )}

      <Modal
        abierto={fotoAmpliada != null}
        titulo={fotoAmpliada ? `${celula.codigo} · ${fechaCorta(fotoAmpliada.fecha)}` : ''}
        onCerrar={() => setFotoAmpliada(null)}
      >
        {fotoAmpliada && (
          <div className="flex flex-col gap-4">
            <FotoRegistro fotoId={fotoAmpliada.fotoId} descripcion={`Foto del ${fechaCorta(fotoAmpliada.fecha)}`} />
            <Boton variante="secundario" onClick={() => setFotoAmpliada(null)}>
              Cerrar
            </Boton>
          </div>
        )}
      </Modal>
    </div>
  )
}