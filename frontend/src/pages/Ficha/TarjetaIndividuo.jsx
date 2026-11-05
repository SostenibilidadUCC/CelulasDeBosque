import ChipEstado from '../../components/ChipEstado.jsx'
import Icono from '../../components/Icono.jsx'
import Tarjeta from '../../components/Tarjeta.jsx'

// FIC-02: altura actual y crecimiento desde el registro inicial de un individuo.
// El chip solo aparece si está muerto: vivo es lo normal y no hace falta decirlo.
// "registros" viene ordenado del más viejo al más nuevo.
export default function TarjetaIndividuo({ individuo, registros }) {
  const valores = registros.map((r) => r.individuos.find((i) => i.formaDeVida === individuo.formaDeVida))
  const inicial = valores[0]
  const actual = valores.at(-1) // .at(-1) es el último elemento de la lista
  const muerto = actual?.vivo === false

  const tieneAltura = actual?.vivo && actual.alturaCm != null
  // Con un solo registro no hay crecimiento que mostrar (sería "+0 cm").
  const crecimiento =
    tieneAltura && valores.length > 1 && inicial?.alturaCm != null ? actual.alturaCm - inicial.alturaCm : null

  return (
    <Tarjeta className={`flex flex-col gap-2 ${muerto ? 'bg-gris-suave' : ''}`}>
      <div className="flex items-center gap-2">
        <Icono nombre={individuo.icono} className={muerto ? 'text-texto-3' : 'text-bosque'} />
        <h3 className="text-label-lg font-semibold text-texto">{individuo.nombre}</h3>
      </div>
      {muerto ? (
        <div>
          <ChipEstado estado="muerto" />
        </div>
      ) : (
        <>
          <p className="text-headline-md font-semibold text-bosque tabular-nums">
            {tieneAltura ? `${actual.alturaCm} cm` : '—'}
          </p>
          {crecimiento != null && (
            <p className="text-body-sm text-texto-2 tabular-nums">
              {crecimiento >= 0 ? '+' : ''}
              {crecimiento} cm desde el inicio
            </p>
          )}
        </>
      )}
    </Tarjeta>
  )
}
