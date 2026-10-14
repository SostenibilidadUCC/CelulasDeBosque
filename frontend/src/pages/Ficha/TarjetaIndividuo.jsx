import ChipEstado from '../../components/ChipEstado.jsx'
import Icono from '../../components/Icono.jsx'
import Tarjeta from '../../components/Tarjeta.jsx'

// FIC-02: estado, altura actual y crecimiento desde el registro inicial de un individuo.
// "registros" viene ordenado del más viejo al más nuevo.
export default function TarjetaIndividuo({ individuo, registros }) {
  const valores = registros.map((r) => r.individuos.find((i) => i.formaDeVida === individuo.formaDeVida))
  const inicial = valores[0]
  const actual = valores.at(-1) // .at(-1) es el último elemento de la lista

  let estado = 'sin-datos'
  if (actual) estado = actual.vivo ? 'vivo' : 'muerto'

  const tieneAltura = actual?.vivo && actual.alturaCm != null
  const crecimiento = tieneAltura && inicial?.alturaCm != null ? actual.alturaCm - inicial.alturaCm : null

  return (
    <Tarjeta className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <Icono nombre={individuo.icono} className="text-bosque" />
        <h3 className="text-label-lg font-semibold text-texto">{individuo.nombre}</h3>
      </div>
      <div>
        <ChipEstado estado={estado} />
      </div>
      <p className="text-headline-md font-semibold text-bosque tabular-nums">
        {tieneAltura ? `${actual.alturaCm} cm` : '—'}
      </p>
      <p className="text-body-sm text-texto-2 tabular-nums">
        {crecimiento != null
          ? `${crecimiento >= 0 ? '+' : ''}${crecimiento} cm desde el registro inicial`
          : 'Sin altura este mes'}
      </p>
    </Tarjeta>
  )
}