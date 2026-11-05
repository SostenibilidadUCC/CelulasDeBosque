import { useEffect, useState } from 'react'
import Icono from '../../components/Icono.jsx'
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

// Gráficos de evolución: se ve uno a la vez, igual que en la Ficha (Altura / Flores).
const GRAFICOS = [
  { valor: 'altura', texto: 'Altura', icono: 'height' },
  { valor: 'supervivencia', texto: 'Supervivencia', icono: 'favorite' },
]

const SIN_DATOS_GRAFICO = 'Todavía no hay registros suficientes para este gráfico'

// Pantalla Resultados (T18, RES-01 a 05 y 07): pocas métricas claras sobre el impacto.
export default function Resultados() {
  // Los filtros van como texto, igual que en los <select>: '' quiere decir "todos".
  const [filtros, setFiltros] = useState({ lugar: '', isleta: '', periodo: 'todo', forma: '' })
  const [lugares, setLugares] = useState({ cargando: true })
  const [metricas, setMetricas] = useState({ cargando: true })
  const [intento, setIntento] = useState(0)
  const [grafico, setGrafico] = useState('altura')

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

  // Contexto de "Células plantadas": dónde están (el nombre del lugar filtrado, o cuántos lugares son).
  const listaLugares = lugares.datos?.lugares ?? []
  const lugarFiltrado = listaLugares.find((l) => String(l.id) === filtros.lugar)
  const dondeEstan = lugarFiltrado
    ? `en ${lugarFiltrado.nombre}`
    : `en ${listaLugares.length} ${listaLugares.length === 1 ? 'lugar' : 'lugares'}`

  return (
    <div className="flex flex-col gap-6 py-4">
      <Titulo nivel="lg">Resultados</Titulo>

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
          {/* RES-02: las 3 métricas principales (pendiente 4: las elige la clienta). En el celular,
              2 arriba y la tercera a todo el ancho. */}
          <section className="grid grid-cols-2 gap-3 md:grid-cols-3 [&>*:last-child]:col-span-2 md:[&>*:last-child]:col-span-1">
            <TarjetaMetrica icono="grid_view" nombre="Células plantadas" valor={m.celulasPlantadas} contexto={dondeEstan} />
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
          </section>

          {/* Señales de que el bosque se sostiene solo: florece, da frutos y aparecen plántulas nuevas.
              El backend ya las calculaba (GET /api/metricas). Van aparte de las principales,
              que elige la clienta (pendiente 4). */}
          <section className="flex flex-col gap-3">
            <Titulo nivel="md">El bosque se regenera</Titulo>
            {/* El ciclo en orden: florece, da frutos y nacen plántulas nuevas. */}
            <div className="grid grid-cols-2 gap-3 md:grid-cols-3 [&>*:last-child]:col-span-2 md:[&>*:last-child]:col-span-1">
              <TarjetaMetrica
                icono="filter_vintage"
                nombre="En floración"
                valor={m.individuosEnFloracion}
                unidad="%"
                contexto="de los individuos vivos"
              />
              <TarjetaMetrica
                icono="nutrition"
                nombre="Con frutos"
                valor={m.individuosConFrutos}
                unidad="%"
                contexto="de los individuos vivos"
              />
              <TarjetaMetrica
                icono="psychiatry"
                nombre="Plántulas nuevas"
                valor={m.celulasConPlantulas}
                unidad="%"
                contexto="de las células tienen plántulas que nacieron solas"
              />
            </div>
          </section>

          <section className="flex flex-col gap-3">
            <Titulo nivel="md">Supervivencia por forma de vida</Titulo>
            <SupervivenciaPorForma datos={m.supervivenciaPorForma} />
          </section>

          {/* RES-04 y RES-05: un solo gráfico de evolución, con un control para elegir qué se ve. */}
          <section className="flex flex-col gap-3">
            <Titulo nivel="md">Evolución</Titulo>
            <Tarjeta className="flex flex-col gap-3">
              <div className="flex w-fit flex-wrap rounded-full bg-segmento p-1" role="group" aria-label="Qué muestra el gráfico">
                {GRAFICOS.map((g) => (
                  <button
                    key={g.valor}
                    type="button"
                    aria-pressed={grafico === g.valor}
                    onClick={() => setGrafico(g.valor)}
                    className={`flex min-h-10 items-center gap-1 rounded-full px-4 text-label-md transition duration-150 ease-out focus-visible:outline-2 focus-visible:outline-bosque-hover ${
                      grafico === g.valor ? 'bg-superficie font-semibold text-bosque shadow-nivel-1' : 'text-texto-2'
                    }`}
                  >
                    <Icono nombre={g.icono} tamano="chico" />
                    {g.texto}
                  </button>
                ))}
              </div>
              {m.evolucion.length < 2 ? (
                <p className="py-8 text-center text-body-md text-texto-2">{SIN_DATOS_GRAFICO}</p>
              ) : grafico === 'altura' ? (
                <GraficoAltura
                  evolucion={m.evolucion}
                  formas={m.formasDeVida.filter((f) => !filtros.forma || String(f.formaDeVida) === filtros.forma)}
                />
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
