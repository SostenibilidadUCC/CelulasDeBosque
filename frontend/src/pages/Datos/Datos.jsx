import { useCallback, useEffect, useState } from 'react'
import { descargarExcel, obtenerDatos, obtenerLugares } from '../../api.js'
import Boton from '../../components/Boton.jsx'
import Cargando from '../../components/Cargando.jsx'
import Icono from '../../components/Icono.jsx'
import MensajeError from '../../components/MensajeError.jsx'
import Titulo from '../../components/Titulo.jsx'
import Vacio from '../../components/Vacio.jsx'
import Buscador from '../Celulas/Buscador.jsx'
import Filtros from '../Resultados/Filtros.jsx'
import { rangoDelPeriodo } from '../Resultados/periodos.js'
import Tabla from './Tabla.jsx'

// Los filtros van como texto, igual que en Resultados: '' quiere decir "todos".
// Por defecto, desde la plantación y lo más reciente primero.
const FILTROS_INICIALES = { lugar: '', isleta: '', periodo: 'todo', forma: '', q: '', orden: 'periodo', dir: 'desc' }

// Lo que se le manda al backend: los filtros con el período pasado a desde/hasta.
// La tabla y el Excel usan exactamente lo mismo, así el Excel trae lo que se ve filtrado.
function armarPedido(filtros, periodoActual) {
  const { periodo, ...resto } = filtros
  return { ...resto, ...rangoDelPeriodo(periodo, periodoActual) }
}

// Pantalla Tabla de datos (T21, TAB-01, 03 a 05): los datos crudos de cada medición, una fila por
// individuo y registro, para filtrar, ordenar y descargar en Excel. La ven todos los roles con sesión.
export default function Datos() {
  const [filtros, setFiltros] = useState(FILTROS_INICIALES)
  const [pagina, setPagina] = useState(1)
  const [lugares, setLugares] = useState({ cargando: true })
  const [datos, setDatos] = useState({ cargando: true })
  const [intento, setIntento] = useState(0)

  // 1. Los lugares (con sus isletas) para los filtros, y el período actual (igual que Resultados).
  useEffect(() => {
    let cancelado = false
    obtenerLugares()
      .then((respuesta) => {
        if (!cancelado) setLugares({ datos: respuesta })
      })
      .catch((error) => {
        if (!cancelado) setLugares({ error })
      })
    return () => {
      cancelado = true
    }
  }, [intento])

  // 2. La página de datos, cada vez que cambia un filtro, el orden o la página.
  // "cancelado" evita que una respuesta vieja pise a la nueva.
  const periodoActual = lugares.datos?.periodo
  useEffect(() => {
    if (!periodoActual) return
    let cancelado = false
    obtenerDatos({ ...armarPedido(filtros, periodoActual), pagina })
      .then((respuesta) => {
        if (!cancelado) setDatos({ datos: respuesta })
      })
      .catch((error) => {
        if (!cancelado) setDatos({ error })
      })
    return () => {
      cancelado = true
    }
  }, [filtros, periodoActual, pagina, intento])

  // Al cambiar un filtro se vuelve a la página 1, y se muestran los datos anteriores más claros
  // hasta que llegan los nuevos. Si cambia el lugar, la isleta vuelve a "todas".
  function cambiarFiltros(cambio) {
    setFiltros((anteriores) => ({ ...anteriores, ...cambio, ...('lugar' in cambio ? { isleta: '' } : {}) }))
    setPagina(1)
    setDatos((anteriores) => ({ ...anteriores, cargando: true }))
  }

  // El Buscador vuelve a buscar si cambia esta función: por eso va con useCallback (la misma en cada render).
  const buscar = useCallback((q) => {
    setFiltros((anteriores) => ({ ...anteriores, q }))
    setPagina(1)
    setDatos((anteriores) => ({ ...anteriores, cargando: true }))
  }, [])

  // Tocar la columna que ya está ordenada invierte el sentido; tocar otra la ordena de menor a mayor.
  function ordenar(clave) {
    const dir = filtros.orden === clave && filtros.dir === 'asc' ? 'desc' : 'asc'
    cambiarFiltros({ orden: clave, dir })
  }

  function irAPagina(n) {
    setPagina(n)
    setDatos((anteriores) => ({ ...anteriores, cargando: true }))
  }

  function reintentar() {
    setLugares((anteriores) => (anteriores.datos ? anteriores : { cargando: true }))
    setDatos({ cargando: true })
    setIntento((n) => n + 1)
  }

  function limpiarFiltros() {
    setFiltros(FILTROS_INICIALES)
    setPagina(1)
    setDatos((anteriores) => ({ ...anteriores, cargando: true }))
  }

  const error = lugares.error ?? datos.error
  const d = datos.datos

  return (
    <div className="flex flex-col gap-6 py-4">
      <Titulo nivel="lg">Tabla de datos</Titulo>

      {lugares.datos && (
        <div className="flex flex-col gap-3">
          <Filtros
            filtros={filtros}
            lugares={lugares.datos.lugares}
            formasDeVida={d?.formasDeVida ?? []}
            onCambiar={cambiarFiltros}
          />
          <div className="grid grid-cols-1 items-end gap-3 md:grid-cols-[1fr_auto]">
            <Buscador inicial={filtros.q} onBuscar={buscar} etiqueta="Buscar por código" placeholder="A-1-45 o A-1-45-1" />
            {/* Mientras llegan los datos de un filtro nuevo, no se puede descargar: el Excel saldría
                de un filtro que todavía no se ve en la tabla. */}
            <BotonExcel
              pedido={armarPedido(filtros, periodoActual)}
              habilitado={!datos.cargando && (d?.total ?? 0) > 0}
            />
          </div>
        </div>
      )}

      {error ? (
        <MensajeError mensaje={error.message} onReintentar={reintentar} />
      ) : !d ? (
        <Cargando filas={5} />
      ) : d.total === 0 ? (
        <Vacio icono="table_chart" titulo="No hay datos con estos filtros" mensaje="Probá con otro período, lugar o código.">
          <Boton variante="secundario" icono="filter_alt_off" onClick={limpiarFiltros}>
            Limpiar filtros
          </Boton>
        </Vacio>
      ) : (
        <div className={`flex flex-col gap-3 transition-opacity ${datos.cargando ? 'opacity-50' : ''}`} aria-busy={datos.cargando}>
          <Tabla filas={d.filas} orden={filtros.orden} dir={filtros.dir} onOrdenar={ordenar} />
          <Paginacion pagina={d.pagina} total={d.total} porPagina={d.porPagina} onIr={irAPagina} />
        </div>
      )}
    </div>
  )
}

