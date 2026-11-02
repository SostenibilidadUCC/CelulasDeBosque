import Boton from '../../components/Boton.jsx'
import ChipEstado from '../../components/ChipEstado.jsx'
import Icono from '../../components/Icono.jsx'
import Tarjeta from '../../components/Tarjeta.jsx'
import { describirPermisos, formatearFecha, grupoDe } from './textos.js'

const chips = { esperando: 'esperando-aprobacion', 'con-acceso': 'con-acceso', 'sin-acceso': 'sin-acceso' }

// Una tarjeta por persona: quién es, qué puede hacer y los botones para cambiarlo.
// No decide nada: avisa con onAprobar, onCambiar, onQuitar y onDevolver y Usuarios.jsx hace el resto.
export default function TarjetaUsuario({ usuario, esYo, ocupado, onAprobar, onCambiar, onQuitar, onDevolver }) {
  const grupo = grupoDe(usuario)

  return (
    <Tarjeta className={`flex flex-col gap-3 ${grupo === 'esperando' ? 'border-pendiente-borde' : ''}`}>
      <div className="flex flex-col gap-1">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-headline-sm font-semibold text-texto">
            {usuario.nombre}
            {esYo && <span className="ml-2 text-body-md font-normal text-texto-2">(vos)</span>}
          </h3>
          <ChipEstado estado={chips[grupo]} />
        </div>
        <p className="break-all text-body-md text-texto-2">{usuario.email}</p>
        {usuario.institucion && (
          <p className="flex items-center gap-1 text-body-md text-texto-2">
            <Icono nombre="school" tamano="chip" />
            {usuario.institucion}
          </p>
        )}
        <p className="text-body-md font-medium text-texto">
          {grupo === 'esperando' ? `Pidió acceso el ${formatearFecha(usuario.creadoEn)}` : describirPermisos(usuario)}
        </p>
      </div>

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {grupo === 'esperando' && (
          <Boton variante="tonal" icono="how_to_reg" disabled={ocupado} onClick={() => onAprobar(usuario)}>
            Aprobar
          </Boton>
        )}
        {grupo === 'con-acceso' && (
          <>
            <Boton variante="secundario" icono="tune" disabled={ocupado} onClick={() => onCambiar(usuario)}>
              Cambiar permisos
            </Boton>
            {!esYo && (
              <Boton variante="peligro" icono="block" disabled={ocupado} onClick={() => onQuitar(usuario)}>
                Quitar acceso
              </Boton>
            )}
          </>
        )}
        {grupo === 'sin-acceso' && (
          <>
            <Boton variante="secundario" icono="tune" disabled={ocupado} onClick={() => onCambiar(usuario)}>
              Cambiar permisos
            </Boton>
            <Boton variante="tonal" icono="lock_open" disabled={ocupado} onClick={() => onDevolver(usuario)}>
              Devolver acceso
            </Boton>
          </>
        )}
      </div>
    </Tarjeta>
  )
}
