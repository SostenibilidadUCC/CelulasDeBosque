import { useEffect, useState } from 'react'
import { obtenerLugares, obtenerMetricas } from '../../api.js'
import Cargando from '../../components/Cargando.jsx'
import MensajeError from '../../components/MensajeError.jsx'
import Tarjeta from '../../components/Tarjeta.jsx'
import Titulo from '../../components/Titulo.jsx'
import Vacio from '../../components/Vacio.jsx'
import Filtros from './Filtros.jsx'
import GraficoAltura from './GraficoAltura.jsx'
import GraficoSupervivencia from './GraficoSupervivencia.jsx'
import SupervivenciaPorForma from './SupervivenciaPorForma.jsx'
import TarjetaMetrica from './TarjetaMetrica.jsx'
import { rangoDelPeriodo } from './periodos.js'

const SIN_DATOS_GRAFICO = 'Todavía no hay registros suficientes para este gráfico'

// Pantalla Resultados (T18, RES-01 a 05 y 07): pocas métricas claras sobre el impacto.
export default function Resultados() {
  // Los filtros van como texto, igual que en los <select>: '' quiere decir "todos".
  const [filtros, setFiltros] = useState({ lugar: '', isleta: '', periodo: 'todo', forma: '' })
  const [lugares, setLugares] = useState({ cargando: true })
  const [metricas, setMetricas] = useState({ cargando: true })
  const [intento, setIntento] = useState(0)

  // 1. Los lugares (con sus isletas) para los filtros. De acá sale también el período actual.
  useEffect(() => {
    let cancelado = false
    obtenerLugares()
      .then((datos) => {
        if (!cancelado) setLugares({ datos })
      })
      .catch((error) => {
        if (!cancelado) setLugares({ error })
      })
    return () => {
      cancelado = true
    }
  }, [intento])

  // 2. Las métricas, cada vez que cambia un filtro. "cancelado" evita que una respuesta vieja
  // (de un filtro anterior que tardó más) pise a la nueva.
  const periodoActual = lugares.datos?.periodo
  useEffect(() => {
    if (!periodoActual) return
    let cancelado = false
    const { desde, hasta } = rangoDelPeriodo(filtros.periodo, periodoActual)
    obtenerMetricas({ lugar: filtros.lugar, isleta: filtros.isleta, forma: filtros.forma, desde, hasta })
      .then((datos) => {
        if (!cancelado) setMetricas({ datos })
      })
      .catch((error) => {
        if (!cancelado) setMetricas({ error })
      })
    return () => {
      cancelado = true
    }
  }, [filtros, periodoActual, intento])

  // Al cambiar un filtro se muestran los datos anteriores más claros hasta que llegan los nuevos.
  // Si cambia el lugar, la isleta vuelve a "todas" (la anterior era de otro lugar).
  function cambiarFiltros(cambio) {
    setFiltros((anteriores) => ({ ...anteriores, ...cambio, ...('lugar' in cambio ? { isleta: '' } : {}) }))
    setMetricas((anteriores) => ({ ...anteriores, cargando: true }))
  }

  function reintentar() {
    setLugares((anteriores) => (anteriores.datos ? anteriores : { cargando: true }))
    setMetricas({ cargando: true })
    setIntento((n) => n + 1)
  }

  const error = lugares.error ?? metricas.error
  const m = metricas.datos

  return (
    <div className="flex flex-col gap-6 py-4">
      <header className="flex flex-col gap-1">
        <Titulo nivel="lg">Resultados</Titulo>
        <p className="text-body-md text-texto-2">Cómo crecen y sobreviven las células de bosque.</p>
      </header>

      {lugares.datos && (
        <Filtros
          filtros={filtros}
          lugares={lugares.datos.lugares}
          formasDeVida={m?.formasDeVida ?? []}
          onCambiar={cambiarFiltros}
        />
      )}

      {error ? (
        <MensajeError mensaje={error.message} onReintentar={reintentar} />
      ) : !m ? (
        <Cargando filas={4} />
      ) : m.individuosConRegistro === 0 ? (
        // RES-07: sin registros, un mensaje en lugar de tarjetas y gráficos vacíos.
        <Vacio
          icono="hourglass_empty"
          titulo="Todavía no hay registros suficientes"
          mensaje="Cuando se carguen registros con estos filtros, acá vas a ver los resultados."
        />
      ) : (
        <div className={`flex flex-col gap-6 transition-opacity ${metricas.cargando ? 'opacity-50' : ''}`} aria-busy={metricas.cargando}>
          {/* RES-02: las 4 métricas principales (pendiente 4: las elige la clienta). */}
          <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <TarjetaMetrica icono="grid_view" nombre="Células plantadas" valor={m.celulasPlantadas} contexto="células activas" />
            <TarjetaMetrica
              icono="favorite"
              nombre="Supervivencia"
              valor={m.tasaSupervivencia}
              unidad="%"
              contexto={`de ${m.individuosConRegistro.toLocaleString('es-AR')} individuos`}
            />
            <TarjetaMetrica
              icono="height"
              nombre="Crecimiento promedio"
              valor={m.crecimientoPromedioCm}
              unidad="cm"
              contexto="desde el registro inicial"
            />
            <TarjetaMetrica
              icono="filter_vintage"
              nombre="En floración"
              valor={m.individuosEnFloracion}
              unidad="%"
              contexto="de los individuos vivos"
            />
          </section>

          <section className="flex flex-col gap-3">
            <Titulo nivel="md">Supervivencia por forma de vida</Titulo>
            <SupervivenciaPorForma datos={m.supervivenciaPorForma} />
          </section>

          <section className="flex flex-col gap-3">
            <Titulo nivel="md">Evolución de la altura</Titulo>
            <Tarjeta>
              {m.evolucion.length < 2 ? (
                <p className="py-8 text-center text-body-md text-texto-2">{SIN_DATOS_GRAFICO}</p>
              ) : (
                <GraficoAltura
                  evolucion={m.evolucion}
                  formas={m.formasDeVida.filter((f) => !filtros.forma || String(f.formaDeVida) === filtros.forma)}
                />
              )}
            </Tarjeta>
          </section>

          <section className="flex flex-col gap-3">
            <Titulo nivel="md">Evolución de la supervivencia</Titulo>
            <Tarjeta>
              {m.evolucion.length < 2 ? (
                <p className="py-8 text-center text-body-md text-texto-2">{SIN_DATOS_GRAFICO}</p>
              ) : (
                <GraficoSupervivencia evolucion={m.evolucion} />
              )}
            </Tarjeta>
          </section>
        </div>
      )}
    </div>
  )
}