// TAB-05: descarga el Excel con lo filtrado (todas las páginas). Es la acción principal de la pantalla.
function BotonExcel({ pedido, habilitado }) {
  const [descargando, setDescargando] = useState(false)
  const [error, setError] = useState(null)

  async function descargar() {
    setDescargando(true)
    setError(null)
    try {
      const { archivo, nombre } = await descargarExcel(pedido)
      // Se arma un enlace al archivo en memoria y se lo "toca" para que el navegador lo guarde.
      const url = URL.createObjectURL(archivo)
      const enlace = document.createElement('a')
      enlace.href = url
      enlace.download = nombre
      enlace.click()
      // Se libera un segundo después: si se libera enseguida, Safari del iPhone a veces corta la descarga.
      setTimeout(() => URL.revokeObjectURL(url), 1000)
    } catch (e) {
      setError(e.message)
    } finally {
      setDescargando(false)
    }
  }

  return (
    <div className="flex flex-col gap-1">
      <Boton icono="download" cargando={descargando} textoCargando="Armando el Excel…" disabled={!habilitado} onClick={descargar} className="md:w-auto">
        Descargar Excel
      </Boton>
      {error && (
        <p role="alert" className="flex items-center gap-1 text-body-sm text-error-texto">
          <Icono nombre="error" tamano="chico" />
          {error}
        </p>
      )}
    </div>
  )
}

// TAB-01: de a 50 filas. "Página 2 de 7 · 312 filas", con Anterior y Siguiente.
function Paginacion({ pagina, total, porPagina, onIr }) {
  const paginas = Math.max(1, Math.ceil(total / porPagina))
  return (
    <nav aria-label="Páginas de la tabla" className="flex flex-col items-center gap-3 sm:flex-row sm:justify-between">
      <p className="text-body-sm text-texto-2 tabular-nums">
        Página {pagina} de {paginas} · {total.toLocaleString('es-AR')} {total === 1 ? 'fila' : 'filas'}
      </p>
      {/* flex-1: en el celular los dos botones se reparten la fila (cada Boton trae w-full). */}
      <div className="flex w-full gap-3 sm:w-auto">
        <Boton variante="secundario" icono="chevron_left" disabled={pagina <= 1} onClick={() => onIr(pagina - 1)} className="flex-1 sm:w-auto sm:flex-none">
          Anterior
        </Boton>
        <Boton variante="secundario" disabled={pagina >= paginas} onClick={() => onIr(pagina + 1)} className="flex-1 sm:w-auto sm:flex-none">
          Siguiente
          <Icono nombre="chevron_right" />
        </Boton>
      </div>
    </nav>
  )
}
